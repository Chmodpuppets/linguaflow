// 今日产出线（飞轮）三步闭环：writing(自由写) → dictation(听写) → script(文字特训) → 连胜 +1
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env'),'utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const AI_CONFIG = {
  active:'glm',
  qwen:{baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen3.8-flash',apiKey:env.QWEN_API_KEY},
  openrouter:{baseUrl:'https://openrouter.ai/api/v1',model:'z-ai/glm-5.3-flash',apiKey:env.OPENROUTER_API_KEY},
  glm:{baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-4-flash',apiKey:env.VITE_GLM_API_KEY},
  deepseek:{baseUrl:'https://api.deepseek.com/v1',model:'deepseek-chat',apiKey:''},
  custom:{baseUrl:'',model:'',apiKey:''},
  ttsVoice:'Cherry',
};
const browser = await chromium.launch({ channel:'chrome', args:['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport:{width:1440,height:950} });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0].slice(0,150)));
const llm = [];
page.on('response', r => { if (/llm\/chat/.test(r.url())) llm.push(r.status()); });

const fw = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_daily_flywheel') || 'null'));
const user = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user') || '{}'));
const goto = async (label, group) => {
  if (group) {
    const g = page.getByRole('button', { name:new RegExp(group) }).first();
    if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  }
  await page.getByRole('button', { name:label, exact:true }).first().click();
  await page.waitForTimeout(2500);
};

const username = `qa_fw_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA飞轮');
await page.getByRole('button', { name:/下一步/ }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click();
await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' });
await page.waitForTimeout(3500);
const lang = (await user()).learningLanguage;
console.log('学习语言:', lang, '| 初始连胜:', (await user()).currentStreak);

// ---- Step 1: 自由写 ----
console.log('\n--- 1) 墨程 · 自由写 ---');
await goto('墨程','精进');
await page.getByRole('button', { name:/自由写/ }).first().click();
await page.waitForTimeout(1200);
await page.locator('textarea').first().fill('今日は朝早く起きて、川沿いを散歩しました。空気が冷たく、街は静かでした。');
await page.waitForTimeout(600);
await page.getByRole('button', { name:/交给教练/ }).first().click();
await page.waitForTimeout(25000);
console.log('飞轮:', JSON.stringify((await fw())?.steps));

// ---- Step 2: 听写 ----
console.log('\n--- 2) 墨程 · 听写 ---');
await page.getByRole('button', { name:/听写/ }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name:/生成听写句/ }).first().click();
let sentence = false;
for (let i=0;i<25;i++){ await page.waitForTimeout(1500); if (await page.getByRole('button',{name:/对照原文/}).first().isVisible().catch(()=>false)) { sentence = true; break; } }
console.log('听写句生成:', sentence);
if (sentence) {
  await page.locator('textarea').first().fill('今日は朝早く起きて、川沿いを散歩しました。');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name:/校对完成/ }).first().click();
  await page.waitForTimeout(3000);
}
console.log('飞轮:', JSON.stringify((await fw())?.steps));

// ---- Step 3: 文字特训 ----
console.log('\n--- 3) 文字特训 ---');
await goto('文字特训','精进');
const packBtns = await page.locator('button:visible').allTextContents();
console.log('按钮:', packBtns.map(t=>t.trim().replace(/\s+/g,' ')).filter(Boolean).slice(10,26).join(' | '));
// 选第一个字形包，再选第一个分组
const pack = page.locator('button:visible').filter({ hasText:/日语五十音/ }).first();
if (await pack.isVisible().catch(()=>false)) { await pack.click(); await page.waitForTimeout(1500); }
const grp = page.locator('button:visible').filter({ hasText:/平假名/ }).first();
if (await grp.isVisible().catch(()=>false)) { await grp.click(); await page.waitForTimeout(2000); }
else console.log('未找到分组按钮 ⚠');
for (let n=0; n<70; n++) {
  const input = page.getByPlaceholder(/输入罗马字|输入/).first();
  if (await input.isVisible().catch(()=>false) && await input.isEnabled().catch(()=>false)) {
    await input.fill('a');
    await page.waitForTimeout(300);
    const sub = page.getByRole('button', { name:'提交', exact:true }).first();
    if (await sub.isVisible().catch(()=>false)) { await sub.click(); await page.waitForTimeout(800); }
    else await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
  }
  const nextBtn = page.getByRole('button', { name:/下一个|完成/ }).first();
  if (await nextBtn.isVisible().catch(()=>false)) { await nextBtn.click(); await page.waitForTimeout(900); }
  else break;
  const done = await page.getByText(/本轮完成/).first().isVisible().catch(()=>false);
  if (done) break;
}
console.log('本轮完成可见:', await page.getByText(/本轮完成/).first().isVisible().catch(()=>false));
console.log('飞轮:', JSON.stringify((await fw())?.steps));

// ---- Step 4: 回今日看连胜 ----
console.log('\n--- 4) 回到今日 ---');
await goto('今日','学习');
await page.waitForTimeout(2500);
const f = await fw();
const u = await user();
console.log('飞轮最终:', JSON.stringify(f?.steps), 'allDone=', f?.allDone);
console.log('连胜:', u.currentStreak, '| lastStreakDate:', u.lastStreakDate, '| XP:', u.progress?.[lang]?.xp);
console.log('/llm/chat 状态码:', llm.join(', '));

// ---- Step 5: 模拟「昨天已完成、今天再来」→ 连胜应 +1 ----
console.log('\n--- 5) 跨天续签验证 ---');
const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
await page.evaluate(([d]) => {
  const u = JSON.parse(localStorage.getItem('linguaflow_user') || '{}');
  u.lastStreakDate = d;
  localStorage.setItem('linguaflow_user', JSON.stringify(u));
}, [y]);
const before5 = (await user()).currentStreak;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await goto('今日', '学习');
await page.waitForTimeout(2500);
const u5 = await user();
console.log(`lastStreakDate 改为 ${y} 后：连胜 ${before5} → ${u5.currentStreak}（期望 +1）｜今日=${u5.lastStreakDate}`);
console.log('pageerror:', errs.length ? [...new Set(errs)].slice(0,3).join(' | ') : '无');
await browser.close();
