
import { UserProfile, ActivityLog, Language, CEFRLevel, UserContent, LanguageProgress, WritingNode, VocabularyItem, DailyQuest, QuestKind, MentorPersona, AIMemory, ScriptItem, ScriptCardProgress, ErrorCard, WritingScoreRecord, TypingContent, ErrorPattern, ErrorPatternType, FlywheelStep, DailyFlywheel, SongPack } from '../types';
import { createDefaultGrowthTree, CEFR_RANK } from '../data/growthTree';
import { getScriptPackForLanguage } from '../data/scriptPacks';

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

// 所有持久化 key 的权威集合（本地备份/恢复用）。集中维护，避免新增模块后备份遗漏、静默丢数据。
// 用字面量以避免引用下方靠后声明的 const 触发 TDZ。
export const ALL_STORAGE_KEYS: string[] = [
  'linguaflow_user', 'linguaflow_logs', 'linguaflow_library', 'linguaflow_writing_tree',
  'linguaflow_vocabulary', 'linguaflow_ai_config', 'linguaflow_script_progress', 'linguaflow_errorbook',
  'linguaflow_writing_history', 'linguaflow_inkquest', 'linguaflow_inkquest_story',
  'linguaflow_inkquest_listening', 'linguaflow_typing_library', 'linguaflow_error_patterns',
  'linguaflow_daily_flywheel', 'linguaflow_custom_script', 'linguaflow_custom_writing',
  'linguaflow_rpg_session', 'linguaflow_rpg_custom', 'linguaflow_song_packs',
];

// --- Runtime AI model configuration (switcher in Settings -> 模型设置) ---
// Keys are stored ONLY in localStorage (browser), never committed to source.
export type AIProviderId = 'qwen' | 'openrouter' | 'glm' | 'custom';

export interface AIConfig {
  active: AIProviderId;
  glm: { baseUrl: string; model: string; apiKey: string };
  custom: { baseUrl: string; model: string; apiKey: string };
  /** Qwen TTS 音色 id（qwen3-tts-flash 的 voice 参数），见 aiService.TTS_VOICES */
  ttsVoice: string;
}

export const defaultAIConfig = (): AIConfig => ({
  active: 'glm', // 默认推荐智谱 GLM 免费模型（见 README「模型切换」）
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'GLM-4.7-Flash', apiKey: '' },
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
      glm: { ...d.glm, ...(p.glm || {}) },
      custom: { ...d.custom, ...(p.custom || {}) },
      ttsVoice: p.ttsVoice || d.ttsVoice,
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

export const getDailyFlywheel = (): DailyFlywheel | null => {
  const data = localStorage.getItem(STORAGE_KEY_FLYWHEEL);
  return data ? JSON.parse(data) : null;
};

export const ensureDailyFlywheel = (): DailyFlywheel => {
  const today = getTodayString();
  const existing = getDailyFlywheel();
  if (existing && existing.date === today) return existing;
  const th = pickFlywheelTheme(today);
  const fw: DailyFlywheel = {
    date: today,
    themeId: th.id,
    theme: th.theme,
    themePrompt: th.prompt,
    steps: { writing: false, dictation: false, script: false },
    allDone: false,
  };
  localStorage.setItem(STORAGE_KEY_FLYWHEEL, JSON.stringify(fw));
  return fw;
};

const buildFlywheelReflection = (lang: Language): string => {
  const top = getTopErrorPatterns(lang, 1)[0];
  if (top) return `今日产出线完成 🎉 写作/听写/字形三路打通。你近期常卡在「${top.label}」，明天可以专门多练练。`;
  return '今日产出线完成 🎉 写作/听写/字形三路打通，保持这个节奏！';
};

export const markFlywheelStep = (step: FlywheelStep, lang?: Language): DailyFlywheel => {
  const fw = ensureDailyFlywheel();
  fw.steps[step] = true;
  // 无字形包的语言（EN/ES/FR/DE/IT/ZH 等）不应被 script 步卡住：该步视为已满足，仅需写作 + 听写即可完成飞轮
  const needsScript = lang ? !!getScriptPackForLanguage(lang) : true;
  const allDone = fw.steps.writing && fw.steps.dictation && (!needsScript || fw.steps.script);
  fw.allDone = allDone;
  if (allDone) fw.reflection = lang ? buildFlywheelReflection(lang) : '今日产出线完成 🎉';
  localStorage.setItem(STORAGE_KEY_FLYWHEEL, JSON.stringify(fw));
  return fw;
};

// 连胜仅在「完成产出飞轮」时累加（取代原 addActivity 内任何活动即 +1 的逻辑）。
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
    const all: InkQuestListeningItem[] = raw ? JSON.parse(raw) : [];
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
    const all: TypingLibraryItem[] = raw ? JSON.parse(raw) : [];
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
    const all: CustomScriptItem[] = raw ? JSON.parse(raw) : [];
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
    const all: CustomWritingPrompt[] = raw ? JSON.parse(raw) : [];
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
    const all: InkQuestCard[] = raw ? JSON.parse(raw) : [];
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
        id: crypto.randomUUID(),
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
    // 确保今日产出飞轮存在（跨天刷新时重置为新主题）
    ensureDailyFlywheel();
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
  else if (type === 'vocabulary') { questKind = 'vocab_review'; questAmount = 1; }
  else if (type === 'script') { questKind = 'script_practice'; questAmount = details.count ?? 1; }
  if (questKind) progressQuests(updatedUser, questKind, questAmount);

  saveUser(updatedUser);

  // 2. Add Log
  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
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
    const data = localStorage.getItem(STORAGE_KEY_LIBRARY);
    return data ? JSON.parse(data) : [];
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
    return data ? JSON.parse(data) : [];
};

export const saveWritingTree = (nodes: WritingNode[]) => {
    localStorage.setItem(STORAGE_KEY_TREE, JSON.stringify(nodes));
};

// 成长树：确保当前语言有一棵有效成长树。
// - 无树 / 旧格式 / 语言不符 → 生成新树（按等级解锁）。
// - 树已存在 → 以「默认树为基准」合并：新增的主题/任务自动补进来（如题库扩充后），
//   同时保留用户已写内容、完成状态，并按当前等级重新计算解锁（不收回已达成的进度）。
export const ensureGrowthTree = (lang: Language, level: CEFRLevel): WritingNode[] => {
    const existing = getWritingTree();
    const isGrowthFormat = existing.some((n) => n.type === 'task');
    const rootLang = existing.find((n) => n.type === 'root')?.language;
    // 无有效树 或 语言不匹配（切换语言）→ 生成对应语言的新成长树（按等级解锁）
    if (existing.length === 0 || !isGrowthFormat || rootLang !== lang) {
        const tree = createDefaultGrowthTree(lang, level);
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
    saveWritingTree(merged);
    return merged;
};

// --- Vocabulary ---

export const getVocabulary = (): VocabularyItem[] => {
    const data = localStorage.getItem(STORAGE_KEY_VOCAB);
    return data ? JSON.parse(data) : [];
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
    const data = localStorage.getItem(STORAGE_KEY_ERRORBOOK);
    return data ? JSON.parse(data) : [];
};

// 把 AI 批改建议沉淀为错题卡。按 (original 小写 + language) 去重合并：
// 已存在 → 更新改正/理由、回到 box1、lapses+1（强化反复出错项）；不存在 → 新增（box1 立即到期）
export const addErrorCards = (
    cards: Array<{ original: string; correction: string; reason: string; language: Language; context?: string }>
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
                box: 1,
                dueDate: now,
                lapses: (updated[idx].lapses ?? 0) + 1,
                createdAt: now,
            };
        } else {
            updated.unshift({
                id: crypto.randomUUID(),
                original,
                correction,
                reason: c.reason,
                language: c.language,
                context: c.context,
                createdAt: now,
                box: 1,
                dueDate: now,
                reviews: 0,
                lapses: 0,
            });
        }
        changed = true;
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
    try {
        const raw = localStorage.getItem(STORAGE_KEY_SONG_PACKS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
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
