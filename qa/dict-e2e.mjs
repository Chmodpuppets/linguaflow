/**
 * 词典端到端验证：
 *  1. 注册本地用户 → 进「我的资料 → 模型设置」
 *  2. 确认「本地词典」卡显示已安装（线上版会空闲预装；没有就点下载）
 *  3. 校验 IndexedDB 里确实存了分片
 *  4. 去词汇页新增一个生词，点「自动填充」，确认释义来自词典而非 AI
 *
 * 跑法：node qa/dict-e2e.mjs（需 NODE_PATH 指向 playwright 所在目录，或用项目内 node_modules）
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const log = (...a) => console.log('[dict-e2e]', ...a);

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

// --- 注册（线上版走 AuthGate：用户名 + 密码；自部署版走本地昵称流程） ---
const localInput = page.getByPlaceholder('输入你的昵称');
if (await localInput.count()) {
  await localInput.fill('dictqa');
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /开始学习/ }).click();
} else {
  const name = `dictqa${Date.now().toString(36).slice(-5)}`;
  await page.getByRole('button', { name: '注册', exact: true }).first().click().catch(() => {});
  await page.getByPlaceholder('用户名').fill(name);
  await page.getByPlaceholder(/密码（至少 6 位）/).fill('dictqa2026');
  await page.getByRole('button', { name: /注册并进入/ }).click();
  await page.waitForTimeout(2500);
  log('online register as', name);
}
await page.waitForTimeout(2500);
// 注册后还有引导（昵称 → 母语 → 目标语/等级 → 开始学习）
const nick = page.getByPlaceholder('输入你的昵称');
if (await nick.count()) await nick.fill('dictqa');
for (let i = 0; i < 5; i++) {
  const start = page.getByRole('button', { name: /开始学习/ }).first();
  const next = page.getByRole('button', { name: /下一步/ }).first();
  if (await start.isVisible().catch(() => false)) { await start.click(); break; }
  if (await next.isVisible().catch(() => false)) { await next.click(); await page.waitForTimeout(800); continue; }
  break;
}
await page.waitForTimeout(2500);
log('registered');

// --- 我的资料 → 模型设置 ---
// 侧栏分组默认折叠：先把「精进 / 资源 / 社区」都展开，再点「我的资料」
for (const g of ['精进', '资源', '社区', '学习']) {
  const h = page.getByRole('button', { name: g, exact: true }).first();
  if (await h.isVisible().catch(() => false)) {
    const expanded = await h.getAttribute('aria-expanded');
    if (expanded === 'false') await h.click().catch(() => {});
  }
}
await page.waitForTimeout(400);
await page.getByRole('button', { name: /^我的资料$/ }).first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /模型设置/ }).first().click();
await page.waitForTimeout(600);

const card = page.locator('text=本地词典（离线查词）').first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

let installed = await page.locator('text=已安装').first().isVisible().catch(() => false);
if (!installed) {
  log('未安装，点「下载到本机」');
  await page.getByRole('button', { name: /下载到本机/ }).click();
}
// 等下载完成（最多 60s）
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  installed = await page.locator('text=已安装').first().isVisible().catch(() => false);
  if (installed) break;
  await page.waitForTimeout(800);
}
const cardText = await page.locator('text=本地词典（离线查词）').first().locator('xpath=ancestor::div[1]').innerText().catch(() => '');
log('installed =', installed, '| 耗时', Math.round((Date.now() - t0) / 1000) + 's');

const idb = await page.evaluate(async () => {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('linguaflow_dict', 1);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  try {
    const db = await open();
    if (!db.objectStoreNames.contains('packs')) return { ok: false, reason: 'no store' };
    const pack = await new Promise((res, rej) => {
      const tx = db.transaction('packs', 'readonly');
      const q = tx.objectStore('packs').get('en');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    return pack ? { ok: true, version: pack.version, parts: pack.parts.length, bytes: pack.parts.reduce((s, p) => s + p.byteLength, 0) } : { ok: false, reason: 'empty' };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});
log('IndexedDB:', JSON.stringify(idb));

await page.screenshot({ path: 'qa-screenshots/dict-settings.png' });

// --- 词汇页：自动填充应来自词典 ---
await page.getByRole('button', { name: /词汇/ }).first().click();
await page.waitForTimeout(900);
const addBtn = page.getByRole('button', { name: /添加单词|新增|添加/ }).first();
await addBtn.click().catch(() => {});
await page.waitForTimeout(500);
const wordInput = page.getByPlaceholder(/输入单词/).first();
await wordInput.fill('supercilious');
await page.waitForTimeout(300);
const sparkle = page.locator('button[title*="自动填充"]').first();
await sparkle.click();
await page.waitForTimeout(1500);
const def = await page.getByPlaceholder('含义…').first().inputValue().catch(() => '');
log('自动填充结果:', JSON.stringify(def));
await page.screenshot({ path: 'qa-screenshots/dict-autofill.png' });

log('page errors:', errors.slice(0, 3));
await browser.close();

const pass = installed && idb.ok && /傲慢|自大/.test(def);
console.log(pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
