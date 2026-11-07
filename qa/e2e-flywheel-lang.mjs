import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const U = process.env.U || 'qa_ls817363';
const P = process.env.P || 'qa-test-123456';

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

const b = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  [pageerror]', e.message));

await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
if (await p.getByPlaceholder('用户名').count()) {
  await p.getByPlaceholder('用户名').fill(U);
  await p.getByPlaceholder(/密码/).fill(P);
  await p.getByRole('button', { name: '登录', exact: true }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: '登录', exact: true }).last().click();
  await p.waitForTimeout(3500);
}
await p.locator('aside').waitFor({ timeout: 15000 });

// 现场：日语飞轮 3/3 完成，英语 0/2 全新；两门语言都已开启
await p.evaluate(() => {
  const today = new Date().toISOString().slice(0, 10);
  const u = JSON.parse(localStorage.getItem('linguaflow_user') || '{}');
  u.learningLanguage = 'Japanese';
  u.progress = u.progress || {};
  for (const lang of ['Japanese', 'English']) {
    u.progress[lang] = u.progress[lang] || { xp: 0, level: 1, cefrLevel: 'A1', totalWordsTyped: 0, lastActive: Date.now(), maxUnlockedStage: 0 };
  }
  localStorage.setItem('linguaflow_user', JSON.stringify(u));
  const base = { date: today, themeId: 'd1', theme: '今天的一件小事', themePrompt: '写一件今天发生的小事' };
  localStorage.setItem('linguaflow_daily_flywheel', JSON.stringify({
    date: today,
    byLang: {
      Japanese: { ...base, steps: { writing: true, dictation: true, script: true }, allDone: true, reflection: '日语今日产出线完成' },
      English: { ...base, steps: { writing: false, dictation: false, script: false }, allDone: false },
    },
  }));
});
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2800);

const titleText = async () => {
  const sec = p.locator('section').filter({ hasText: '今日产出线' }).first();
  return (await sec.innerText()).slice(0, 260).replace(/\n+/g, ' | ');
};

// 1) 日语：3/3 且标题点名语言
let t = await titleText();
console.log('1) 日语视图:', t);
/日本語/.test(t) ? ok('标题标注当前语言 日本語') : bad('标题未标注语言');
/3\/3/.test(t) ? ok('日语显示 3/3 完成') : bad('日语未显示 3/3');
await p.screenshot({ path: 'qa-screenshots/shot-flywheel-ja.png' });

// 2) 切英语：应是全新 0/2，而不是沿用日语的完成态
await p.getByRole('button', { name: /当前学习语言/ }).click();
await p.waitForTimeout(300);
await p.getByRole('listbox').getByRole('option', { name: /English/ }).click();
await p.waitForTimeout(2200);
t = await titleText();
console.log('2) 英语视图:', t);
/English/.test(t) ? ok('标题切换到 English') : bad('标题未切换');
/0\/2/.test(t) ? ok('英语显示 0/2（不再串用日语完成态）') : bad('英语未显示 0/2');
await p.screenshot({ path: 'qa-screenshots/shot-flywheel-en.png' });

// 3) 切回日语：完成态仍在
await p.getByRole('button', { name: /当前学习语言/ }).click();
await p.waitForTimeout(300);
await p.getByRole('listbox').getByRole('option', { name: /日本語/ }).click();
await p.waitForTimeout(2200);
t = await titleText();
console.log('3) 切回日语:', t.slice(0, 120));
/3\/3/.test(t) ? ok('日语完成态原样保留') : bad('日语完成态丢失');

// 4) 两个分桶都还在
const store = await p.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_daily_flywheel') || '{}'));
console.log('4) 分桶:', Object.keys(store.byLang || {}).join(', '));
const ja = store.byLang?.Japanese, en = store.byLang?.English;
ja?.allDone && en && !en.allDone ? ok('两门语言的飞轮状态独立保存') : bad('分桶状态异常');

await b.close();
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
