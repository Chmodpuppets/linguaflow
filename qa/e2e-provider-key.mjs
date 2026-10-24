// 通用厂商 Key 验证：只点「测试连接」（不点保存），验证连通 + 自动保存
// 用法：TEST_PROVIDER=glm|qwen|deepseek|openrouter TEST_KEY=xxx [TEST_MODEL=xxx] node qa/e2e-provider-key.mjs
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const PROVIDER = process.env.TEST_PROVIDER || 'glm';
const KEY = process.env.TEST_KEY || '';
const MODEL = process.env.TEST_MODEL || '';
const LABEL = { glm: '智谱 GLM', qwen: 'Qwen', deepseek: 'DeepSeek', openrouter: 'OpenRouter' }[PROVIDER];
const username = `qa_${PROVIDER}_${Date.now().toString().slice(-7)}`;
if (!KEY) { console.error('缺少 TEST_KEY'); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill(`QA-${PROVIDER}`);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /^社区/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /我的资料/ }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /模型设置/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: new RegExp(LABEL) }).first().click();
await page.waitForTimeout(400);
if (MODEL) {
  const inputs = page.locator('input');
  // 第二个输入框是「模型名称」
  await inputs.nth(1).fill(MODEL);
}
await page.getByPlaceholder('必填：粘贴你自己的 API Key').fill(KEY);
await page.getByRole('button', { name: /测试连接/ }).first().click();

let msg = '';
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1500);
  const line = page.locator('p').filter({ hasText: /连接成功|连接失败/ }).first();
  if (await line.isVisible().catch(() => false)) { msg = (await line.textContent()) || ''; break; }
}
const saved = await page.evaluate((p) => {
  const raw = localStorage.getItem('linguaflow_ai_config');
  if (!raw) return null;
  const c = JSON.parse(raw);
  return { active: c.active, key: !!(c[p] && c[p].apiKey), model: (c[p] && c[p].model) || '' };
}, PROVIDER);
console.log(`[${PROVIDER}] 测试结果: ${msg || '(超时)'}`);
console.log(`[${PROVIDER}] 保存状态: ${JSON.stringify(saved)}`);
console.log(`未捕获错误: ${errors.length}`);
await browser.close();
process.exit(/连接成功/.test(msg) && errors.length === 0 ? 0 : 1);
