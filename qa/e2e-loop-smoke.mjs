// 三系统闭环冒烟：
//  1) 对话台星任务全清 → 连胜不应增加（只由飞轮触发）+ 横幅提示改为「去完成飞轮」
//  2) 写作树任务详情 → 出现「构思→起草→重读→重写→编辑→分享」阶段进度条
//  3) 剧情对话大厅 → 场景包正常加载
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_loop_${Date.now().toString().slice(-8)}`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const readUser = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user') || '{}'));

console.log('--- 注册 + 向导 ---');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA闭环');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);

console.log('\n=== 1) 对话台：完成全部星任务，验证连胜不被旁路 ===');
await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2500);
// 等任务生成完成（AI 生成可能较慢；本地兜底也要时间）
for (let i = 0; i < 25; i++) {
  const loading = await page.getByText('正在为你规划今日任务').isVisible().catch(() => false);
  const hasDone = await page.getByRole('button', { name: '完成', exact: true }).first().isVisible().catch(() => false);
  if (!loading && hasDone) break;
  await page.waitForTimeout(1500);
}
const streakBefore = (await readUser()).currentStreak ?? -1;
console.log(`完成前连胜: ${streakBefore}`);
for (let i = 0; i < 3; i++) {
  const doneBtn = page.getByRole('button', { name: '完成', exact: true }).first();
  if (!(await doneBtn.isVisible().catch(() => false))) break;
  await doneBtn.click();
  await page.waitForTimeout(500);
  const star = page.locator('p:has-text("这次练得怎么样") + div > button').first();
  if (await star.isVisible().catch(() => false)) {
    await star.click();
    await page.waitForTimeout(700);
  }
}
const afterUser = await readUser();
const streakAfter = afterUser.currentStreak ?? -1;
const bannerOk = await page.getByText(/去「今日」完成产出飞轮/).isVisible().catch(() => false);
const doneRaw = await page.evaluate(() => localStorage.getItem('linguaflow_daily_tasks_done'));
const tasksRaw = await page.evaluate(() => localStorage.getItem('linguaflow_daily_tasks'));
const doneCount = doneRaw ? Object.keys(JSON.parse(doneRaw).done || {}).length : 0;
const taskCount = tasksRaw ? (JSON.parse(tasksRaw).tasks || []).length : 0;
const remainingDoneBtns = await page.getByRole('button', { name: '完成', exact: true }).count();
console.log(`完成后连胜: ${streakAfter}（期望与完成前相同 = 不由星任务续）`);
console.log(`横幅提示出现: ${bannerOk}（期望 true）`);
console.log(`完成态: ${doneCount}/${taskCount}，剩余未完成按钮: ${remainingDoneBtns}`);

console.log('\n=== 2) 写作树：阶段进度条 ===');
// 写作树在「精进」分组（默认折叠），先展开
await page.getByRole('button', { name: /精进/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: '写作树', exact: true }).first().click();
await page.waitForTimeout(3500);
// 点击第一个可选的写作任务节点
const treeButtons = await page.locator('button:visible').allTextContents();
console.log('写作树可见按钮（前20）:', treeButtons.map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 20).join(' | '));
const treeText = await page.locator('body').innerText();
console.log('写作树页面文本片段:', treeText.replace(/\s+/g, ' ').slice(0, 220));
const taskNode = page.getByText('一句话介绍自己', { exact: true }).first();
if (await taskNode.isVisible().catch(() => false)) {
  await taskNode.click();
  await page.waitForTimeout(1500);
  console.log('已点击「自我介绍」节点');
} else {
  console.log('未找到「自我介绍」节点');
}
const stepPlan = await page.getByText('构思', { exact: true }).first().isVisible().catch(() => false);
const stepShare = await page.getByText('分享', { exact: true }).first().isVisible().catch(() => false);
const panelOpen = await page.getByText('提交批改').isVisible().catch(() => false);
if (!stepPlan) {
  const t = await page.locator('body').innerText();
  console.log('诊断-点击后页面文本:', t.replace(/\s+/g, ' ').slice(0, 400));
}
console.log(`写作面板已打开(提交批改可见): ${panelOpen}`);
console.log(`阶段条「构思」可见: ${stepPlan}；「分享」可见: ${stepShare}`);

console.log('\n=== 3) 剧情对话：大厅加载 ===');
await page.getByRole('button', { name: '剧情对话', exact: true }).first().click();
await page.waitForTimeout(2000);
const lobbyOk = await page.getByText(/自定义剧情/).first().isVisible().catch(() => false);
const scenarioCount = await page.locator('button').filter({ hasText: /人设|场景|任务/ }).count().catch(() => 0);
console.log(`大厅可见: ${lobbyOk}；含场景关键词按钮数: ${scenarioCount}`);

console.log(`\n未捕获错误: ${errors.length}${errors.length ? ' :: ' + errors.join(' | ') : ''}`);
await browser.close();
process.exit(streakAfter === streakBefore && bannerOk && errors.length === 0 ? 0 : 1);
