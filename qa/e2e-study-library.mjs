// 学习书库：SRS 到期复习入口 + 断点续学
// 用法: QA_REUSE_USER=qa_xxx node qa/e2e-study-library.mjs
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const USER = process.env.QA_REUSE_USER || '';
const PASS = 'qa-test-123456';

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.split('\n')[0].slice(0, 160)));

const gotoLibrary = async () => {
  const g = page.getByRole('button', { name: /精进|学习/ }).first();
  if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  await page.getByRole('button', { name: '学习书库', exact: true }).first().click();
  await page.waitForTimeout(5000);
};
const body = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const stats = async (tag) => {
  const s = await page.evaluate(async () => {
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
      let reviewed = 0, dueReviewed = 0;
      const prompts = [];
      const seen = new Set();
      for (const ch of b.chapters) for (const it of ch.items) {
        const rv = it.reviews ?? 0;
        if (rv > 0) {
          reviewed++;
          if (prompts.length < 30) prompts.push(it.prompt.slice(0, 10) + '@' + it.id.slice(0, 6));
          seen.add(it.id);
        }
        if (rv > 0 && (it.dueDate ?? 0) <= now) dueReviewed++;
      }
      return { title: b.title.slice(0, 12), total: b.totalItems, reviewed, dueReviewed, uniqIds: seen.size, prompts };
    });
  });
  console.log(`[${tag}]`, JSON.stringify(s));
};

// --- 登录 ---
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(USER);
await page.getByPlaceholder(/密码/).fill(PASS);
await page.getByRole('button', { name: '登录', exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: '登录', exact: true }).last().click();
await page.waitForTimeout(4000);
if (!(await page.evaluate(() => !!localStorage.getItem('linguaflow_user')))) {
  console.log('登录失败，检查 QA_REUSE_USER'); await browser.close(); process.exit(2);
}
console.log('登录:', USER);

// --- 1. 新书不应显示「待复习」 ---
await gotoLibrary();
let t = await body();
console.log('\n[1] 书库首页有「待复习」:', /待复习/.test(t), '（新书 expect false）');
const bookCount = await page.locator('button:visible').filter({ hasText: /章/ }).count();
console.log('    可见书籍卡片数:', bookCount);

// --- 2. 进第一本书 ---
await page.locator('button:visible').filter({ hasText: /章/ }).first().click();
await page.waitForTimeout(1500);
t = await body();
console.log('\n[2] 书详情片段:', t.slice(0, 160));

// --- 3. 进第一章，记录起始序号 ---
const chapBtn = page.locator('button:visible').filter({ hasText: /\d+\/\d+/ }).first();
await chapBtn.click();
await page.waitForTimeout(2000);
const readCounter = async () => {
  const m = (await body()).match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
};
const c0 = await readCounter();
console.log('\n[3] 首次进入章节，序号:', JSON.stringify(c0));

// --- 4. 练 2 条，然后退出 ---
for (let i = 0; i < 2; i++) {
  const reveal = page.getByRole('button', { name: '显示答案', exact: true }).first();
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
    await page.waitForTimeout(500);
  }
  const good = page.getByRole('button', { name: '记住了', exact: true }).first();
  if (await good.isVisible().catch(() => false)) {
    await good.click();
    await page.waitForTimeout(900);
  } else {
    console.log('    未找到「记住了」按钮，停止推进'); break;
  }
}
const c1 = await readCounter();
console.log('[4] 练 2 条后序号:', JSON.stringify(c1));

// --- 5. 退出再进，验证断点续学 ---
await page.getByRole('button', { name: '退出', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1500);
const chapBtn2 = page.locator('button:visible').filter({ hasText: /\d+\/\d+/ }).first();
await chapBtn2.click();
await page.waitForTimeout(2000);
const c2 = await readCounter();
console.log('[5] 重新进入章节序号:', JSON.stringify(c2), '→ 断点续学生效:', !!c2 && !!c1 && c2.cur === c1.cur);
await stats('5b 只练了2条时');

// --- 6. 造 5 条「已复习且过期」的条目 ---
const seeded = await page.evaluate(async () => {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('linguaflow_study_books_db', 1);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const db = await open();
  const all = await new Promise((res, rej) => {
    const tx = db.transaction('study_books', 'readonly');
    const r = tx.objectStore('study_books').getAll();
    r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
  });
  const book = all[0];
  if (!book) return { before: -1, n: 0, touched: [] };
  let before = 0;
  for (const ch of book.chapters) for (const it of ch.items) if ((it.reviews ?? 0) > 0) before++;
  let n = 0;
  const touched = [];
  for (const ch of book.chapters) {
    for (const it of ch.items) {
      if (n >= 5) break;
      it.reviews = 1; it.box = 2; it.dueDate = Date.now() - 86400000; n++;
      touched.push(it.prompt.slice(0, 8));
    }
    if (n >= 5) break;
  }
  await new Promise((res, rej) => {
    const tx = db.transaction('study_books', 'readwrite');
    tx.objectStore('study_books').put(book);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
  return { before, n, touched, chapters: book.chapters.length, items0: book.chapters[0].items.length };
});
console.log('\n[6] 造到期条目:', JSON.stringify(seeded));

await stats('6b 造完后');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await stats('6c reload 后（若被重建则 reviewed 归零）');

// --- 7. 看首页横幅 ---
await gotoLibrary();
t = await body();
const m = t.match(/今日待复习\s*(\d+)\s*条/);
console.log('[7] 首页「今日待复习 N 条」:', m ? m[0] : '(未出现)');
const hasStart = await page.getByRole('button', { name: '开始复习', exact: true }).first().isVisible().catch(() => false);
console.log('    「开始复习」按钮可见:', hasStart);

// --- 8. 进入复习模式 ---
if (hasStart) {
  await page.getByRole('button', { name: '开始复习', exact: true }).first().click();
  await page.waitForTimeout(2500);
  t = await body();
  console.log('\n[8] 复习模式徽标可见:', /复习模式/.test(t));
  console.log('    片段:', t.slice(0, 200));
  // 练完一条
  const reveal = page.getByRole('button', { name: '显示答案', exact: true }).first();
  if (await reveal.isVisible().catch(() => false)) { await reveal.click(); await page.waitForTimeout(400); }
  const good = page.getByRole('button', { name: '记住了', exact: true }).first();
  const clicked = await good.isVisible().catch(() => false);
  if (clicked) { await good.click(); await page.waitForTimeout(1200); }
  console.log('    练掉一条:', clicked);
  await page.getByRole('button', { name: '退出', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  console.log('    退出后仍在书详情:', (await body()).includes('全书进度'));
}

console.log('\npageerror:', errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') : '无');
await browser.close();
