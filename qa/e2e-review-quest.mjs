// 验证「复习 vs 添加单词」的任务闭环修复：
//   A. 添加单词 → 只给 XP，不推进「复习 10 个单词」任务
//   B. 复习单词 → 给 XP + 推进任务 +1
// 用法：node qa/e2e-review-quest.mjs
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_rq_${Date.now().toString().slice(-8)}`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const readUser = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user') || '{}'));
const info = (u) => {
  const q = (u.dailyQuests || []).find((x) => x.kind === 'vocab_review');
  const lp = (u.progress || {})[u.learningLanguage] || {};
  return { review: q ? q.current : -1, target: q ? q.target : -1, xp: lp.xp ?? -1 };
};

console.log('--- 注册 + 向导 ---');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA复习');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);

const s0 = info(await readUser());
console.log(`初始: 复习任务 ${s0.review}/${s0.target}, XP ${s0.xp}`);

console.log('--- 进「词汇」页 ---');
await page.getByRole('button', { name: '词汇', exact: true }).first().click();
await page.waitForTimeout(1500);

console.log('--- A. 添加一个单词（期望：XP+，复习任务不变）---');
await page.getByRole('button', { name: /添加单词/ }).first().click();
await page.waitForTimeout(500);
await page.getByPlaceholder('输入单词（如 Serendipity）').fill('serendipity');
await page.getByPlaceholder('含义…').fill('意外发现美好事物的能力');
await page.getByRole('button', { name: /保存单词/ }).click();
await page.waitForTimeout(1200);
const s1 = info(await readUser());
const addOk = s1.review === s0.review && s1.xp > s0.xp;
console.log(`添加后: 复习任务 ${s1.review}/${s1.target}, XP ${s1.xp} → ${addOk ? '✅ 不推进任务且给XP' : '❌ 行为不符'}`);

console.log('--- B. 复习该单词（期望：XP+，复习任务 +1）---');
await page.getByRole('button', { name: /^复习/ }).first().click();
await page.waitForTimeout(1200);
const hasCard = await page.getByRole('button', { name: /显示答案/ }).isVisible().catch(() => false);
console.log(`复习卡片出现: ${hasCard}`);
if (hasCard) {
  await page.getByRole('button', { name: /显示答案/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /记住了/ }).click();
  await page.waitForTimeout(1200);
}
const s2 = info(await readUser());
const reviewOk = s2.review === s1.review + 1 && s2.xp > s1.xp;
console.log(`复习后: 复习任务 ${s2.review}/${s2.target}, XP ${s2.xp} → ${reviewOk ? '✅ 推进任务且给XP' : '❌ 未推进'}`);

console.log(`\n未捕获错误: ${errors.length}${errors.length ? ' :: ' + errors.join(' | ') : ''}`);
await browser.close();
process.exit(addOk && reviewOk && errors.length === 0 ? 0 : 1);
