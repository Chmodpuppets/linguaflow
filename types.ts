
export enum Language {
  English = 'English',
  Japanese = 'Japanese',
  Korean = 'Korean',
  Spanish = 'Spanish',
  French = 'French',
  German = 'German',
  Chinese = 'Chinese',
  Italian = 'Italian'
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
  RPG = 'rpg'
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
}

// --- Writing Tree System Types ---

export type NodeType = 'root' | 'chapter' | 'section' | 'snippet' | 'idea';

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
}

// --- RPG System Types ---

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
}

// --- Gamification & User Types ---

export interface ActivityLog {
  id: string;
  timestamp: number;
  date: string; // YYYY-MM-DD
  type: 'writing' | 'typing' | 'tree_writing' | 'vocabulary' | 'rpg';
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
  
  // History
  joinedDate: number;
}

export interface DailyQuest {
  id: string;
  label: string;
  target: number;
  current: number;
  completed: boolean;
  rewardXP: number;
}
