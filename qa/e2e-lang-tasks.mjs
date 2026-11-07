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

// 登录（已注册账号）
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

// 造一份「日语任务已缓存」的现场
const seed = await p.evaluate(() => {
  const today = new Date().toISOString().slice(0, 10);
  const u = JSON.parse(localStorage.getItem('linguaflow_user') || '{}');
  u.learningLanguage = 'Japanese';
  u.progress = u.progress || {};
  u.progress.Japanese = u.progress.Japanese || { xp: 0, level: 1, cefrLevel: 'A1', totalWordsTyped: 0, lastActive: Date.now(), maxUnlockedStage: 0 };
  // 切换器现在只列「已开启」语言 → English 也要有进度记录才会出现在下拉里
  u.progress.English = u.progress.English || { xp: 0, level: 1, cefrLevel: 'B1', totalWordsTyped: 0, lastActive: Date.now(), maxUnlockedStage: 0 };
  localStorage.setItem('linguaflow_user', JSON.stringify(u));
  const jaTasks = [
    { id: 'ja-1', module: 'vocabulary', star: 2, durationMin: 10, xp: 15, title: '基础问候与自我介绍词汇', detail: '学习 15 个 A1 日语常用问候与自我介绍词汇' },
    { id: 'ja-2', module: 'typing', star: 3, durationMin: 18, xp: 30, title: '平假名短句输入练习', detail: '通过罗马字输入 20 个 A1 日语短句' },
    { id: 'ja-3', module: 'writing', star: 4, durationMin: 30, xp: 45, title: '编写日语自我介绍段落', detail: '用平假名和简单汉字写 8 到 10 句自我介绍' },
  ];
  localStorage.setItem('linguaflow_daily_tasks', JSON.stringify({
    date: today,
    byLang: { Japanese: { tasks: jaTasks, done: { 'ja-1': 2 }, chest: { opened: true, reward: 88 } } },
  }));
  return { lang: u.learningLanguage, today };
});
console.log('0) 已写入日语现场:', JSON.stringify(seed));

await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);

// 进「对话」页
await p.getByRole('button', { name: /^对话$/ }).first().click();
await p.waitForTimeout(2500);
const bodyJa = await p.locator('body').innerText();
console.log('1) 切换前含日语任务:', /基础问候与自我介绍词汇/.test(bodyJa));
/基础问候与自我介绍词汇/.test(bodyJa) ? ok('日语任务按缓存显示') : bad('日语任务未显示（seed 未生效）');
/1\/3 完成|完成 1/.test(bodyJa) ? ok('日语完成态已恢复（ja-1 已通关）') : console.log('   （完成态文案未匹配，非关键）');

// 切到英语
await p.getByRole('button', { name: /当前学习语言/ }).click();
await p.waitForTimeout(300);
await p.getByRole('listbox').getByRole('option', { name: /English/ }).click();
await p.waitForTimeout(4500);
const bodyEn = await p.locator('body').innerText();
const stillJa = /基础问候与自我介绍词汇|平假名短句输入练习/.test(bodyEn);
console.log('2) 切英语后是否仍显示日语任务:', stillJa);
stillJa ? bad('切语言后仍显示日语任务（未修复）') : ok('切换后不再显示日语任务');
const taskTitles = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('linguaflow_daily_tasks') || '{}');
  return Object.fromEntries(Object.entries(d.byLang || {}).map(([k, v]) => [k, (v.tasks || []).map((t) => t.title)]));
});
console.log('3) 缓存里的语言分桶:', JSON.stringify(taskTitles, null, 1));
taskTitles.English?.length === 3 ? ok('已为 English 生成独立任务') : bad('English 没有独立任务');
taskTitles.Japanese?.[0] === '基础问候与自我介绍词汇' ? ok('日语任务仍保留在各自分桶') : bad('日语分桶被覆盖');
await p.screenshot({ path: 'qa-screenshots/shot-lang-tasks-en.png' });

// 切回日语 → 原任务（含完成态）应原样回来
await p.getByRole('button', { name: /当前学习语言/ }).click();
await p.waitForTimeout(300);
await p.getByRole('listbox').getByRole('option', { name: /日本語/ }).click();
await p.waitForTimeout(3000);
const bodyBack = await p.locator('body').innerText();
console.log('4) 切回日语:', /基础问候与自我介绍词汇/.test(bodyBack));
/基础问候与自我介绍词汇/.test(bodyBack) ? ok('日语任务原样恢复（未重复生成）') : bad('切回后日语任务丢失');
await p.screenshot({ path: 'qa-screenshots/shot-lang-tasks-back.png' });

await b.close();
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
