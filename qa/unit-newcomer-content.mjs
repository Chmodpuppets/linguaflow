// 新人内容缺口修复的单元测试：esbuild 现场打包真实源码，Node 里跑。
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const tmp = [];
const load = (entry, name) => {
  const out = path.join(here, `.tmp-${name}.cjs`);
  buildSync({
    entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'cjs',
    outfile: out, logLevel: 'silent',
    // aiService 里有 Vite 专属的 import.meta.env，CJS 打包时需要给个空对象
    define: { 'import.meta.env': '{}' },
  });
  tmp.push(out);
  return require(out);
};

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

const SV = load('data/starterVocab.ts', 'starter');
const KD = load('data/kanaDrills.ts', 'kana');
const SS = load('services/storageService.ts', 'storage');
const AI = load('services/aiService.ts', 'ai');

// 1) 起步词：复用内置书，不编造
const ja = SV.getStarterVocab('Japanese');
const ko = SV.getStarterVocab('Korean');
const en = SV.getStarterVocab('English');
const fr = SV.getStarterVocab('French');
console.log('1) 起步词数量:', { ja: ja.length, ko: ko.length, en: en.length, fr: fr.length });
ja.length === 20 && ko.length === 20 && en.length === 16 && fr.length === 0
  ? ok('日/韩从内置书派生 20 词、英语 16 词、无数据的语言优雅降级') : bad('起步词数量异常');
ja.every((w) => w.word && w.definition && w.example) ? ok('日语词条含假名/释义/例句') : bad('日语词条字段缺失');
ja[0].pronunciation ? ok('日语带假名注音') : bad('日语缺注音');

// 2) 五十音打字内容：纯静态、字形正确
const drills = KD.KANA_DRILLS;
const hira = KD.buildKanaContent('hira-1');
const kata = KD.buildKanaContent('kata-1');
console.log('2) 关卡数:', drills.length, '| 平假名首组:', hira?.text.slice(0, 10), '| 片假名首组:', kata?.text.slice(0, 10));
drills.length === 8 ? ok('8 组关卡（平/片各 2 + 浊音 2 + 拗音 2）') : bad(`关卡数 ${drills.length} ≠ 8`);
hira && /^[\u3040-\u309f]+$/.test(hira.text) ? ok('平假名文本全是平假名') : bad('平假名文本混入其它字符');
kata && /^[\u30a0-\u30ff]+$/.test(kata.text) ? ok('片假名文本全是片假名') : bad('片假名文本混入其它字符');
hira?.phoneticGuide.startsWith('a i u e o') ? ok('罗马字提示正确') : bad('罗马字提示异常');
KD.buildKanaContent('not-exist') === null ? ok('未知关卡返回 null') : bad('未知关卡未返回 null');

// 3) 导入去重
const n1 = SS.importStarterVocab('Japanese', ja);
const n2 = SS.importStarterVocab('Japanese', ja);
console.log('3) 导入:', n1, '/', n2, '| 词库数:', SS.getVocabularyCount('Japanese'));
n1 === 20 && n2 === 0 && SS.getVocabularyCount('Japanese') === 20 ? ok('一键导入 20 词且重复导入不覆盖') : bad('导入或去重异常');

// 4) 任务落地校正：直接测纯函数，避免 pickLocalTasks 的随机性让断言不稳定
mem.clear();
const user = {
  username: 'qa', nativeLanguage: 'Chinese', learningLanguage: 'Japanese',
  progress: { Japanese: { xp: 0, level: 1, cefrLevel: 'A1', totalWordsTyped: 0, lastActive: 0, maxUnlockedStage: 0 } },
  currentStreak: 1, maxStreak: 1, streakShields: 1,
  dailyQuests: [], preferredTopics: [], aiMemory: { goals: [], weakPoints: [], interests: [], notes: '' },
};
const fake = (module, title, detail = '') => ({ id: `t-${module}`, module, star: 2, durationMin: 10, xp: 20, title, detail });
const fixed = AI.reconcileDailyTasks([
  fake('vocabulary', '复习并记忆 10 个 A1 问候词', '闪卡复习'),
  fake('typing', '五十音键盘输入练习', '通过平假名和片假名的听写'),
  fake('writing', '简单自我介绍短文'),
], { vocabCount: 0, hasScript: true, hasStarterVocab: true });
console.log('4) 空词库 + 有字形包 →', JSON.stringify(fixed.map((t) => [t.module, t.target, t.title])));
fixed[0].target === 'starter_vocab' && /导入/.test(fixed[0].title)
  ? ok('空词库 → 词汇任务改写为「导入起步词」并标 starter_vocab') : bad('空词库词汇任务未校正');
fixed[1].target === 'kana' ? ok('日语五十音任务标 kana，直达静态关卡') : bad('五十音任务未标 kana');

const noScript = AI.reconcileDailyTasks(
  [fake('typing', '五十音练习', '平假名')],
  { vocabCount: 10, hasScript: false, hasStarterVocab: false }
);
noScript[0].target !== 'kana' && !/五十音|假名/.test(noScript[0].title)
  ? ok('无字形包的语言自动去掉假名任务文案') : bad('非日语仍保留假名任务');

const tasks0 = await AI.generateDailyTasks(user);
console.log('   AI 不可用时的兜底任务:', JSON.stringify(tasks0.map((t) => [t.module, t.target, t.title])));
tasks0.every((t) => !t.target || ['kana', 'starter_vocab'].includes(t.target))
  ? ok('本地兜底同样经过落地校正') : bad('兜底任务未校正');

// 5) 有词后不再改写
SS.importStarterVocab('Japanese', ja);
const tasks1 = await AI.generateDailyTasks(user);
const vocab1 = tasks1.filter((t) => t.module === 'vocabulary');
console.log('5) 有词后任务:', JSON.stringify(vocab1.map((t) => [t.target, t.title])));
vocab1.length && vocab1.every((t) => t.target !== 'starter_vocab')
  ? ok('有词后恢复正常复习任务，不再强制导入') : bad('有词后仍被改写');

// 6) 非日语不出现假名任务
const enUser = { ...user, learningLanguage: 'English', progress: { English: user.progress.Japanese } };
const tasksEn = await AI.generateDailyTasks(enUser);
console.log('6) 英语任务:', JSON.stringify(tasksEn.map((t) => [t.module, t.target, t.title])));
tasksEn.every((t) => t.target !== 'kana' && !/五十音|假名/.test(t.title + t.detail))
  ? ok('非日语不会出现假名/五十音任务') : bad('非日语仍出现假名任务');

tmp.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
