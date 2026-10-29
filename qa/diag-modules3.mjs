// 诊断 2：作文流水线 / 写作树 / 剧情对话 / 打字闯关 —— 给 AI 生成留足时间，找出真实断点
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
const page = await (await browser.newContext({ viewport:{width:1440,height:950} })).newPage();
const errs = []; const llm = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0].slice(0,160)));
page.on('response', r => { if (/llm\/chat/.test(r.url())) llm.push(r.status()); });
const user = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user')||'{}'));
// 等到「生成中」类文案消失
const waitIdle = async (ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const loading = await page.getByText(/正在生成|生成中|加载中|思考中|……$/).first().isVisible().catch(()=>false);
    if (!loading) return true;
    await page.waitForTimeout(1500);
  }
  return false;
};
const snap = async (t) => {
  const b = await page.locator('button:visible').allTextContents();
  const i = await page.locator('input:visible,textarea:visible').evaluateAll(e=>e.map(x=>`${x.tagName}[${x.getAttribute('placeholder')||x.type}]`));
  console.log(`  [${t}] buttons:`, b.map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(6,18).join(' | '));
  console.log(`  [${t}] inputs:`, i.join(' | '));
  console.log(`  [${t}] text:`, (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0, 300));
};
const goto = async (label, group) => {
  if (group) {
    const g = page.getByRole('button', { name:new RegExp(group) }).first();
    if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  }
  await page.getByRole('button', { name:label, exact:true }).first().click();
  await page.waitForTimeout(2800);
};

const username = `qa_m3_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA模块3');
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3500);

// ===== 剧情对话 =====
console.log('\n=== 剧情对话 ===');
llm.length = 0;
await goto('剧情对话','学习');
await page.getByText('咖啡馆点单').first().click();
const idle1 = await waitIdle(70000);
console.log('生成结束(未卡住):', idle1, '| llm:', llm.join(','));
await snap('剧情-场景内');
const inp = page.locator('input:visible, textarea:visible').first();
if (await inp.isVisible().catch(()=>false)) {
  await inp.fill('こんにちは。コーヒーをお願いします。');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(25000);
  console.log('对话后 llm:', llm.join(','));
  console.log('  回复片段:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(150, 520));
}

// ===== 打字闯关 =====
console.log('\n=== 打字闯关 ===');
llm.length = 0;
await goto('打字闯关','学习');
await page.getByRole('button', { name:/初学起步/ }).first().click();
const idle2 = await waitIdle(70000);
console.log('生成结束(未卡住):', idle2, '| llm:', llm.join(','));
await snap('打字-关卡内');

// ===== 作文流水线 =====
console.log('\n=== 作文流水线 ===');
llm.length = 0;
await goto('作文流水线','精进');
const card = page.locator('button:visible').filter({ hasText:/自我介绍/ }).first();
console.log('命中卡片:', await card.isVisible().catch(()=>false));
await card.click();
await page.waitForTimeout(3000);
await snap('流水线-选篇后');
const ta2 = page.locator('textarea:visible').first();
if (await ta2.isVisible().catch(()=>false)) {
  await ta2.fill('私の名前はマイクです。深センに住んでいます。');
  await page.waitForTimeout(600);
  await snap('流水线-填写后');
}

// ===== 写作树 =====
console.log('\n=== 写作树 ===');
llm.length = 0;
await goto('写作树','精进');
await page.getByText('一句话介绍自己', { exact:true }).first().click();
await page.waitForTimeout(2500);
await snap('写作树-节点后');
const ta3 = page.locator('textarea:visible').first();
if (await ta3.isVisible().catch(()=>false)) {
  await ta3.fill('私の名前はマイクです。');
  await page.waitForTimeout(800);
  await snap('写作树-填写后');
  const b = await page.locator('button:visible').allTextContents();
  console.log('  全部按钮:', b.map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(10,30).join(' | '));
}
const u = await user();
console.log('\n最终 XP:', u.progress?.[u.learningLanguage]?.xp);
console.log('pageerror:', errs.length ? [...new Set(errs)].slice(0,5).join(' | ') : '无');
await browser.close();
