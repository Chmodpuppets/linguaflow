// TTS 验证：配置 Qwen Key 后点「试听这个声音」，应不再报 401
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const KEY = process.env.QWEN_TEST_KEY || '';
const username = `qa_tts_${Date.now().toString().slice(-8)}`;
if (!KEY) { console.error('缺少 QWEN_TEST_KEY'); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const audioReq = [];
page.on('response', (r) => { if (r.url().includes('dashscope')) audioReq.push(`${r.status()} ${r.url().slice(0, 70)}`); });

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA-TTS');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2000);

// 注入 Qwen 配置（含 Key）
await page.evaluate((key) => {
  localStorage.setItem('linguaflow_ai_config', JSON.stringify({
    active: 'qwen',
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-flash', apiKey: key },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-5.3-flash', apiKey: '' },
    glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiKey: '' },
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '' },
    custom: { baseUrl: '', model: '', apiKey: '' },
    ttsVoice: 'Cherry',
  }));
}, KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /^社区/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /我的资料/ }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /模型设置/ }).first().click();
await page.waitForTimeout(800);

const btn = page.getByRole('button', { name: /试听这个声音/ }).first();
await btn.scrollIntoViewIfNeeded().catch(() => {});
await btn.click();

let msg = '';
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(1500);
  const t = await page.locator('body').innerText();
  const m = t.match(/试听失败：[^\n]*/);
  if (m) { msg = m[0]; break; }
  if (/生成中/.test(t)) continue;
}
console.log('DashScope 请求:', audioReq.length ? audioReq.join(' | ') : '(没有请求)');
console.log('试听结果:', msg || '(未报错 ✅)');
console.log('未捕获错误:', errors.length);
await browser.close();
process.exit(msg ? 1 : 0);
