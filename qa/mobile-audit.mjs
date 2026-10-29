// 手机端适配体检：390×844（iPhone 14）逐模块截图 + 采集横向溢出
import { chromium, devices } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const U = `qa_m_${Date.now().toString().slice(-7)}`;
const P = 'qa-test-123456';

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'zh-CN' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.split('\n')[0].slice(0, 120)));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
// 注册
await page.getByPlaceholder('用户名').fill(U);
await page.getByPlaceholder(/密码/).fill(P);
await page.getByRole('button', { name: '注册并进入' }).click();
await page.waitForTimeout(3000);
// onboarding
if (await page.getByPlaceholder('输入你的昵称').isVisible().catch(() => false)) {
  await page.getByPlaceholder('输入你的昵称').fill('手机测试');
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /开始学习/ }).click();
  await page.waitForTimeout(3000);
}
console.log('账号:', U, '| 已进入应用:', await page.evaluate(() => !!localStorage.getItem('linguaflow_user')));

const openMenu = async () => {
  const btn = page.locator('button[aria-label*="菜单"], button:has(svg.lucide-menu)').first();
  if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(500); }
};
const go = async (label) => {
  await openMenu();
  const target = page.getByRole('button', { name: new RegExp(`^${label}`) }).first();
  if (!(await target.isVisible().catch(() => false))) {
    // 展开分组
    for (const g of ['学习', '精进', '资源', '社区']) {
      const gb = page.getByRole('button', { name: g, exact: true }).first();
      if (await gb.isVisible().catch(() => false)) { await gb.click(); await page.waitForTimeout(350); }
      if (await target.isVisible().catch(() => false)) break;
    }
  }
  await target.click();
  await page.waitForTimeout(2200);
  // 关掉可能残留的 overlay
  const ov = page.locator('div.fixed.inset-0.bg-black\\/60').first();
  if (await ov.isVisible().catch(() => false)) { await ov.click({ position: { x: 350, y: 400 } }).catch(() => {}); await page.waitForTimeout(400); }
};

const measure = async (name) => {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const over = [];
    document.querySelectorAll('main *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 1) {
        const cls = (el.className || '').toString().slice(0, 60);
        if (over.length < 3) over.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(rect.right)}`);
      }
    });
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      overflowX: de.scrollWidth > de.clientWidth + 2,
      over,
    };
  });
  const flag = r.overflowX ? '⚠ 横向溢出' : '✓ 无横向溢出';
  console.log(`  ${name}: ${flag} (scrollW=${r.scrollW} clientW=${r.clientW})`);
  if (r.over.length) r.over.forEach((o) => console.log(`      → ${o}`));
  return r;
};

const targets = ['今日', '对话', '打字闯关', '写作树', '学习书库', '墨程', '词汇', '我的资料'];
const results = {};
for (const t of targets) {
  try {
    await go(t);
    results[t] = await measure(t);
    await page.screenshot({ path: `qa/mobile/${String(Object.keys(results).length).padStart(2, '0')}-${t}.png`, fullPage: false });
  } catch (e) {
    console.log(`  ${t}: 打开失败 ${(e.message || '').split('\n')[0].slice(0, 80)}`);
  }
}

const bad = Object.entries(results).filter(([, r]) => r.overflowX).map(([k]) => k);
console.log('\n横向溢出的模块:', bad.length ? bad.join('、') : '无');
console.log('pageerror:', errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') : '无');
console.log('测试账号:', U);
await browser.close();
