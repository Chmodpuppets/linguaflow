// 诊断：对话页流式请求到底返回了什么（配置 key 后发一条消息）
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const KEY = process.env.GLM_TEST_KEY || '';
const username = `qa_stream_${Date.now().toString().slice(-8)}`;
if (!KEY) { console.error('缺少 GLM_TEST_KEY'); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
const net = [];
page.on('response', (r) => {
  if (r.url().includes('/llm/chat')) net.push(`${r.status()} ${r.request().method()} ${r.url()}`);
});
page.on('requestfailed', (r) => {
  if (r.url().includes('/llm/chat')) net.push(`FAILED ${r.url()} :: ${r.failure()?.errorText}`);
});
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 240)); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA流式');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2500);

// 直接写入模型配置（跳过 UI），active=glm + 他的 key
await page.evaluate((key) => {
  localStorage.setItem('linguaflow_ai_config', JSON.stringify({
    active: 'glm',
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-flash-2026-07-15', apiKey: '' },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-5.3-flash', apiKey: '' },
    glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiKey: key },
    custom: { baseUrl: '', model: '', apiKey: '' },
    ttsVoice: 'Cherry',
  }));
}, KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2000);

const box = page.getByPlaceholder(/问 AI 教练/).first();
await box.fill('只回复两个字：成功');
await page.keyboard.press('Enter');

// 等回复（最多 40s）
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(2000);
  const t = await page.locator('body').innerText();
  if (/成功/.test(t) || /暂时不可用|未返回内容/.test(t)) break;
}
const body = await page.locator('body').innerText();
const tail = body.replace(/\s+/g, ' ').slice(-260);
console.log('--- /llm/chat 网络 ---');
console.log(net.length ? net.join('\n') : '(无请求，说明没走中转)');
console.log('--- 页面尾部文本 ---');
console.log(tail);
console.log('--- 未捕获错误 ---');
console.log(errors.length ? errors.join(' | ') : '(无)');
await browser.close();
