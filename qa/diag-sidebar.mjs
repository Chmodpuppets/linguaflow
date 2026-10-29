import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const b = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const p = await (await b.newContext()).newPage();
await p.goto('https://linguaflow.pathmora.cn', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.getByPlaceholder('用户名').fill(process.env.U);
await p.getByPlaceholder(/密码/).fill('qa-test-123456');
await p.getByRole('button', { name: '登录', exact: true }).first().click();
await p.waitForTimeout(400);
await p.getByRole('button', { name: '登录', exact: true }).last().click();
await p.waitForTimeout(4000);
const names = await p.evaluate(() =>
  Array.from(document.querySelectorAll('nav button')).map((e) => (e.textContent || '').trim()).filter(Boolean)
);
console.log('nav buttons:', JSON.stringify(names));
const groups = await p.evaluate(() =>
  Array.from(document.querySelectorAll('nav button[aria-expanded]')).map(
    (e) => `${(e.textContent || '').trim()}=${e.getAttribute('aria-expanded')}`
  )
);
console.log('groups:', JSON.stringify(groups));
await b.close();
