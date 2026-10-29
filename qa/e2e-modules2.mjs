// 实操：写作工坊 / 作文流水线 / 写作树 / 剧情对话 / 打字闯关 —— 真实走一遍并看 AI 是否返回
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'https://linguaflow.pathmora.cn';
const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env'),'utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const AI_CONFIG = { active:'glm',
  qwen:{baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen3.8-flash',apiKey:env.QWEN_API_KEY},
  openrouter:{baseUrl:'https://openrouter.ai/api/v1',model:'z-ai/glm-5.3-flash',apiKey:env.OPENROUTER_API_KEY},
  glm:{baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-4-flash',apiKey:env.VITE_GLM_API_KEY},
  deepseek:{baseUrl:'https://api.deepseek.com/v1',model:'deepseek-chat',apiKey:''},
  custom:{baseUrl:'',model:'',apiKey:''}, ttsVoice:'Cherry' };

const browser = await chromium.launch({ channel:'chrome', args:['--no-proxy-server'] });
const ctx = await browser.newContext({ viewport:{width:1440,height:950} });
const page = await ctx.newPage();
const errs = []; const llm = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0].slice(0,150)));
page.on('response', r => { if (/llm\/chat/.test(r.url())) llm.push(r.status()); });

const user = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user')||'{}'));
const goto = async (label, group) => {
  if (group) {
    const g = page.getByRole('button', { name:new RegExp(group) }).first();
    if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  }
  await page.getByRole('button', { name:label, exact:true }).first().click();
  await page.waitForTimeout(2800);
};
const snap = async (t) => {
  const b = await page.locator('button:visible').allTextContents();
  const i = await page.locator('input:visible,textarea:visible').evaluateAll(e=>e.map(x=>`${x.tagName}[${x.getAttribute('placeholder')||x.type}]`));
  const txt = (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ');
  console.log(`  [${t}] buttons:`, b.map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(6,18).join(' | '));
  console.log(`  [${t}] inputs:`, i.join(' | '));
  console.log(`  [${t}] text:`, txt.slice(0, 260));
};

const username = `qa_m2b_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA模块2B');
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3500);

// ===== 1. 写作工坊 =====
console.log('\n=== 1) 写作工坊：AI 批改 ===');
llm.length = 0;
await goto('写作工坊','学习');
const ta1 = page.locator('textarea').first();
await ta1.fill('私の名前はマイクです。中国の深センに住んでいます。日本語を勉強しています。');
await page.waitForTimeout(600);
await page.getByRole('button', { name:/获取 AI 批改/ }).first().click();
await page.waitForTimeout(28000);
console.log('llm:', llm.join(','));
console.log('  批改结果片段:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(200, 600));

// ===== 2. 作文流水线 =====
console.log('\n=== 2) 作文流水线 ===');
llm.length = 0;
await goto('作文流水线','精进');
await page.getByText('自我介绍', { exact:true }).first().click();
await page.waitForTimeout(2500);
await snap('选篇后');
const ta2 = page.locator('textarea').first();
if (await ta2.isVisible().catch(()=>false)) {
  await ta2.fill('私の名前はマイクです。深センに住んでいます。日本語を勉強しています。');
  await page.waitForTimeout(600);
  const nextB = page.getByRole('button', { name:/下一步|提交|生成|完成|保存/ }).first();
  if (await nextB.isVisible().catch(()=>false)) { await nextB.click(); await page.waitForTimeout(20000); }
  console.log('llm:', llm.join(','));
  console.log('  流水线后片段:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(200, 520));
}

// ===== 3. 写作树 =====
console.log('\n=== 3) 写作树：节点任务 ===');
llm.length = 0;
await goto('写作树','精进');
await page.getByText('一句话介绍自己', { exact:true }).first().click();
await page.waitForTimeout(2000);
await snap('节点后');
const ta3 = page.locator('textarea').first();
if (await ta3.isVisible().catch(()=>false)) {
  await ta3.fill('私の名前はマイクです。');
  await page.waitForTimeout(600);
  const sub = page.getByRole('button', { name:/提交批改|下一步|提交|完成/ }).first();
  if (await sub.isVisible().catch(()=>false)) { await sub.click(); await page.waitForTimeout(25000); }
  console.log('llm:', llm.join(','));
  console.log('  写作树后片段:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(200, 520));
}

// ===== 4. 剧情对话 =====
console.log('\n=== 4) 剧情对话：开一局 ===');
llm.length = 0;
await goto('剧情对话','学习');
await page.getByText('咖啡馆点单').first().click();
await page.waitForTimeout(3000);
await snap('进场景');
const inp4 = page.locator('input:visible, textarea:visible').first();
if (await inp4.isVisible().catch(()=>false)) {
  await inp4.fill('こんにちは、コーヒーをお願いします。');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(22000);
  console.log('llm:', llm.join(','));
  console.log('  剧情回复片段:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(200, 560));
}

// ===== 5. 打字闯关 =====
console.log('\n=== 5) 打字闯关 ===');
await goto('打字闯关','学习');
await page.getByRole('button', { name:/初学起步/ }).first().click();
await page.waitForTimeout(2500);
await snap('进关卡');
const ti = page.locator('input:visible, textarea:visible').first();
if (await ti.isVisible().catch(()=>false)) {
  // 读出目标文本（屏幕上显示的待打内容）再照打
  const target = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('main *'))
      .filter(e => e.children.length === 0 && (e.textContent||'').trim().length > 2)
      .map(e => (e.textContent||'').trim()).sort((a,b)=>b.length-a.length)[0];
    return el || '';
  });
  console.log('  目标文本:', JSON.stringify(String(target).slice(0,80)));
  await ti.fill(String(target).slice(0, 30));
  await page.waitForTimeout(4000);
  console.log('  打字后:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(150, 400));
}

const u = await user();
console.log('\n最终 XP:', u.progress?.[u.learningLanguage]?.xp);
console.log('pageerror:', errs.length ? [...new Set(errs)].slice(0,5).join(' | ') : '无');
await browser.close();
