// dump：seed 后一本书的原始结构（item 是否有 id、是否共享引用）
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const USER = process.env.QA_REUSE_USER || '';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext()).newPage();
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.getByPlaceholder('用户名').fill(USER);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '登录', exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: '登录', exact: true }).last().click();
await page.waitForTimeout(3500);
// 进书库触发 seed
const g = page.getByRole('button', { name: /精进/ }).first();
if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(300); }
await page.getByRole('button', { name: '学习书库', exact: true }).first().click();
await page.waitForTimeout(6000);

const out = await page.evaluate(async () => {
  const open = () => new Promise((res, rej) => {
    const q = indexedDB.open('linguaflow_study_books_db', 1);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
  const db = await open();
  const all = await new Promise((res, rej) => {
    const tx = db.transaction('study_books', 'readonly');
    const q = tx.objectStore('study_books').getAll();
    q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error);
  });
  const b = all[0];
  const it0 = b.chapters[0].items[0];
  const allIds = [];
  const refs = [];
  for (const ch of b.chapters) for (const it of ch.items) { allIds.push(String(it.id)); refs.push(it); }
  return {
    bookId: b.id,
    chapters: b.chapters.length,
    perChapter: b.chapters.map((c) => c.items.length),
    item0keys: Object.keys(it0),
    item0id: String(it0.id),
    idLen: String(it0.id).length,
    uniq: new Set(allIds).size,
    sampleIds: allIds.slice(0, 6),
    sameRefCount: refs.filter((r) => r === it0).length,
    chapter0Refs: b.chapters[0].items.map((r) => r === it0),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
