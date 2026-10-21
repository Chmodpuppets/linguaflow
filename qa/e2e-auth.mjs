// 线上端到端验证：AuthGate 注册 → 登录 → 错误密码拒绝。
// 用法：BASE_URL=http://47.107.187.5 node qa/e2e-auth.mjs
// 会创建临时测试用户（qa_probe_<时间戳>）。

import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) {
  delete process.env[k];
}

const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_probe_${Date.now().toString().slice(-8)}`;
const password = 'qa-test-123456';

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
const failedUrls = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) failedUrls.push(`${r.status()} ${r.request().method()} ${r.url()}`);
});
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
    errors.push(`[console.error] ${m.text()}`);
  }
});

const step = (s) => console.log(`\n--- ${s} ---`);
const TOKEN_KEY = 'linguaflow_sync_token';

step('1. 打开首页（期望见 AuthGate 登录门）');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const hasAuthGate = await page.getByRole('button', { name: '注册并进入' }).isVisible().catch(() => false);
console.log(`AuthGate 登录门可见: ${hasAuthGate}`);

step(`2. 注册新用户 ${username}`);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill(password);
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3500);

const afterRegister = await page.evaluate((k) => ({
  token: !!localStorage.getItem(k),
}), TOKEN_KEY);
const stillGateAfterRegister = await page.getByRole('button', { name: '注册并进入' }).isVisible().catch(() => false);
console.log(`注册后 token 已存: ${afterRegister.token}`);
console.log(`已离开登录门: ${!stillGateAfterRegister}`);
// 注册后应进入本地建档向导（LoginView：填昵称 → 语言 → 导师）
const inWizard = await page.getByPlaceholder('输入你的昵称').isVisible().catch(() => false);
console.log(`进入本地建档向导: ${inWizard}`);

step('3. 清除本地身份，验证「登录」路径');
await page.evaluate((k) => {
  localStorage.removeItem(k);
  localStorage.removeItem('linguaflow_user');
}, TOKEN_KEY);
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

await page.getByRole('button', { name: '登录', exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder('密码').fill(password);
await page.getByRole('button', { name: '登录', exact: true }).last().click();
await page.waitForTimeout(3500);

const afterLogin = await page.evaluate((k) => ({ token: !!localStorage.getItem(k) }), TOKEN_KEY);
const gateAfterLogin = await page.getByRole('button', { name: '注册并进入' }).isVisible().catch(() => false);
console.log(`登录后 token 已存: ${afterLogin.token}`);
console.log(`已离开登录门: ${!gateAfterLogin}`);

step('4. 错误密码应被拒绝');
await page.evaluate((k) => {
  localStorage.removeItem(k);
  localStorage.removeItem('linguaflow_user');
}, TOKEN_KEY);
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByRole('button', { name: '登录', exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder('密码').fill('wrong-password-xxx');
await page.getByRole('button', { name: '登录', exact: true }).last().click();
await page.waitForTimeout(2500);
const errVisible = await page.locator('text=用户名或密码错误').isVisible().catch(() => false);
const tokenAfterBadPw = await page.evaluate((k) => !!localStorage.getItem(k), TOKEN_KEY);
console.log(`错误密码提示可见: ${errVisible}`);
console.log(`错误密码未发放 token: ${!tokenAfterBadPw}`);

step('资源失败清单（按状态码）');
if (failedUrls.length === 0) console.log('(无)');
else {
  const byStatus = {};
  for (const u of failedUrls) {
    const code = u.split(' ')[0];
    (byStatus[code] ||= []).push(u);
  }
  for (const [code, list] of Object.entries(byStatus)) {
    console.log(`  ${code}: ${list.length} 次`);
    [...new Set(list)].slice(0, 5).forEach((u) => console.log(`    ${u}`));
  }
}

step('结果汇总');
console.log(`测试用户: ${username}`);
console.log(`未捕获 JS 错误: ${errors.length}`);
if (errors.length) errors.forEach((e) => console.log('  ' + e));

await browser.close();

const onlyExpected4xx = failedUrls.every((u) => u.startsWith('401 ') || u.startsWith('404 '));
const pass = hasAuthGate && afterRegister.token && !stillGateAfterRegister && inWizard
  && afterLogin.token && !gateAfterLogin && errVisible && !tokenAfterBadPw
  && errors.length === 0 && onlyExpected4xx;
console.log(pass ? '\n✅ 全部通过' : '\n❌ 存在失败项');
process.exit(pass ? 0 : 1);
