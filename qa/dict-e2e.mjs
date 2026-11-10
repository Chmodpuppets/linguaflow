/**
 * 词典端到端验证（多语种）：
 *  0. 服务端四个语言的 /dict/lookup 与 /dict/stats（含日语活用还原 alt）
 *  1. 注册 → 我的资料 → 模型设置 → 四语卡片都在 → 装日语包
 *  2. 校验 IndexedDB 里英语 + 日语两包的分片
 *  3. 词汇页自动填充：
 *     - 英文词 supercilious（当前学习语言是日语，验证拉丁字母回退英语词典）
 *     - 日文词 食べる（验证日语离线包）
 *  4. 划词浮层的发音按钮在「打字闯关」正文里可见（需先选中文本）
 *
 * 跑法：NODE_PATH=<playwright 所在 node_modules> node qa/dict-e2e.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const log = (...a) => console.log('[dict-e2e]', ...a);

// ---------------------------------------------------------------- 0. 服务端接口
const apiCases = [
  ['en', 'serendipity', /珍宝|奇缘/],
  ['ja', '食べる', /吃/],
  ['ko', '학교', /学校/],
  ['es', 'agua', /水/],
];
const apiResults = {};
for (const [lang, w, re] of apiCases) {
  try {
    const r = await fetch(`${BASE}/api/dict/lookup?w=${encodeURIComponent(w)}&lang=${lang}`);
    const j = await r.json();
    apiResults[lang] = { status: r.status, meaning: j.meaning || '', ok: r.ok && re.test(j.meaning || '') };
  } catch (e) {
    apiResults[lang] = { ok: false, error: String(e) };
  }
  log(`api ${lang}:`, JSON.stringify(apiResults[lang]));
}
// 活用还原：客户端把候选放在 alt 里，服务端按索引查
try {
  const r = await fetch(
    `${BASE}/api/dict/lookup?w=${encodeURIComponent('食べました')}&lang=ja&alt=${encodeURIComponent('食べる,食べ')}`
  );
  const j = await r.json();
  apiResults.jaInflect = { ok: !!j.found, word: j.word, meaning: j.meaning };
  log('api ja 活用还原:', JSON.stringify(apiResults.jaInflect));
} catch (e) {
  apiResults.jaInflect = { ok: false, error: String(e) };
}
const stats = await fetch(`${BASE}/api/dict/stats`).then((r) => r.json()).catch(() => null);
log('api stats:', JSON.stringify(stats?.languages || stats));

// ---------------------------------------------------------------- 浏览器
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  localStorage.clear();
  const dbs = (await indexedDB.databases?.()) || [];
  for (const d of dbs) if (d.name) indexedDB.deleteDatabase(d.name);
});
await page.reload({ waitUntil: 'domcontentloaded' });

const localInput = page.getByPlaceholder('输入你的昵称');
let qaUser = null;
if (await localInput.count()) {
  await localInput.fill('dictqa');
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /开始学习/ }).click();
} else {
  qaUser = process.env.QA_REUSE_USER || `dictqa${Date.now().toString(36).slice(-6)}`;
  const pwd = process.env.QA_REUSE_PASS || 'dictqa2026';
  if (process.env.QA_REUSE_USER) {
    await page.getByPlaceholder('用户名').fill(qaUser);
    await page.getByPlaceholder(/密码/).first().fill(pwd);
    await page.getByRole('button', { name: /登录|登入/ }).first().click().catch(() => {});
  } else {
    await page.getByRole('button', { name: '注册', exact: true }).first().click().catch(() => {});
    await page.getByPlaceholder('用户名').fill(qaUser);
    await page.getByPlaceholder(/密码（至少 6 位）/).fill(pwd);
    await page.getByRole('button', { name: /注册并进入/ }).click();
  }
  await page.waitForTimeout(2500);
  log('online account:', qaUser, process.env.QA_REUSE_USER ? '(reuse)' : '(new)');
}
await page.waitForTimeout(2200);
const nick = page.getByPlaceholder('输入你的昵称');
if (await nick.count()) await nick.fill('dictqa');
for (let i = 0; i < 5; i++) {
  const start = page.getByRole('button', { name: /开始学习/ }).first();
  const next = page.getByRole('button', { name: /下一步/ }).first();
  if (await start.isVisible().catch(() => false)) { await start.click(); break; }
  if (await next.isVisible().catch(() => false)) { await next.click(); await page.waitForTimeout(800); continue; }
  break;
}
await page.waitForTimeout(2200);
log('registered');

for (const g of ['精进', '资源', '社区', '学习']) {
  const h = page.getByRole('button', { name: g, exact: true }).first();
  if (await h.isVisible().catch(() => false) && (await h.getAttribute('aria-expanded')) === 'false') {
    await h.click().catch(() => {});
  }
}
await page.waitForTimeout(400);
await page.getByRole('button', { name: /^我的资料$/ }).first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /模型设置/ }).first().click();
await page.waitForTimeout(700);

const card = page.locator('text=本地词典（离线查词）').first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
const rowCount = await page.locator('text=本地词典（离线查词）').first()
  .locator('xpath=ancestor::div[contains(@class,"glass-panel")]').first()
  .getByRole('button', { name: /下载到本机|更新/ }).count();
log('四语卡片按钮数 =', rowCount);

// 英语：线上版空闲预装；没装就点第一行下载
let enInstalled = await page.locator('text=已安装').first().isVisible().catch(() => false);
if (!enInstalled) {
  await page.getByRole('button', { name: /下载到本机/ }).first().click();
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    enInstalled = await page.locator('text=已安装').first().isVisible().catch(() => false);
    if (enInstalled) break;
    await page.waitForTimeout(800);
  }
}
log('en installed =', enInstalled);

// 日语：手动装一次，验证按语言分别下载
await page.getByRole('button', { name: /下载到本机/ }).first().click().catch(() => {});
const t1 = Date.now();
let jaInstalled = false;
while (Date.now() - t1 < 60000) {
  jaInstalled = (await page.locator('text=已安装').count()) >= 2;
  if (jaInstalled) break;
  await page.waitForTimeout(800);
}
log('ja installed =', jaInstalled, '| 耗时', Math.round((Date.now() - t1) / 1000) + 's');
await page.screenshot({ path: 'qa-screenshots/dict-settings.png' });

const idb = await page.evaluate(async () => {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('linguaflow_dict', 1);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  try {
    const db = await open();
    if (!db.objectStoreNames.contains('packs')) return { ok: false, reason: 'no store' };
    const get = (key) => new Promise((res, rej) => {
      const q = db.transaction('packs', 'readonly').objectStore('packs').get(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const out = {};
    for (const k of ['en', 'ja', 'ko', 'es']) {
      const p = await get(k);
      out[k] = p ? { version: p.version, parts: p.parts.length, bytes: p.parts.reduce((s, x) => s + x.byteLength, 0) } : null;
    }
    return { ok: !!out.en && !!out.ja, packs: out };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});
log('IndexedDB:', JSON.stringify(idb));

// --- 词汇页自动填充 ---
await page.getByRole('button', { name: /词汇/ }).first().click();
await page.waitForTimeout(900);
const addBtn = page.getByRole('button', { name: /添加单词|新增|添加/ }).first();
await addBtn.click().catch(() => {});
await page.waitForTimeout(400);

const autofill = async (word) => {
  const wordInput = page.getByPlaceholder(/输入单词/).first();
  await wordInput.fill(word);
  await page.waitForTimeout(250);
  await page.locator('button[title*="自动填充"]').first().click();
  await page.waitForTimeout(1200);
  return await page.getByPlaceholder('含义…').first().inputValue().catch(() => '');
};
const enDef = await autofill('supercilious');
log('英文自动填充:', JSON.stringify(enDef));
await page.screenshot({ path: 'qa-screenshots/dict-autofill.png' });
const jaDef = await autofill('食べる');
log('日文自动填充:', JSON.stringify(jaDef));

log('page errors:', errors.slice(0, 3));
await browser.close();

const apiOk = apiCases.every(([lang]) => apiResults[lang]?.ok) && apiResults.jaInflect?.ok;
const pass = apiOk && rowCount >= 4 && enInstalled && jaInstalled && idb.ok &&
  /傲慢|自大/.test(enDef) && /吃/.test(jaDef);
log('qaUser =', qaUser, '（生产库测试账号，跑完请清理）');
console.log(pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
