// 学习搭子：两个测试账号互加好友 + 连胜可见
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const browser = await chromium.launch({ channel:'chrome', args:['--no-proxy-server'] });

const mkUser = async (tag) => {
  const ctx = await browser.newContext({ viewport:{ width:1400, height:950 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[pageerror ${tag}]`, e.message.split('\n')[0]));
  const u = `qa_soc_${tag}_${Date.now().toString().slice(-6)}`;
  await page.goto(BASE_URL, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder('用户名').fill(u);
  await page.getByPlaceholder(/密码/).fill('qa-test-123456');
  await page.getByRole('button', { name:'注册并进入' }).click();
  await page.waitForTimeout(3000);
  await page.getByPlaceholder('输入你的昵称').fill(`搭子${tag}`);
  await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
  await page.getByRole('button', { name:/下一步/ }).click(); await page.waitForTimeout(700);
  await page.getByRole('button', { name:/开始学习/ }).click(); await page.waitForTimeout(3000);
  return { page, username: u };
};
const openSocial = async (page) => {
  const g = page.getByRole('button', { name:/社区/ }).first();
  if ((await g.getAttribute('aria-expanded')) === 'false') { await g.click(); await page.waitForTimeout(400); }
  await page.getByRole('button', { name:'学习搭子', exact:true }).first().click();
  await page.waitForTimeout(2500);
};

const A = await mkUser('A');
const B = await mkUser('B');
await openSocial(A.page);
// 读 A 的好友码：好友码是 6 位大写（不含 0/O/1/I）；服务端 /me 可能稍慢，轮询等待
let code = '';
for (let i = 0; i < 20; i++) {
  code = await A.page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/\b[A-HJ-NP-Z2-9]{6}\b/g) || [];
    return m[0] || '';
  });
  if (code) break;
  await A.page.waitForTimeout(1500);
}
console.log('A 好友码:', code);
if (!code) { console.log('未取到好友码 ⚠'); await browser.close(); process.exit(1); }

await openSocial(B.page);
await B.page.getByPlaceholder('输入好友码').fill(code);
await B.page.getByRole('button', { name:'加好友', exact:true }).first().click();
await B.page.waitForTimeout(4000);
console.log('提示:', (await B.page.locator('main').innerText()).replace(/\s+/g,' ').match(/(已添加好友|添加失败|好友码[^。]{0,30})/g)?.slice(0,3));
const bText = (await B.page.locator('main').innerText()).replace(/\s+/g,' ');
console.log('B 加好友后:', bText.slice(bText.indexOf('一起连胜') >= 0 ? bText.indexOf('一起连胜') : 0, (bText.indexOf('一起连胜') >= 0 ? bText.indexOf('一起连胜') : 0) + 220));
console.log('B 好友列表出现 A:', bText.includes(A.username));

await A.page.reload({ waitUntil:'domcontentloaded' });
await A.page.waitForTimeout(3500);
await openSocial(A.page);
await A.page.waitForTimeout(2000);
const aText = (await A.page.locator('main').innerText()).replace(/\s+/g,' ');
console.log('A 好友列表出现 B:', aText.includes(B.username));
await browser.close();
