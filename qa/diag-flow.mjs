// 诊断：对话台 / 词汇 / 墨程 的真实可交互元素 + /llm/chat 请求明细
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
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
const llmCalls = [];
page.on('request', r => { if (/llm\/chat/.test(r.url())) llmCalls.push({ t:'req', m:r.method(), u:r.url() }); });
page.on('response', async r => { if (/llm\/chat/.test(r.url())) llmCalls.push({ t:'res', s:r.status(), u:r.url() }); });
page.on('pageerror', e => console.log('[pageerror]', e.message.split('\n')[0]));

const username = `qa_diag_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA诊断');
await page.getByRole('button', { name:/下一步/ }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click();
await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' });
await page.waitForTimeout(3500);
console.log('学习语言:', await page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_user')||'{}').learningLanguage));

const dump = async (tag, sel) => {
  const btns = await page.locator('button:visible').allTextContents();
  console.log(`\n[${tag}] buttons(${btns.length}):`, btns.map(t=>t.trim().replace(/\s+/g,' ')).filter(Boolean).slice(0,30).join(' | '));
  const inputs = await page.locator('input:visible, textarea:visible').evaluateAll(els =>
    els.map(e => `${e.tagName}[${e.getAttribute('placeholder')||e.type||''}]`));
  console.log(`[${tag}] inputs:`, inputs.slice(0,15).join(' | '));
};

const goto = async (label, group) => {
  if (group) {
    const g = page.getByRole('button', { name:new RegExp(group) }).first();
    if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  }
  await page.getByRole('button', { name:label, exact:true }).first().click();
  await page.waitForTimeout(2500);
};

// ---- 对话台 ----
console.log('\n===== 对话台 =====');
await goto('对话','学习');
llmCalls.length = 0;
await dump('对话');
const ta = page.locator('textarea').first();
await ta.fill('こんにちは。短く一言で、今日の練習を提案してください。');
await page.keyboard.press('Enter');
await page.waitForTimeout(20000);
console.log('llmCalls:', JSON.stringify(llmCalls));
const bubbles = await page.evaluate(() => Array.from(document.querySelectorAll('[class*="rounded"]'))
  .map(e => (e.textContent||'').trim()).filter(t => t.length > 20 && !/Enter 发送|Shift/.test(t)).slice(-6));
console.log('末几条气泡:', JSON.stringify(bubbles, null, 1).slice(0, 900));

// ---- 词汇 ----
console.log('\n===== 词汇 =====');
await goto('词汇','学习');
await dump('词汇');

// ---- 墨程 ----
console.log('\n===== 墨程 =====');
await goto('墨程','精进');
await dump('墨程');
// 点「自由写」tab
const freeTab = page.getByRole('button', { name:/自由写/ }).first();
if (await freeTab.isVisible().catch(()=>false)) { await freeTab.click(); await page.waitForTimeout(1500); await dump('墨程-自由写'); }

await browser.close();
