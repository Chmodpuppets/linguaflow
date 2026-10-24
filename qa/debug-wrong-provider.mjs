// 验证：Key 填错厂商（智谱 Key 放进 Qwen）时应报「鉴权失败」而不是「限流」
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const KEY = process.env.GLM_TEST_KEY || '';
const username = `qa_403_${Date.now().toString().slice(-8)}`;
if (!KEY) { console.error('缺少 GLM_TEST_KEY'); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
const net = [];
page.on('response', (r) => { if (r.url().includes('/llm/chat')) net.push(`${r.status()} ${r.url()}`); });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA403');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2000);

// 故意把智谱 Key 放进 Qwen 槽、并让 active=qwen（复现 Mike 的情况）
await page.evaluate((key) => {
  localStorage.setItem('linguaflow_ai_config', JSON.stringify({
    active: 'qwen',
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-flash-2026-07-15', apiKey: key },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-5.3-flash', apiKey: '' },
    glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiKey: '' },
    custom: { baseUrl: '', model: '', apiKey: '' },
    ttsVoice: 'Cherry',
  }));
}, KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2000);
await page.getByPlaceholder(/问 AI 教练/).first().fill('hi');
await page.keyboard.press('Enter');

for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(2000);
  const t = await page.locator('body').innerText();
  if (/拒绝了请求|限流|额度不足|暂时不可用/.test(t)) break;
}
const body = await page.locator('body').innerText();
const line = (body.match(/[^\n]*(拒绝了请求|密钥无效)[^\n]*/) || body.match(/[^\n]*(限流|额度不足)[^\n]*/) || ['(未捕获到错误文案)'])[0];
console.log('网络:', net.length ? net.join(' | ') : '(没有 /llm/chat 请求)');
console.log('页面尾部:', body.replace(/\s+/g, ' ').slice(-220));
console.log('错误文案:', line.replace(/\s+/g, ' ').slice(0, 220));
console.log('是否误报为限流:', /限流或额度不足/.test(line));
await browser.close();
process.exit(/密钥无效|拒绝了请求/.test(line) ? 0 : 1);
