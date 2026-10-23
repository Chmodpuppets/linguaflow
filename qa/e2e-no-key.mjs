// 验证「无内置 Key」体验：
//  1) 模型设置里四家 provider 都能填 Key，未填时有明确提示
//  2) 未配 Key 时使用 AI 给出可操作引导（而不是静默失败/undefined）
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_key_${Date.now().toString().slice(-8)}`;

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
await page.getByPlaceholder('输入你的昵称').fill('QA密钥');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);

console.log('=== 1) 模型设置：Key 输入 + 提示 ===');
await page.getByRole('button', { name: /^社区/ }).first().click(); // 社区组默认折叠
await page.waitForTimeout(600);
await page.getByRole('button', { name: /我的资料/ }).first().click();
await page.waitForTimeout(1500);
const settingsTab = page.getByRole('button', { name: /模型设置/ }).first();
if (await settingsTab.isVisible().catch(() => false)) {
  await settingsTab.click();
  await page.waitForTimeout(800);
}
const keyInput = page.getByPlaceholder('必填：粘贴你自己的 API Key');
const hasKeyInput = await keyInput.isVisible().catch(() => false);
// 逐个 provider 检查都能切到并可填
const providerNames = ['智谱 GLM', 'Qwen', 'OpenRouter', '自定义'];
const providerOk = {};
for (const n of providerNames) {
  const btn = page.getByRole('button', { name: new RegExp(n) }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(400);
    providerOk[n] = await page.getByPlaceholder('必填：粘贴你自己的 API Key').isVisible().catch(() => false);
  }
}
const warn = await page.getByText(/本站不内置任何 API Key/).isVisible().catch(() => false);
console.log(`Key 输入框存在: ${hasKeyInput}`);
console.log(`四家 provider 均可填: ${JSON.stringify(providerOk)}`);
console.log(`未填 Key 提示可见: ${warn}`);

console.log('=== 2) 未配 Key 时用 AI → 应给引导 ===');
await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2500);
const box = page.getByPlaceholder(/问|输入|说/).first();
if (await box.isVisible().catch(() => false)) {
  await box.fill('你好');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
}
const guide = await page.getByText(/不内置 API Key|AI 暂时不可用/).first().isVisible().catch(() => false);
console.log(`AI 引导提示可见: ${guide}`);

console.log(`未捕获错误: ${errors.length}`);
await browser.close();
process.exit(hasKeyInput && warn && guide && errors.length === 0 ? 0 : 1);
