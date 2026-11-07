import { chromium } from 'playwright';

for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];

const BASE = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const U = process.env.U || 'qa_ls817363';
const P = process.env.P || 'qa-test-123456';

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

const mockTasks = [
  { module: 'vocabulary', star: 1, durationMin: 5, xp: 10, title: '英语高频问候词 10 个', detail: 'AI mock：英语 A1 问候词' },
  { module: 'typing', star: 2, durationMin: 10, xp: 20, title: '英语短句打字练习', detail: 'AI mock：英语短句' },
  { module: 'writing', star: 3, durationMin: 20, xp: 35, title: '写一段英语自我介绍', detail: 'AI mock：英语写作' },
];

const b = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  [pageerror]', e.message));

let llmCalls = 0;
const mockLlm = async (route) => {
  llmCalls++;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockTasks) } }] }),
  });
};
await ctx.route('**/llm/chat', mockLlm);
await ctx.route('**/chat/completions', mockLlm);

// 登录
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

// 造现场：有 Key、未授权、今日任务缓存清空 → 打开「对话」必然触发一次 AI 调用
await p.evaluate(() => {
  localStorage.setItem('linguaflow_ai_config', JSON.stringify({
    active: 'glm',
    glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiKey: 'QA_FAKE_KEY_NOT_REAL' },
  }));
  localStorage.removeItem('linguaflow_ai_consent_v1');
  localStorage.removeItem('linguaflow_daily_tasks');
});
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);

// 1) 首次 AI 调用 → 弹窗
await p.getByRole('button', { name: /^对话$/ }).first().click();
await p.waitForTimeout(1800);
const dialog = p.getByRole('dialog');
const dlgVisible = await dialog.isVisible().catch(() => false);
console.log('1) 首次 AI 调用是否弹窗:', dlgVisible, '| LLM 请求数:', llmCalls);
dlgVisible ? ok('自动触发的「今日任务」被授权闸门拦住') : bad('没有弹出授权说明');
llmCalls === 0 ? ok('未授权前没有任何请求发到模型厂商') : bad(`未授权前已发出 ${llmCalls} 次请求`);
if (dlgVisible) {
  const txt = await dialog.innerText();
  console.log('   弹窗文案片段:', txt.slice(0, 120).replace(/\n+/g, ' | '));
  for (const [label, re] of [['自己的 Key', /自己的 Key/], ['服务器中转', /中转/], ['180 天留痕', /180 天/], ['可随时关闭', /关闭/]]) {
    re.test(txt) ? ok(`披露项：${label}`) : bad(`弹窗缺少：${label}`);
  }
  /今日任务规划/.test(txt) ? ok('弹窗点名了触发功能（今日任务规划）') : bad('未显示触发功能');
  /glm-4-flash/.test(txt) ? ok('弹窗点名了实际模型') : bad('未显示模型');
}
await p.screenshot({ path: 'qa-screenshots/shot-ai-consent-dialog.png' });

// 2) 允许 → 原来那次调用直接继续（不需要重新点按钮）
await dialog.getByRole('button', { name: '允许使用 AI' }).click();
await p.waitForTimeout(2500);
const afterAllow = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('linguaflow_daily_tasks') || '{}');
  const all = Object.values(d.byLang || {}).flatMap((x) => x.tasks || []);
  return { consent: localStorage.getItem('linguaflow_ai_consent_v1'), ids: all.map((t) => t.id), titles: all.map((t) => t.title) };
});
console.log('2) 允许后:', JSON.stringify(afterAllow));
afterAllow.consent === 'granted' ? ok('授权状态已写入') : bad('未写入 granted');
afterAllow.ids.some((id) => id.startsWith('ai-')) ? ok('被拦住的那次调用自动续跑，拿到 AI 任务') : bad('未自动续跑（任务仍是本地兜底）');
llmCalls > 0 ? ok(`授权后共发出 ${llmCalls} 次模型请求`) : bad('授权后没有发出请求');
(await p.getByRole('dialog').count()) === 0 ? ok('弹窗已关闭') : bad('弹窗未关闭');
await p.screenshot({ path: 'qa-screenshots/shot-ai-consent-granted.png' });

// 3) 模型设置里的全局开关（「我的资料」在默认折叠的「社区」分组里）
let profileBtn = p.getByRole('button', { name: /我的资料/ });
if (!(await profileBtn.first().isVisible().catch(() => false))) {
  await p.getByRole('button', { name: /社区/ }).first().click();
  await p.waitForTimeout(400);
}
await profileBtn.first().click();
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /模型设置/ }).first().click();
await p.waitForTimeout(800);
const sw = p.getByRole('switch', { name: '允许调用 AI' });
console.log('3) 开关 aria-checked:', await sw.getAttribute('aria-checked'));
(await sw.getAttribute('aria-checked')) === 'true' ? ok('设置页开关与弹窗状态同步为已允许') : bad('开关未同步');
await p.screenshot({ path: 'qa-screenshots/shot-ai-consent-toggle.png' });
await sw.click();
await p.waitForTimeout(500);
(await sw.getAttribute('aria-checked')) === 'false' ? ok('关掉开关后状态变为已关闭') : bad('开关关不掉');
const consentOff = await p.evaluate(() => localStorage.getItem('linguaflow_ai_consent_v1'));
consentOff === 'denied' ? ok('持久化 denied') : bad('未持久化 denied: ' + consentOff);

// 4) 关闭后：不再弹窗、不再发请求、走本地兜底
const callsBefore = llmCalls;
await p.evaluate(() => localStorage.removeItem('linguaflow_daily_tasks'));
await p.getByRole('button', { name: /^对话$/ }).first().click();
await p.waitForTimeout(2800);
const afterDeny = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('linguaflow_daily_tasks') || '{}');
  return Object.values(d.byLang || {}).flatMap((x) => x.tasks || []).map((t) => t.id);
});
console.log('4) 关闭后任务 id:', JSON.stringify(afterDeny), '| 新增请求:', llmCalls - callsBefore);
llmCalls === callsBefore ? ok('关闭后零模型请求') : bad(`关闭后仍发了 ${llmCalls - callsBefore} 次请求`);
(await p.getByRole('dialog').count()) === 0 ? ok('关闭后不再弹窗') : bad('关闭后仍弹窗');
afterDeny.length > 0 && afterDeny.every((id) => id.startsWith('local-')) ? ok('全部走本地兜底') : bad('未走本地兜底');

// 5) 刷新仍保持关闭
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
const consentReload = await p.evaluate(() => localStorage.getItem('linguaflow_ai_consent_v1'));
console.log('5) 刷新后:', consentReload);
consentReload === 'denied' ? ok('刷新后仍为已关闭') : bad('刷新后授权状态丢失');

await b.close();
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
