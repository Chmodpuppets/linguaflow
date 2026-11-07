// 今日产出线「按语言隔离」单元测试：直接用 esbuild 现场打包真实 storageService.ts，
// 用 localStorage shim 在 Node 里跑，不依赖浏览器 / 服务器。
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(here, '.flywheel-storage.cjs');
buildSync({
  entryPoints: [path.join(root, 'services/storageService.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
  logLevel: 'silent',
});

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const require = createRequire(import.meta.url);
const S = require(out);
fs.unlinkSync(out);

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failures.push(m); };
const today = new Date().toISOString().slice(0, 10);
const readStore = () => JSON.parse(localStorage.getItem('linguaflow_daily_flywheel') || '{}');

// 1) 日语：三步齐全才算完成
const ja0 = S.ensureDailyFlywheel('Japanese');
ja0.steps.writing === false && ja0.allDone === false ? ok('日语初始 0/3') : bad('日语初始状态异常');
S.markFlywheelStep('writing', 'Japanese');
S.markFlywheelStep('dictation', 'Japanese');
const ja2 = S.getDailyFlywheel('Japanese');
console.log('1) 日语两步后:', JSON.stringify(ja2.steps), 'allDone=', ja2.allDone);
ja2.steps.writing && ja2.steps.dictation && !ja2.allDone ? ok('有字形包的语言必须凑齐三步') : bad('两步就被判定完成');
const ja3 = S.markFlywheelStep('script', 'Japanese');
ja3.allDone && /今日产出线完成/.test(ja3.reflection || '') ? ok('第三步后日语飞轮完成并写入复盘') : bad('日语未完成');

// 2) 英语：完全独立的一份，且无字形包时两步即完成
const enBefore = S.getDailyFlywheel('English');
enBefore === null ? ok('日语的进度没有串到英语') : bad('英语被日语进度污染');
const en0 = S.ensureDailyFlywheel('English');
Object.values(en0.steps).every((v) => v === false) ? ok('英语是全新的 0/2') : bad('英语初始状态异常');
S.markFlywheelStep('writing', 'English');
const enDone = S.markFlywheelStep('dictation', 'English');
console.log('2) 英语两步后:', JSON.stringify(enDone.steps), 'allDone=', enDone.allDone);
enDone.allDone ? ok('无字形包的语言两步即完成（第二种语言可再完成一次）') : bad('英语两步未完成');

// 3) 两个分桶并存、互不覆盖
const store = readStore();
const keys = Object.keys(store.byLang || {});
console.log('3) 分桶:', keys.join(', '));
keys.includes('Japanese') && keys.includes('English') ? ok('两门语言各存一份') : bad('分桶缺失');
S.getDailyFlywheel('Japanese').allDone ? ok('切到英语后日语仍是已完成') : bad('日语完成态被覆盖');
S.getDailyFlywheel('English').steps.writing ? ok('英语完成态保留') : bad('英语完成态丢失');

// 4) 旧格式（单份、只按日期）迁移到当前语言，不抹掉今天已完成的产出
mem.clear();
localStorage.setItem('linguaflow_daily_flywheel', JSON.stringify({
  date: today, themeId: 'd1', theme: '旧主题', themePrompt: '旧引导',
  steps: { writing: true, dictation: true, script: true }, allDone: true, reflection: '旧复盘',
}));
const migrated = S.getDailyFlywheel('Japanese');
console.log('4) 迁移结果:', migrated && JSON.stringify({ theme: migrated.theme, allDone: migrated.allDone }));
migrated && migrated.allDone && migrated.theme === '旧主题' ? ok('旧单份记录迁移到当前语言且保留完成态') : bad('旧记录迁移失败');
Object.keys(readStore().byLang || {}).includes('Japanese') ? ok('迁移后写入 byLang 结构') : bad('迁移后结构未升级');

// 5) 口径 A：连胜一天只记一次，XP 由 addActivity 按次发放（验证 XP 不被飞轮去重）
mem.clear();
const u = {
  username: 'qa', nativeLanguage: 'Chinese', learningLanguage: 'Japanese',
  progress: { Japanese: { xp: 0, level: 1, cefrLevel: 'A1', totalWordsTyped: 0, lastActive: 0, maxUnlockedStage: 0 } },
  currentStreak: 2, maxStreak: 2, streakShields: 1, lastStreakDate: today,
  dailyQuests: [], lastQuestDate: today, preferredTopics: [], aiMemory: { goals: [], weakPoints: [], interests: [], notes: '' },
};
localStorage.setItem('linguaflow_user', JSON.stringify(u));
const s1 = S.addActivity(u, 'writing', 'Japanese', 25, '日语产出', { wordCount: 5 });
const s2 = S.addActivity(s1.user, 'writing', 'English', 30, '英语产出', { wordCount: 6 });
console.log('5) XP:', s2.user.progress.Japanese.xp, '/', s2.user.progress.English.xp);
s2.user.progress.Japanese.xp === 25 && s2.user.progress.English.xp === 30
  ? ok('两门语言各自按次拿到 XP（口径 A）') : bad('第二种语言没给 XP');
const st1 = S.commitDailyStreak(s2.user);
const st2 = S.commitDailyStreak(st1);
console.log('   连胜:', st2.currentStreak, '(当天重复调用后)');
st2.currentStreak === 2 ? ok('同一天完成两门语言，连胜不重复计数') : bad('连胜被重复计数');

console.log('\n失败项:', failures.length ? JSON.stringify(failures, null, 1) : '无');
process.exit(failures.length ? 1 : 0);
