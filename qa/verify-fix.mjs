// 验证修复：5xx 回落（写作工坊批改）+ 作文流水线解锁提示 + 写作树提交批改
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env'),'utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
// 故意保留 OpenRouter（会偶发 502）作为 reason 层首选，用来验证回落
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
  await page.waitForTimeout(2600);
};

const username = `qa_fix_${Date.now().toString().slice(-7)}`;
await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);
await page.getByPlaceholder('用户名').fill(username);
await page.getByPlaceholder(/密码/).fill('qa-test-123456');
await page.getByRole('button', { name:'注册并进入' }).click();
await page.waitForTimeout(3000);
await page.getByPlaceholder('输入你的昵称').fill('QA修复');
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
await page.evaluate(c => localStorage.setItem('linguaflow_ai_config', JSON.stringify(c)), AI_CONFIG);
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3500);

console.log('=== A) 写作工坊：AI 批改（验证 5xx 回落）===');
llm.length = 0;
await goto('写作工坊','学习');
await page.locator('textarea').first().fill('私の名前はマイクです。中国の深センに住んでいます。日本語を勉強しています。');
await page.waitForTimeout(600);
await page.getByRole('button', { name:/获取 AI 批改/ }).first().click();
await page.waitForTimeout(35000);
const t1 = (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ');
const failed = /批改失败/.test(t1);
console.log('llm 状态码序列:', llm.join(', '));
console.log('是否批改失败:', failed);
console.log('结果片段:', t1.slice(200, 620));

console.log('\n=== B) 作文流水线：解锁提示 ===');
await goto('作文流水线','精进');
const banner = await page.getByText(/全部 \d+ 篇暂未解锁/).first().isVisible().catch(()=>false);
const lockHint = await page.getByText(/解锁/).first().isVisible().catch(()=>false);
console.log('解锁横幅可见:', banner, '｜列表项解锁标记可见:', lockHint);
console.log('横幅文案:', (await page.getByText(/暂未解锁/).first().textContent().catch(()=>''))?.trim());

console.log('\n=== C) 写作树：提交批改 ===');
llm.length = 0;
await goto('写作树','精进');
await page.getByText('一句话介绍自己', { exact:true }).first().click();
await page.waitForTimeout(2200);
const ta = page.locator('textarea:visible').first();
if (await ta.isVisible().catch(()=>false)) {
  await ta.fill('私の名前はマイクです。');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name:'提交批改', exact:true }).first().click();
  await page.waitForTimeout(32000);
  console.log('llm 状态码序列:', llm.join(', '));
  const t3 = (await page.locator('main').innerText().catch(()=>'')).replace(/\s+/g,' ');
  console.log('提交后片段:', t3.slice(0, 520));
} else console.log('未找到写作框 ⚠');

console.log('\npageerror:', errs.length ? [...new Set(errs)].slice(0,3).join(' | ') : '无');
await browser.close();
