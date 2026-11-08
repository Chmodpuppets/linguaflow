
import { uuid } from '../utils/uuid';
import { repairIds, repairTreeIds } from '../utils/idRepair';

import { UserProfile, ActivityLog, Language, CEFRLevel, UserContent, LanguageProgress, WritingNode, VocabularyItem, DailyQuest, QuestKind, MentorPersona, AIMemory, ScriptItem, ScriptCardProgress, ErrorCard, WritingScoreRecord, TypingContent, ErrorPattern, ErrorPatternType, ERROR_PATTERN_LABELS, FlywheelStep, DailyFlywheel, SongPack, Book, BookVideo, StudyBook, StudyItem, StudyItemQuality } from '../types';
import { getScriptPackForLanguage } from '../data/scriptPacks';
import type { StarterWord } from '../data/starterVocab';

const STORAGE_KEY_USER = 'linguaflow_user';
const STORAGE_KEY_LOGS = 'linguaflow_logs';
const STORAGE_KEY_LIBRARY = 'linguaflow_library';
const STORAGE_KEY_TREE = 'linguaflow_writing_tree';
const STORAGE_KEY_VOCAB = 'linguaflow_vocabulary';
const STORAGE_KEY_AI = 'linguaflow_ai_config';
const STORAGE_KEY_SCRIPT = 'linguaflow_script_progress';
const STORAGE_KEY_ERRORBOOK = 'linguaflow_errorbook';
const STORAGE_KEY_WRITING_HISTORY = 'linguaflow_writing_history';
const STORAGE_KEY_INKQUEST = 'linguaflow_inkquest';
const STORAGE_KEY_INKQUEST_STORY = 'linguaflow_inkquest_story';
const STORAGE_KEY_INKQUEST_LISTENING = 'linguaflow_inkquest_listening';
const STORAGE_KEY_TYPING_LIBRARY = 'linguaflow_typing_library';
const STORAGE_KEY_ERROR_PATTERNS = 'linguaflow_error_patterns';
const STORAGE_KEY_FLYWHEEL = 'linguaflow_daily_flywheel';
const STORAGE_KEY_BOOKS = 'linguaflow_books';

// 所有持久化 key 的权威集合（本地备份/恢复用）。集中维护，避免新增模块后备份遗漏、静默丢数据。
// 用字面量以避免引用下方靠后声明的 const 触发 TDZ。
export const ALL_STORAGE_KEYS: string[] = [
  'linguaflow_user', 'linguaflow_logs', 'linguaflow_library', 'linguaflow_writing_tree',
  'linguaflow_vocabulary', 'linguaflow_ai_config', 'linguaflow_script_progress', 'linguaflow_errorbook',
  'linguaflow_writing_history', 'linguaflow_inkquest', 'linguaflow_inkquest_story',
  'linguaflow_inkquest_listening', 'linguaflow_typing_library', 'linguaflow_error_patterns',
  'linguaflow_daily_flywheel', 'linguaflow_custom_script', 'linguaflow_custom_writing',
  'linguaflow_rpg_session', 'linguaflow_rpg_custom', 'linguaflow_song_packs', 'linguaflow_books',
  'linguaflow_custom_directions',
];

// --- 历史脏 id 的读时修复（见 utils/idRepair.ts）---
// 读列表 → 若存在非法/重复 id 则重发号并写回原 key → 返回修复后的列表。
// 只动 id，业务字段（内容 / 进度 / 时间）保持不动；无问题时零写入。
const readListRepair = <T extends { id: string }>(key: string, raw: string | null): T[] => {
  if (!raw) return [];
  let list: T[];
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const { list: fixed, changed } = repairIds(list as T[]);
  if (changed) {
    try {
      localStorage.setItem(key, JSON.stringify(fixed));
    } catch {
      /* 配额满等异常不阻塞读取 */
    }
  }
  return fixed;
};

// --- Runtime AI model configuration (switcher in Settings -> 模型设置) ---
// Keys are stored ONLY in localStorage (browser), never committed to source.
export type AIProviderId = 'qwen' | 'openrouter' | 'glm' | 'deepseek' | 'custom';

/**
 * 任务级模型路由：按"活儿"分配模型，而非全站一个默认模型。
 * - 'fast'   ：高频小调用 / 实时性要求高（打字辅助、取词、翻译、注音）→ 走快模型（Qwen / GLM），避开慢推理模型。
 * - 'reason' ：需要深推理的高价值任务（写作批改、错误诊断、计划、考试评分、文章导学、跨文字特训、对话复盘、SRS 排程、定目标、Agentic 闭环）→ 走高推理模型（OpenRouter / ox-alpha）。
 * - 'auto'   ：跟随「当前模型」全局选择（默认 active provider）。
 */
export type TaskTier = 'fast' | 'reason' | 'auto';

export type TaskCategory =
  | 'typing'              // 打字辅助（生成打字文段、看词造句词表、 scaffolds 等）
  | 'vocabExtract'        // 批量取词 / 单词释义
  | 'writingCritique'     // 写作深度批改（含二稿、引导式写作）
  | 'errorDiagnosis'      // 错误模式根因诊断
  | 'studyPlan'           // 自适应学习计划
  | 'examScoring'         // 考试评分有理据反馈
  | 'articleGuide'        // 导入文章层级导学
  | 'scriptTraining'      // 跨文字生成式特训设计
  | 'conversationDebrief' // 对话复盘（非实时）
  | 'srsSchedule'         // SRS 智能排程
  | 'goalSetting'         // 定目标
  | 'agenticLoop'         // Agentic 学习闭环
  | 'studyBookGen'        // 学习书库：导入文本结构化 / AI 生成等价书
  | 'productionEval';     // 学习书库：Production 造句评分

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  typing: '打字辅助',
  vocabExtract: '批量取词',
  writingCritique: '写作深度批改',
  errorDiagnosis: '错误模式根因诊断',
  studyPlan: '自适应学习计划',
  examScoring: '考试评分有理据反馈',
  articleGuide: '导入文章层级导学',
  scriptTraining: '跨文字生成式特训',
  conversationDebrief: '对话复盘（非实时）',
  srsSchedule: 'SRS 智能排程',
  goalSetting: '定目标',
  agenticLoop: 'Agentic 学习闭环',
  studyBookGen: '学习书库生成',
  productionEval: '造句评分',
};

/** 默认路由：高频小活走 fast，深推理活走 reason。可在「个人中心 → 模型设置」逐项覆盖。 */
export const DEFAULT_TASK_ROUTES: Record<TaskCategory, TaskTier> = {
  typing: 'fast',
  vocabExtract: 'fast',
  writingCritique: 'reason',
  errorDiagnosis: 'reason',
  studyPlan: 'reason',
  examScoring: 'reason',
  articleGuide: 'reason',
  scriptTraining: 'reason',
  conversationDebrief: 'reason',
  srsSchedule: 'reason',
  goalSetting: 'reason',
  agenticLoop: 'reason',
  studyBookGen: 'fast',
  productionEval: 'fast',
};

export interface AIProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AIConfig {
  active: AIProviderId;
  qwen: AIProviderConfig;
  openrouter: AIProviderConfig;
  glm: AIProviderConfig;
  deepseek: AIProviderConfig;
  custom: AIProviderConfig;
  /** Qwen TTS 音色 id（qwen3-tts-flash 的 voice 参数），见 aiService.TTS_VOICES */
  ttsVoice: string;
  /** 按任务类别分配模型层级（fast/reason/auto）；缺省项回落 DEFAULT_TASK_ROUTES。 */
  taskRoutes?: Partial<Record<TaskCategory, TaskTier>>;
}

// 重要：线上版/开源版**不内置任何真实 API Key**（生产构建会把 .env 密钥清空，
// 见 vite.config.ts）。所有 Key 都必须由用户在「模型设置」里自行填写后才能使用 AI。
export const defaultAIConfig = (): AIConfig => ({
  active: 'glm',
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-flash', apiKey: '' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-5.3-flash', apiKey: '' },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiKey: '' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '' },
  custom: { baseUrl: '', model: '', apiKey: '' },
  ttsVoice: 'Cherry',
});

export const getAIConfig = (): AIConfig => {
  const data = localStorage.getItem(STORAGE_KEY_AI);
  if (!data) return defaultAIConfig();
  try {
    const p = JSON.parse(data);
    const d = defaultAIConfig();
    return {
      active: (p.active as AIProviderId) || d.active,
      qwen: { ...d.qwen, ...(p.qwen || {}) },
      openrouter: { ...d.openrouter, ...(p.openrouter || {}) },
      glm: { ...d.glm, ...(p.glm || {}) },
      deepseek: { ...d.deepseek, ...(p.deepseek || {}) },
      custom: { ...d.custom, ...(p.custom || {}) },
      ttsVoice: p.ttsVoice || d.ttsVoice,
      taskRoutes: (p.taskRoutes as Partial<Record<TaskCategory, TaskTier>>) || {},
    };
  } catch {
    return defaultAIConfig();
  }
};

export const saveAIConfig = (c: AIConfig) => {
  localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(c));
};

// --- Helper: Date String ---
const getTodayString = () => new Date().toISOString().split('T')[0];

// Fill defaults for fields added in later phases (safe for old profiles)
const normalizeUser = (u: any): UserProfile => ({
  ...u,
  currentStreak: u.currentStreak ?? 1,
  maxStreak: u.maxStreak ?? u.currentStreak ?? 1,
  streakShields: u.streakShields ?? 1,
  dailyQuests: Array.isArray(u.dailyQuests) ? u.dailyQuests : [],
  lastQuestDate: u.lastQuestDate ?? u.lastActiveDate ?? getTodayString(),
  mentorPersona: u.mentorPersona ?? 'encourager',
  preferredTopics: Array.isArray(u.preferredTopics) ? u.preferredTopics : [],
  aiMemory: u.aiMemory ?? { goals: [], weakPoints: [], interests: [], notes: '' },
  premium: !!u.premium,
  lastStreakDate: u.lastStreakDate ?? u.lastActiveDate ?? getTodayString(),
});

export const getUser = (): UserProfile | null => {
  const data = localStorage.getItem(STORAGE_KEY_USER);
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    // Migration fallback
    if (parsed.xp !== undefined && !parsed.progress) {
        return normalizeUser({
            ...parsed,
            progress: {
                [parsed.learningLanguage]: {
                    xp: parsed.xp,
                    level: parsed.level,
                    cefrLevel: parsed.cefrLevel || CEFRLevel.A1,
                    totalWordsTyped: 0,
                    lastActive: Date.now(),
                    maxUnlockedStage: 0
                }
            }
        });
    }
    return normalizeUser(parsed);
  } catch (e) {
    return null;
  }
};

export const saveUser = (user: UserProfile) => {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
};

export const logoutUser = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
};

// 清除本机全部「学习数据」（不含 AI 配置，避免重新输入密钥）。
// 用户退出时若勾选「清除所有数据」再调用，防止换昵称后串用旧数据。
export const clearAllLearningData = () => {
    localStorage.removeItem(STORAGE_KEY_LOGS);
    localStorage.removeItem(STORAGE_KEY_LIBRARY);
    localStorage.removeItem(STORAGE_KEY_TREE);
    localStorage.removeItem(STORAGE_KEY_VOCAB);
    localStorage.removeItem(STORAGE_KEY_SCRIPT);
    localStorage.removeItem(STORAGE_KEY_ERRORBOOK);
    localStorage.removeItem(STORAGE_KEY_WRITING_HISTORY);
    localStorage.removeItem(STORAGE_KEY_INKQUEST);
    localStorage.removeItem(STORAGE_KEY_INKQUEST_STORY);
    localStorage.removeItem(STORAGE_KEY_INKQUEST_LISTENING);
    localStorage.removeItem(STORAGE_KEY_TYPING_LIBRARY);
    localStorage.removeItem(STORAGE_KEY_ERROR_PATTERNS);
    localStorage.removeItem(STORAGE_KEY_FLYWHEEL);
};

// --- 个人错误模式引擎（Error Pattern Engine）---
// 捕捉用户在产出练习中的错误类型，按 (language, type) 聚合，用于出题优先级。

export const getErrorPatterns = (lang?: Language): ErrorPattern[] => {
  const data = localStorage.getItem(STORAGE_KEY_ERROR_PATTERNS);
  const all: ErrorPattern[] = data ? JSON.parse(data) : [];
  return lang ? all.filter((p) => p.language === lang) : all;
};

export const bumpErrorPattern = (
  lang: Language,
  type: ErrorPatternType,
  label: string,
  example?: string,
  tags?: string[]
): ErrorPattern => {
  const all = getErrorPatterns();
  const id = `${lang}:${type}`;
  const idx = all.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const p = all[idx];
    if (example && !p.examples.includes(example)) {
      p.examples = [...p.examples, example].slice(-5);
    }
    p.count += 1;
    p.lastSeen = Date.now();
    if (tags && tags.length) p.tags = Array.from(new Set([...(p.tags || []), ...tags]));
    all[idx] = p;
  } else {
    all.push({ id, type, language: lang, label, examples: example ? [example] : [], count: 1, lastSeen: Date.now(), tags: tags || [] });
  }
  localStorage.setItem(STORAGE_KEY_ERROR_PATTERNS, JSON.stringify(all));
  return all.find((p) => p.id === id)!;
};

export const getTopErrorPatterns = (lang: Language, n = 3): ErrorPattern[] =>
  getErrorPatterns(lang).sort((a, b) => b.count - a.count).slice(0, n);

// --- 每日产出飞轮（Daily Production Flywheel）---
// 每天一个统一主题，串起写作/听写/字形三路产出；跑完才计连胜。

interface FlywheelTheme { id: string; theme: string; prompt: string; }

const FLYWHEEL_THEMES: FlywheelTheme[] = [
  { id: 'd1', theme: '今天的一件小事', prompt: '用目标语言写下/练出今天发生的一件小事' },
  { id: 'd2', theme: '我的日常 routine', prompt: '描述你平常的一天' },
  { id: 'd3', theme: '最爱的一道食物', prompt: '写/练你最喜欢的食物' },
  { id: 'd4', theme: '周末想做的事', prompt: '说说你这个周末想做什么' },
  { id: 'd5', theme: '一个熟悉的人', prompt: '描述一个你熟悉的人' },
  { id: 'd6', theme: '最近学到的新词', prompt: '用最近学到的新词造点句子' },
  { id: 'd7', theme: '我住的地方', prompt: '描述你住的地方' },
  { id: 'd8', theme: '一次难忘的旅行', prompt: '回忆一次难忘的旅行' },
  { id: 'd9', theme: '我的小目标', prompt: '写写你最近的小目标' },
  { id: 'd10', theme: '天气与心情', prompt: '结合今天的天气说说心情' },
  { id: 'd11', theme: '一部喜欢的电影', prompt: '聊聊你喜欢的电影' },
  { id: 'd12', theme: '童年记忆', prompt: '写一段童年记忆' },
  { id: 'd13', theme: '我的爱好', prompt: '介绍你的爱好' },
  { id: 'd14', theme: '明天的计划', prompt: '计划一下明天' },
  { id: 'd15', theme: '一种动物', prompt: '描述一种你喜欢的动物' },
  { id: 'd16', theme: '购物清单', prompt: '列一份购物清单并说明用途' },
  { id: 'd17', theme: '一封短信', prompt: '用目标语言写一封短小的信' },
  { id: 'd18', theme: '城市的声音', prompt: '写写城市里你熟悉的声音' },
  { id: 'd19', theme: '一次小失败', prompt: '说说一次小失败和收获' },
  { id: 'd20', theme: '我的理想周末', prompt: '描绘你的理想周末' },
  { id: 'd21', theme: '一道家乡菜', prompt: '介绍一道家乡菜的做法或味道' },
  { id: 'd22', theme: '交通工具', prompt: '聊聊你常用的交通工具' },
  { id: 'd23', theme: '夜晚的街', prompt: '描写夜晚的街道' },
  { id: 'd24', theme: '给一年后的自己', prompt: '写一句话给一年后的自己' },
];

const pickFlywheelTheme = (date: string): FlywheelTheme => {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
  return FLYWHEEL_THEMES[h % FLYWHEEL_THEMES.length];
};

// 今日产出线：按「日期 + 语言」两层键保存。
// 旧实现是全局单份 → 日语写完/听写完再切英语，三步仍显示已完成。
// 口径 A：每门语言各自一套 steps；每门语言再次完成都正常给 XP（XP 由 addActivity 按次发放，
// 不在这里），连胜由 commitDailyStreak 的「当天防重」保证一天只记一次。
interface FlywheelStore {
  date: string;
  byLang: Record<string, DailyFlywheel>;
}

const resolveFlywheelLang = (lang?: Language): string => {
  if (lang) return String(lang);
  try {
    const u = getUser();
    if (u?.learningLanguage) return String(u.learningLanguage);
  } catch {}
  return 'unknown';
};

const readFlywheelStore = (lang: string): FlywheelStore => {
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FLYWHEEL);
    const d = raw ? JSON.parse(raw) : null;
    if (d && d.date === today && d.byLang && typeof d.byLang === 'object') {
      return { date: d.date, byLang: d.byLang };
    }
    // 旧格式（单份、只按日期）：迁移到「当前语言」，不抹掉用户今天已经写完的产出。
    // 该记录当天午夜自动过期，归属即使偶有偏差也只影响今天。
    if (d && d.date === today && d.steps) {
      const store: FlywheelStore = { date: today, byLang: { [lang]: d as DailyFlywheel } };
      localStorage.setItem(STORAGE_KEY_FLYWHEEL, JSON.stringify(store));
      return store;
    }
  } catch {}
  return { date: today, byLang: {} };
};

const writeFlywheelStore = (byLang: Record<string, DailyFlywheel>): void => {
  localStorage.setItem(STORAGE_KEY_FLYWHEEL, JSON.stringify({ date: getTodayString(), byLang }));
};

const ensureFlywheelForKey = (lang: string): DailyFlywheel => {
  const store = readFlywheelStore(lang);
  const existing = store.byLang[lang];
  if (existing && existing.date === store.date) return existing;
  const th = pickFlywheelTheme(store.date);
  const fw: DailyFlywheel = {
    date: store.date,
    themeId: th.id,
    theme: th.theme,
    themePrompt: th.prompt,
    steps: { writing: false, dictation: false, script: false },
    allDone: false,
  };
  store.byLang[lang] = fw;
  writeFlywheelStore(store.byLang);
  return fw;
};

export const getDailyFlywheel = (lang?: Language): DailyFlywheel | null => {
  const key = resolveFlywheelLang(lang);
  return readFlywheelStore(key).byLang[key] || null;
};

export const ensureDailyFlywheel = (lang?: Language): DailyFlywheel =>
  ensureFlywheelForKey(resolveFlywheelLang(lang));

const buildFlywheelReflection = (lang: Language): string => {
  const top = getTopErrorPatterns(lang, 1)[0];
  if (top) return `今日产出线完成 🎉 写作/听写/字形三路打通。你近期常卡在「${top.label}」，明天可以专门多练练。`;
  return '今日产出线完成 🎉 写作/听写/字形三路打通，保持这个节奏！';
};

export const markFlywheelStep = (step: FlywheelStep, lang?: Language): DailyFlywheel => {
  const key = resolveFlywheelLang(lang);
  const fw = ensureFlywheelForKey(key);
  fw.steps[step] = true;
  // 无字形包的语言（EN/ES/FR/DE/IT/ZH 等）不应被 script 步卡住：该步视为已满足，仅需写作 + 听写即可完成飞轮
  const needsScript = lang ? !!getScriptPackForLanguage(lang) : true;
  const allDone = fw.steps.writing && fw.steps.dictation && (!needsScript || fw.steps.script);
  fw.allDone = allDone;
  if (allDone) fw.reflection = lang ? buildFlywheelReflection(lang) : '今日产出线完成 🎉';
  // 读-改-写：只覆盖当前语言那份，其它语言的今日进度保留
  const store = readFlywheelStore(key);
  store.byLang[key] = fw;
  writeFlywheelStore(store.byLang);
  return fw;
};

// 连胜唯一口径：完成「今日产出飞轮」（写作 + 听写 + 有字形包时的字形特训）时由调用方 commitDailyStreak。
// 对话台星任务全清只给 XP，不再旁路续连胜。
export const commitDailyStreak = (user: UserProfile): UserProfile => {
  const today = getTodayString();
  if (user.lastStreakDate === today) return user; // 今天已计入，防重
  let updated: UserProfile = { ...user };
  if (!updated.lastStreakDate) {
    updated.currentStreak = 1;
  } else {
    const last = new Date(updated.lastStreakDate);
    const curr = new Date(today);
    const diffDays = Math.ceil(Math.abs(curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) updated.currentStreak += 1;
    else updated.currentStreak = 1;
  }
  if (updated.currentStreak > updated.maxStreak) updated.maxStreak = updated.currentStreak;
  updated.lastStreakDate = today;
  saveUser(updated);
  return updated;
};

// --- 墨程 InkQuest 手帐（独立于 UserProfile，避免 addActivity 频繁序列化大数组） ---
export interface InkQuestCard {
  id: string;
  date: string;            // YYYY-MM-DD
  language: Language;
  seasonId: string;
  cardId: string;
  theme: string;          // 主题（中文）
  userText: string;       // 用户写的原文
  highlight: string;      // 用户收进手帐的亮点句/段落
  coachComment?: string;  // 教练总评
  scores?: { grammar: number; fluency: number; vocabulary: number; task: number }; // 教练四维度小分
  wordCount?: number;     // 字数/词数（用于成长对决）
  createdAt: number;
}

// --- 墨程 InkQuest 故事线（叙事成长）：按语言存一条持续累积的旅程手帐 ---
export interface InkQuestStory {
  language: Language;
  text: string;       // 已累积的完整故事
  updatedAt: number;
}

export const getInkQuestStory = (lang: Language): InkQuestStory | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INKQUEST_STORY);
    const all: InkQuestStory[] = raw ? JSON.parse(raw) : [];
    return all.find((s) => s.language === lang) ?? null;
  } catch {
    return null;
  }
};

export const setInkQuestStory = (story: InkQuestStory): void => {
  const raw = localStorage.getItem(STORAGE_KEY_INKQUEST_STORY);
  const all: InkQuestStory[] = raw ? JSON.parse(raw) : [];
  const next = [...all.filter((s) => s.language !== story.language), story];
  localStorage.setItem(STORAGE_KEY_INKQUEST_STORY, JSON.stringify(next));
};

export const appendInkQuestStory = (lang: Language, paragraph: string): InkQuestStory => {
  const cur = getInkQuestStory(lang);
  const sep = cur && cur.text ? '\n\n' : '';
  const text = (cur?.text ?? '') + sep + paragraph;
  const story: InkQuestStory = { language: lang, text, updatedAt: Date.now() };
  setInkQuestStory(story);
  return story;
};

// --- 墨程 InkQuest 听力库：AI 生成的听写句持久化，可回看/重听/重做 ---
export interface InkQuestListeningAttempt {
  text: string;     // 用户当时写下的内容
  pct: number;      // 匹配百分比
  at: number;       // 时间戳
}

export interface InkQuestListeningItem {
  id: string;
  date: string;            // YYYY-MM-DD
  language: Language;
  seasonId: string;
  cardId: string;
  theme: string;           // 主题（中文）
  sentence: string;        // AI 生成的听写句（目标语）
  createdAt: number;
  attempts: InkQuestListeningAttempt[]; // 历次重做记录，最新在前
}

export const getInkQuestListeningItems = (lang?: Language): InkQuestListeningItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INKQUEST_LISTENING);
    const all = readListRepair<InkQuestListeningItem>(STORAGE_KEY_INKQUEST_LISTENING, raw);
    const filtered = lang ? all.filter((c) => c.language === lang) : all;
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

export const saveInkQuestListeningItem = (item: InkQuestListeningItem): void => {
  const all = getInkQuestListeningItems();
  const next = [item, ...all.filter((c) => c.id !== item.id)].slice(0, INKQUEST_MAX);
  localStorage.setItem(STORAGE_KEY_INKQUEST_LISTENING, JSON.stringify(next));
};

export const updateInkQuestListeningAttempt = (
  id: string,
  attempt: InkQuestListeningAttempt
): void => {
  const all = getInkQuestListeningItems();
  const target = all.find((c) => c.id === id);
  if (!target) return;
  target.attempts = [attempt, ...(target.attempts ?? [])].slice(0, 10);
  localStorage.setItem(STORAGE_KEY_INKQUEST_LISTENING, JSON.stringify(all));
};

export const deleteInkQuestListeningItem = (id: string): void => {
  const all = getInkQuestListeningItems();
  localStorage.setItem(STORAGE_KEY_INKQUEST_LISTENING, JSON.stringify(all.filter((c) => c.id !== id)));
};

const INKQUEST_MAX = 200;

// --- 打字库：AI 生成的打字闯关内容持久化，可无 token 重复练习 ---
export interface TypingLibraryItem {
  id: string;
  language: Language;
  cefr: CEFRLevel;
  topic: string;
  source: 'stage' | 'practice';
  text: string;
  translation: string;
  phoneticGuide: string;
  keyVocabulary: TypingContent['keyVocabulary'];
  createdAt: number;
  lastPracticedAt?: number;
  practiceCount: number;
}

export const getTypingLibraryItems = (lang?: Language): TypingLibraryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TYPING_LIBRARY);
    const all = readListRepair<TypingLibraryItem>(STORAGE_KEY_TYPING_LIBRARY, raw);
    const filtered = lang ? all.filter((c) => c.language === lang) : all;
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

// 保存一条；同一语言下 text 去重，避免反复生成相同内容造成重复条目。
// 返回该语言下的最新列表，方便调用方直接 setState。
export const saveTypingLibraryItem = (item: TypingLibraryItem): TypingLibraryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TYPING_LIBRARY);
    const all: TypingLibraryItem[] = raw ? JSON.parse(raw) : [];
    if (all.some((c) => c.language === item.language && c.text === item.text)) {
      return getTypingLibraryItems(item.language);
    }
    const next = [...all, item].slice(-300); // 上限保护
    localStorage.setItem(STORAGE_KEY_TYPING_LIBRARY, JSON.stringify(next));
    return getTypingLibraryItems(item.language);
  } catch {
    return getTypingLibraryItems(item.language);
  }
};

export const deleteTypingLibraryItem = (id: string, lang?: Language): TypingLibraryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TYPING_LIBRARY);
    const all: TypingLibraryItem[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(STORAGE_KEY_TYPING_LIBRARY, JSON.stringify(all.filter((c) => c.id !== id)));
    return getTypingLibraryItems(lang);
  } catch {
    return [];
  }
};

// 重新练习时更新练习次数与最近练习时间。
export const touchTypingLibraryItem = (id: string, lang?: Language): TypingLibraryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TYPING_LIBRARY);
    const all: TypingLibraryItem[] = raw ? JSON.parse(raw) : [];
    const target = all.find((c) => c.id === id);
    if (target) {
      target.practiceCount = (target.practiceCount ?? 0) + 1;
      target.lastPracticedAt = Date.now();
      localStorage.setItem(STORAGE_KEY_TYPING_LIBRARY, JSON.stringify(all));
    }
    return getTypingLibraryItems(lang);
  } catch {
    return getTypingLibraryItems(lang);
  }
};

// --- 自定义字形卡（用户自建，接入文字特训 / 内容仓库）---
// 注意：自建包无 romaji 自动校验（transliterate 是函数不可存），只能走虚拟键盘点按字形。
export interface CustomScriptItem extends ScriptItem {
  language: Language;
}

const STORAGE_KEY_CUSTOM_SCRIPT = 'linguaflow_custom_script';

export const getCustomScriptItems = (lang?: Language): CustomScriptItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_SCRIPT);
    const all = readListRepair<CustomScriptItem>(STORAGE_KEY_CUSTOM_SCRIPT, raw);
    return lang ? all.filter((c) => c.language === lang) : all;
  } catch {
    return [];
  }
};

export const saveCustomScriptItem = (item: CustomScriptItem): void => {
  const all = getCustomScriptItems();
  const next = [item, ...all.filter((c) => c.id !== item.id)].slice(0, 500);
  localStorage.setItem(STORAGE_KEY_CUSTOM_SCRIPT, JSON.stringify(next));
};

export const deleteCustomScriptItem = (id: string): void => {
  const all = getCustomScriptItems();
  localStorage.setItem(STORAGE_KEY_CUSTOM_SCRIPT, JSON.stringify(all.filter((c) => c.id !== id)));
};

// --- 自定义写作题（用户自建，接入墨程 / 内容仓库）---
export interface CustomWritingPrompt {
  id: string;
  text: string;            // 主题/写作任务（中文）
  register: string;        // 'casual' | 'neutral' | 'polite' | 'formal' | 'business'
  language: Language;
  createdAt: number;
}

const STORAGE_KEY_CUSTOM_WRITING = 'linguaflow_custom_writing';

export const getCustomWritingPrompts = (lang?: Language): CustomWritingPrompt[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_WRITING);
    const all = readListRepair<CustomWritingPrompt>(STORAGE_KEY_CUSTOM_WRITING, raw);
    return lang ? all.filter((c) => c.language === lang) : all;
  } catch {
    return [];
  }
};

export const saveCustomWritingPrompt = (item: CustomWritingPrompt): void => {
  const all = getCustomWritingPrompts();
  const next = [item, ...all.filter((c) => c.id !== item.id)].slice(0, 500);
  localStorage.setItem(STORAGE_KEY_CUSTOM_WRITING, JSON.stringify(next));
};

export const deleteCustomWritingPrompt = (id: string): void => {
  const all = getCustomWritingPrompts();
  localStorage.setItem(STORAGE_KEY_CUSTOM_WRITING, JSON.stringify(all.filter((c) => c.id !== id)));
};

export const getInkQuestCards = (lang?: Language): InkQuestCard[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INKQUEST);
    const all = readListRepair<InkQuestCard>(STORAGE_KEY_INKQUEST, raw);
    const filtered = lang ? all.filter((c) => c.language === lang) : all;
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

export const saveInkQuestCard = (card: InkQuestCard): void => {
  const all = getInkQuestCards();
  const next = [card, ...all.filter((c) => c.id !== card.id)].slice(0, INKQUEST_MAX);
  localStorage.setItem(STORAGE_KEY_INKQUEST, JSON.stringify(next));
};

export const deleteInkQuestCard = (id: string): void => {
  const all = getInkQuestCards();
  localStorage.setItem(STORAGE_KEY_INKQUEST, JSON.stringify(all.filter((c) => c.id !== id)));
};

export const registerUser = (username: string, nativeLanguage: Language, learningLanguage: Language, level: CEFRLevel): UserProfile => {
  const newUser: UserProfile = {
    username,
    nativeLanguage,
    learningLanguage,
    progress: {
        [learningLanguage]: {
            xp: 0,
            level: 1,
            cefrLevel: level,
            totalWordsTyped: 0,
            lastActive: Date.now(),
            maxUnlockedStage: 0
        }
    },
    currentStreak: 1,
    maxStreak: 1,
    lastActiveDate: getTodayString(),
    streakShields: 1,
    lastStreakDate: getTodayString(),
    dailyQuests: generateDailyQuests(learningLanguage),
    lastQuestDate: getTodayString(),
    mentorPersona: 'encourager',
    preferredTopics: [],
    aiMemory: { goals: [], weakPoints: [], interests: [], notes: '' },
    premium: false,
    joinedDate: Date.now()
  };
  saveUser(newUser);
  return newUser;
};

// Ensure language progress exists when switching languages
export const ensureLanguageProgress = (user: UserProfile, lang: Language): UserProfile => {
    if (!user.progress[lang]) {
        user.progress[lang] = {
            xp: 0,
            level: 1,
            cefrLevel: CEFRLevel.A1,
            totalWordsTyped: 0,
            lastActive: Date.now(),
            maxUnlockedStage: 0
        };
        saveUser(user);
    }
    return user;
};

// 每升一级所需经验值（等级 = 1 + floor(xp / XP_PER_LEVEL)）
export const XP_PER_LEVEL = 500;

export interface LevelInfo {
  level: number;        // 1 基的当前等级
  xpInLevel: number;    // 当前等级内的经验值 [0, XP_PER_LEVEL)
  xpToNext: number;     // 距下一级还需经验
  pct: number;          // 当前等级内进度 0–100
}

// 单一计算源：等级与进度条都从这里取，避免多处公式漂移导致不一致
export const getLevelInfo = (xp: number): LevelInfo => {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = 1 + Math.floor(safeXp / XP_PER_LEVEL);
  const xpInLevel = safeXp % XP_PER_LEVEL;
  return {
    level,
    xpInLevel,
    xpToNext: XP_PER_LEVEL - xpInLevel,
    pct: (xpInLevel / XP_PER_LEVEL) * 100,
  };
};

// --- Daily Quests (Phase 1) ---

const QUEST_TEMPLATES: Array<{ kind: QuestKind; label: string; target: number; rewardXP: number }> = [
    { kind: 'typing_words', label: '打字练习：完成 30 个词的输入', target: 30, rewardXP: 15 },
    { kind: 'vocab_review', label: '词汇复习：复习 10 个单词', target: 10, rewardXP: 15 },
    { kind: 'rpg_sessions', label: '口语对话：完成 5 轮 RPG 情景对话', target: 5, rewardXP: 20 },
    { kind: 'writing_words', label: '写作练习：写满 50 个词', target: 50, rewardXP: 20 },
    { kind: 'script_practice', label: '字形特训：练熟 10 个字形', target: 10, rewardXP: 15 },
];

// 错误模式类型 → 每日任务第三项模板索引（dictation_miss 无独立每日任务，不映射 → 回退日期轮换）
const WEAK_QUEST_TEMPLATE: Partial<Record<ErrorPatternType, number>> = {
    kana_dakuon: 4, kana_youon: 4, kana_confusion: 4, // 字形类弱项 → 字形特训
    spelling: 3, tense: 3, particle: 3, word_order: 3, collocation: 3, register: 3, agreement: 3, other: 3, // 写作类弱项 → 写作练习
    content: 3, structure: 3, reader_awareness: 3, // 重写弱项（内容/结构/读者意识）→ 写作练习
};

// 弱项优先：取 Top 弱项中第一个能映射到每日任务模板的，作为第三项；都映射不到则返回 null
const pickWeaknessQuest = (lang: Language) => {
    for (const w of getTopErrorPatterns(lang, 3)) {
        const idx = WEAK_QUEST_TEMPLATE[w.type];
        if (idx !== undefined) return QUEST_TEMPLATES[idx];
    }
    return null;
};

export const generateDailyQuests = (lang: Language): DailyQuest[] => {
    // 固定两项：打字 + 词汇复习
    // 第三项：优先从个人错误模式引擎的弱项挑对应模块（字形类→字形特训，写作类→写作练习）；
    // 无弱项或弱项无对应任务时，回退到「口语 / 写作 / 字形特训」按日期轮换，保证多样性
    const third = pickWeaknessQuest(lang)
        ?? [QUEST_TEMPLATES[2], QUEST_TEMPLATES[3], QUEST_TEMPLATES[4]][
            parseInt(getTodayString().slice(-1), 10) % 3
        ];
    const picks = [QUEST_TEMPLATES[0], QUEST_TEMPLATES[1], third];
    return picks.map((t) => ({
        id: uuid(),
        label: t.label,
        target: t.target,
        current: 0,
        completed: false,
        rewardXP: t.rewardXP,
        kind: t.kind,
    }));
};

// 每日刷新：跨天则重新生成任务
export const rolloverDailyQuests = (user: UserProfile): UserProfile => {
    const today = getTodayString();
    if (user.lastQuestDate !== today) {
        user.dailyQuests = generateDailyQuests(user.learningLanguage);
        user.lastQuestDate = today;
        saveUser(user);
    }
    // 确保今日产出飞轮存在（跨天刷新时重置为新主题）；按当前语言各自一份
    ensureDailyFlywheel(user.learningLanguage);
    return user;
};

// 活动发生时推进对应任务；完成任务发放奖励 XP
export const progressQuests = (user: UserProfile, kind: QuestKind, amount: number): UserProfile => {
    if (amount <= 0) return user;
    let changed = false;
    let bonusXP = 0;
    const lang = user.learningLanguage;
    user.dailyQuests = user.dailyQuests.map((q) => {
        if (q.kind !== kind || q.completed) return q;
        const next = Math.min(q.target, q.current + amount);
        if (next !== q.current) changed = true;
        const justCompleted = !q.completed && next >= q.target;
        if (justCompleted) bonusXP += q.rewardXP;
        return { ...q, current: next, completed: next >= q.target };
    });
    if (bonusXP > 0 && user.progress[lang]) {
        const lp = user.progress[lang];
        lp.xp += bonusXP;
        const newLevel = 1 + Math.floor(lp.xp / 500);
        if (newLevel > lp.level) lp.level = newLevel;
        changed = true;
    }
    if (changed) saveUser(user);
    return user;
};

// 加载时校验 streak：连胜以「完成产出飞轮」为基准（lastStreakDate），断签则清零/消耗护盾
export const checkStreakOnLoad = (user: UserProfile): UserProfile => {
    const today = getTodayString();
    if (user.lastStreakDate === today) return user;        // 今天已完成飞轮并计入
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    if (user.lastStreakDate === yStr) return user;          // 昨天完成过，今天尚未完成，连胜仍有效
    if (user.currentStreak > 0) {
        if (user.streakShields > 0) {
            user.streakShields -= 1; // 消耗一张断签保护卡
        } else {
            user.currentStreak = 0;
        }
        saveUser(user);
    }
    return user;
};

// --- Spaced Repetition (SRS) for Vocabulary (Phase 1) ---
// Leitner box 1..5，熟词间隔更长；答错回到 box 1
const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
export { SRS_INTERVALS_DAYS };

export const reviewVocabulary = (item: VocabularyItem, known: boolean): VocabularyItem => {
    const box = item.box ?? 1;
    const nextBox = known ? Math.min(5, box + 1) : 1;
    const days = SRS_INTERVALS_DAYS[nextBox] ?? 35;
    const due = Date.now() + days * 24 * 3600 * 1000;
    return {
        ...item,
        box: nextBox,
        dueDate: due,
        reviews: (item.reviews ?? 0) + 1,
        lapses: known ? (item.lapses ?? 0) : (item.lapses ?? 0) + 1,
    };
};

export const getDueVocabulary = (): VocabularyItem[] => {
    const now = Date.now();
    return getVocabulary()
        .filter((i) => (i.dueDate ?? 0) <= now)
        .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
};

export const updateVocabularyItem = (item: VocabularyItem) => {
    const items = getVocabulary();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
        const updated = [...items];
        updated[idx] = item;
        localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(updated));
    }
};

// --- Activity Logs ---

export const getLogs = (): ActivityLog[] => {
  const data = localStorage.getItem(STORAGE_KEY_LOGS);
  return data ? JSON.parse(data) : [];
};

export const addActivity = (
    user: UserProfile, 
    type: ActivityLog['type'], 
    language: Language,
    xp: number, 
    summary: string, 
    details: any
): { user: UserProfile, log: ActivityLog } => {
  
  // 1. Update User Stats (Multi-language support)
  const today = getTodayString();
  const isNewDay = user.lastActiveDate !== today;
  
  let updatedUser = { ...user };

  // 每日任务跨天刷新
  rolloverDailyQuests(updatedUser);

  // Ensure progress object exists
  if (!updatedUser.progress[language]) {
      updatedUser = ensureLanguageProgress(updatedUser, language);
  }

  const langProgress = updatedUser.progress[language];

  // Update specific language progress
  langProgress.xp += xp;
  langProgress.lastActive = Date.now();
  if (details.wordCount) {
      langProgress.totalWordsTyped += details.wordCount;
  }

  // Level Up Logic (Simple: Level = 1 + XP/500)
  const newLevel = 1 + Math.floor(langProgress.xp / 500);
  if (newLevel > langProgress.level) {
      langProgress.level = newLevel;
  }

  // Check for Stage Unlock (Typing Mode)
  if (type === 'typing' && details.passed && details.stageId !== undefined) {
      if (details.stageId === langProgress.maxUnlockedStage) {
          langProgress.maxUnlockedStage += 1;
      }
  }

  updatedUser.progress[language] = langProgress;

  // 连胜逻辑已迁移到「完成产出飞轮」时由 commitDailyStreak 累加（见 DailyFlywheel）。
  // 此处仅记录今日活跃日期，连胜数值不再随任意活动自动 +1。
  if (isNewDay) {
      updatedUser.lastActiveDate = today;
  }

  // 按活动类型推进每日任务
  let questKind: QuestKind | null = null;
  let questAmount = 0;
  if (type === 'typing') { questKind = 'typing_words'; questAmount = details.wordCount ?? 0; }
  else if (type === 'writing' || type === 'tree_writing') { questKind = 'writing_words'; questAmount = details.wordCount ?? 0; }
  else if (type === 'rpg') { questKind = 'rpg_sessions'; questAmount = 1; }
  // 词汇：只有「复习」(details.review) 才推进每日复习任务；「添加单词」给 XP 但不算复习
  else if (type === 'vocabulary' && details?.review) { questKind = 'vocab_review'; questAmount = 1; }
  else if (type === 'script') { questKind = 'script_practice'; questAmount = details.count ?? 1; }
  if (questKind) progressQuests(updatedUser, questKind, questAmount);

  saveUser(updatedUser);

  // 2. Add Log
  const newLog: ActivityLog = {
    id: uuid(),
    timestamp: Date.now(),
    date: today,
    type,
    language,
    summary,
    details,
    xpEarned: xp
  };
  
  const logs = getLogs();
  const updatedLogs = [newLog, ...logs].slice(0, 100); // Keep last 100
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));

  return { user: updatedUser, log: newLog };
};

// --- Library (Memory Bank) ---

export const getLibrary = (): UserContent[] => {
    return readListRepair<UserContent>(STORAGE_KEY_LIBRARY, localStorage.getItem(STORAGE_KEY_LIBRARY));
};

export const saveLibraryItem = (item: UserContent) => {
    const items = getLibrary();
    const existingIdx = items.findIndex(i => i.id === item.id);
    let updatedItems;
    if (existingIdx >= 0) {
        updatedItems = [...items];
        updatedItems[existingIdx] = item;
    } else {
        updatedItems = [item, ...items];
    }
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(updatedItems));
};

export const deleteLibraryItem = (id: string) => {
    const items = getLibrary().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(items));
};

// --- Writing Tree ---

export const getWritingTree = (): WritingNode[] => {
    const data = localStorage.getItem(STORAGE_KEY_TREE);
    if (!data) return [];
    let nodes: WritingNode[];
    try {
        nodes = JSON.parse(data);
    } catch {
        return [];
    }
    if (!Array.isArray(nodes)) return [];
    // 树形：重发号时同步修正子节点的 parentId（见 utils/idRepair.ts）
    const { list, changed } = repairTreeIds(nodes);
    if (changed) {
        try {
            localStorage.setItem(STORAGE_KEY_TREE, JSON.stringify(list));
        } catch {
            /* ignore */
        }
    }
    return list;
};

export const saveWritingTree = (nodes: WritingNode[]) => {
    localStorage.setItem(STORAGE_KEY_TREE, JSON.stringify(nodes));
};

// 成长树：确保当前语言有一棵有效成长树。
// - 无树 / 旧格式 / 语言不符 → 生成新树（按等级解锁）。
// - 树已存在 → 以「默认树为基准」合并：新增的主题/任务自动补进来（如题库扩充后），
//   同时保留用户已写内容、完成状态，并按当前等级重新计算解锁（不收回已达成的进度）。
// 注意：growthTree（含 8 语言题库 treeThemes，984 行）与 customDirectionService（含 aiService，1955 行）
//   体积大，改为在此处按需动态 import，避免首屏登录/仪表盘就被迫转译整棵题库 + 全部 AI 逻辑。
export const ensureGrowthTree = async (lang: Language, level: CEFRLevel): Promise<WritingNode[]> => {
    const [{ createDefaultGrowthTree, CEFR_RANK }, { appendCustomDirections }] = await Promise.all([
        import('../data/growthTree'),
        import('./customDirectionService'),
    ]);
    const existing = getWritingTree();
    const isGrowthFormat = existing.some((n) => n.type === 'task');
    const rootLang = existing.find((n) => n.type === 'root')?.language;
    // 无有效树 或 语言不匹配（切换语言）→ 生成对应语言的新成长树（按等级解锁）
    if (existing.length === 0 || !isGrowthFormat || rootLang !== lang) {
        let tree = createDefaultGrowthTree(lang, level);
        // 自定义写作方向（用户私人枝干）：种子不在默认树里，每次重建后重挂（按语言隔离）
        tree = appendCustomDirections(tree, lang, level);
        saveWritingTree(tree);
        return tree;
    }
    // 树已存在且语言匹配 → 以默认树为基准合并，补齐新增节点并重新计算解锁
    const fresh = createDefaultGrowthTree(lang, level);
    const levelRank = CEFR_RANK[level] ?? 1;
    const existingById = new Map(existing.map((n) => [n.id, n]));
    const merged = fresh.map((n) => {
        const ex = existingById.get(n.id);
        if (!ex) return n; // 新增节点（如题库扩充新增的主题/任务/作文），直接采用默认解锁
        // root/theme 结构不变
        if (n.type !== 'task' && n.type !== 'composition') return n;
        const taskRank = n.cefrLevel ? (CEFR_RANK[n.cefrLevel] ?? 1) : 1;
        // 保留用户已写内容/完成状态；解锁 = 已达成的进度 ∪ 达到当前等级 ∪ 原本已解锁
        const unlocked = ex.completed || ex.unlocked || taskRank <= levelRank;
        return {
            ...n,
            content: ex.content ?? n.content,
            sections: ex.sections ?? n.sections,
            genre: ex.genre ?? n.genre,
            prompt: ex.prompt ?? n.prompt,
            completed: ex.completed ?? false,
            progress: ex.progress ?? 0,
            wordCount: ex.wordCount ?? 0,
            isExpanded: ex.isExpanded ?? n.isExpanded,
            unlocked,
        };
    });
    // 自定义写作方向：默认树里没有这些节点，合并后重挂（树里已有的保留用户进度，只补缺失）
    const withCustom = appendCustomDirections(merged, lang, level);
    saveWritingTree(withCustom);
    return withCustom;
};

// --- Vocabulary ---

export const getVocabulary = (): VocabularyItem[] => {
    return readListRepair<VocabularyItem>(STORAGE_KEY_VOCAB, localStorage.getItem(STORAGE_KEY_VOCAB));
};

export const saveVocabularyItem = (item: VocabularyItem) => {
    const items = getVocabulary();
    // Prevent duplicates by word
    if (items.some(i => i.word.toLowerCase() === item.word.toLowerCase() && i.language === item.language)) {
        return; 
    }
    // 新词进入 SRS：box 1、立即到期
    const withSrs: VocabularyItem = {
        ...item,
        box: item.box ?? 1,
        dueDate: item.dueDate ?? Date.now(),
        reviews: item.reviews ?? 0,
        lapses: item.lapses ?? 0,
    };
    const updated = [withSrs, ...items];
    localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(updated));
};

export const deleteVocabularyItem = (id: string) => {
    const items = getVocabulary().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(items));
};

/**
 * 一键导入 A1 起步词（词库为空时由用户主动触发，不自动写入）。
 * 按「词 + 语言」去重，返回实际新增条数；已存在的词不会被覆盖。
 */
export const importStarterVocab = (lang: Language, words: StarterWord[]): number => {
    const existing = getVocabulary();
    let added = 0;
    for (const w of words) {
        if (existing.some(i => i.language === lang && i.word.toLowerCase() === w.word.toLowerCase())) continue;
        saveVocabularyItem({
            id: uuid(),
            word: w.word,
            definition: w.pronunciation ? `${w.pronunciation} · ${w.definition}` : w.definition,
            exampleSentence: w.example,
            partOfSpeech: w.partOfSpeech,
            language: lang,
            createdAt: Date.now(),
        });
        added++;
    }
    return added;
};

export const getVocabularyCount = (lang: Language): number =>
    getVocabulary().filter(i => i.language === lang).length;

// --- Script / Alphabet Production Trainer SRS ---
// 复用 Leitner 间隔重复逻辑（与词汇一致）：答错回 box 1、答对冲高 box，间隔变长。
// 存储结构：Record<packId, Record<itemId, ScriptCardProgress>>
const getScriptStore = (): Record<string, Record<string, ScriptCardProgress>> => {
    const data = localStorage.getItem(STORAGE_KEY_SCRIPT);
    return data ? JSON.parse(data) : {};
};

const saveScriptStore = (store: Record<string, Record<string, ScriptCardProgress>>) => {
    localStorage.setItem(STORAGE_KEY_SCRIPT, JSON.stringify(store));
};

export const getScriptProgress = (packId: string): Record<string, ScriptCardProgress> => {
    const store = getScriptStore();
    return store[packId] ?? {};
};

export const reviewScriptCard = (packId: string, itemId: string, known: boolean): ScriptCardProgress => {
    const store = getScriptStore();
    const pack = store[packId] ?? {};
    const prev = pack[itemId] ?? { box: 1, dueDate: Date.now(), reviews: 0, lapses: 0 };
    const nextBox = known ? Math.min(5, prev.box + 1) : 1;
    const days = SRS_INTERVALS_DAYS[nextBox] ?? 35;
    const updated: ScriptCardProgress = {
        box: nextBox,
        dueDate: Date.now() + days * 24 * 3600 * 1000,
        reviews: prev.reviews + 1,
        lapses: known ? prev.lapses : prev.lapses + 1,
    };
    store[packId] = { ...pack, [itemId]: updated };
    saveScriptStore(store);
    return updated;
};

export const getDueScriptItems = (packId: string, items: ScriptItem[]): ScriptItem[] => {
    const progress = getScriptProgress(packId);
    const now = Date.now();
    return items.filter(it => (progress[it.id]?.dueDate ?? 0) <= now);
};

// --- Writing Error Book (SRS) ---
// 与词汇/字形特训共用 Leitner 间隔重复逻辑：答错回 box1，答对冲高 box，间隔变长。
export const getErrorBook = (): ErrorCard[] => {
    return readListRepair<ErrorCard>(STORAGE_KEY_ERRORBOOK, localStorage.getItem(STORAGE_KEY_ERRORBOOK));
};

// 把 AI 批改建议沉淀为错题卡。按 (original 小写 + language) 去重合并：
// 已存在 → 更新改正/理由、回到 box1、lapses+1（强化反复出错项）；不存在 → 新增（box1 立即到期）。
// 若卡片带 type（弱项类型），同步 bump 到「个人错误模式引擎」，使其在弱项看板与每日弱项任务中生效。
export const addErrorCards = (
    cards: Array<{ original: string; correction: string; reason: string; language: Language; context?: string; type?: ErrorPatternType; tags?: string[] }>
): void => {
    const existing = getErrorBook();
    const now = Date.now();
    let changed = false;
    const updated = [...existing];
    for (const c of cards) {
        const original = c.original?.trim();
        const correction = c.correction?.trim();
        if (!original || !correction) continue;
        const idx = updated.findIndex(
            (e) => e.original.toLowerCase() === original.toLowerCase() && e.language === c.language
        );
        if (idx >= 0) {
            updated[idx] = {
                ...updated[idx],
                correction,
                reason: c.reason,
                context: c.context ?? updated[idx].context,
                type: c.type ?? updated[idx].type,
                tags: c.tags ? Array.from(new Set([...(updated[idx].tags || []), ...c.tags])) : updated[idx].tags,
                box: 1,
                dueDate: now,
                lapses: (updated[idx].lapses ?? 0) + 1,
                createdAt: now,
            };
        } else {
            updated.unshift({
                id: uuid(),
                original,
                correction,
                reason: c.reason,
                language: c.language,
                context: c.context,
                type: c.type,
                tags: c.tags,
                createdAt: now,
                box: 1,
                dueDate: now,
                reviews: 0,
                lapses: 0,
            });
        }
        changed = true;
        if (c.type) {
            bumpErrorPattern(c.language, c.type, ERROR_PATTERN_LABELS[c.type], original, c.tags);
        }
    }
    if (changed) localStorage.setItem(STORAGE_KEY_ERRORBOOK, JSON.stringify(updated));
};

export const updateErrorCard = (item: ErrorCard) => {
    const items = getErrorBook();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
        const updated = [...items];
        updated[idx] = item;
        localStorage.setItem(STORAGE_KEY_ERRORBOOK, JSON.stringify(updated));
    }
};

export const deleteErrorCard = (id: string) => {
    const items = getErrorBook().filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY_ERRORBOOK, JSON.stringify(items));
};

export const reviewErrorCard = (item: ErrorCard, known: boolean): ErrorCard => {
    const box = item.box ?? 1;
    const nextBox = known ? Math.min(5, box + 1) : 1;
    const days = SRS_INTERVALS_DAYS[nextBox] ?? 35;
    const due = Date.now() + days * 24 * 3600 * 1000;
    return {
        ...item,
        box: nextBox,
        dueDate: due,
        reviews: (item.reviews ?? 0) + 1,
        lapses: known ? (item.lapses ?? 0) : (item.lapses ?? 0) + 1,
    };
};

export const getDueErrorCards = (): ErrorCard[] => {
    const now = Date.now();
    return getErrorBook()
        .filter((i) => (i.dueDate ?? 0) <= now)
        .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
};

// --- Writing Score History (趋势曲线数据源) ---
// 与错题本平行：按 language 隔离，存每次批改的结构化评分，供 WritingProgressView 聚合趋势。
export const addWritingScore = (record: WritingScoreRecord): void => {
    const records = getWritingHistory();
    const updated = [record, ...records].slice(0, 500); // 保留最近 500 条
    localStorage.setItem(STORAGE_KEY_WRITING_HISTORY, JSON.stringify(updated));
};

export const getWritingHistory = (): WritingScoreRecord[] => {
    const data = localStorage.getItem(STORAGE_KEY_WRITING_HISTORY);
    return data ? JSON.parse(data) : [];
};

// 按当前学习语言过滤（多语言隔离），并按时间正序返回（趋势曲线从左到右递增）
export const getWritingHistoryByLang = (lang: Language): WritingScoreRecord[] => {
    return getWritingHistory()
        .filter((r) => r.language === lang)
        .sort((a, b) => a.timestamp - b.timestamp);
};

// --- Song Lab（歌曲跟打）---
// 歌词包元数据存 localStorage（体积小）；音频 blob 体积大，单独存 IndexedDB，避免超限。

const STORAGE_KEY_SONG_PACKS = 'linguaflow_song_packs';

export const getSongPacks = (): SongPack[] => {
    return readListRepair<SongPack>(STORAGE_KEY_SONG_PACKS, localStorage.getItem(STORAGE_KEY_SONG_PACKS));
};

export const getSongPack = (id: string): SongPack | null => {
    return getSongPacks().find((p) => p.id === id) ?? null;
};

export const saveSongPack = (pack: SongPack): SongPack[] => {
    const all = getSongPacks();
    const next = [pack, ...all.filter((p) => p.id !== pack.id)].sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(STORAGE_KEY_SONG_PACKS, JSON.stringify(next));
    return next;
};

export const deleteSongPack = async (id: string): Promise<SongPack[]> => {
    const pack = getSongPack(id);
    if (pack?.audioId) {
        try { await deleteSongAudio(pack.audioId); } catch { /* 音频删除失败不影响元数据清理 */ }
    }
    if (pack?.hasClips) {
        try { await deleteSongClips(id); } catch { /* 片段清理失败不影响元数据 */ }
    }
    const next = getSongPacks().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_SONG_PACKS, JSON.stringify(next));
    return next;
};

// --- 音频 blob：IndexedDB 封装（独立于 localStorage 的 key 空间）---
const SONG_AUDIO_DB = 'linguaflow_song_audio';
const SONG_AUDIO_STORE = 'audio';

const openSongAudioDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(SONG_AUDIO_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SONG_AUDIO_STORE)) {
                db.createObjectStore(SONG_AUDIO_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

export const saveSongAudio = async (id: string, blob: Blob): Promise<void> => {
    const db = await openSongAudioDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(SONG_AUDIO_STORE, 'readwrite');
            tx.objectStore(SONG_AUDIO_STORE).put(blob, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
};

export const getSongAudio = async (id: string): Promise<Blob | null> => {
    const db = await openSongAudioDB();
    try {
        return await new Promise<Blob | null>((resolve, reject) => {
            const tx = db.transaction(SONG_AUDIO_STORE, 'readonly');
            const req = tx.objectStore(SONG_AUDIO_STORE).get(id);
            req.onsuccess = () => resolve((req.result as Blob) ?? null);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
};

export const deleteSongAudio = async (id: string): Promise<void> => {
    const db = await openSongAudioDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(SONG_AUDIO_STORE, 'readwrite');
            tx.objectStore(SONG_AUDIO_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
};

// --- 每句音频片段：IndexedDB（key 形如 clip:${packId}:${idx}）---
const SONG_CLIP_PREFIX = 'clip:';

export const saveSongClips = async (
    packId: string,
    clips: { idx: number; blob: Blob }[],
): Promise<void> => {
    const db = await openSongAudioDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(SONG_AUDIO_STORE, 'readwrite');
            const store = tx.objectStore(SONG_AUDIO_STORE);
            for (const c of clips) store.put(c.blob, `${SONG_CLIP_PREFIX}${packId}:${c.idx}`);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
};

export const getSongClip = async (packId: string, idx: number): Promise<Blob | null> => {
    const db = await openSongAudioDB();
    try {
        return await new Promise<Blob | null>((resolve, reject) => {
            const tx = db.transaction(SONG_AUDIO_STORE, 'readonly');
            const req = tx.objectStore(SONG_AUDIO_STORE).get(`${SONG_CLIP_PREFIX}${packId}:${idx}`);
            req.onsuccess = () => resolve((req.result as Blob) ?? null);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
};

export const deleteSongClips = async (packId: string): Promise<void> => {
    const db = await openSongAudioDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(SONG_AUDIO_STORE, 'readwrite');
            const store = tx.objectStore(SONG_AUDIO_STORE);
            const req = store.openCursor();
            req.onsuccess = () => {
                const cur = req.result;
                if (cur) {
                    if (String(cur.key).startsWith(`${SONG_CLIP_PREFIX}${packId}:`)) cur.delete();
                    cur.continue();
                } else resolve();
            };
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
};

// ==================== 书架（Book）====================

// 分页：按段落（\n\n）累积，达到 targetChars 左右切成一页，不切断段落。
// 单段超长（超过 1.5 倍目标）则切成多页，但**切点会回退到句末 / 空白边界**，
// 绝不把单词劈成两半（旧实现裸切 1500 字符，Animal Farm 第一页曾以 "s began to arrive" 开头）。
//
// targetChars 取值的依据（2026-10-26 实测，Playwright + 真实 Literata 字体）：
// 正文样式 font-literata / lg:text-2xl(24px) / leading-loose(行高 48px) / tracking 0.075em，
// 内容宽 804px（max-w-4xl 896 - p-10 80 - pr-3 12）→ 每行约 50 字符；
// 阅读窗 max-h-[60vh] 在常见视口下是 9–11 行：
//   1440×790 → 60vh 474px / 9 行 / 494 字符
//   1440×860 → 60vh 516px / 10 行 / 552 字符
//   1512×955 → 60vh 573px / 11 行 / 608 字符
// 取 550 = 「一页≈一屏」，笔记本上不用滚就能看到整页；更小的窗口最多溢出 1–2 行。
export const paginateText = (rawText: string, targetChars = 550): string[] => {
    const text = rawText.trim();
    if (!text) return [];
    const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (paragraphs.length === 0) return [text];

    const pages: string[] = [];
    let current = '';
    const hardCut = Math.max(targetChars, 400);

    // 在 limit 之前找一个「体面的」切点：优先句末，其次空白，最后才硬切
    const findCutIndex = (s: string, limit: number): number => {
        if (s.length <= limit) return s.length;
        const min = Math.max(1, Math.floor(limit * 0.7));
        // 1) 句末：. ! ? … 后允许跟引号 / 括号，再跟空白（或已到结尾）
        for (let i = limit; i >= min; i--) {
            if (/[.!?…]/.test(s[i])) {
                let j = i + 1;
                while (j < s.length && /["'”’)\]]/.test(s[j])) j++;
                if (j >= s.length || /\s/.test(s[j])) return j;
            }
        }
        // 2) 回退到最近空白，保证不劈开单词
        for (let i = limit; i >= min; i--) {
            if (/\s/.test(s[i])) return i + 1;
        }
        return limit;
    };

    const flush = () => {
        if (current.trim()) pages.push(current.trim());
        current = '';
    };

    for (const para of paragraphs) {
        // 单段超长：按「句末 / 空白」切点切成多页
        if (para.length > targetChars * 1.5) {
            flush();
            let rest = para;
            while (rest.length > hardCut) {
                const cut = findCutIndex(rest, hardCut);
                const piece = rest.slice(0, cut).trim();
                if (piece) pages.push(piece);
                rest = rest.slice(cut).replace(/^\s+/, '');
            }
            current = rest;
            continue;
        }
        if (current && (current.length + para.length) > targetChars) {
            flush();
            current = para;
        } else {
            current = current ? current + '\n\n' + para : para;
        }
    }
    flush();
    return pages.length > 0 ? pages : [text];
};

/** 分页算法版本：2 = 句子边界 + 一屏一页。旧书靠它做一次性原地修复，见 repairBookPagination。 */
export const BOOK_PAGINATION_VERSION = 2;

// 旧版把正文按固定字符数裸切，会在单词中间断开（页首出现 "s began to arrive"）。
// 旧书已经以碎片页存进库，原始正文没有保留 —— 这里按页边界特征把碎片拼回原文，再重新分页，
// 等价于「删掉重新导入」，但保留阅读进度。只在 paginationVersion < 2 时跑一次，
// 之后靠版本号挡住，避免反复拼接导致文本漂移。
const isHardCutBoundary = (prev: string, next: string): boolean => {
    const end = prev.trimEnd().slice(-1);
    const start = next.replace(/^\s+/, '').charAt(0);
    if (!end || !start) return false;
    // 上一页没收在句末/分隔符，下一页却从半句腰上（小写字母、逗号、数字）开始 → 判定为裸切
    return !/[.!?…"'”’)\]—:;]/.test(end) && /[a-z,0-9]/.test(start);
};

export const repairBookPagination = (book: Book): Book | null => {
    if ((book.paginationVersion ?? 1) >= BOOK_PAGINATION_VERSION) return null;
    const pages = book.pages ?? [];
    if (pages.length === 0) return null;
    if (pages.length === 1) return { ...book, paginationVersion: BOOK_PAGINATION_VERSION };

    let hardCuts = 0;
    for (let i = 1; i < pages.length; i++) if (isHardCutBoundary(pages[i - 1], pages[i])) hardCuts++;
    const boundaries = pages.length - 1;
    // 过半断点是裸切 → 当初整段长文被逐段切碎，原样拼回（不 trim，保持字节一致）；
    // 否则按段落拼（旧的分段式分页本来就在段落边界切，\n\n 是原样还原）。
    const glueAll = hardCuts / boundaries >= 0.5;

    let rebuilt = pages[0];
    for (let i = 1; i < pages.length; i++) {
        rebuilt += (glueAll || isHardCutBoundary(pages[i - 1], pages[i]) ? '' : '\n\n') + pages[i];
    }

    const nextPages = paginateText(rebuilt);
    if (nextPages.length === 0) return null;
    const same = nextPages.length === pages.length && nextPages.every((p, i) => p === pages[i]);
    // 读完了的书保持「已读完」（currentPage === pages.length 是完成标记），否则夹到最后一页
    const wasDone = (book.currentPage ?? 0) >= pages.length;
    return {
        ...book,
        pages: nextPages,
        currentPage: same
            ? book.currentPage ?? 0
            : wasDone
            ? nextPages.length
            : Math.min(Math.max(book.currentPage ?? 0, 0), nextPages.length - 1),
        paginationVersion: BOOK_PAGINATION_VERSION,
    };
};

// 书架存储升级为 IndexedDB：容量远大于 localStorage（~5MB），可容纳大量长文本书籍。
// 原 localStorage 的旧数据在首次读取时自动迁移到 IndexedDB，迁移后清除旧 key。
const BOOKS_DB = 'linguaflow_books_db';
const BOOKS_STORE = 'books';

const openBooksDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(BOOKS_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(BOOKS_STORE)) {
                const store = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
                store.createIndex('language', 'language', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

// 迁移 localStorage 旧 books → IndexedDB（只跑一次，迁移后清除旧 key）
const migrateBooksFromLocalStorage = async (db: IDBDatabase): Promise<void> => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_BOOKS);
        if (!raw) return;
        const old: Book[] = JSON.parse(raw);
        if (!Array.isArray(old) || old.length === 0) { localStorage.removeItem(STORAGE_KEY_BOOKS); return; }
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(BOOKS_STORE, 'readwrite');
            const store = tx.objectStore(BOOKS_STORE);
            for (const b of old) store.put(b);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        localStorage.removeItem(STORAGE_KEY_BOOKS);
    } catch {
        /* 迁移失败不阻塞 */
    }
};

const sortBooks = (all: Book[], lang?: Language): Book[] => {
    const filtered = lang ? all.filter((b) => b.language === lang) : all;
    return filtered.sort((a, b) => (b.lastReadAt ?? b.createdAt) - (a.lastReadAt ?? a.createdAt));
};

export const getBooks = async (lang?: Language): Promise<Book[]> => {
    const db = await openBooksDB();
    try {
        await migrateBooksFromLocalStorage(db);
        let all = await new Promise<Book[]>((resolve, reject) => {
            const tx = db.transaction(BOOKS_STORE, 'readonly');
            const req = tx.objectStore(BOOKS_STORE).getAll();
            req.onsuccess = () => resolve((req.result as Book[]) ?? []);
            req.onerror = () => reject(req.error);
        });
        // 历史脏 id（早期 uuid 在 http://IP 下会重复）→ 重发号并回写，
        // 否则「按 id 打开/删除某本书」会命中另一本。
        const { list: fixed, changed } = repairIds(all);
        if (changed) {
            const oldIds = new Set(all.map((b) => b.id));
            const newIds = new Set(fixed.map((b) => b.id));
            await new Promise<void>((resolve) => {
                const tx = db.transaction(BOOKS_STORE, 'readwrite');
                const store = tx.objectStore(BOOKS_STORE);
                for (const b of fixed) store.put(b);
                for (const oldId of oldIds) {
                    if (!newIds.has(oldId)) store.delete(oldId);
                }
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
            all = fixed;
        }
        return sortBooks(all, lang);
    } catch {
        return [];
    } finally {
        db.close();
    }
};

export const saveBook = async (book: Book): Promise<Book[]> => {
    const db = await openBooksDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(BOOKS_STORE, 'readwrite');
            tx.objectStore(BOOKS_STORE).put(book);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return await getBooks(book.language);
    } catch {
        return getBooks(book.language);
    } finally {
        db.close();
    }
};

export const deleteBook = async (id: string, lang?: Language): Promise<Book[]> => {
    const db = await openBooksDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(BOOKS_STORE, 'readwrite');
            tx.objectStore(BOOKS_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return await getBooks(lang);
    } catch {
        return [];
    } finally {
        db.close();
    }
};

// 更新阅读进度
export const updateBookProgress = async (id: string, currentPage: number): Promise<Book[]> => {
    const db = await openBooksDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(BOOKS_STORE, 'readwrite');
            const store = tx.objectStore(BOOKS_STORE);
            const req = store.get(id);
            req.onsuccess = () => {
                const book = req.result as Book | undefined;
                if (book) {
                    book.currentPage = currentPage;
                    book.lastReadAt = Date.now();
                    store.put(book);
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return await getBooks();
    } catch {
        return getBooks();
    } finally {
        db.close();
    }
};

// 更新某本书挂载的 B 站视频（阅读工作台左侧播放器）。
// 走「读-改-写」事务而不是 saveBook(整本)，避免把手里的旧 book 对象整体覆盖回去
// （reader 里的 currentPage 由 updateBookProgress 单独维护，覆盖会丢进度）。
export const updateBookVideos = async (id: string, videos: BookVideo[]): Promise<void> => {
    const db = await openBooksDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(BOOKS_STORE, 'readwrite');
            const store = tx.objectStore(BOOKS_STORE);
            const req = store.get(id);
            req.onsuccess = () => {
                const book = req.result as Book | undefined;
                if (book) {
                    book.videos = videos;
                    store.put(book);
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* 静默：视频是增强项，失败不阻塞阅读 */
    } finally {
        db.close();
    }
};

// ==================== 学习书库（Study Library） ====================
// 结构化学习型书籍（词汇/语法/短语书），存 IndexedDB（复制 openBooksDB 模式），
// 与阅读型 Book（pages 连续文本）区分。StudyBook → StudyChapter → StudyItem 三层。

const STUDY_BOOKS_DB = 'linguaflow_study_books_db';
const STUDY_BOOKS_STORE = 'study_books';

const openStudyBooksDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(STUDY_BOOKS_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STUDY_BOOKS_STORE)) {
                const store = db.createObjectStore(STUDY_BOOKS_STORE, { keyPath: 'id' });
                store.createIndex('language', 'language', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

const sortStudyBooks = (all: StudyBook[], lang?: Language): StudyBook[] => {
    const filtered = lang ? all.filter((b) => b.language === lang) : all;
    return filtered.sort((a, b) => (b.lastStudiedAt ?? b.createdAt) - (a.lastStudiedAt ?? a.createdAt));
};

export const getStudyBooks = async (lang?: Language): Promise<StudyBook[]> => {
    const db = await openStudyBooksDB();
    try {
        const all = await new Promise<StudyBook[]>((resolve, reject) => {
            const tx = db.transaction(STUDY_BOOKS_STORE, 'readonly');
            const req = tx.objectStore(STUDY_BOOKS_STORE).getAll();
            req.onsuccess = () => resolve((req.result as StudyBook[]) ?? []);
            req.onerror = () => reject(req.error);
        });
        return sortStudyBooks(all, lang);
    } catch {
        return [];
    } finally {
        db.close();
    }
};

export const saveStudyBook = async (book: StudyBook): Promise<StudyBook[]> => {
    const db = await openStudyBooksDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STUDY_BOOKS_STORE, 'readwrite');
            tx.objectStore(STUDY_BOOKS_STORE).put(book);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return await getStudyBooks(book.language);
    } catch {
        return getStudyBooks(book.language);
    } finally {
        db.close();
    }
};

export const deleteStudyBook = async (id: string, lang?: Language): Promise<StudyBook[]> => {
    const db = await openStudyBooksDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STUDY_BOOKS_STORE, 'readwrite');
            tx.objectStore(STUDY_BOOKS_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return await getStudyBooks(lang);
    } catch {
        return [];
    } finally {
        db.close();
    }
};

// 重算 denormalized 统计（totalItems / completedItems / masteredItems）
export const recomputeStudyBookStats = (book: StudyBook): StudyBook => {
    let total = 0, completed = 0, mastered = 0;
    for (const chapter of book.chapters) {
        for (const item of chapter.items) {
            total++;
            if ((item.box ?? 1) >= 2) completed++;
            if ((item.box ?? 1) >= 4) mastered++;
        }
    }
    return { ...book, totalItems: total, completedItems: completed, masteredItems: mastered };
};

// --- StudyItem SRS（3 档，独立于 VocabularyItem 的 2 档）---
// good → box++（cap 5）；ok → box 不动；poor → box = 1。
// 复用 SRS_INTERVALS_DAYS 调度（与 vocab 同源）。
export const reviewStudyItem = (item: StudyItem, quality: StudyItemQuality): StudyItem => {
    const box = item.box ?? 1;
    const nextBox = quality === 'good' ? Math.min(5, box + 1)
                  : quality === 'poor' ? 1
                  : box;
    const days = SRS_INTERVALS_DAYS[nextBox] ?? 35;
    return {
        ...item,
        box: nextBox as 1 | 2 | 3 | 4 | 5,
        dueDate: Date.now() + days * 24 * 3600 * 1000,
        reviews: (item.reviews ?? 0) + 1,
        lapses: quality === 'poor' ? (item.lapses ?? 0) + 1 : (item.lapses ?? 0),
        quality,
    };
};

// 到期 items（可选 bookId 过滤），返回带 bookId/chapterId 便于 UI 定位。
export const getDueStudyItems = async (bookId?: string): Promise<Array<{ item: StudyItem; bookId: string; chapterId: string }>> => {
    const books = await getStudyBooks();
    const now = Date.now();
    const due: Array<{ item: StudyItem; bookId: string; chapterId: string }> = [];
    for (const book of books) {
        if (bookId && book.id !== bookId) continue;
        for (const chapter of book.chapters) {
            for (const item of chapter.items) {
                if ((item.dueDate ?? 0) <= now) {
                    due.push({ item, bookId: book.id, chapterId: chapter.id });
                }
            }
        }
    }
    due.sort((a, b) => (a.item.dueDate ?? 0) - (b.item.dueDate ?? 0));
    return due;
};

// 提升 StudyItem 到全局词汇库（VocabularyItem）。仅 word / phrase 可提升。
// 纯转换：不写库；调用方负责 dedup 判断 + saveVocabularyItem。
export const promoteStudyItemToVocabulary = (item: StudyItem, language: Language): VocabularyItem => {
    if (item.type !== 'word' && item.type !== 'phrase') {
        throw new Error('只有词或短语可加入词汇库');
    }
    return {
        id: uuid(),
        word: item.prompt,
        definition: item.answer,
        exampleSentence: item.examples[0] ?? '',
        partOfSpeech: item.partOfSpeech ?? '',
        language,
        createdAt: Date.now(),
        box: item.box,
        dueDate: item.dueDate,
        reviews: item.reviews,
        lapses: item.lapses,
    };
};

// 内置书清单（动态 import 各自数据，懒加载避免首屏变大）。
// { id, targetLanguage, totalItems, build } 四元组：
// - targetLanguage = 内容语言（书用哪种语言写），seed 时只给 matching learningLanguage 的书；
// - totalItems 用作内容版本信号（条目数变化 = 内容更新）。
const BUILTIN_STUDY_BOOKS: Array<{
    id: string;
    targetLanguage: Language;
    totalItems: () => Promise<number>;
    build: (lang: Language) => Promise<StudyBook>;
}> = [
    {
        id: 'builtin-keywords-for-fluency',
        targetLanguage: Language.English,
        totalItems: async () => (await import('../data/studyBooks/keyWordsForFluency')).KEYWORDS_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/keyWordsForFluency')).buildKeyWordsForFluencyBook(lang),
    },
    {
        id: 'builtin-english-grammar-in-use',
        targetLanguage: Language.English,
        totalItems: async () => (await import('../data/studyBooks/englishGrammarInUse')).GRAMMAR_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/englishGrammarInUse')).buildEnglishGrammarInUseBook(lang),
    },
    {
        id: 'builtin-english-phrasal-verbs',
        targetLanguage: Language.English,
        totalItems: async () => (await import('../data/studyBooks/englishPhrasalVerbs')).PHRASAL_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/englishPhrasalVerbs')).buildEnglishPhrasalVerbsBook(lang),
    },
    {
        id: 'builtin-jlpt-n5n4-vocabulary',
        targetLanguage: Language.Japanese,
        totalItems: async () => (await import('../data/studyBooks/jlptVocabulary')).JLPT_VOCAB_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/jlptVocabulary')).buildJlptVocabularyBook(lang),
    },
    {
        id: 'builtin-jlpt-n5n4-grammar',
        targetLanguage: Language.Japanese,
        totalItems: async () => (await import('../data/studyBooks/jlptGrammar')).JLPT_GRAMMAR_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/jlptGrammar')).buildJlptGrammarBook(lang),
    },
    {
        id: 'builtin-topik-basic-vocabulary',
        targetLanguage: Language.Korean,
        totalItems: async () => (await import('../data/studyBooks/topikVocabulary')).TOPIK_VOCAB_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/topikVocabulary')).buildTopikVocabularyBook(lang),
    },
    {
        id: 'builtin-topik-basic-grammar',
        targetLanguage: Language.Korean,
        totalItems: async () => (await import('../data/studyBooks/topikGrammar')).TOPIK_GRAMMAR_TOTAL_ITEMS,
        build: async (lang) => (await import('../data/studyBooks/topikGrammar')).buildTopikGrammarBook(lang),
    },
];

// 修复历史脏 id：早期 uuid() 的非 HTTPS 降级分支写错（HEX 只有 16 个字符却用整字节索引），
// 在 http://<IP> 下会生成 "undefinedundefined-…" 这种 140 字符的假 id，且碰撞率极高
// （实测 5000 次只有 1268 个唯一值）。id 重复会让练习进度按 id 匹配时互相覆盖。
// 这里给整本书（章节 + 条目，跨章一起去重）重新发号，box / reviews / dueDate 等进度原样保留。
const repairBookIds = (book: StudyBook): StudyBook | null => {
    const sizes: number[] = [];
    const flat: StudyItem[] = [];
    for (const c of book.chapters) {
        sizes.push(c.items.length);
        flat.push(...c.items);
    }
    const items = repairIds(flat);
    const chapters = repairIds(book.chapters.map((c) => ({ id: c.id })));
    if (!items.changed && !chapters.changed) return null;

    let cursor = 0;
    const nextChapters = book.chapters.map((c, i) => {
        const n = sizes[i];
        const nextItems = items.list.slice(cursor, cursor + n);
        cursor += n;
        return { ...c, id: chapters.list[i].id, items: nextItems };
    });
    return { ...book, chapters: nextChapters };
};

// 首次加载自动 seed 内置学习书。动态 import 内置书数据（懒加载，避免首屏变大）；
// 无 AI key / 网络均不依赖，纯本地。seed 失败不阻塞（用户仍可手动导入）。
// 内置书内容更新时（条目数变化）自动删除旧版重建，避免旧数据卡在 IndexedDB 不更新。
// 按内容语言分组：只 seed 与 learningLanguage 匹配的书（学日语只见日语书）。
export const ensureBuiltInStudyBooks = async (language: Language): Promise<void> => {
    try {
        const existing = await getStudyBooks();
        // 先修脏 id（历史遗留），再判断内容是否需要重建
        for (let i = 0; i < existing.length; i++) {
            const fixed = repairBookIds(existing[i]);
            if (fixed) {
                await saveStudyBook(fixed);
                existing[i] = fixed;
            }
        }
        for (const def of BUILTIN_STUDY_BOOKS) {
            if (def.targetLanguage !== language) continue;
            try {
                const total = await def.totalItems();
                const builtIn = existing.find((b) => b.id === def.id);
                if (builtIn && builtIn.totalItems === total) continue;
                if (builtIn) await deleteStudyBook(builtIn.id);
                await saveStudyBook(await def.build(language));
            } catch {
                /* 单本 seed 失败不阻塞其它 */
            }
        }
    } catch {
        /* seed 失败不阻塞 */
    }
};

// ==================== 账户级一键备份 / 恢复 ====================
// 覆盖：localStorage 全量键（ALL_STORAGE_KEYS）+ 书架（IndexedDB 书籍正文）。
// 范围外：歌曲音频 / 片段二进制（体积大、可由用户重新导入源文件），v1 不纳入。
// 恢复语义为「整包覆盖」：用备份替换当前全部数据（导入前 UI 会二次确认）。

export interface LinguaFlowBackup {
    app: 'linguaflow';
    version: 1;
    exportedAt: string;
    localStorage: Record<string, string | null>;
    books: Book[];
    studyBooks: StudyBook[];
}

export const exportAllData = async (): Promise<LinguaFlowBackup> => {
    const localStorageData: Record<string, string | null> = {};
    for (const k of ALL_STORAGE_KEYS) {
        localStorageData[k] = localStorage.getItem(k);
    }
    let books: Book[] = [];
    try {
        books = await getBooks();
    } catch {
        books = [];
    }
    let studyBooks: StudyBook[] = [];
    try {
        studyBooks = await getStudyBooks();
    } catch {
        studyBooks = [];
    }
    return {
        app: 'linguaflow',
        version: 1,
        exportedAt: new Date().toISOString(),
        localStorage: localStorageData,
        books,
        studyBooks,
    };
};

export const importAllData = async (raw: unknown): Promise<void> => {
    if (!raw || typeof raw !== 'object') throw new Error('备份文件格式不正确');
    const data = raw as Partial<LinguaFlowBackup>;
    if (data.app !== 'linguaflow') throw new Error('不是 LinguaFlow 备份文件');
    if (!data.localStorage || typeof data.localStorage !== 'object') throw new Error('备份内容缺失');

    // 1) 恢复 localStorage 全量键（单键失败不中断其余）
    for (const k of ALL_STORAGE_KEYS) {
        const v = data.localStorage[k];
        if (v == null) continue;
        try {
            localStorage.setItem(k, v);
        } catch {
            /* 单键写入失败不影响其余键 */
        }
    }

    // 2) 恢复书籍（IndexedDB）
    if (Array.isArray(data.books)) {
        for (const b of data.books) {
            try {
                await saveBook(b);
            } catch {
                /* 单本失败不影响其余 */
            }
        }
    }

    // 3) 恢复学习书库（IndexedDB）
    if (Array.isArray(data.studyBooks)) {
        for (const b of data.studyBooks) {
            try {
                await saveStudyBook(b);
            } catch {
                /* 单本失败不影响其余 */
            }
        }
    }
};
