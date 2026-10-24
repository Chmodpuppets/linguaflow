// 诊断：文字特训（script 步）为什么跑不完
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
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
page.on('pageerror', e => console.log('[pageerror]', e.message.split('\n')[0]));

const fw = () => page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_daily_flywheel') || 'null'));
const dump = async (t) => {
  const b = await page.locator('button:visible').allTextContents();
  console.log(`[${t}] buttons:`, b.map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(12,32).join(' | '));
  const i = await page.locator('input:visible,textarea:visible').evaluateAll(e=>e.map(x=>x.getAttribute('placeholder')||x.type));
  console.log(`[${t}] inputs:`, i.join(' | '));
  console.log(`[${t}] text:`, (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,300));
};

const username = `qa_st_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA字形');
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3500);

const g = page.getByRole('button', { name:/精进/ }).first();
await g.click(); await page.waitForTimeout(500);
await page.getByRole('button', { name:'文字特训', exact:true }).first().click();
await page.waitForTimeout(2500);
await dump('大厅');

await page.getByRole('button', { name:/日语五十音/ }).first().click();
await page.waitForTimeout(1500);
await dump('选包后');

const grp = page.locator('button:visible').filter({ hasText:/平假名/ }).first();
if (await grp.isVisible().catch(()=>false)) { await grp.click(); await page.waitForTimeout(2000); await dump('选组后'); }
else console.log('未找到分组按钮');

// 试着跑 5 张卡
for (let n=0;n<5;n++){
  const input = page.getByPlaceholder(/输入/).first();
  const vis = await input.isVisible().catch(()=>false);
  console.log(`\n-- 卡 ${n+1}: input可见=${vis}`);
  if (!vis) { console.log('text:', (await page.locator('main').innerText()).replace(/\s+/g,' ').slice(0,300)); break; }
  // 读出题目提示（不暴露答案）
  await input.fill('a'); await page.waitForTimeout(300);
  const sub = page.getByRole('button', { name:'提交', exact:true }).first();
  if (await sub.isVisible().catch(()=>false)) { await sub.click(); await page.waitForTimeout(900); }
  const nb = page.getByRole('button', { name:/下一个|完成/ }).first();
  const nbv = await nb.isVisible().catch(()=>false);
  console.log(`提交后：下一个按钮可见=${nbv}`);
  if (nbv) { await nb.click(); await page.waitForTimeout(900); }
  else { console.log('提交后 text:', (await page.locator('main').innerText()).replace(/\s+/g,' ').slice(0,300)); break; }
}
console.log('\n飞轮:', JSON.stringify((await fw())?.steps));
await browser.close();
