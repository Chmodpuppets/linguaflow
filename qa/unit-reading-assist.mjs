// 阅读辅助「模型选择」单测：esbuild 现场打包真实 aiService，Node 里跑。
// 回归 2026-11 的 bug：「Qwen 槽位配了 deepseek-v4.1-flash，阅读辅助却回落 GLM-4.7-Flash 推理模型」。
// 根因：旧逻辑按「槽位名」找 deepseek + fast 档硬编码 GLM 第一；现按「模型名」匹配快模型并避开推理模型。
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);

// aiService 的 GLM/QWEN 兜底 Key 直读 process.env（不是 import.meta.env）。
// 显式清空，保证无论跑测试的 shell 带不带 .env，结果都确定。
for (const k of ['QWEN_API_KEY', 'GLM_API_KEY', 'OPENROUTER_API_KEY', 'QWEN_MODEL']) delete process.env[k];

const out = path.join(here, '.tmp-reading-ai.cjs');
buildSync({
  entryPoints: [path.join(root, 'services/aiService.ts')],
  bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
});

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };

const AI = require(out);
const setCfg = (cfg) => mem.set('linguaflow_ai_config', JSON.stringify(cfg));
const slot = (model, baseUrl = '') => ({ baseUrl, model, apiKey: 'test-key' });

// 1) 推理模型识别
console.log('1) isReasoningModel');
AI.isReasoningModel('GLM-4.7-Flash') ? ok('GLM-4.7-Flash → 推理') : bad('GLM-4.7-Flash 未识别为推理');
AI.isReasoningModel('glm-4.5') ? ok('glm-4.5 → 推理') : bad('glm-4.5 未识别为推理');
!AI.isReasoningModel('glm-4-flash') ? ok('glm-4-flash → 非推理') : bad('glm-4-flash 误判为推理');
!AI.isReasoningModel('deepseek-v4.1-flash') ? ok('deepseek-v4.1-flash → 非推理') : bad('deepseek flash 误判为推理');

// 2) 用户场景：Qwen 槽位托管 deepseek-v4.1-flash + GLM-4.7-Flash → 必须选 Qwen 槽位的快模型
console.log('2) Qwen 槽位托管 deepseek flash（核心回归）');
setCfg({
  active: 'qwen',
  qwen: slot('deepseek-v4.1-flash', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
  glm: slot('GLM-4.7-Flash'),
});
let info = AI.getReadingAssistModelInfo();
console.log('   →', info);
(info.label.startsWith('qwen') && !info.reasoning)
  ? ok('优先 Qwen 槽位的 deepseek flash，而非 GLM 推理模型')
  : bad('仍回落 GLM：' + info.label);

// 3) 只配了 GLM 推理模型 → 如实标 reasoning（UI 会提示偏慢），不假装是快模型
console.log('3) 仅有推理模型可用');
setCfg({ active: 'glm', glm: slot('GLM-4.7-Flash') });
info = AI.getReadingAssistModelInfo();
(info.label.startsWith('glm') && info.reasoning)
  ? ok('只有推理模型时用它，但标 reasoning=true')
  : bad('reasoning 标记错误：' + JSON.stringify(info));

// 4) qwen3.8-flash + glm-4-flash → 都是快模型，非推理
console.log('4) 双快模型');
setCfg({ active: 'qwen', qwen: slot('qwen3.8-flash'), glm: slot('glm-4-flash') });
info = AI.getReadingAssistModelInfo();
!info.reasoning ? ok('快模型场景非推理：' + info.label) : bad('快模型场景误判为推理：' + info.label);

// 5) DeepSeek 官方槽位仍优先（历史首选不被破坏）
console.log('5) DeepSeek 官方槽位优先');
setCfg({
  active: 'glm',
  glm: slot('glm-4-flash'),
  deepseek: slot('deepseek-flash', 'https://api.deepseek.com/v1'),
});
info = AI.getReadingAssistModelInfo();
info.label.startsWith('deepseek') ? ok('DeepSeek 官方槽位优先') : bad('DeepSeek 官方槽位未优先：' + info.label);

// 6) 无任何 Key → 未配置模型
console.log('6) 无 Key');
mem.clear();
info = AI.getReadingAssistModelInfo();
(info.label === '未配置模型' && !info.reasoning) ? ok('无 Key → 未配置模型') : bad('无 Key 状态错误：' + JSON.stringify(info));

try { fs.unlinkSync(out); } catch { /* ignore */ }
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
