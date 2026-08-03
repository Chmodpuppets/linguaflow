
export enum Language {
  English = 'English',
  Japanese = 'Japanese',
  Korean = 'Korean',
  Spanish = 'Spanish',
  French = 'French',
  German = 'German',
  Chinese = 'Chinese',
  Italian = 'Italian',
  Russian = 'Russian',
  Greek = 'Greek',
  Arabic = 'Arabic'
}

export enum CEFRLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2'
}

export enum AppMode {
  Assessment = 'assessment',
  Typing = 'typing',
  Writing = 'writing',
  Library = 'library',
  WritingTree = 'writing_tree',
  Profile = 'profile',
  Vocabulary = 'vocabulary',
  RPG = 'rpg',
  Daily = 'daily',
  Import = 'import',
  Social = 'social',
  ScriptTrainer = 'script_trainer'
}

// --- Personalization (Phase 2/3) ---
export type MentorPersona = 'encourager' | 'strict' | 'friend' | 'professor';

export interface AIMemory {
  goals: string[];            // 用户的学习目标（如"能点咖啡""通过雅思"）
  weakPoints: string[];       // AI 观察到的 recurring 薄弱点（时态/发音词等）
  interests: string[];        // 兴趣主题（与 DRILL_TOPICS 对应）
  notes: string;              // 自由备注
}

export interface AssessmentResult {
  level: CEFRLevel;
  reasoning: string;
  vocabularyScore: number; // 0-100
  grammarScore: number; // 0-100
}

export interface TypingContent {
  text: string;
  topic: string;
  phoneticGuide?: string; // For Japanese (Romaji), Chinese (Pinyin), etc.
  translation: string;
  keyVocabulary: Array<{
    word: string;
    meaning: string;
    partOfSpeech: string;
  }>;
}

export interface WritingFeedback {
  correctedText: string;
  suggestions: Array<{
    original: string;
    suggestion: string;
    reason: string;
  }>;
  generalComment: string;
  cefrEstimation: CEFRLevel;
}

// 二稿改写闭环：在首稿批改基础上，对比二稿是否修复了问题。
// 语言无关——所有 learningLanguage 通用；与具体考试框架(IELTS/JLPT...)解耦。
export interface WritingRevisionFeedback extends WritingFeedback {
  fixedIssues: string[];      // 相较首稿已修复的问题（母语说明）
  remainingIssues: string[];  // 二稿仍存在的错误 / 新问题
  improved: boolean;          // 相较首稿是否整体进步
}

// 引导式微写作（句型填空 / 看词造句 / 情境一句）的 AI 反馈
export type GuidedMode = 'scaffold' | 'wordchain' | 'prompt';

export interface GuidedWritingFeedback {
  isCorrect: boolean;        // 整体可接受（语义传达 + 语法对该等级基本正确）
  correctedText: string;     // AI 改写后的正确句子（目标语言）
  issues: Array<{ original: string; fix: string; reason: string }>;
  encouragement: string;     // 母语：先肯定，再给一个最该改进的点
  cefrEstimation: CEFRLevel;
}

export interface ReadingReflection {
  topic: string;           // 这篇文章的主题是什么？
  impressivePoint: string; // 哪个观点最让你印象深刻？
  examples: string;        // 作者给出了哪些例子？
  userOpinion: string;     // 你自己的观点是什么？
  summary: string;         // 你能用一句话总结整篇内容吗？
}

export interface UserContent {
  id: string;
  title: string;
  content: string;
  notes: string;
  language: Language;
  createdAt: number;
  reflection?: ReadingReflection;
}

export interface VocabularyItem {
  id: string;
  word: string;
  definition: string;
  exampleSentence: string;
  partOfSpeech: string;
  language: Language;
  createdAt: number;
  // --- SRS (Spaced Repetition) fields (Phase 1) ---
  box?: number;        // Leitner box 1..5 (1 = 新词/最难)
  dueDate?: number;    // 下次复习时间戳
  reviews?: number;    // 已复习次数
  lapses?: number;     // 遗忘次数
}

// --- Script / Alphabet Production Trainer (跨语言通用，数据驱动) ---
// 设计铁律：生成式练习——给声音/意思/罗马字提示，绝不直接显示答案字形；
// 用户必须主动从记忆里产出字形（打字或虚拟键盘），答错才揭示答案并降级。
export type ScriptTarget = 'hiragana' | 'katakana' | 'other';

export interface ScriptItem {
  id: string;
  group: string;            // 分组标签，如 '平假名' / '片假名' / '拗音（平假名）'
  prompt: string;           // 给用户的提示（romaji 或 意思），不显示答案字形
  answer: string;           // 正确字形，如 'きゃ' / 'ア'
  romaji?: string;          // 罗马字（日语 romaji 输入对照用）
  targetScript?: ScriptTarget; // 转换目标文字（决定 romaji 输入转成哪种）
  audioText?: string;       // 送 TTS 的读音文本（通常 === answer）
}

export interface ScriptPack {
  id: string;               // 如 'ja-kana'
  language: Language;
  name: string;
  description: string;
  groups: string[];         // 可选分组（用户选择练习范围）
  items: ScriptItem[];
  // 把用户的拉丁/罗马字输入转成目标字形，用于校验（生成式闭环）。
  // 不提供则禁用文本输入，仅用虚拟键盘点按（适合无简单罗马字映射的复杂文字，如阿拉伯连写）。
  transliterate?: (input: string, item: ScriptItem) => string;
}

export interface ScriptCardProgress {
  box: number;              // Leitner 1..5
  dueDate: number;          // 下次复习时间戳
  reviews: number;
  lapses: number;
}

// --- Writing Tree System Types ---

export type NodeType = 'root' | 'chapter' | 'section' | 'snippet' | 'idea' | 'theme' | 'task';

export interface WritingNode {
  id: string;
  parentId: string | null; // null if it's a top-level project/book
  type: NodeType;
  title: string;
  content: string;
  summary?: string; // AI generated summary
  progress: number; // 0-100
  wordCount: number;
  tags: string[];
  isExpanded?: boolean; // UI state for tree
  createdAt: number;
  updatedAt: number;
  // 成长树字段（theme/task 节点用）
  cefrLevel?: CEFRLevel;   // 任务难度
  unlocked?: boolean;      // 是否解锁（可开始）
  completed?: boolean;     // 是否已完成
  scaffold?: string;       // 脚手架模板（含 ___，空串表示自由写）
  scaffoldHint?: string;   // 填空提示
  order?: number;          // 同主题内顺序（解锁链用）
  language?: Language;      // 该树所属语言（root/theme/task 均写入，便于按语言重建缓存）
}

// --- RPG System Types ---

// 角色人设：用于让 AI 稳定扮演固定角色（影视/主题宇宙包）
export interface CharacterProfile {
  name: string;            // 角色名
  persona: string;         // 性格 / 口癖 / 口语特征，喂给 AI 让人设稳定
}

// 预置剧本定义（语言无关，运行时由 AI 按用户学习语言生成台词）
export interface ScenarioDef {
  id: string;
  title: string;
  context: string;         // 场景描述（用户可见）
  userRole: string;
  aiRole: string;
  character?: CharacterProfile;  // AI 要扮演的固定角色
  objectives: string[];    // 任务目标（母语描述，如中文）
  cefrRange: [CEFRLevel, CEFRLevel];
  tags: string[];
  inspiredBy?: string;     // “灵感来自 XXX”框架，绝不复制剧本原文
}

// 主题宇宙包：把场景打包成可探索的世界
export interface UniversePack {
  id: string;
  name: string;
  icon: string;
  description: string;
  scenarios: ScenarioDef[];
}

export interface RPGScenario {
  id: string;
  theme: string;
  title: string;
  context: string;
  userRole: string;
  aiRole: string;
  initialMessage: string;
  initialPhonetic?: string; // Pronunciation guide for initial message
  initialSuggestedReply?: string; // Suggestion for user's first response
  initialSuggestedReplyPhonetic?: string; // Pronunciation guide for suggested reply
  objectives: string[]; // e.g., ["Order a coffee", "Ask for the price"]
  difficulty: CEFRLevel;
  universe?: string;       // 所属宇宙包名
  inspiredBy?: string;     // 灵感来源（影视名场面包用）
  character?: CharacterProfile; // 本场景 AI 扮演的角色人设
}

export interface RPGMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  translation?: string;
  phonetic?: string; // Pronunciation guide
  audioUrl?: string; // Cache key or raw base64
  vocabularyHighlights?: Array<{ word: string; meaning: string }>;
}

export interface RPGTurnResult {
  aiReply: string;
  phonetic?: string; // Pronunciation guide for aiReply
  translation: string;
  suggestedUserReply?: string; // A hint for what the user could say next
  suggestedUserReplyPhonetic?: string; // Pronunciation guide for suggested user reply
  completedObjectives: string[]; // Which objectives were finished in this turn
  newObjectives?: string[]; // Dynamic new goals
  vocabulary: Array<{ word: string; meaning: string }>;
  isScenarioComplete: boolean;
  feedback?: string; // Brief feedback on user's last input
  choices?: string[]; // 2-3 个剧情分支选项（用户可一键选择推进）
}

// --- Gamification & User Types ---

export interface ActivityLog {
  id: string;
  timestamp: number;
  date: string; // YYYY-MM-DD
  type: 'writing' | 'typing' | 'tree_writing' | 'vocabulary' | 'rpg' | 'script';
  language: Language;
  summary: string;
  details: {
    wpm?: number;
    accuracy?: number;
    wordCount?: number;
    feedback?: string;
    nodeTitle?: string;
    word?: string;
    stageId?: number;
    passed?: boolean;
    scenarioTitle?: string;
  };
  xpEarned: number;
}

export interface LanguageProgress {
  xp: number;
  level: number;
  cefrLevel: CEFRLevel; // Per-language CEFR
  totalWordsTyped: number;
  lastActive: number;
  maxUnlockedStage: number; // 0-indexed, for Typing Adventure Mode
}

export interface UserProfile {
  username: string;
  nativeLanguage: Language;
  learningLanguage: Language; // Currently selected active language
  
  // Multi-language progression
  progress: Record<string, LanguageProgress>; // Keyed by Language enum value

  // Global Gamification
  currentStreak: number;
  maxStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakShields: number;  // 断签保护卡数量（Phase 1）
  
  // Daily Quests (Phase 1)
  dailyQuests: DailyQuest[];
  lastQuestDate: string; // YYYY-MM-DD，用于每日刷新

  // Personalization (Phase 2/3)
  mentorPersona: MentorPersona;
  preferredTopics: string[]; // DRILL_TOPICS ids
  aiMemory: AIMemory;

  // Monetization placeholder (Phase 3)
  premium: boolean;

  // History
  joinedDate: number;
}

export type QuestKind = 'typing_words' | 'vocab_review' | 'rpg_sessions' | 'writing_words' | 'script_practice';

export interface DailyQuest {
  id: string;
  label: string;
  target: number;
  current: number;
  completed: boolean;
  rewardXP: number;
  kind: QuestKind; // 用于活动发生时自动推进
}
