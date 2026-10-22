// 复现任务系统两个 bug：
//   1) 点「完成」无反应（期望：弹出 1–3 星通关评价 → 打星后任务标记完成）
//   2) 词汇任务点「开始」无反应（期望：跳转到词汇界面）
// 用法：BASE_URL=http://47.107.187.5 node qa/repro-tasks.mjs
// 会注册临时用户 qa_task_<时间戳>。

import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) {
  delete process.env[k];
}

const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_task_${Date.now().toString().slice(-8)}`;
const password = 'qa-test-123456';
const SHOT = (n) => `qa-screenshots/repro-tasks-${n}.png`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
    errors.push(`[console.error] ${m.text()}`);
  }
});

const step = (s) => console.log(`\n=== ${s} ===`);

step('1. 注册 + 走完建档向导');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill(password);
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA任务测试');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);
console.log('向导完成，已进入应用');

step('2. 进入「对话」页');
await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2000);

step('3. 等今日任务出现（AI 生成或本地兜底，最多 40s）');
let tasksReady = false;
for (let i = 0; i < 20; i++) {
  if (await page.getByText('今日任务').isVisible().catch(() => false)) {
    if (!(await page.getByText('正在为你规划今日任务').isVisible().catch(() => false))) {
      tasksReady = true;
      break;
    }
  }
  await page.waitForTimeout(2000);
}
console.log(`任务列表就绪: ${tasksReady}`);
if (!tasksReady) {
  console.log('❌ 任务一直没出来，跳过后续');
  await page.screenshot({ path: SHOT('0-no-tasks'), fullPage: true });
  await browser.close();
  process.exit(1);
}
await page.screenshot({ path: SHOT('1-tasks'), fullPage: true });

step('4. 【Bug1】点第一个任务的「完成」');
const firstDone = page.getByRole('button', { name: '完成' }).first();
await firstDone.click();
await page.waitForTimeout(800);
const ratingVisible = await page.getByText('这次练得怎么样').isVisible().catch(() => false);
console.log(`点「完成」后出现通关评价面板: ${ratingVisible}`);
await page.screenshot({ path: SHOT('2-after-done-click'), fullPage: true });

if (ratingVisible) {
  step('5. 点 1 星按钮 → 期望任务标记完成');
  const starBtn = page.locator('p:has-text("这次练得怎么样") + div > button').first();
  await starBtn.click();
  await page.waitForTimeout(1200);
  const doneLabel = await page.getByText(/已完成|认真完成|完美通关/).first().isVisible().catch(() => false);
  const countText = await page.getByText(/\/3 完成/).first().textContent().catch(() => null);
  console.log(`任务显示已完成: ${doneLabel}；完成计数: ${countText}`);
  await page.screenshot({ path: SHOT('3-after-rate'), fullPage: true });
}

step('6. 【Bug2】空词库进复习（期望「词库还是空的」引导，而非「复习完成 0 个」）');
// 优先从词汇任务卡进入；本轮任务池没有词汇任务时，走侧栏「词汇」→「复习」确定性路径
const vocabCard = page.locator('text=拼写').locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
if (await vocabCard.isVisible().catch(() => false)) {
  await vocabCard.getByRole('button', { name: '开始' }).click();
} else {
  console.log('(本轮任务无词汇任务，走侧栏路径)');
  await page.getByRole('button', { name: '词汇', exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '复习', exact: true }).first().click();
}
await page.waitForTimeout(2000);
const emptyBank = await page.getByText('词库还是空的').isVisible().catch(() => false);
const fakeDone = await page.getByText(/你刚刚复习了 0 个单词/).isVisible().catch(() => false);
console.log(`显示「词库还是空的」引导: ${emptyBank}（期望 true）`);
console.log(`误显示「复习完成 0 个单词」: ${fakeDone}（期望 false）`);
await page.screenshot({ path: SHOT('4-after-vocab-start'), fullPage: true });

step('结果汇总');
console.log(`未捕获 JS 错误: ${errors.length}`);
if (errors.length) errors.forEach((e) => console.log('  ' + e));
await browser.close();
