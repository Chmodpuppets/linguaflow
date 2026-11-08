import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const U = process.env.U || 'qa_ls817363';
const P = process.env.P || 'qa-test-123456';
// MOCK=url → 模拟真实 Qwen：只返回 OSS URL，且 CDN 不给 CORS（抓 Blob 失败 → URL 兜底）
// 默认 MOCK=blob → 返回 data: URL，能抓成 Blob 落盘
const MOCK = process.env.MOCK === 'url' ? 'url' : 'blob';
// 44 字节静音 WAV，作为 data: URL 返回，避免假音频 URL 触发额外网络请求
const SILENT_WAV = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
console.log('模式:', MOCK === 'url' ? '真实 Qwen（OSS URL + CDN 无 CORS → URL 兜底）' : 'data: URL → Blob 落盘');
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
};

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

const b = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  [pageerror]', e.message));

let synthCalls = 0;
// MOCK=url 时让 CDN 请求直接失败，模拟浏览器被 CORS 拦截（抓不到 Blob）
if (MOCK === 'url') {
  await ctx.route('https://cdn.test/**', async (route) => { await route.abort(); });
}
await ctx.route('**/multimodal-generation/**', async (route) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS });
    return;
  }
  synthCalls++;
  const audio = MOCK === 'url'
    ? { url: `https://cdn.test/tts-${synthCalls}.mp3`, expires_at: Math.floor(Date.now() / 1000) + 86400 }
    : { data: SILENT_WAV };
  await route.fulfill({
    status: 200, contentType: 'application/json', headers: CORS,
    body: JSON.stringify({ output: { audio } }),
  });
});

// 直接注入本地登录态，绕开服务端登录限流（1h/10 次）——本用例不依赖社区账号。
// addInitScript 在每次导航都会跑，所以写成「不存在才写」，避免覆盖用例中途的 seed。
const today = new Date().toISOString().slice(0, 10);
const now = Date.now();
await p.addInitScript(({ user, cfg, vocab }) => {
  localStorage.setItem('linguaflow_sync_token', 'QA_E2E_TOKEN');
  localStorage.setItem('linguaflow_ai_consent_v1', 'granted');
  if (!localStorage.getItem('linguaflow_user')) localStorage.setItem('linguaflow_user', JSON.stringify(user));
  if (!localStorage.getItem('linguaflow_ai_config')) localStorage.setItem('linguaflow_ai_config', JSON.stringify(cfg));
  if (!localStorage.getItem('linguaflow_vocabulary')) localStorage.setItem('linguaflow_vocabulary', JSON.stringify(vocab));
}, {
  user: {
    username: 'qa', nativeLanguage: 'Chinese', learningLanguage: 'Korean',
    progress: { Korean: { xp: 0, level: 1, cefrLevel: 'A1', totalWordsTyped: 0, lastActive: now, maxUnlockedStage: 0 } },
    currentStreak: 1, maxStreak: 1, streakShields: 1, premium: false,
    dailyQuests: [], lastQuestDate: today, lastStreakDate: today, lastActiveDate: today,
    preferredTopics: [], aiMemory: { goals: [], weakPoints: [], interests: [], notes: '' },
  },
  cfg: {
    active: 'glm',
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-flash', apiKey: 'QA_FAKE_QWEN_KEY' },
  },
  vocab: [
    { id: 'ko-1', word: '오늘', definition: '今天', exampleSentence: '오늘은 날씨가 좋아요.', partOfSpeech: '名词', language: 'Korean', createdAt: now, box: 1, dueDate: now, reviews: 0, lapses: 0 },
    { id: 'ko-2', word: '내일', definition: '明天', exampleSentence: '내일은 쉬어요.', partOfSpeech: '名词', language: 'Korean', createdAt: now, box: 1, dueDate: now, reviews: 0, lapses: 0 },
  ],
});

await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2600);
await p.locator('aside').waitFor({ timeout: 15000 });
// 从干净环境起跑，避免上次运行残留的 Blob 影响合成计数
await p.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase('linguaflow-tts');
  req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
}));

await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2600);

await p.getByRole('button', { name: /^词汇$/ }).first().click();
await p.waitForTimeout(1500);
const speakBtns = p.getByTitle('朗读单词');
const btnCount = await speakBtns.count();
console.log('0) 词库发音按钮数:', btnCount);
btnCount === 2 ? ok('两个韩语词都有发音入口') : bad(`按钮数 ${btnCount} ≠ 2`);

// 1) 同一个词连点 3 次 → 只合成 1 次
for (let i = 0; i < 3; i++) {
  await speakBtns.nth(0).click();
  await p.waitForTimeout(700);
}
console.log('1) 同词点 3 次后的 Qwen 合成次数:', synthCalls);
synthCalls === 1 ? ok('同一韩语词重复点播只打 1 次 Qwen（命中缓存）') : bad(`合成 ${synthCalls} 次，缓存未生效`);

// 2) 换一个词 → 新请求
await speakBtns.nth(1).click();
await p.waitForTimeout(900);
console.log('2) 换词后:', synthCalls);
synthCalls === 2 ? ok('不同词正常重新合成') : bad(`换词后合成次数 ${synthCalls} ≠ 2`);

// 3) 切回第一个词 → 仍然命中
await speakBtns.nth(0).click();
await p.waitForTimeout(700);
console.log('3) 切回第一个词:', synthCalls);
synthCalls === 2 ? ok('来回切换仍复用缓存') : bad('来回切换重复合成');

await p.screenshot({ path: 'qa-screenshots/shot-tts-cache.png' });

// 4) 刷新页面 → IndexedDB Blob 仍命中，0 次新合成
// 先等后台落盘完成（persistTtsAudio 是 fire-and-forget，不阻塞播放）
await p.waitForTimeout(1200);
const recs = await p.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('linguaflow-tts', 1);
  req.onsuccess = () => {
    const db = req.result;
    const all = db.transaction('audio', 'readonly').objectStore('audio').getAll();
    all.onsuccess = () => resolve(all.result.map((r) => ({ hasBlob: !!r.blob, hasUrl: !!r.url, expiresAt: r.expiresAt })));
    all.onerror = () => resolve([]);
  };
  req.onerror = () => resolve([]);
}));
console.log('4) IndexedDB 记录:', JSON.stringify(recs));
recs.length >= 2 ? ok('音频已持久化到 IndexedDB') : bad(`落盘条数 ${recs.length} < 2`);
if (MOCK === 'url') {
  recs.every((r) => r.hasUrl && !r.hasBlob && r.expiresAt > Date.now())
    ? ok('CDN 无 CORS 时正确退存「URL + expires_at」') : bad('URL 兜底未生效');
} else {
  recs.every((r) => r.hasBlob) ? ok('可抓取时存的是 Blob（永不过期）') : bad('Blob 落盘异常');
}

await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2600);
await p.getByRole('button', { name: /^词汇$/ }).first().click();
await p.waitForTimeout(1500);
await p.getByTitle('朗读单词').nth(0).click();
await p.waitForTimeout(900);
console.log('   刷新后再点第一个词的合成次数:', synthCalls);
synthCalls === 2
  ? ok(`刷新后 0 次 Qwen 调用（跨会话命中${MOCK === 'url' ? '持久化 URL' : 'Blob'}）`)
  : bad(`刷新后合成次数 ${synthCalls} ≠ 2`);

// 5) 清掉 IndexedDB 作对照：应重新合成，证明命中的确实是 Blob 而非别的缓存
await p.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase('linguaflow-tts');
  req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
}));
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2600);
await p.getByRole('button', { name: /^词汇$/ }).first().click();
await p.waitForTimeout(1500);
await p.getByTitle('朗读单词').nth(0).click();
await p.waitForTimeout(900);
console.log('5) 清库后再点:', synthCalls);
synthCalls === 3 ? ok('清库后重新合成（对照成立）') : bad(`清库后合成次数 ${synthCalls} ≠ 3`);

await b.close();
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
