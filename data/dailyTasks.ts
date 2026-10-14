import { DailyTask, StarLevel } from '../types';

// 本地任务池：按模块 × 星级预设，离线 / 无 AI key 时兜底。
// 4 个硬资产落点：词汇 / 打字 / 写作 / 错题，各 5 档难度。

interface TaskSeed {
  module: DailyTask['module'];
  star: StarLevel;
  durationMin: number;
  xp: number;
  title: string;
  detail: string;
}

const POOL: TaskSeed[] = [
  // 词汇
  { module: 'vocabulary', star: 1, durationMin: 5, xp: 10, title: '认识 5 个新词', detail: '学习 5 个新单词，听发音、看例句' },
  { module: 'vocabulary', star: 2, durationMin: 10, xp: 20, title: 'SRS 复习 20 词', detail: '间隔重复复习今天到期的 20 个词' },
  { module: 'vocabulary', star: 3, durationMin: 15, xp: 30, title: '拼写 10 个词', detail: '不看提示，拼写 10 个目标词' },
  { module: 'vocabulary', star: 4, durationMin: 20, xp: 40, title: '用 5 个词造句', detail: '挑 5 个新词，各造一个句子' },
  { module: 'vocabulary', star: 5, durationMin: 30, xp: 50, title: '20 个新词写一段话', detail: '用 20 个新词写一段连贯的话' },
  // 打字
  { module: 'typing', star: 1, durationMin: 5, xp: 10, title: '打字闯关 · 第 1 关', detail: '热身关卡，练基础字符' },
  { module: 'typing', star: 2, durationMin: 10, xp: 20, title: '打字闯关 · 第 3 关', detail: '日常关，巩固速度' },
  { module: 'typing', star: 3, durationMin: 15, xp: 30, title: '打字闯关 · 第 6 关', detail: '进阶关，挑战更高 WPM' },
  { module: 'typing', star: 4, durationMin: 20, xp: 40, title: '打字闯关 · 第 9 关', detail: '高难关，冲刺速度' },
  { module: 'typing', star: 5, durationMin: 30, xp: 50, title: 'Boss 关 · 速度冲刺', detail: 'Boss 关，证明你的速度' },
  // 写作
  { module: 'writing', star: 1, durationMin: 5, xp: 10, title: '写 1 句话', detail: '用目标语言写一句完整的话' },
  { module: 'writing', star: 2, durationMin: 10, xp: 20, title: '写 3 句话', detail: '围绕一个主题写 3 句话' },
  { module: 'writing', star: 3, durationMin: 20, xp: 35, title: '写一段 50 字', detail: '写一段约 50 字的短文' },
  { module: 'writing', star: 4, durationMin: 30, xp: 50, title: '写短文 150 字 + AI 评分', detail: '写 150 字短文并让 AI 批改' },
  { module: 'writing', star: 5, durationMin: 45, xp: 80, title: '完整作文 300 字 + 自评', detail: '写 300 字作文并复盘' },
  // 错题
  { module: 'errorbook', star: 1, durationMin: 5, xp: 10, title: '看 3 个错题', detail: '浏览 3 个历史错题，回忆错因' },
  { module: 'errorbook', star: 2, durationMin: 10, xp: 20, title: '重做 5 个错题', detail: '重做 5 个易错题' },
  { module: 'errorbook', star: 3, durationMin: 15, xp: 30, title: '错题分类回顾', detail: '按类型回顾错题，找出规律' },
  { module: 'errorbook', star: 4, durationMin: 20, xp: 40, title: '重做 10 个错题', detail: '重做 10 个高错题' },
  { module: 'errorbook', star: 5, durationMin: 30, xp: 60, title: '错题清零 + 总结模式', detail: '清空到期错题并总结错误模式' },
];

// CEFR → 推荐星级区间（轻 / 中 / 重三档落点）
const CEFR_STARS: Record<string, { light: StarLevel; mid: StarLevel; heavy: StarLevel }> = {
  A1: { light: 1, mid: 2, heavy: 3 },
  A2: { light: 1, mid: 2, heavy: 4 },
  B1: { light: 2, mid: 3, heavy: 4 },
  B2: { light: 2, mid: 3, heavy: 5 },
  C1: { light: 3, mid: 4, heavy: 5 },
  C2: { light: 3, mid: 4, heavy: 5 },
};

// 从本地池挑「1 轻 + 1 中 + 1 重」，尽量覆盖不同模块。
export const pickLocalTasks = (cefr: string): DailyTask[] => {
  const { light, mid, heavy } = CEFR_STARS[cefr] || CEFR_STARS.B1;
  const used = new Set<string>();
  const tasks: DailyTask[] = [];

  const pick = (star: StarLevel): DailyTask | null => {
    let candidates = POOL.filter((t) => t.star === star && !used.has(t.module));
    if (!candidates.length) candidates = POOL.filter((t) => t.star === star);
    if (!candidates.length) return null;
    const seed = candidates[Math.floor(Math.random() * candidates.length)];
    return { ...seed, id: `local-${seed.module}-${seed.star}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  };

  for (const star of [light, mid, heavy]) {
    const t = pick(star);
    if (t) {
      tasks.push(t);
      used.add(t.module);
    }
  }
  return tasks;
};
