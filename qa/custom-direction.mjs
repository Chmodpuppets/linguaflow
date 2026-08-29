// Task 8 回归：自定义写作方向全流程（创建→解锁链→重命名→重新生成→删除）
// 用法：先起 dev server（npm run dev），再 BASE_URL=http://127.0.0.1:3011 node qa/custom-direction.mjs
// 本沙箱/无 API key 环境自动拦截 LLM 请求走本地模板兜底路径。
// 无 AI key 环境自动走本地模板兜底（同样验证创建链路）。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3012';

const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 250)));
// window.confirm 一律接受（重新生成/删除的二次确认）
page.on('dialog', (d) => d.accept());
// 拦截 LLM 请求：本沙箱直连外网不通，模拟「AI 不可用」以验证本地模板兜底路径
await page.route('**/chat/completions*', (route) => route.abort());

const step = (ok, name, detail = '') => console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('nav, input[placeholder="输入你的昵称"]', { timeout: 90000 });
const nickname = page.locator('input[placeholder="输入你的昵称"]');
await nickname.fill('FlowTester');
await page.getByText('下一步', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByText('下一步', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByText('开始学习', { exact: true }).first().click();
await page.waitForSelector('nav', { timeout: 30000 });
const headers = page.locator('nav button[aria-expanded]');
const hc = await headers.count();
for (let i = 0; i < hc; i++) {
  const h = headers.nth(i);
  if ((await h.getAttribute('aria-expanded')) !== 'true') { await h.click(); await page.waitForTimeout(250); }
}
console.log('✓ 登录完成');

// 进入写作树
await page.locator('nav').getByText('写作树', { exact: true }).first().click({ timeout: 10000 });
await page.waitForTimeout(1500);

// 1) 添加入口存在（等待挂载完成）
const addBtn = page.getByText('添加我的写作方向', { exact: true });
await addBtn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
step((await addBtn.count()) === 1, '入口「+ 添加我的写作方向」存在');

// 2) 打开弹窗 → 填一句话 + 自定义方向名 → 生成（AI 被拦截 → 走本地模板兜底）
const DESC = '我想写健身打卡日记';
await addBtn.click({ timeout: 10000 });
await page.waitForTimeout(600);
const textarea = page.locator('textarea[placeholder*="用一句话描述"]');
step((await textarea.count()) === 1, '弹窗打开，一句话输入框在位');
await textarea.fill(DESC);
// 展开更多设置，指定方向名（否则兜底标题取描述前 12 字）
await page.getByText('更多设置（可选）', { exact: true }).click({ timeout: 10000 });
await page.waitForTimeout(400);
await page.locator('input[placeholder="例如：健身打卡日记"]').fill('健身打卡日记');
await page.getByText('生成专属阶梯', { exact: true }).click({ timeout: 10000 });
// 等生成完成（弹窗关闭 + 自定义枝干出现）；AI 被拦截应立即走兜底，留足余量
const customHeader = page.getByText('健身打卡日记', { exact: true }).first();
try {
  await customHeader.waitFor({ state: 'visible', timeout: 60000 });
  step(true, '生成自定义枝干「健身打卡日记」');
} catch {
  step(false, '生成自定义枝干', '60s 内未出现');
}

// 3) 枝干创建后默认已展开：直接断言模板阶梯任务可见，再点首题进编辑器
await page.waitForTimeout(800);
const bodyText = await page.locator('body').innerText();
const taskTitles = [`初识${DESC}`, `一次${DESC}的小事`, `我的${DESC}日常`, `把${DESC}说清楚`, `我对${DESC}的看法`, '重写与打磨'];
const present = taskTitles.filter((t) => bodyText.includes(t));
step(present.length >= 4, '本地模板阶梯任务出现', `${present.length}/6 个模板任务可见`);
// 点第一题 → 编辑器
await page.getByText(`初识${DESC}`, { exact: true }).first().click({ timeout: 10000 });
await page.waitForTimeout(1000);
const editorText = await page.locator('body').innerText();
step(editorText.includes('具体细节') || editorText.includes('提交'), '首题可在编辑器打开（提示语在位）');

// 4) 重命名
await customHeader.hover();
await page.locator('button[aria-label="方向管理菜单"]').first().click({ timeout: 10000 });
await page.waitForTimeout(400);
await page.getByText('重命名', { exact: true }).first().dispatchEvent('click');
await page.waitForTimeout(400);
const renameInput = page.locator('input[placeholder="方向名"]');
await renameInput.fill('撸铁日记');
await page.getByText('保存', { exact: true }).click({ timeout: 10000 });
await page.waitForTimeout(800);
const afterRename = await page.locator('body').innerText();
step(afterRename.includes('撸铁日记'), '重命名生效（撸铁日记）');

// 5) 重新生成（confirm 自动接受）。兜底模板两次生成标题相同，视觉上无法区分替换，
//    故判定：确认弹窗被接受（dialog handler）+ 流程无报错 + 枝干仍在。
await page.getByText('撸铁日记', { exact: true }).first().hover();
await page.locator('button[aria-label="方向管理菜单"]').first().click({ timeout: 10000 });
await page.waitForTimeout(400);
await page.getByText('重新生成', { exact: true }).first().dispatchEvent('click');
await page.waitForTimeout(4000);
const afterRegen = await page.locator('body').innerText();
step(afterRegen.includes('撸铁日记') && errs.length === 0, '重新生成执行完成，枝干仍在');

// 6) 删除方向
await page.getByText('撸铁日记', { exact: true }).first().hover();
await page.locator('button[aria-label="方向管理菜单"]').first().click({ timeout: 10000 });
await page.waitForTimeout(400);
await page.getByText('删除方向', { exact: true }).first().dispatchEvent('click');
await page.waitForTimeout(1500);
const afterDelete = await page.locator('body').innerText();
step(!afterDelete.includes('撸铁日记'), '删除方向生效');
const addBtnAgain = await page.getByText('添加我的写作方向', { exact: true }).count();
step(addBtnAgain === 1, '删除后入口恢复');

console.log('--- pageerror ---');
console.log(errs.length ? errs.slice(0, 5).join('\n') : '（无）');
await browser.close();
