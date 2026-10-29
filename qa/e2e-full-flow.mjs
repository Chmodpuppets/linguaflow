// 全系统端到端体检
//   stage=modules  : 22 个导航模块逐个点开，抓 pageerror / console error / 4xx-5xx / 空屏
//   stage=loop     : 核心学习闭环（对话台 AI 回复 → 墨程自由写 → 飞轮点亮 → 词汇 → 打字）
//   stage=all      : 依次跑完
// 用法: node qa/e2e-full-flow.mjs [stage]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];

const BASE_URL = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const STAGE = process.argv[2] || 'all';
const ROOT = path.resolve(import.meta.dirname, '..');

// --- 读 .env 里的 key（只用于本地测试注入，不落盘、不打印）---
const envRaw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const env = Object.fromEntries(
  envRaw.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const GLM_KEY = env.VITE_GLM_API_KEY || '';
const QWEN_KEY = env.QWEN_API_KEY || '';
const OR_KEY = env.OPENROUTER_API_KEY || '';

const AI_CONFIG = {
  active: 'glm',
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-flash', apiKey: QWEN_KEY },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-5.3-flash', apiKey: OR_KEY },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiKey: GLM_KEY },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '' },
  custom: { baseUrl: '', model: '', apiKey: '' },
  ttsVoice: 'Cherry',
};

const NAV = [
  ['conversation', '对话', '学习'], ['daily', '今日', '学习'], ['typing', '打字闯关', '学习'],
  ['books', '书架', '学习'], ['study_library', '学习书库', '学习'], ['vocabulary', '词汇', '学习'],
  ['writing', '写作工坊', '学习'], ['rpg', '剧情对话', '学习'],
  ['writing_tree', '写作树', '精进'], ['composition_studio', '作文流水线', '精进'],
  ['ink_quest', '墨程', '精进'], ['script_trainer', '文字特训', '精进'],
  ['errorbook', '错题本', '精进'], ['error_patterns', '错误模式', '精进'],
  ['library', '记忆库', '资源'], ['content_repo', '内容仓库', '资源'], ['import', '导入', '资源'],
  ['song_lab', '歌曲跟打', '资源'], ['trend', '写作趋势', '资源'], ['portfolio', '作品集', '资源'],
  ['social', '学习搭子', '社区'], ['profile', '我的资料', '社区'],
];

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

let bucket = { pageerrors: [], consoleErrors: [], netFails: [] };
const llmLog = [];
page.on('pageerror', (e) => bucket.pageerrors.push(e.message.split('\n')[0].slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') bucket.consoleErrors.push(m.text().split('\n')[0].slice(0, 160)); });
page.on('response', (r) => {
  const s = r.status();
  const u = r.url();
  if (/llm\/chat/.test(u)) llmLog.push(s);
  if (s >= 400 && !/favicon/.test(u)) {
    const host = (() => { try { return new URL(u).host; } catch { return ''; } })();
    bucket.netFails.push(`${s} ${host}${(() => { try { return new URL(u).pathname; } catch { return ''; } })()}`);
  }
});
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!/favicon/.test(u)) bucket.netFails.push(`FAIL ${u.slice(0, 80)} ${r.failure()?.errorText || ''}`);
});
const drain = () => { const b = bucket; bucket = { pageerrors: [], consoleErrors: [], netFails: [] }; return b; };

// ---------- 注册 + 向导 ----------
console.log('=== 注册 + 新手向导 ===');
// 服务端注册限流 = 单 IP 每小时 20 次；QA 复用已有账号时走登录，避免打满限流
const REUSE = process.env.QA_REUSE_USER || '';
const username = REUSE || `qa_flow_${Date.now().toString().slice(-8)}`;
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
if (REUSE) {
  await page.getByRole('button', { name: '登录', exact: true }).first().click(); // 切到登录 tab
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '登录', exact: true }).last().click();  // 提交
} else {
  await page.getByRole('button', { name: '注册并进入' }).click();
}
await page.waitForTimeout(3000);
// 复用老账号时可能不再走新手向导（本地档案已存在于云端），需容忍跳过
const hasOnboarding = await page.getByPlaceholder('输入你的昵称').isVisible().catch(() => false);
if (hasOnboarding) {
  await page.getByPlaceholder('输入你的昵称').fill('QA全流程');
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /开始学习/ }).click();
  await page.waitForTimeout(3000);
} else {
  console.log('（跳过新手向导：复用已有账号）');
  await page.waitForTimeout(2500);
}
const landed = await page.evaluate(() => !!localStorage.getItem('linguaflow_user'));
console.log('进入应用:', landed, '| 用户:', username);
console.log('向导阶段错误:', JSON.stringify(drain()));

// ---------- 注入 AI Key（生产构建无内置 Key）----------
await page.evaluate((cfg) => {
  localStorage.setItem('linguaflow_ai_config', JSON.stringify(cfg));
}, AI_CONFIG);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const cfgOk = await page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('linguaflow_ai_config') || '{}');
  return { active: c.active, glmHasKey: !!(c.glm && c.glm.apiKey), qwenHasKey: !!(c.qwen && c.qwen.apiKey) };
});
console.log('注入 AI 配置:', JSON.stringify(cfgOk));
drain();

const readUser = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user') || '{}'));

// ---------- Stage 1: 模块冒烟 ----------
if (STAGE === 'all' || STAGE === 'modules') {
  console.log('\n=== Stage 1: 22 个模块冒烟 ===');
  // 展开所有分组
  for (const g of ['精进', '资源', '社区']) {
    const btn = page.getByRole('button', { name: new RegExp(g) }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(400); }
  }

  const rows = [];
  for (const [id, label] of NAV) {
    drain();
    const navBtn = page.getByRole('button', { name: label, exact: true }).first();
    if (!(await navBtn.isVisible().catch(() => false))) {
      // 组可能被再次收起，尝试点开组
      rows.push([label, 'NAV_NOT_VISIBLE', '', '']);
      continue;
    }
    await navBtn.click();
    await page.waitForTimeout(2600);
    const b = drain();
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    const len = text.length;
    const crashed = /Application error|Something went wrong|Uncaught|Minified React error/i.test(text);
    // 统计主内容区可见元素数（判断空屏）
    const nodes = await page.locator('main *').count().catch(() => 0);
    const status = crashed ? 'CRASH' : len < 120 ? 'EMPTY' : b.pageerrors.length ? 'PAGEERROR' : (b.netFails.length ? 'NET' : 'OK');
    rows.push([label, status, `text=${len} nodes=${nodes}`, [...new Set(b.pageerrors)].slice(0, 2).join(' | ') || [...new Set(b.netFails)].slice(0, 2).join(' | ')]);
    if (status !== 'OK') {
      try { await page.screenshot({ path: `/tmp/qa-mod-${id}.png`, fullPage: false }); } catch {}
    }
  }
  console.log('模块'.padEnd(12) + '状态'.padEnd(12) + '内容');
  for (const [label, status, info, err] of rows) {
    console.log(`${label.padEnd(12)}${status.padEnd(12)}${info}${err ? '  ⚠ ' + err : ''}`);
  }
  const bad = rows.filter((r) => r[1] !== 'OK');
  console.log(`\n模块结果: ${rows.length - bad.length}/${rows.length} OK；异常: ${bad.map((r) => r[0]).join(', ') || '无'}`);
}

// ---------- Stage 2: 核心学习闭环 ----------
if (STAGE === 'all' || STAGE === 'loop') {
  const goto = async (label, group) => {
    if (group) {
      const gbtn = page.getByRole('button', { name: new RegExp(group) }).first();
      const expanded = await gbtn.getAttribute('aria-expanded');
      if (expanded === 'false') { await gbtn.click(); await page.waitForTimeout(400); }
    }
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.waitForTimeout(2200);
  };

  console.log('\n=== Stage 2a: 对话台 —— AI 是否真的回内容 ===');
  drain();
  llmLog.length = 0;
  await goto('对话', '学习');
  const before = await readUser();
  const input = page.locator('textarea').first();
  if (await input.isVisible().catch(() => false)) {
    const mine = 'こんにちは。今日の練習を一言で提案してください。';
    await input.fill(mine);
    await page.keyboard.press('Enter');
    let reply = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      reply = await page.evaluate((sent) => {
        const els = Array.from(document.querySelectorAll('div,p,span'))
          .map((e) => (e.textContent || '').trim())
          .filter((t) => t.length > 12 && t !== sent && !/Enter 发送|Shift|AI 生成|正在|思考/.test(t));
        return els[els.length - 1] || '';
      }, mine);
      if (reply && reply.length > 15) break;
    }
    const b = drain();
    console.log(`/llm/chat 状态码序列: [${llmLog.join(', ')}]`);
    console.log(`AI 回复片段: ${JSON.stringify(String(reply).slice(0, 150))}`);
    console.log(`pageerror: ${b.pageerrors.length ? [...new Set(b.pageerrors)].slice(0, 3).join(' | ') : '无'}`);
  } else {
    console.log('未找到输入框 ⚠');
  }

  console.log('\n=== Stage 2b: 今日产出线（飞轮）===');
  drain();
  await goto('今日', '学习');
  const fwBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_daily_flywheel') || 'null'));
  console.log('飞轮初始:', fwBefore ? `${JSON.stringify(fwBefore.steps)} allDone=${fwBefore.allDone}` : '(null)');

  console.log('\n=== Stage 2c: 墨程 · 自由写（飞轮 writing 步）===');
  await goto('墨程', '精进');
  const freeTab = page.getByRole('button', { name: /自由写/ }).first();
  if (await freeTab.isVisible().catch(() => false)) { await freeTab.click(); await page.waitForTimeout(1200); }
  const ta = page.locator('textarea').first();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill('今日は朝早く起きて、川沿いを散歩しました。空気が冷たくて、街は静かでした。');
    await page.waitForTimeout(800);
    const coach = page.getByRole('button', { name: /交给教练/ }).first();
    if (await coach.isVisible().catch(() => false)) {
      await coach.click();
      await page.waitForTimeout(25000); // AI 批改
      console.log('已点「交给教练」，批改后页面片段:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(200, 600));
    } else {
      console.log('未找到「交给教练」按钮 ⚠');
    }
  } else {
    console.log('墨程未找到写作框 ⚠');
  }
  const ic = drain();
  console.log(`墨程 AI 批改 /llm/chat 异常: ${ic.netFails.filter((f) => /llm\/chat/.test(f)).join(' | ') || '无'}；pageerror=${ic.pageerrors.length}`);
  await goto('今日', '学习');
  const fwAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_daily_flywheel') || 'null'));
  console.log('飞轮提交后:', fwAfter ? `${JSON.stringify(fwAfter.steps)} allDone=${fwAfter.allDone}` : '(null)');

  console.log('\n=== Stage 2d: 词汇（添加 + 保存）===');
  drain();
  await goto('词汇', '学习');
  const vocabBefore = await page.evaluate(() => (JSON.parse(localStorage.getItem('linguaflow_vocabulary') || '[]')).length);
  const addBtn = page.getByRole('button', { name: /添加单词|添加第一个单词/ }).first();
  let vocabAfter = vocabBefore;
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    await page.getByPlaceholder(/输入单词/).fill('serendipity');
    await page.getByPlaceholder(/含义/).fill('意外发现美好事物的运气');
    await page.waitForTimeout(400);
    const saveBtn = page.getByRole('button', { name: /保存单词/ }).first();
    if (await saveBtn.isVisible().catch(() => false)) { await saveBtn.click(); await page.waitForTimeout(2500); }
    vocabAfter = await page.evaluate(() => (JSON.parse(localStorage.getItem('linguaflow_vocabulary') || '[]')).length);
  } else {
    console.log('未找到「添加单词」按钮 ⚠');
  }
  console.log(`词汇条数: ${vocabBefore} → ${vocabAfter}`);

  console.log('\n=== Stage 2e: 打字闯关 ===');
  drain();
  await goto('打字闯关', '学习');
  const typeText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  console.log('打字页片段:', typeText);
  const tb = drain();
  console.log(`打字页错误: pageerror=${tb.pageerrors.length} net=${tb.netFails.length}`);

  console.log('\n=== Stage 2f: 剧情对话（大厅 + 场景）===');
  drain();
  await goto('剧情对话', '学习');
  const rpgText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  console.log('剧情页片段:', rpgText);
  const rb = drain();
  console.log(`剧情页错误: pageerror=${rb.pageerrors.length} net=${rb.netFails.length}`);
}

// ---------- Stage 3: 持久化 ----------
if (STAGE === 'all' || STAGE === 'loop') {
  console.log('\n=== Stage 3: 刷新后数据是否保留 ===');
  const u1 = await readUser();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const u2 = await readUser();
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('linguaflow_')).length);
  console.log(`XP: ${u1.progress?.[u1.learningLanguage]?.xp ?? '?'} → ${u2.progress?.[u2.learningLanguage]?.xp ?? '?'}`);
  console.log(`连胜: ${u1.currentStreak} → ${u2.currentStreak}；最近打卡: ${u2.lastStreakDate}`);
  console.log(`localStorage 键数: ${keysBefore}`);
  console.log(`登录态保持: ${!!u2.username}（${u2.username}）`);
}

await browser.close();
