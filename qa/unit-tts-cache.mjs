// TTS 缓存单测：打包真实 aiService + ttsCache，mock Qwen 端点，验证「同一段文本只合成一次」。
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const out = path.join(here, '.tmp-tts-ai.cjs');
// 必须用同一个 bundle：分别打包会让 aiService 和 ttsCache 各持有一份独立的 Map
buildSync({
  stdin: {
    contents: `export * from './services/aiService.ts'; export * as TTSC from './services/ttsCache.ts'; export * as BLOBC from './services/ttsBlobCache.ts';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
});

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
// 假 Qwen 端点：只有 multimodal-generation 算「合成调用」；
// persistTtsAudio 后续抓音频内容是另一类请求，不计入合成次数。
let fetchCount = 0;
const calls = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('data:') || u.startsWith('https://cdn.test/')) {
    return { ok: true, status: 200, blob: async () => new Blob(['fake-audio'], { type: 'audio/wav' }) };
  }
  fetchCount++;
  calls.push({ url: u, body: JSON.parse(init?.body || '{}') });
  return {
    ok: true,
    status: 200,
    json: async () => ({ output: { audio: { url: `https://cdn.test/tts-${fetchCount}.mp3` } } }),
    text: async () => '',
  };
};

const BUNDLE = require(out);
const AI = BUNDLE;
const CACHE = BUNDLE.TTSC;
fs.unlinkSync(out);

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

mem.clear();
localStorage.setItem('linguaflow_ai_config', JSON.stringify({
  active: 'glm', qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-flash', apiKey: 'QA_FAKE_QWEN_KEY' },
}));
localStorage.setItem('linguaflow_ai_consent_v1', 'granted');

// 1) 同一个韩语词点两次 → 只打一次 Qwen
const u1 = await AI.fetchSpeechUrl('오늘');
const u2 = await AI.fetchSpeechUrl('오늘');
console.log('1) 两次结果:', u1, '/', u2, '| fetch 次数:', fetchCount);
u1 === u2 && fetchCount === 1 ? ok('同一韩语词第二次命中缓存，0 次 API 调用') : bad('同词重复请求');

// 2) 不同词 → 新请求
const u3 = await AI.fetchSpeechUrl('내일');
console.log('2) 新词:', u3, '| fetch 次数:', fetchCount);
u3 && u3 !== u1 && fetchCount === 2 ? ok('不同词正常重新合成') : bad('不同词缓存串味');

// 3) 缓存 key 与「实际生效音色」一致（URL 失效时才能删对）
const voice = AI.getEffectiveTtsVoice();
console.log('3) 生效音色:', voice, '| 缓存命中:', CACHE.getCachedTtsUrl('오늘', voice));
CACHE.getCachedTtsUrl('오늘', voice) === u1 ? ok('UI 层用 getEffectiveTtsVoice 能命中底层写入的条目') : bad('缓存 key 不一致');
CACHE.deleteCachedTtsUrl('오늘', voice);
CACHE.getCachedTtsUrl('오늘', voice) === null ? ok('失效条目可被正确删除') : bad('删不掉死链');

// 4) 关掉 AI 授权后：命中缓存仍可重播，未缓存文本不再发请求
localStorage.setItem('linguaflow_ai_consent_v1', 'denied');
const before = fetchCount;
const u4 = await AI.fetchSpeechUrl('내일'); // 已缓存
const u5 = await AI.fetchSpeechUrl('모레'); // 未缓存 → 授权拦住，回落 null
console.log('4) 关闭授权后:', { cached: u4, fresh: u5, newCalls: fetchCount - before });
u4 && fetchCount === before ? ok('关闭 AI 后仍可重播已合成音频，且零新请求') : bad('缓存重播异常');
u5 === null && fetchCount === before ? ok('未缓存文本被授权闸门拦住，不发 Qwen 请求') : bad('关闭授权后仍在请求 Qwen');

// 5) 重新开启授权 → 恢复正常合成
localStorage.setItem('linguaflow_ai_consent_v1', 'granted');
const u6 = await AI.fetchSpeechUrl('모레');
console.log('5) 重新授权后:', u6, '| fetch 次数:', fetchCount);
u6 && fetchCount === before + 1 ? ok('重新开启后正常合成') : bad('重新授权后异常');

// 6) 环境没有 IndexedDB（Node / 隐私模式）时必须优雅降级，不能阻断播放
const stats = await AI.BLOBC.getTtsBlobStats();
console.log('6) 无 IndexedDB 时统计:', JSON.stringify(stats));
stats.count === 0 && stats.bytes === 0 ? ok('IndexedDB 不可用时静默降级到内存缓存') : bad('降级逻辑异常');
const u7 = await AI.fetchSpeechUrl('오늘');
u7 ? ok('降级环境下播放链路仍可用') : bad('降级后播放失败');

tmpCleanup();
function tmpCleanup() {
  for (const f of [path.join(here, '.tmp-tts-ai.cjs'), path.join(here, '.tmp-tts-cache.cjs')]) {
    try { fs.unlinkSync(f); } catch {}
  }
}
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
