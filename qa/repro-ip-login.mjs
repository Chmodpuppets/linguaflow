// 复现「线上 IP 访问卡在欢迎页」：走一遍 LoginView 向导，抓 console error / pageerror。
// 关键对比：secure context（localhost/https）vs 非 secure context（http://IP）。
// 用法：BASE_URL=http://47.107.187.5 node qa/repro-ip-login.mjs

import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) {
  delete process.env[k];
}

const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';

const browser = await chromium.launch({
  channel: 'chrome', // 复用系统 Chrome，避免 playwright 内置 chromium 下载超时
  args: ['--no-proxy-server'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

// 环境判定
const env = await page.evaluate(() => ({
  isSecureContext: window.isSecureContext,
  hasRandomUUID: typeof window.crypto?.randomUUID === 'function',
  hasGetRandomValues: typeof window.crypto?.getRandomValues === 'function',
}));
console.log('=== 环境判定 ===');
console.log(`URL            : ${BASE_URL}`);
console.log(`isSecureContext: ${env.isSecureContext}`);
console.log(`crypto.randomUUID 可用: ${env.hasRandomUUID}`);
console.log(`crypto.getRandomValues 可用: ${env.hasGetRandomValues}`);

// 走向导：填昵称 → 下一步 → 下一步 → 开始学习
console.log('\n=== 走登录向导 ===');
await page.getByPlaceholder('输入你的昵称').fill('testuser');
await page.getByRole('button', { name: /下一步/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /下一步/ }).first().click();
await page.waitForTimeout(400);
console.log('已到第 3 步，准备点击「开始学习」');

await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(3000);

// 结果判定：进入主布局 = 侧栏出现；仍在欢迎页 = 卡住
const stillLogin = await page.getByRole('button', { name: /开始学习/ }).isVisible().catch(() => false);
const hasSidebar = await page.locator('nav').count() > 0;
const title = await page.locator('h2').first().textContent().catch(() => '(none)');

console.log('\n=== 结果 ===');
console.log(`仍在欢迎页: ${stillLogin}`);
console.log(`主布局侧栏存在: ${hasSidebar}`);
console.log(`当前标题: ${title}`);

console.log('\n=== 捕获到的错误 ===');
if (errors.length === 0) console.log('(无)');
else errors.forEach((e) => console.log(e));

await browser.close();
process.exit(stillLogin ? 1 : 0);
