// 调试 v2：注入词汇任务 → 点「开始」→ 断言空词库引导态
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const username = `qa_dbg2_${Date.now().toString().slice(-8)}`;
const today = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA调试2');
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /下一步/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /开始学习/ }).click();
await page.waitForTimeout(2000);

console.log('--- 注入一个词汇任务（绕过 AI/任务池随机性）---');
await page.evaluate((d) => {
  localStorage.setItem('linguaflow_daily_tasks', JSON.stringify({
    date: d,
    tasks: [{ id: 'qa-vocab-task', module: 'vocabulary', star: 4, durationMin: 15, xp: 30, title: '拼写 10 个词', detail: '不看提示，拼写 10 个目标词' }],
  }));
}, today);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.getByRole('button', { name: '对话', exact: true }).first().click();
await page.waitForTimeout(2000);
const card = page.locator('text=拼写 10 个词').locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
console.log('词汇任务卡可见:', await card.isVisible().catch(() => false));
await card.getByRole('button', { name: '开始' }).click();
await page.waitForTimeout(2000);

for (const t of ['词库还是空的', '去添加单词', '你刚刚复习了 0 个单词']) {
  console.log(`「${t}」可见:`, await page.getByText(t).first().isVisible().catch(() => false));
}
await page.screenshot({ path: 'qa-screenshots/debug-vocab-fix.png', fullPage: true });
await browser.close();
