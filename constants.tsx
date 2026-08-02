
import { Language, CEFRLevel, MentorPersona } from './types';
import {
  Globe,
  Type,
  PenTool,
  User,
  Book,
  Network,
  BookA,
  BrainCircuit,
  Gamepad2,
  Home,
  Upload,
  Users,
  Sparkles,
  Target
} from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  { id: Language.English, label: 'English', flag: '🇬🇧', code: 'en-US' },
  { id: Language.Japanese, label: '日本語', flag: '🇯🇵', code: 'ja-JP' },
  { id: Language.Korean, label: '한국어', flag: '🇰🇷', code: 'ko-KR' },
  { id: Language.Spanish, label: 'Español', flag: '🇪🇸', code: 'es-ES' },
  { id: Language.French, label: 'Français', flag: '🇫🇷', code: 'fr-FR' },
  { id: Language.German, label: 'Deutsch', flag: '🇩🇪', code: 'de-DE' },
  { id: Language.Chinese, label: '中文', flag: '🇨🇳', code: 'zh-CN' },
  { id: Language.Italian, label: 'Italiano', flag: '🇮🇹', code: 'it-IT' },
];

export const DRILL_TOPICS = [
  { id: 'daily', label: '日常生活', icon: '☕' },
  { id: 'business', label: '商务', icon: '💼' },
  { id: 'tech', label: '科技', icon: '💻' },
  { id: 'travel', label: '旅行', icon: '✈️' },
  { id: 'culture', label: '文化', icon: '🎨' },
  { id: 'food', label: '美食', icon: '🍜' },
  { id: 'news', label: '时事', icon: '📰' },
  { id: 'science', label: '科学', icon: '🔬' },
  { id: 'literature', label: '文学', icon: '📚' },
  { id: 'philosophy', label: '哲学', icon: '🤔' },
];

export const NAV_ITEMS = [
  { id: 'daily', label: '今日', icon: <Home size={20} /> },
  { id: 'rpg', label: '剧情对话', icon: <Gamepad2 size={20} /> },
  { id: 'typing', label: '打字闯关', icon: <Type size={20} /> },
  { id: 'writing_tree', label: '写作树', icon: <Network size={20} /> },
  { id: 'writing', label: '写作工坊', icon: <PenTool size={20} /> },
  { id: 'library', label: '记忆库', icon: <Book size={20} /> },
  { id: 'vocabulary', label: '词汇', icon: <BookA size={20} /> },
  { id: 'import', label: '导入', icon: <Upload size={20} /> },
  { id: 'social', label: '学习搭子', icon: <Users size={20} /> },
  { id: 'profile', label: '我的资料', icon: <User size={20} /> },
];

// --- AI Tutor Personas (Phase 2/3) ---
export const MENTOR_PERSONAS: Array<{ id: MentorPersona; label: string; emoji: string; description: string; system: string }> = [
  {
    id: 'encourager',
    label: '鼓励伙伴',
    emoji: '🌟',
    description: '温柔鼓励，多夸少批，适合刚开始或容易受挫',
    system: '你是温暖鼓励的语言伙伴。多肯定用户的尝试，用简单的鼓励推动ta继续输出，纠错要温和。'
  },
  {
    id: 'strict',
    label: '严厉教练',
    emoji: '🥋',
    description: '高标准、直接指出错误，适合冲刺突破',
    system: '你是严格专业的语言教练。直接指出错误与不当之处，要求准确，不降低标准。'
  },
  {
    id: 'friend',
    label: '母语朋友',
    emoji: '🤝',
    description: '像朋友闲聊，自然地道，重流畅不重完美',
    system: '你是用户的母语朋友。像日常聊天一样自然，优先流畅和地道表达，偶尔顺带纠正。'
  },
  {
    id: 'professor',
    label: '学者导师',
    emoji: '🎓',
    description: '讲解语法与文化背景，适合系统性学习',
    system: '你是严谨的语言学者。在对话中适当讲解语法规则与文化背景，帮助系统性理解。'
  },
];

// 兴趣主题包（与 DRILL_TOPICS 对应，供个性化练习与内容导入使用）
export const TOPIC_PACKAGES = DRILL_TOPICS;

// --- Gamified Progression Map ---
export const TYPING_STAGES = [
  // World 1: The Basics (A1)
  { id: 0, title: "初学起步", cefr: CEFRLevel.A1, minWpm: 0, description: "简单的单词与问候。", isBoss: false, icon: "🌱" },
  { id: 1, title: "日常物品", cefr: CEFRLevel.A1, minWpm: 15, description: "你身边的常见物品。", isBoss: false, icon: "🍎" },
  { id: 2, title: "自我介绍", cefr: CEFRLevel.A1, minWpm: 20, description: "介绍你自己。", isBoss: false, icon: "👋" },
  { id: 3, title: "A1 Boss：速度冲刺", cefr: CEFRLevel.A1, minWpm: 30, description: "证明你已经掌握基础。", isBoss: true, icon: "⚔️" },

  // World 2: Building Blocks (A2)
  { id: 4, title: "城市", cefr: CEFRLevel.A2, minWpm: 25, description: "在城市中穿行。", isBoss: false, icon: "🏙️" },
  { id: 5, title: "日常作息", cefr: CEFRLevel.A2, minWpm: 30, description: "描述你的一天。", isBoss: false, icon: "⏰" },
  { id: 6, title: "感受", cefr: CEFRLevel.A2, minWpm: 35, description: "表达情绪。", isBoss: false, icon: "🎭" },
  { id: 7, title: "A2 Boss：精准", cefr: CEFRLevel.A2, minWpm: 40, description: "精准是关键。", isBoss: true, icon: "🐉" },

  // World 3: Fluency (B1)
  { id: 8, title: "旅行日志", cefr: CEFRLevel.B1, minWpm: 35, description: "写写旅途见闻。", isBoss: false, icon: "✈️" },
  { id: 9, title: "观点", cefr: CEFRLevel.B1, minWpm: 40, description: "同意与反对。", isBoss: false, icon: "🗣️" },
  { id: 10, title: "B1 Boss：耐力", cefr: CEFRLevel.B1, minWpm: 50, description: "更长的段落等着你。", isBoss: true, icon: "🏰" },

  // World 4: Mastery (B2+)
  { id: 11, title: "抽象概念", cefr: CEFRLevel.B2, minWpm: 45, description: "讨论想法。", isBoss: false, icon: "🧠" },
  { id: 12, title: "职场", cefr: CEFRLevel.C1, minWpm: 50, description: "商务与正式表达。", isBoss: false, icon: "💼" },
  { id: 13, title: "终极 Boss：诗人", cefr: CEFRLevel.C2, minWpm: 60, description: "复杂的文学结构。", isBoss: true, icon: "👑" },
];
