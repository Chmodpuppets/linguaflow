// 诊断：浏览器里直接打 /llm/chat，看到底是 CORS、401 还是别的问题
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const KEY = process.env.GLM_TEST_KEY || '';
const username = `qa_dbg_${Date.now().toString().slice(-8)}`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);

const info = await page.evaluate(() => ({
  token: (localStorage.getItem('linguaflow_sync_token') || '').slice(0, 10),
  server: localStorage.getItem('linguaflow_sync_server') || '',
}));
console.log('本地 token 前缀:', info.token || '(空)');
console.log('本地自定义 server:', info.server || '(空，走内置地址)');

const result = await page.evaluate(async (key) => {
  const token = localStorage.getItem('linguaflow_sync_token') || '';
  const base = 'http://47.107.187.5:8787';
  try {
    const res = await fetch(`${base}/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: key,
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: '只回复两个字：成功' }],
        temperature: 0.7,
      }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}, KEY);

console.log('直打 /llm/chat 结果:', JSON.stringify(result));
await browser.close();
