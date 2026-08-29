// 自定义写作方向（写作树「用户私人枝干」）：
// - 只存种子（方向名 + 叶子阶梯），树节点由种子重建——ensureGrowthTree 每次合并/语言切换
//   都以默认树为基准重建，自定义枝干必须在合并后重新挂载（appendCustomDirections）。
// - 方向按目标语言隔离（跟语言走）：切语言互不串扰，切回即恢复。
// - AI 不可用 / 生成不合格时回退本地模板，保证功能永远可用。
import { Language, CEFRLevel, WritingNode, CustomDirectionSeed } from '../types';
import { CEFR_RANK, REGISTER_BY_LEVEL } from '../data/growthTree';
import { generateCustomDirectionLeaves, CustomDirectionDraft } from './aiService';

const STORAGE_KEY_DIRECTIONS = 'linguaflow_custom_directions';
export const MAX_CUSTOM_DIRECTIONS = 5;

type DirectionStore = Partial<Record<Language, CustomDirectionSeed[]>>;

const readStore = (): DirectionStore => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_DIRECTIONS) || '{}');
  } catch {
    return {};
  }
};

const writeStore = (store: DirectionStore) => {
  localStorage.setItem(STORAGE_KEY_DIRECTIONS, JSON.stringify(store));
};

export const getCustomDirections = (lang: Language): CustomDirectionSeed[] => readStore()[lang] ?? [];

const saveDirections = (lang: Language, seeds: CustomDirectionSeed[]) => {
  const store = readStore();
  store[lang] = seeds;
  writeStore(store);
};

export const addCustomDirection = (seed: CustomDirectionSeed) =>
  saveDirections(seed.lang, [...getCustomDirections(seed.lang), seed]);

export const updateCustomDirection = (lang: Language, seed: CustomDirectionSeed) =>
  saveDirections(lang, getCustomDirections(lang).map((s) => (s.id === seed.id ? seed : s)));

export const deleteCustomDirection = (lang: Language, id: string) =>
  saveDirections(lang, getCustomDirections(lang).filter((s) => s.id !== id));

// --- 种子 → 树节点 ---
// existingIds 用于幂等合并：树里已存在的节点不动（保留已写内容/完成状态），只补缺失的。
export const buildCustomDirectionNodes = (seed: CustomDirectionSeed, level: CEFRLevel, now: number): WritingNode[] => {
  const levelRank = CEFR_RANK[level] ?? 1;
  const theme: WritingNode = {
    id: seed.id,
    parentId: null, // 一级分组：与「我的写作成长档案」并列（自定义方向是用户的独立内容，不埋在档案里）
    type: 'theme',
    title: seed.title,
    content: '',
    progress: 0,
    wordCount: 0,
    tags: ['custom'],
    isExpanded: true,
    createdAt: now,
    updatedAt: now,
    language: seed.lang,
  };
  const tasks: WritingNode[] = seed.leaves.map((lf, i) => ({
    id: `${seed.id}-task-${i}`,
    parentId: seed.id,
    type: 'task',
    title: lf.title,
    content: '',
    progress: 0,
    wordCount: 0,
    tags: ['custom'],
    isExpanded: false,
    createdAt: now,
    updatedAt: now,
    cefrLevel: lf.cefr,
    register: lf.register ?? REGISTER_BY_LEVEL[lf.cefr] ?? 'neutral',
    unlocked: (CEFR_RANK[lf.cefr] ?? 1) <= levelRank,
    completed: false,
    scaffold: lf.scaffold ?? '',
    scaffoldHint: lf.hint,
    order: i,
    practiceType: lf.practiceType,
    cycleStage: lf.cycleStage,
    language: seed.lang,
  }));
  return [theme, ...tasks];
};

// ensureGrowthTree 合并后调用：把「种子有、树里没有」的自定义节点补挂到树上；
// 并把历史版本挂在 root 下的自定义枝干迁移为一级分组（parentId: null）。
export const appendCustomDirections = (tree: WritingNode[], lang: Language, level: CEFRLevel): WritingNode[] => {
  const seeds = getCustomDirections(lang);
  if (seeds.length === 0) return tree;
  const existingIds = new Set(tree.map((n) => n.id));
  const now = Date.now();
  const additions: WritingNode[] = [];
  for (const seed of seeds) {
    for (const n of buildCustomDirectionNodes(seed, level, now)) {
      if (!existingIds.has(n.id)) additions.push(n);
    }
  }
  // 迁移：旧结构里自定义枝干的 parentId 是 'root'，统一提为一级
  const migrated = tree.map((n) =>
    n.type === 'theme' && n.tags?.includes('custom') && n.parentId !== null ? { ...n, parentId: null, updatedAt: Date.now() } : n,
  );
  return additions.length || migrated !== tree ? [...migrated, ...additions] : tree;
};

// --- 生成（AI 优先，本地模板兜底） ---
const CEFR_LADDER: CEFRLevel[] = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2];
const ladderAt = (rank: number) => CEFR_LADDER[Math.min(6, Math.max(1, rank)) - 1];

// 本地模板阶梯：观察 → 叙事×2 → 组织 → 观点 → 重写打磨，难度从「低一级」缓升到「高一级」。
const fallbackDirectionDraft = (desc: string, level: CEFRLevel): CustomDirectionDraft => {
  const baseRank = CEFR_RANK[level] ?? 1;
  const short = desc.trim().slice(0, 12) || '我的方向';
  return {
    title: short,
    leaves: [
      { title: `初识${short}`, cefr: ladderAt(baseRank - 1), hint: `围绕「${desc}」，写下你注意到的 2–3 个具体细节：看到什么、听到什么、感受到什么。`, practiceType: 'observe', cycleStage: 'plan', register: 'casual' },
      { title: `一次${short}的小事`, cefr: ladderAt(baseRank), hint: `写一件和「${desc}」相关的小事：发生了什么、你做了什么、结果如何。`, practiceType: 'narrate', cycleStage: 'draft', register: 'neutral' },
      { title: `我的${short}日常`, cefr: ladderAt(baseRank), hint: `描述你日常和「${desc}」相关的场景，按时间或空间顺序写 4–5 句。`, practiceType: 'narrate', cycleStage: 'draft', register: 'neutral' },
      { title: `把${short}说清楚`, cefr: ladderAt(baseRank), hint: `围绕「${desc}」选三个要点，用连接词（首先 / 然后 / 最后）连成一段有条理的话。`, practiceType: 'organize', cycleStage: 'draft', register: 'polite' },
      { title: `我对${short}的看法`, cefr: ladderAt(baseRank + 1), hint: `说说你对「${desc}」的看法：喜欢什么、不喜欢什么、为什么。至少给出一个理由。`, practiceType: 'opinion', cycleStage: 'edit', register: 'formal' },
      { title: `重写与打磨`, cefr: ladderAt(baseRank + 1), hint: `把第 2 题（一次${short}的小事）重写一遍：用更具体的动作和画面代替空泛的形容词。`, practiceType: 'rewrite', cycleStage: 'rewrite', register: 'neutral' },
    ],
  };
};

export const createCustomDirection = async (
  desc: string,
  lang: Language,
  level: CEFRLevel,
  nativeLanguage: Language
): Promise<CustomDirectionSeed> => {
  let draft: CustomDirectionDraft;
  try {
    draft = await generateCustomDirectionLeaves(desc, lang, level, nativeLanguage);
  } catch {
    draft = fallbackDirectionDraft(desc, level);
  }
  const seed: CustomDirectionSeed = {
    id: `custom_${Date.now()}`,
    title: draft.title,
    desc: desc.trim(),
    lang,
    createdAt: Date.now(),
    leaves: draft.leaves,
  };
  addCustomDirection(seed);
  return seed;
};

// 重新生成：复用 desc 换一批叶子（进度重置由 UI 层确认后处理节点）。
export const regenerateCustomDirection = async (
  seed: CustomDirectionSeed,
  level: CEFRLevel,
  nativeLanguage: Language
): Promise<CustomDirectionSeed> => {
  let draft: CustomDirectionDraft;
  try {
    draft = await generateCustomDirectionLeaves(seed.desc, seed.lang, level, nativeLanguage);
  } catch {
    draft = fallbackDirectionDraft(seed.desc, level);
  }
  const next: CustomDirectionSeed = { ...seed, title: seed.title, createdAt: Date.now(), leaves: draft.leaves };
  updateCustomDirection(seed.lang, next);
  return next;
};
