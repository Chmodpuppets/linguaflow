// 服务端 TTS 缓存层单测：打包真实 services/ttsServerCache.ts，对着契约桩服务验证
// 「地址拼装 / 命中取字节 / 未命中返回 null / 未登录降级」四件事。
// 服务端端点本身的行为由手动联调覆盖（见 docs/ai-voice.md），这里只钉住前端这一半。
import { buildSync } from 'esbuild';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(here, '.tmp-tts-server.cjs');

const PORT = 18799;
const HIT_TEXT = 'おはよう';
const HIT_VOICE = 'Cherry';
const AUDIO = Buffer.from('fake-mp3-bytes-0123456789');

// —— 契约桩：实现真实的 GET/POST /tts/audio 语义 ——
const seen = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  seen.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: req.headers.authorization });
  if (req.headers.authorization !== 'Bearer test-token') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end('{"error":"unauthorized"}');
  }
  if (url.pathname !== '/tts/audio') {
    res.writeHead(404);
    return res.end();
  }
  if (req.method === 'GET') {
    const hit = url.searchParams.get('text') === HIT_TEXT && url.searchParams.get('voice') === HIT_VOICE;
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end('{"error":"not cached"}');
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': AUDIO.length });
    return res.end(AUDIO);
  }
  // POST：读 body，确认带 text/voice/src，回字节 + X-Tts-Stored
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    seen[seen.length - 1].body = body;
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'X-Tts-Stored': '1' });
    res.end(AUDIO);
  });
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// —— 打包真实源码，把服务器地址塞进 process.env.COMMUNITY_URL ——
buildSync({
  stdin: {
    contents: `export * from './services/ttsServerCache.ts'; export * from './services/serverBridge.ts';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent',
  define: {
    'import.meta.env': '{}',
    'process.env.COMMUNITY_URL': JSON.stringify(`http://127.0.0.1:${PORT}`),
  },
});

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const M = await import(`file://${out}?t=${Date.now()}`);

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

// ① 未登录：整体降级，不发任何请求
mem.clear();
check('未登录时 isTtsServerEnabled = false', M.isTtsServerEnabled() === false);
const before = seen.length;
const noAuthBlob = await M.fetchTtsFromServer(HIT_TEXT, HIT_VOICE);
check('未登录时 fetchTtsFromServer 返回 null', noAuthBlob === null);
check('未登录时不发请求', seen.length === before);

// ② 登录后：地址拼装要正确编码（中文 / 特殊字符）
mem.set('linguaflow_sync_token', 'test-token');
check('登录后 isTtsServerEnabled = true', M.isTtsServerEnabled() === true);
const url = M.serverTtsUrl('日本語 & test/1', 'Cherry');
check('地址对中文做了 encodeURIComponent', url.includes(encodeURIComponent('日本語 & test/1')), url);
check('地址指向 /tts/audio', url.includes('/tts/audio?'));

// ③ 未命中 → null（服务端 404 是设计内结果）
const miss = await M.fetchTtsFromServer('没合成过的句子', HIT_VOICE);
check('未命中返回 null', miss === null);
check('请求带上了 Bearer token', seen[seen.length - 1].auth === 'Bearer test-token');

// ④ 命中 → 拿到字节
const hit = await M.fetchTtsFromServer(HIT_TEXT, HIT_VOICE);
check('命中返回 Blob', hit instanceof Blob);
check('字节完全一致', Buffer.from(await hit.arrayBuffer()).equals(AUDIO));

// ⑤ 推送：POST 带上 text/voice/src，回字节
const pushed = await M.pushTtsToServer(HIT_TEXT, HIT_VOICE, { src: 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/x.mp3' });
const last = seen[seen.length - 1];
check('push 走 POST', last.method === 'POST');
check('push body 带 text / voice / src', last.body?.text === HIT_TEXT && last.body?.voice === HIT_VOICE && !!last.body?.src);
check('push 返回音频字节', pushed instanceof Blob && Buffer.from(await pushed.arrayBuffer()).equals(AUDIO));

// ⑥ 空参数不发请求（避免无意义 400）
const b = seen.length;
check('空 text 直接返回 null', (await M.pushTtsToServer('', HIT_VOICE, { src: 'x' })) === null);
check('没有 src/data 直接返回 null', (await M.pushTtsToServer(HIT_TEXT, HIT_VOICE, {})) === null);
check('以上两种情况都没发请求', seen.length === b);

server.close();
try { fs.unlinkSync(out); } catch {}

console.log(`\nTTS 服务端缓存单测：${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
