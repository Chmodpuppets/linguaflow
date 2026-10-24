// 诊断：写作工坊 / 作文流水线 / 写作树 / 剧情对话 / 打字闯关 / 学习搭子 的入口元素
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

const username = `qa_m2_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA模块2');
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3500);

const dump = async (t) => {
  const b = await page.locator('button:visible').allTextContents();
  console.log(`\n[${t}] buttons:`, b.map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(6,26).join(' | '));
  const i = await page.locator('input:visible,textarea:visible').evaluateAll(e=>e.map(x=>`${x.tagName}[${x.getAttribute('placeholder')||x.type}]`));
  console.log(`[${t}] inputs:`, i.join(' | '));
  console.log(`[${t}] text:`, (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,320));
};
const goto = async (label, group) => {
  if (group) {
    const g = page.getByRole('button', { name:new RegExp(group) }).first();
    if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  }
  await page.getByRole('button', { name:label, exact:true }).first().click();
  await page.waitForTimeout(2800);
};

await goto('写作工坊','学习'); await dump('写作工坊');
await goto('作文流水线','精进'); await dump('作文流水线');
await goto('写作树','精进'); await dump('写作树');
await goto('剧情对话','学习'); await dump('剧情对话');
await goto('打字闯关','学习'); await dump('打字闯关');
await goto('学习搭子','社区'); await dump('学习搭子');
await browser.close();
