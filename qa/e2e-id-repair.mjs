// 端到端：注入历史脏 id → 进模块 → 验证是否被修复（唯一 + 合法 + 业务字段不变）
import { chromium } from 'playwright';
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete process.env[k];
const BASE_URL = process.env.BASE_URL || 'http://47.107.187.5';
const USER = process.env.QA_REUSE_USER || '';
const PASS = 'qa-test-123456';
const BAD = 'undefinedundefinedundefinedundefined-undefinedundefined';
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.split('\n')[0].slice(0, 160)));

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
};

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.getByPlaceholder('用户名').fill(USER);
await page.getByPlaceholder(/密码/).fill(PASS);
await page.getByRole('button', { name: '登录', exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: '登录', exact: true }).last().click();
await page.waitForTimeout(4000);
if (!(await page.evaluate(() => !!localStorage.getItem('linguaflow_user')))) {
  console.log('登录失败'); await browser.close(); process.exit(2);
}

// --- 注入脏数据 ---
const seeded = await page.evaluate(([BAD]) => {
  const lang = 'Japanese';
  const vocab = [
    { id: 'dup-id', word: 'alpha', definition: 'A', language: lang, createdAt: 1, box: 2, dueDate: 1, reviews: 3, lapses: 1 },
    { id: 'dup-id', word: 'beta', definition: 'B', language: lang, createdAt: 2, box: 3, dueDate: 1, reviews: 5, lapses: 0 },
    { id: BAD, word: 'gamma', definition: 'C', language: lang, createdAt: 3, box: 1, dueDate: 1, reviews: 0, lapses: 0 },
  ];
  const errbook = [
    { id: 'dup-err', original: 'a b', correction: 'a c', reason: 'r1', language: lang, box: 2, dueDate: 1, lapses: 0, createdAt: 1 },
    { id: 'dup-err', original: 'x y', correction: 'x z', reason: 'r2', language: lang, box: 1, dueDate: 1, lapses: 0, createdAt: 2 },
  ];
  const sentences = [
    { id: 'dup-s', text: 'sentence one', language: lang, createdAt: 1 },
    { id: 'dup-s', text: 'sentence two', language: lang, createdAt: 2 },
  ];
  localStorage.setItem('linguaflow_vocabulary', JSON.stringify(vocab));
  localStorage.setItem('linguaflow_errorbook', JSON.stringify(errbook));
  localStorage.setItem('linguaflow_sentence_bank', JSON.stringify(sentences));
  return { vocab: vocab.length, errbook: errbook.length, sentences: sentences.length };
}, [BAD]);
console.log('注入脏数据:', JSON.stringify(seeded));

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// --- 逐个进模块触发 getter ---
const goto = async (label, group) => {
  // 导航项可能带未读徽标（如「错题本2」），不能用 exact 匹配
  const target = () => page.getByRole('button', { name: new RegExp(`^${label}`) }).first();
  if (!(await target().isVisible().catch(() => false)) && group) {
    const g = page.getByRole('button', { name: group, exact: true }).first();
    if (await g.isVisible().catch(() => false)) {
      await g.click();
      await page.waitForTimeout(600);
    }
  }
  await target().click();
  await page.waitForTimeout(2200);
};
await goto('词汇', '学习');
await goto('错题本', '精进');
// 句子库没有独立模块，靠阅读页读取；这里用一次「写作工坊」无关，改为直接触发不了 —— 记录未触发
console.log('\n[1] 词汇 / 错题本 模块已进入');

const check = async (key, name, fields) => {
  const data = await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
  console.log(`\n[${name}] ${key}`);
  if (!data) { ok(false, '数据存在'); return; }
  const ids = data.map((x) => x.id);
  ok(data.length > 0, `条目数 ${data.length}`);
  ok(ids.every((id) => V4.test(id)), 'id 全部为合法 v4');
  ok(new Set(ids).size === ids.length, `id 全部唯一（${new Set(ids).size}/${ids.length}）`);
  const preserved = data.every((x) => fields.every((f) => x[f] !== undefined && x[f] !== ''));
  ok(preserved, `业务字段保留（${fields.join('/')}）`);
  console.log('   id 示例:', ids.map((i) => i.slice(0, 8)).join(', '));
};

await check('linguaflow_vocabulary', '词汇', ['word', 'definition']);
await check('linguaflow_errorbook', '错题本', ['original', 'correction']);

// 句子库：通过刷新页面不再触发读取，直接看它是否已被修复（saveSentence/getSentences 由阅读页调用）
const sent = await page.evaluate(() => {
  const raw = localStorage.getItem('linguaflow_sentence_bank');
  return raw ? JSON.parse(raw) : null;
});
console.log('\n[句子库] 直接读（未进阅读页，可能仍是脏 id）');
if (sent) {
  console.log('   id:', sent.map((s) => String(s.id).slice(0, 10)).join(', '));
}

// 复习一次词汇，确认不会改错条目（id 已唯一）
await goto('词汇', '学习');
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_vocabulary') || '[]'));
const revBtn = page.getByRole('button', { name: /复习/ }).first();
if (await revBtn.isVisible().catch(() => false)) {
  await revBtn.click();
  await page.waitForTimeout(1500);
  const knowBtn = page.getByRole('button', { name: /认识|记得|会/ }).first();
  if (await knowBtn.isVisible().catch(() => false)) {
    await knowBtn.click();
    await page.waitForTimeout(1500);
  }
}
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('linguaflow_vocabulary') || '[]'));
console.log(`\n[复习一次后] 条目数 ${before.length} → ${after.length}，id 仍唯一: ${new Set(after.map((x) => x.id)).size === after.length}`);

console.log('\npageerror:', errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') : '无');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
await browser.close();
process.exit(fail === 0 && errs.length === 0 ? 0 : 1);
