// 诊断：书库里 reviews>0 且已到期的条目到底分布在哪本书
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const USER = process.env.QA_REUSE_USER || '';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext()).newPage();
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(USER);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '登录', exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: '登录', exact: true }).last().click();
await page.waitForTimeout(4000);

const r = await page.evaluate(async () => {
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
  const now = Date.now();
  return all.map((b) => {
    let total = 0, reviewed = 0, dueAll = 0, dueReviewed = 0;
    const sample = [];
    for (const ch of b.chapters) for (const it of ch.items) {
      total++;
      const rv = it.reviews ?? 0;
      if (rv > 0) reviewed++;
      if ((it.dueDate ?? 0) <= now) dueAll++;
      if (rv > 0 && (it.dueDate ?? 0) <= now) {
        dueReviewed++;
        if (sample.length < 3) sample.push({ p: it.prompt, rv, box: it.box, dd: it.dueDate, now });
      }
    }
    return { id: b.id, title: b.title, lang: b.language, total, reviewed, dueAll, dueReviewed, sample };
  });
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
