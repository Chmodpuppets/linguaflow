
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

// 考试目标框架（写作批改可按其输出对应评分体系）。
// 各考试与语言一一对应、严格门控：IELTS/TOEFL→英语；JLPT→日语；TOPIK→韩语；DELE→西语。
// 不匹配语言或非考试目标（none）一律回落通用 CEFR 反馈（examScores = null）。
export type TargetExam = 'none' | 'IELTS' | 'TOEFL' | 'JLPT' | 'TOPIK' | 'DELE';

// 雅思写作四项评分（0–9，可含 .5）。仅当 learningLanguage === English 且目标 = IELTS 时由 AI 输出。
export interface IeltsBandScores {
  taskResponse: number;        // TR（Task Achievement / Task Response）
  coherenceCohesion: number;   // CC
  lexicalResource: number;     // LR
  grammaticalRange: number;    // GRA
  overall: number;             // 四项均值（保留一位小数）
  feedback: {
    taskResponse: string;
    coherenceCohesion: string;
    lexicalResource: string;
    grammaticalRange: string;
  };
}

// 日语 JLPT 写作能力映射（0–100，三维）。仅当目标 = JLPT 且学习语言 = 日语 时由 AI 输出。
// 注：JLPT 官方为选择题考试，此处将"写作"能力映射到 N 级量表作为估算。
export interface JlptScores {
  estimatedLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';  // 估算 N 级（N5 最容易 → N1 最难）
  vocabularyKanji: number;     // 文字・語彙（汉字读音/写法、词汇）
  grammar: number;             // 文法（助词/活用/句型/敬体）
  composition: number;         // 構成・表現（组织/连贯/语体）
  feedback: {
    vocabularyKanji: string;
    grammar: string;
    composition: string;
  };
}

// 韩语 TOPIK 写作评分（0–100，三维）。仅当目标 = TOPIK 且学习语言 = 韩语 时由 AI 输出。
export interface TopikScores {
  estimatedLevel: number;      // 估算 TOPIK 等级 1–6（I=1-2，II=3-6）
  vocabGrammar: number;        // 어휘・문법
  contentOrganization: number; // 내용 구성
  expression: number;          // 표현
  feedback: {
    vocabGrammar: string;
    contentOrganization: string;
    expression: string;
  };
}

// 西语 DELE 写作评分（0–100，四维，CEFR 对齐）。仅当目标 = DELE 且学习语言 = 西语 时由 AI 输出。
export interface DeleScores {
  estimatedLevel: CEFRLevel;   // 估算 CEFR 等级
  grammar: number;             // gramática
  vocabulary: number;          // léxico
  coherence: number;           // coherencia y cohesión
  taskAdequacy: number;        // adecuación a la tarea
  feedback: {
    grammar: string;
    vocabulary: string;
    coherence: string;
    taskAdequacy: string;
  };
}

// 托福 TOEFL iBT 写作评分（0–5 三维 + 0–30 换算总分）。仅当目标 = TOEFL 且学习语言 = 英语 时由 AI 输出。
// 注：TOEFL 写作含综合写作与学术讨论两项，官方量规每项 0–5；此处按该量规估算单篇写作质量。
export interface ToeflScores {
  development: number;       // 展开度（观点充实、有例证/解释，任务回应充分）
  organization: number;      // 组织（统一、连贯、推进）
  languageUse: number;       // 语言运用（语法、词汇、准确与得体）
  scaled: number;            // 换算总分（0–30，由三维估算）
  feedback: {
    development: string;
    organization: string;
    languageUse: string;
  };
}

// 写作考试评分联合类型
export type ExamScores = IeltsBandScores | JlptScores | TopikScores | DeleScores | ToeflScores;

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
  ScriptTrainer = 'script_trainer',
  ErrorBook = 'errorbook',
  ErrorPatterns = 'error_patterns',
  Trend = 'trend',
  Portfolio = 'portfolio',
  CompositionStudio = 'composition_studio',
  InkQuest = 'ink_quest',
  ContentRepo = 'content_repo',
  SongLab = 'song_lab'
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

// 写作纵向趋势：每次批改（首稿/二稿）沉淀一条结构化评分记录，供趋势曲线聚合。
// 考试分数为原始 ExamScores（含各考试量纲），绘制时按考试类型分别归一化。
export interface WritingScoreRecord {
  id: string;
  timestamp: number;
  date: string;            // YYYY-MM-DD
  language: Language;
  isRevision: boolean;     // true = 二稿对比批改；false = 首稿
  cefrEstimation: CEFRLevel;
  examScores?: ExamScores | null;  // 仅当本次写作目标考试与语言匹配时存在
  wordCount: number;
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

// --- Song Lab（歌曲跟打）---
// 用户粘贴 LRC / 纯文本歌词 + 可选上传 mp3，自动切割成逐句，逐句做打字练习。
// 音频 blob 存 IndexedDB（避免 localStorage 超限），SongPack 仅存 audioId 引用。
export interface SongLine {
  id: string;
  time?: number;          // LRC 时间戳（秒）。纯文本无时间戳则为 undefined
  start?: number;         // 剪辑片段起止（秒），来自本地剪辑包
  end?: number;
  clip?: string;          // 该句音频片段文件名（如 01.mp3），相对剪辑包
  text: string;           // 原句（目标语言，例如日语歌词）
  translation?: string;   // 中译（可选，AI 生成或手动）
  romaji?: string;        // 注音（日语 romaji 等，本地生成或手动）
}

export interface SongPack {
  id: string;
  title: string;          // 歌名
  artist?: string;        // 歌手（可选）
  language: Language;
  lines: SongLine[];
  source: 'lrc' | 'plain';
  audioId?: string;       // 对应 IndexedDB 中的整首音频 blob key
  hasClips?: boolean;     // 是否带每句音频片段（来自剪辑包）
  createdAt: number;
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
  // 仅当目标考试与该学习语言匹配且已实现时由 AI 填充；否则为 null（含 none 或语言不匹配）。
  examScores?: ExamScores | null;
  // 语体（口气）点评：题目要求用某种语气写作时，由 AI 评估口气是否得当（母语说明）。
  registerNote?: string;
}

// 二稿改写闭环：在首稿批改基础上，对比二稿是否修复了问题。
// 语言无关——所有 learningLanguage 通用；与具体考试框架(IELTS/JLPT...)解耦。
export interface WritingRevisionFeedback extends WritingFeedback {
  fixedIssues: string[];      // 相较首稿已修复的问题（母语说明）
  remainingIssues: string[];  // 二稿仍存在的错误 / 新问题
  improved: boolean;          // 相较首稿是否整体进步
}

// 引导式微写作（句型填空 / 看词造句 / 情境一句）的 AI 反馈
export type GuidedMode = 'scaffold' | 'wordchain' | 'prompt' | 'revision';

export interface GuidedWritingFeedback {
  isCorrect: boolean;        // 整体可接受（语义传达 + 语法对该等级基本正确）
  correctedText: string;     // AI 改写后的正确句子（目标语言）
  issues: Array<{ original: string; fix: string; reason: string }>;
  encouragement: string;     // 母语：先肯定，再给一个最该改进的点
  cefrEstimation: CEFRLevel;
  registerNote?: string;     // 语体/口气是否得当的点评（母语）
  // 重写模式（practiceType==='rewrite' 或 AI mode='revision'）下由 AI 给出「重写建议」，
  // 与 issues（语言精修：用词/语法）明确分离：本字段关注读者/目的/内容/结构。
  revision?: RevisionAdvice;
}

// 重写建议可归类的弱项维度（与 ErrorPatternType 的 content/structure/reader_awareness 对应）
export type RevisionPointType = 'content' | 'structure' | 'reader_awareness';

// 重写建议（重写 vs 改语法分离）：关注读者 / 目的 / 内容 / 结构，不碰句子准确度
export interface RevisionAdvice {
  focus: string;                                     // 本次重写核心焦点（母语）
  points: Array<{                                    // 重写层面具体建议
    point: string;                                   // 该条建议的标题（母语）
    detail: string;                                  // 具体怎么做（母语）
    type?: RevisionPointType;                        // 可归类的弱项维度，用于沉淀到错误模式引擎
  }>;
}

// 写作练习类型（纵向养成主线的「练的是什么」维度，数据驱动 UI 徽标）
export type WritingPracticeType =
  | 'observe'   // 观察与积累
  | 'narrate'   // 叙事 / 描述
  | 'organize'  // 组织与表达
  | 'opinion'   // 观点与论述
  | 'reader'    // 为读者而写
  | 'style'     // 风格与声音
  | 'rewrite';  // 重写与打磨

export const PRACTICE_TYPE_LABELS: Record<WritingPracticeType, string> = {
  observe: '观察积累',
  narrate: '叙事描述',
  organize: '组织表达',
  opinion: '观点论述',
  reader: '读者意识',
  style: '风格声音',
  rewrite: '重写打磨',
};

// 写作过程循环阶段（Writing Commons / Purdue：构思→起草→重读→重写→编辑→分享）
export type WritingCycleStage =
  | 'plan'
  | 'draft'
  | 'reread'
  | 'rewrite'
  | 'edit'
  | 'share';

export const CYCLE_STAGE_LABELS: Record<WritingCycleStage, string> = {
  plan: '构思',
  draft: '起草',
  reread: '重读',
  rewrite: '重写',
  edit: '编辑',
  share: '分享',
};

// 写作语体 / 口气（register）：同一主题用不同语体写，训练得体表达
export type WritingRegister = 'casual' | 'neutral' | 'polite' | 'formal' | 'business';
export const REGISTER_LABELS: Record<WritingRegister, string> = {
  casual: '口语',
  neutral: '中性',
  polite: '礼貌',
  formal: '正式',
  business: '商务',
};

// 作文体裁 / 题材（genre）：同一主题可用不同体裁写，训练不同篇章结构
export type CompositionGenre = 'argumentative' | 'narrative' | 'expository' | 'letter' | 'story';
export const GENRE_LABELS: Record<CompositionGenre, string> = {
  argumentative: '议论文',
  narrative: '记叙文',
  expository: '说明文',
  letter: '书信',
  story: '故事',
};

// AI 生成的参考范文 / 提纲（长文允许范文，iron-rule 仅限手写特训模块）
export interface ReferenceEssay {
  outline: string[]; // 参考提纲要点（母语说明，帮助学生搭结构）
  essay: string;     // 参考范文全文（目标语言）
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

// 写作错题卡（自动从 AI 批改的 suggestions 沉淀，间隔复习强化弱项）
// 与 VocabularyItem 平行、按 language 区分；存独立 storage，不污染 UserProfile（多语言隔离）
export interface ErrorCard {
  id: string;
  original: string;        // 错误写法（学习者原文片段）
  correction: string;      // 正确写法（AI 建议）
  reason: string;          // 母语解释（为什么错、怎么改）
  language: Language;
  context?: string;        // 原句/段落上下文片段（可选，帮助回忆）
  type?: ErrorPatternType; // 弱项类型（重写建议沉淀时带入，用于跨界面聚合）
  tags?: string[];         // 关联维度（如 ['spine','rewrite']），用于出题命中
  createdAt: number;       // 最近一次出现时间（合并去重时刷新）
  // --- SRS (Leitner) fields ---
  box: number;             // 1..5 (1 = 刚错/最难)
  dueDate: number;         // 下次复习时间戳
  reviews: number;         // 已复习次数
  lapses: number;          // 再次犯错次数
}

// --- Personal Error Pattern Engine（个人错误模式引擎）---
// 捕捉用户在产出练习中的高频错误类型，按 (language, type) 聚合，用于驱动后续出题优先级。
export type ErrorPatternType =
  | 'kana_dakuon'      // 浊音/半浊音混淆（日语）
  | 'kana_youon'       // 拗音混淆（日语）
  | 'kana_confusion'   // 假名形近混淆（シ/ツ、ソ/ン 等）
  | 'spelling'         // 拼写错误
  | 'tense'            // 时态
  | 'particle'         // 助词/介词
  | 'word_order'       // 语序
  | 'collocation'      // 搭配/用词
  | 'register'         // 语体/敬语
  | 'agreement'        // 一致性（性数格）
  | 'dictation_miss'   // 听写漏写/错写
  | 'content'          // 内容 / 选材（偏题、缺细节、无例子）
  | 'structure'        // 结构 / 组织（段落混乱、无逻辑连接）
  | 'reader_awareness' // 读者意识 / 目的（语体错配、未考虑读者）
  | 'other';

export const ERROR_PATTERN_LABELS: Record<ErrorPatternType, string> = {
  kana_dakuon: '浊音/半浊音混淆',
  kana_youon: '拗音混淆',
  kana_confusion: '假名形近混淆',
  spelling: '拼写错误',
  tense: '时态',
  particle: '助词/介词',
  word_order: '语序',
  collocation: '搭配/用词',
  register: '语体/敬语',
  agreement: '一致性(性数格)',
  dictation_miss: '听写漏写/错写',
  content: '内容/选材',
  structure: '结构/组织',
  reader_awareness: '读者意识/目的',
  other: '其他',
};

export interface ErrorPattern {
  id: string;            // `${language}:${type}`
  type: ErrorPatternType;
  language: Language;
  label: string;         // 人类可读，如「浊音混淆」
  examples: string[];    // 具体犯错例子（"きゃ→ぎゃ" 等），去重、限长
  count: number;         // 累计权重
  lastSeen: number;      // 最近一次时间戳
  tags?: string[];       // 关联维度（如 ScriptItem.group），用于出题命中
}

// --- Daily Production Flywheel（每日产出飞轮）---
// 每天一个统一主题，把核心产出模块串成一条线；跑完才计连胜。
export type FlywheelStep = 'writing' | 'dictation' | 'script';

export interface DailyFlywheel {
  date: string;                       // YYYY-MM-DD
  themeId: string;
  theme: string;                      // 主题（中文）
  themePrompt: string;                // 给各模块的统一引导
  steps: Record<FlywheelStep, boolean>;
  allDone: boolean;
  reflection?: string;
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

export type NodeType = 'root' | 'chapter' | 'section' | 'snippet' | 'idea' | 'theme' | 'task' | 'composition';

// 作文（长文）节点下的段落：提纲骨架 + 用户分段写作内容
export interface CompositionSection {
  id: string;
  title: string;        // 段落标题（如 引言 / 主体段落1 / 结论）
  targetWords: number;  // 该段目标词数
  content: string;      // 用户写作内容
}

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
  register?: WritingRegister; // 要求语体/口气（口语/中性/礼貌/正式/商务）
  unlocked?: boolean;      // 是否解锁（可开始）
  completed?: boolean;     // 是否已完成
  scaffold?: string;       // 脚手架模板（含 ___，空串表示自由写）
  scaffoldHint?: string;   // 填空提示
  order?: number;          // 同主题内顺序（解锁链用）
  // 作文（composition）节点字段
  sections?: CompositionSection[];   // 分段内容与提纲骨架
  defaultExam?: TargetExam;          // 默认考试维度（用于结构/構成评分，如 EN→IELTS）
  examMode?: boolean;                // 考试视角开关（true=按 defaultExam 评分；false=自由写作，仅通用反馈）
  genre?: CompositionGenre;          // 作文体裁（议论文/记叙文/书信…），决定提纲骨架
  prompt?: string;                   // 真实考题/任务正文（非主题标签）。考试评分（TR/Development 等）必须对照此题，否则评分在结构上无意义
  language?: Language;      // 该树所属语言（root/theme/task 均写入，便于按语言重建缓存）
  // 纵向养成主线（写作者养成）字段
  spine?: boolean;                     // 是否属于「写作者养成主线」子树
  practiceType?: WritingPracticeType;   // 练的是什么维度（观察/叙事/组织/观点/读者/风格/重写）
  cycleStage?: WritingCycleStage;      // 写作过程循环阶段（构思/起草/重读/重写/编辑/分享）
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
  lastStreakDate: string; // YYYY-MM-DD，最近一次「完成产出飞轮」计入连胜的日期
  
  // Daily Quests (Phase 1)
  dailyQuests: DailyQuest[];
  lastQuestDate: string; // YYYY-MM-DD，用于每日刷新

  // Personalization (Phase 2/3)
  mentorPersona: MentorPersona;
  preferredTopics: string[]; // DRILL_TOPICS ids
  aiMemory: AIMemory;

  // 考试目标（写作批改评分体系门控）。默认 'none' = 通用 CEFR 反馈。
  // 各考试与语言一一对应：IELTS/TOEFL→英语、JLPT→日语、TOPIK→韩语、DELE→西语；
  // 不匹配语言或非考试目标回落到通用反馈。
  targetExam?: TargetExam;

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
