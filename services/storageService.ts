
import { UserProfile, ActivityLog, Language, CEFRLevel, UserContent, LanguageProgress, WritingNode, VocabularyItem, DailyQuest, QuestKind, MentorPersona, AIMemory, ScriptItem, ScriptCardProgress, ErrorCard, WritingScoreRecord } from '../types';
import { createDefaultGrowthTree, CEFR_RANK } from '../data/growthTree';

const STORAGE_KEY_USER = 'linguaflow_user';
const STORAGE_KEY_LOGS = 'linguaflow_logs';
const STORAGE_KEY_LIBRARY = 'linguaflow_library';
const STORAGE_KEY_TREE = 'linguaflow_writing_tree';
const STORAGE_KEY_VOCAB = 'linguaflow_vocabulary';
const STORAGE_KEY_AI = 'linguaflow_ai_config';
const STORAGE_KEY_SCRIPT = 'linguaflow_script_progress';
const STORAGE_KEY_ERRORBOOK = 'linguaflow_errorbook';
const STORAGE_KEY_WRITING_HISTORY = 'linguaflow_writing_history';

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

export const generateDailyQuests = (lang: Language): DailyQuest[] => {
    // 固定两项：打字 + 词汇复习；第三项在「口语 / 写作 / 字形特训」间按日期轮换，保证每日多样性
    const dayMod = parseInt(getTodayString().slice(-1), 10) % 3;
    const third = [QUEST_TEMPLATES[2], QUEST_TEMPLATES[3], QUEST_TEMPLATES[4]][dayMod];
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

// 加载时校验 streak：若已超过一天未活跃且无机动（保护卡），真实归零
export const checkStreakOnLoad = (user: UserProfile): UserProfile => {
    const today = getTodayString();
    if (user.lastActiveDate === today) return user;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    if (user.lastActiveDate === yStr) return user; // 昨天活跃过，今天尚未练习，streak 仍有效
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

  // Global Streak Logic
  if (isNewDay) {
      // Check if consecutive day
      const last = new Date(user.lastActiveDate);
      const curr = new Date(today);
      const diffTime = Math.abs(curr.getTime() - last.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (diffDays === 1) {
          updatedUser.currentStreak += 1;
          if (updatedUser.currentStreak > updatedUser.maxStreak) {
              updatedUser.maxStreak = updatedUser.currentStreak;
          }
      } else if (diffDays > 1) {
          updatedUser.currentStreak = 1;
      }
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
