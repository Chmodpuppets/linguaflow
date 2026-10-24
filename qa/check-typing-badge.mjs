// 打字闯关：完成徽章是否还压住提示卡片（截图验证）
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_typing_${Date.now().toString().slice(-8)}`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA打字');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2000);

// 让前两关处于「已完成 / 当前」状态，好看到完成徽章
await page.evaluate(() => {
  const raw = localStorage.getItem('linguaflow_user');
  if (!raw) return;
  const u = JSON.parse(raw);
  const lang = u.learningLanguage;
  u.progress = u.progress || {};
  u.progress[lang] = { ...(u.progress[lang] || {}), maxUnlockedStage: 2 };
  localStorage.setItem('linguaflow_user', JSON.stringify(u));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /打字闯关/ }).first().click();
await page.waitForTimeout(2000);

// 悬停第一关（完成态），让提示卡片显示
const firstStage = page.locator('button').filter({ hasText: /🌱|🌿|🍀|🔥|⭐|👑/ }).first();
await firstStage.hover({ force: true });
await page.waitForTimeout(900);
await page.screenshot({ path: 'qa-typing-badge-check.png', clip: { x: 200, y: 150, width: 800, height: 560 } });
console.log('截图已保存 qa-typing-badge-check.png');
await browser.close();
