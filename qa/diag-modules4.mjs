// 诊断 3：作文流水线解锁状态 + 写作树提交
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
const llm = []; const errs = [];
page.on('response', r => { if (/llm\/chat/.test(r.url())) llm.push(r.status()); });
page.on('pageerror', e => errs.push(e.message.split('\n')[0].slice(0,140)));
const goto = async (label, group) => {
  if (group) {
    const g = page.getByRole('button', { name:new RegExp(group) }).first();
    if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  }
  await page.getByRole('button', { name:label, exact:true }).first().click();
  await page.waitForTimeout(2800);
};

const username = `qa_m4_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA模块4');
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3500);
console.log('CEFR:', await page.evaluate(() => { const u=JSON.parse(localStorage.getItem('linguaflow_user')||'{}'); return u.progress?.[u.learningLanguage]?.cefrLevel; }));

console.log('\n=== 作文流水线：解锁情况 ===');
await goto('作文流水线','精进');
for (const f of ['全部状态','可写','未解锁']) {
  await page.getByRole('button', { name:f, exact:true }).first().click();
  await page.waitForTimeout(800);
  const cards = await page.locator('button:visible').filter({ hasText:/记叙文|议论文|说明文|书信/ }).evaluateAll(els =>
    els.map(e => ({ t: (e.textContent||'').trim().replace(/\s+/g,' ').slice(0,24), disabled: e.disabled })));
  console.log(`[${f}] 篇目数 ${cards.length}:`, JSON.stringify(cards));
}

console.log('\n=== 写作树：提交 ===');
llm.length = 0;
await goto('写作树','精进');
await page.getByText('一句话介绍自己', { exact:true }).first().click();
await page.waitForTimeout(2500);
const ta = page.locator('textarea:visible').first();
if (await ta.isVisible().catch(()=>false)) {
  await ta.fill('私の名前はマイクです。');
  await page.waitForTimeout(1000);
  const btns = await page.locator('button:visible').allTextContents();
  console.log('填写后按钮:', btns.map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(12,32).join(' | '));
  const sub = page.locator('button:visible').filter({ hasText:/提交|下一步|批改|完成|保存/ }).first();
  console.log('命中提交按钮:', await sub.isVisible().catch(()=>false), '|', (await sub.textContent().catch(()=>'')).trim());
  await sub.click();
  await page.waitForTimeout(30000);
  console.log('llm:', llm.join(','));
  console.log('提交后:', (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0, 600));
}
console.log('pageerror:', errs.length ? [...new Set(errs)].slice(0,3).join(' | ') : '无');
await browser.close();
