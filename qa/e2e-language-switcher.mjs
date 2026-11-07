import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const P = 'qa-test-123456';
const U = process.env.U || 'qa_ls' + String(Date.now()).slice(-6);

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

const b = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  [pageerror]', e.message));

const trigger = () => p.getByRole('button', { name: /当前学习语言/ });
const optionNames = async () => p.getByRole('listbox').getByRole('option').allInnerTexts();

console.log('0) 新账号完整注册 + 引导:', U);
await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.getByPlaceholder('用户名').fill(U);
await p.getByPlaceholder(/密码/).first().fill(P);
await p.getByRole('button', { name: '注册并进入' }).click();
await p.waitForTimeout(3000);
for (let i = 0; i < 4; i++) {
  if (await p.locator('aside').count()) break;
  const nick = p.getByPlaceholder(/昵称/);
  if (await nick.count()) await nick.first().fill(U);
  const mentor = p.getByRole('button', { name: /鼓励伙伴/ });
  if (await mentor.count()) await mentor.first().click();
  const next = p.getByRole('button', { name: /下一步|开始学习/ }).first();
  if (!(await next.count())) break;
  await next.click();
  await p.waitForTimeout(1200);
}
(await p.locator('aside').count()) ? ok('进入主界面') : bad('未进入主界面');
await p.waitForTimeout(1200);

// 1) 只列已开启语言：新账号默认只有日语
console.log('1) 初始语言按钮:', await trigger().getAttribute('aria-label'));
await trigger().click();
await p.waitForTimeout(350);
let names = await optionNames();
console.log('   下拉项:', JSON.stringify(names.map((s) => s.split('\n')[0])));
names.length === 1 ? ok('只显示 1 个已开启语言（未开始的已隐藏）') : bad(`应只剩 1 项，实际 ${names.length} 项`);
names[0]?.includes('日本語') ? ok('该项是当前语言 日本語') : bad('列表内容异常');
const addBtn = p.getByRole('button', { name: /添加语言/ });
(await addBtn.count()) ? ok('底部有「＋ 添加语言」入口') : bad('缺少添加语言入口');
await p.screenshot({ path: 'qa-screenshots/shot-lang-only-started.png' });

// 2) 添加入口 → 我的资料 · 设置
await addBtn.click();
await p.waitForTimeout(1600);
const bodySettings = await p.locator('body').innerText();
/语言设置/.test(bodySettings) ? ok('已跳到「我的资料 → 设置 · 语言设置」') : bad('未跳到设置页');
/目标语言/.test(bodySettings) ? ok('目标语言选择器可见（在这里添加新语言）') : bad('设置页缺目标语言选择器');
await p.screenshot({ path: 'qa-screenshots/shot-lang-add-entry.png' });

// 3) 在设置页把语言改成 English → 侧栏切换器同步
const langSelect = p.locator('select').first();
await langSelect.selectOption('English');
await p.waitForTimeout(1500);
const label1 = await trigger().getAttribute('aria-label');
console.log('3) 设置页切成 English 后按钮:', label1);
label1 && label1.includes('English') ? ok('侧栏切换器同步为 English') : bad('切换器未同步');

// 4) 回列表看：现在应是 2 项（English + 日本語）
await trigger().click();
await p.waitForTimeout(350);
names = await optionNames();
console.log('4) 下拉项:', JSON.stringify(names.map((s) => s.split('\n')[0])));
names.length === 2 ? ok('新增语言后变 2 项') : bad(`应为 2 项，实际 ${names.length}`);
await p.screenshot({ path: 'qa-screenshots/shot-lang-open.png' });

// 5) 从切换器切回日语
await p.getByRole('listbox').getByRole('option', { name: /日本語/ }).click();
await p.waitForTimeout(1200);
const label2 = await trigger().getAttribute('aria-label');
console.log('5) 切回日语:', label2);
label2 && label2.includes('日本語') ? ok('切换器切回 日本語 生效') : bad('切换失败');
const stored = await p.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('linguaflow_user') || '{}');
  return { lang: u.learningLanguage, keys: Object.keys(u.progress || {}) };
});
console.log('   localStorage:', JSON.stringify(stored));
stored.lang === 'Japanese' ? ok('learningLanguage=Japanese 已持久化') : bad('未持久化');

// 6) 刷新保持
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const label3 = await trigger().getAttribute('aria-label');
console.log('6) 刷新后:', label3);
label3 && label3.includes('日本語') ? ok('刷新后仍是 日本語') : bad('刷新后丢失');

// 7) 折叠态
const collapse = p.getByRole('button', { name: /收起侧栏/ });
if (await collapse.count()) {
  await collapse.first().click();
  await p.waitForTimeout(600);
  const tb = await trigger().boundingBox();
  await trigger().click();
  await p.waitForTimeout(350);
  const pb = await p.getByRole('listbox').boundingBox();
  console.log('7) 折叠态:', tb && `${Math.round(tb.width)}×${Math.round(tb.height)}`, '面板', pb && `${Math.round(pb.x)},${Math.round(pb.y)}`);
  pb && tb && pb.x >= tb.x + tb.width ? ok('折叠态面板向右弹出') : bad('折叠态面板位置异常');
  await p.getByRole('listbox').getByRole('option', { name: /English/ }).click();
  await p.waitForTimeout(1000);
  const l4 = await trigger().getAttribute('aria-label');
  l4 && l4.includes('English') ? ok('折叠态切换生效') : bad('折叠态切换失败');
  await collapse.first().click().catch(() => {});
  await p.waitForTimeout(400);
}

// 8) 移动端顶栏
const m = await ctx.newPage();
await m.setViewportSize({ width: 390, height: 844 });
await m.goto(BASE, { waitUntil: 'domcontentloaded' });
await m.waitForTimeout(3000);
const mTrigger = m.locator('header button[aria-label*="学习语言"]');
const mc = await mTrigger.count();
console.log('8) 移动端切换器数量:', mc);
if (mc > 0) {
  await mTrigger.first().click();
  await m.waitForTimeout(300);
  (await m.getByRole('listbox').isVisible()) ? ok('移动端下拉可见') : bad('移动端下拉不可见');
  const mNames = await m.getByRole('listbox').getByRole('option').allInnerTexts();
  console.log('   移动端下拉项数:', mNames.length);
  mNames.length === 2 ? ok('移动端同样只列已开启语言') : bad(`移动端项数 ${mNames.length} ≠ 2`);
  await m.screenshot({ path: 'qa-screenshots/shot-lang-mobile.png' });
} else {
  bad('移动端顶栏没有切换器');
}

await b.close();
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
