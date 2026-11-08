import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const U = process.env.U || 'qa_ls817363';
const P = process.env.P || 'qa-test-123456';

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

const tasks = [
  { id: 'seed-vocab', module: 'vocabulary', star: 1, durationMin: 5, xp: 10, title: '导入并认识 A1 起步词', detail: '一键导入内置 A1 高频词', target: 'starter_vocab' },
  { id: 'seed-kana', module: 'typing', star: 3, durationMin: 18, xp: 30, title: '五十音键盘输入练习', detail: '平假名与片假名打字', target: 'kana' },
  { id: 'seed-writing', module: 'writing', star: 4, durationMin: 30, xp: 60, title: '简单自我介绍短文', detail: '写一段自我介绍' },
];

const b = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  [pageerror]', e.message));
let llmCalls = 0;
await ctx.route('**/llm/chat', async (route) => { llmCalls++; await route.abort(); });
await ctx.route('**/chat/completions', async (route) => { llmCalls++; await route.abort(); });

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

// 现场：日语新人、词库空、AI 关闭、任务已带精确落点
await p.evaluate((tasks) => {
  const today = new Date().toISOString().slice(0, 10);
  const u = JSON.parse(localStorage.getItem('linguaflow_user') || '{}');
  u.learningLanguage = 'Japanese';
  u.progress = u.progress || {};
  for (const lang of ['Japanese', 'English']) {
    u.progress[lang] = u.progress[lang] || { xp: 0, level: 1, cefrLevel: 'A1', totalWordsTyped: 0, lastActive: Date.now(), maxUnlockedStage: 0 };
  }
  localStorage.setItem('linguaflow_user', JSON.stringify(u));
  localStorage.setItem('linguaflow_ai_consent_v1', 'denied');
  localStorage.removeItem('linguaflow_vocabulary');
  localStorage.removeItem('linguaflow_ai_config');
  localStorage.setItem('linguaflow_daily_tasks', JSON.stringify({
    date: today,
    byLang: { Japanese: { tasks, done: {}, chest: { opened: false, reward: null } } },
  }));
}, tasks);
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2600);

// 1) 对话台任务
await p.getByRole('button', { name: /^对话$/ }).first().click();
await p.waitForTimeout(1500);
const body0 = await p.locator('body').innerText();
console.log('1) 任务标题:', body0.includes('导入并认识 A1 起步词'), body0.includes('五十音键盘输入练习'));
/导入并认识 A1 起步词/.test(body0) ? ok('词汇任务不再承诺「复习已有词」') : bad('词汇任务文案不对');
/五十音键盘输入练习/.test(body0) ? ok('五十音任务可见') : bad('五十音任务缺失');

// 2) 词汇任务「开始」→ 导入按钮 → 真有词
await p.getByRole('button', { name: '开始', exact: true }).nth(0).click();
await p.waitForTimeout(1600);
const impBtn = p.getByRole('button', { name: /导入 .* A1 起步词/ });
const impVisible = await impBtn.isVisible().catch(() => false);
console.log('2) 词库导入按钮:', impVisible);
impVisible ? ok('点开始直达词库，一键导入入口可见') : bad('词库没有导入入口');
await p.screenshot({ path: 'qa-screenshots/shot-newcomer-vocab-empty.png' });
if (impVisible) await impBtn.click();
await p.waitForTimeout(1200);
const vocabCount = await p.evaluate(() => {
  const v = JSON.parse(localStorage.getItem('linguaflow_vocabulary') || '[]');
  return { total: v.length, ja: v.filter((i) => i.language === 'Japanese').length };
});
console.log('   导入后词库:', JSON.stringify(vocabCount));
vocabCount.ja === 20 ? ok('导入 20 个日语 A1 起步词（内置 JLPT 派生）') : bad(`导入数 ${vocabCount.ja} ≠ 20`);
await p.screenshot({ path: 'qa-screenshots/shot-newcomer-vocab-filled.png' });

// 3) 五十音任务「开始」→ 直达静态假名关卡
await p.getByRole('button', { name: /^对话$/ }).first().click();
await p.waitForTimeout(1200);
await p.getByRole('button', { name: '开始', exact: true }).nth(1).click();
await p.waitForTimeout(1800);
const bodyKana = await p.locator('body').innerText();
console.log('3) 打字页含假名:', /あいうえお/.test(bodyKana), '| 罗马字提示:', /a i u e o/.test(bodyKana));
/あいうえお/.test(bodyKana) ? ok('任务直达五十音关卡，页面真的有假名可打') : bad('点开始后没有进入假名练习');
/a i u e o/.test(bodyKana) ? ok('专项练习显示罗马字提示（不受硬核模式限制）') : bad('罗马字提示被硬核模式吞掉');
await p.screenshot({ path: 'qa-screenshots/shot-newcomer-kana-task.png' });

// 4) 侧栏直接进打字页 → 五十音卡片 + 8 个关卡
await p.getByRole('button', { name: /^今日$/ }).first().click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: /^打字闯关$/ }).first().click();
await p.waitForTimeout(1500);
const bodyStage = await p.locator('body').innerText();
/五十音打字特训/.test(bodyStage) ? ok('打字闯关出现「五十音打字特训」卡片') : bad('缺五十音卡片');
const kanaBtns = p.getByRole('button', { name: /平假名 ·|片假名 ·|浊音 ·|拗音 ·/ });
const kanaBtnCount = await kanaBtns.count();
console.log('4) 五十音关卡按钮数:', kanaBtnCount);
kanaBtnCount === 8 ? ok('8 组关卡齐全') : bad(`关卡按钮 ${kanaBtnCount} ≠ 8`);
await p.screenshot({ path: 'qa-screenshots/shot-newcomer-kana-panel.png' });

// 5) 点片假名关卡 → 片假名内容（全程零 AI 请求）
if (kanaBtnCount >= 3) {
  await kanaBtns.nth(2).click();
  await p.waitForTimeout(1200);
  const bodyKata = await p.locator('body').innerText();
  /アイウエオ/.test(bodyKata) ? ok('片假名关卡加载出片假名文本') : bad('片假名关卡内容异常');
  await p.screenshot({ path: 'qa-screenshots/shot-newcomer-kata-drill.png' });
}
console.log('5) 全程模型请求数:', llmCalls);
llmCalls === 0 ? ok('AI 关闭 / 无 Key 也能完整练五十音') : bad(`发生了 ${llmCalls} 次模型请求`);

await b.close();
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
