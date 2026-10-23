// 新用户 Key 引导验证：
//  1) 无条件（未配 Key）打开对话台 → 看到免费渠道引导卡片
//  2) 点「去填写 Key」→ 直达「我的资料 → 模型设置」
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_guide_${Date.now().toString().slice(-8)}`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA引导');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(3000);

console.log('=== 1) 对话台引导卡片 ===');
await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2500);
const title = await page.getByText('先填一个你自己的 API Key，才能开始对话').isVisible().catch(() => false);
const glm = await page.getByText('智谱 GLM').first().isVisible().catch(() => false);
const qwen = await page.getByText(/阿里云百炼/).first().isVisible().catch(() => false);
const or = await page.getByText('OpenRouter', { exact: true }).first().isVisible().catch(() => false);
console.log(`引导卡片标题: ${title}；GLM: ${glm}；阿里云百炼: ${qwen}；OpenRouter: ${or}`);

console.log('=== 2) 一键跳「模型设置」 ===');
const goBtn = page.getByRole('button', { name: /去填写 Key/ }).first();
if (await goBtn.isVisible().catch(() => false)) {
  await goBtn.click();
  await page.waitForTimeout(2000);
}
const keyInput = await page.getByPlaceholder('必填：粘贴你自己的 API Key').isVisible().catch(() => false);
const warn = await page.getByText(/本站不内置任何 API Key/).isVisible().catch(() => false);
console.log(`直达模型设置（Key 输入可见）: ${keyInput}；未填提示: ${warn}`);

console.log(`未捕获错误: ${errors.length}`);
await browser.close();
process.exit(title && glm && qwen && keyInput && errors.length === 0 ? 0 : 1);
