// LinguaFlow — QA 截图回归脚本（Playwright）
// 路由为状态机（mode state），无 URL 路径，故通过点击侧栏中文标签切换视图后截图。
// 未登录时先驱动 LoginView 向导（填昵称 → 下一步 ×2 → 开始学习）进入主布局。
// 由 qa-playwright-capture.sh 调用；也可单独运行：BASE_URL=http://127.0.0.1:3011 node qa/capture.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 本环境存在 HTTP(S)_PROXY，会拦截对 127.0.0.1 的访问（dev server 在本地）。
// 强制 chromium 直连本地，避免被代理卡死。
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) {
  delete process.env[k];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3011';
const OUT_DIR = path.join(ROOT, 'public', 'qa-screenshots');

// 7 个代表视图（覆盖 输入/输出/复习/反馈/社交/精听 闭环）
const VIEWS = [
  { id: 'daily', label: '今日' },
  { id: 'rpg', label: '剧情对话' },
  { id: 'writing_tree', label: '写作树' },
  { id: 'composition_studio', label: '作文流水线' },
  { id: 'error_patterns', label: '错误模式' },
  { id: 'vocabulary', label: '词汇' },
  { id: 'song_lab', label: '歌曲跟打' },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 未登录则驱动 LoginView 向导进入主布局（级别/导师有默认值，无需额外选择）
async function ensureLoggedIn() {
  // 等登录表单或主布局出现（React 挂载晚于 load 事件，需显式等待）
  await page.waitForSelector('nav, input[placeholder="输入你的昵称"]', { timeout: 15000 });
  if ((await page.locator('nav').count()) > 0) return; // 已登录
  const nameInput = page.locator('input[placeholder="输入你的昵称"]');
  await nameInput.fill('QA Bot');
  await page.getByText('下一步', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText('下一步', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText('开始学习', { exact: true }).first().click();
  await page.waitForSelector('nav', { timeout: 15000 });
  await page.waitForTimeout(800);

  // 展开所有折叠的分组（部分分组默认折叠，内部视图按钮未渲染 → 点击会超时）
  const headers = page.locator('nav button[aria-expanded]');
  const hCount = await headers.count();
  for (let i = 0; i < hCount; i++) {
    const h = headers.nth(i);
    if ((await h.getAttribute('aria-expanded')) !== 'true') {
      await h.click();
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(300);
}

console.log(`→ 打开 ${BASE_URL}`);
try {
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 });
} catch (e) {
  console.warn(`⚠ 页面加载较慢，继续尝试：${e.message}`);
}

await ensureLoggedIn();

let ok = 0;
for (const v of VIEWS) {
  const file = path.join(OUT_DIR, `${v.id}.png`);
  try {
    const btn = page.locator('nav').getByText(v.label, { exact: true }).first();
    await btn.click({ timeout: 8000 });
    await page.waitForTimeout(1200); // 等霓虹渐入 + 懒加载视图渲染
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${v.id}.png`);
    ok++;
  } catch (e) {
    console.warn(`✗ ${v.id} 跳过：${e.message}`);
  }
}

await browser.close();
console.log(`\n完成：${ok}/${VIEWS.length} 张截图 → ${path.relative(ROOT, OUT_DIR)}`);
process.exit(ok === VIEWS.length ? 0 : 1);
