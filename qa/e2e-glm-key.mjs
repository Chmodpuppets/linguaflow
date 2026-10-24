// GLM Key 真实连通性验证（走服务端 /llm/chat 中转）
// 用法：GLM_TEST_KEY=xxxx.yyyy node qa/e2e-glm-key.mjs
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const KEY = process.env.GLM_TEST_KEY || '';
const username = `qa_glm_${Date.now().toString().slice(-8)}`;
if (!KEY) { console.error('缺少 GLM_TEST_KEY'); process.exit(2); }

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
await page.getByPlaceholder('输入你的昵称').fill('QA-GLM');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);

// 进「我的资料 → 模型设置」
await page.getByRole('button', { name: /^社区/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /我的资料/ }).first().click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /模型设置/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /智谱 GLM/ }).first().click();
await page.waitForTimeout(400);

// 填 Key（模型保持默认 glm-4-flash）；故意不点「保存」，验证测试成功会自动保存
await page.getByPlaceholder('必填：粘贴你自己的 API Key').fill(KEY);
await page.getByRole('button', { name: /测试连接/ }).first().click();

// 等结果（最多 30s）
let msg = '';
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  const okMsg = await page.getByText(/连接成功/).first().isVisible().catch(() => false);
  const errMsg = await page.getByText(/连接失败/).first().isVisible().catch(() => false);
  if (okMsg || errMsg) {
    msg = (await page.locator('p').filter({ hasText: /连接成功|连接失败/ }).first().textContent().catch(() => '')) || '';
    break;
  }
}
console.log(`测试结果: ${msg || '(超时无结果)'}`);
// 验证「测试成功自动保存」：只点过测试、没点保存，配置也应已落库
const saved = await page.evaluate(() => {
  const raw = localStorage.getItem('linguaflow_ai_config');
  if (!raw) return { key: false, active: '', model: '' };
  const c = JSON.parse(raw);
  return { key: !!(c.glm && c.glm.apiKey), active: c.active, model: (c.glm && c.glm.model) || '' };
});
console.log(`自动保存配置: key=${saved.key} active=${saved.active} model=${saved.model}`);
console.log(`未捕获错误: ${errors.length}${errors.length ? ' :: ' + errors.join(' | ') : ''}`);
await browser.close();
process.exit(/连接成功/.test(msg) && saved.key && errors.length === 0 ? 0 : 1);
