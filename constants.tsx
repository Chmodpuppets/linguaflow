
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
  { id: 'daily', label: 'Daily Life', icon: '☕' },
  { id: 'business', label: 'Business', icon: '💼' },
  { id: 'tech', label: 'Technology', icon: '💻' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'culture', label: 'Culture', icon: '🎨' },
  { id: 'food', label: 'Food & Dining', icon: '🍜' },
  { id: 'news', label: 'Current Events', icon: '📰' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'literature', label: 'Literature', icon: '📚' },
  { id: 'philosophy', label: 'Philosophy', icon: '🤔' },
];

export const NAV_ITEMS = [
  { id: 'daily', label: 'Today', icon: <Home size={20} /> },
  { id: 'rpg', label: 'LinguaQuest', icon: <Gamepad2 size={20} /> },
  { id: 'typing', label: 'Typing Adventure', icon: <Type size={20} /> },
  { id: 'writing_tree', label: 'Writing Tree', icon: <Network size={20} /> },
  { id: 'writing', label: 'Writing Lab', icon: <PenTool size={20} /> },
  { id: 'library', label: 'Memory Bank', icon: <Book size={20} /> },
  { id: 'vocabulary', label: 'Vocabulary', icon: <BookA size={20} /> },
  { id: 'import', label: 'Import', icon: <Upload size={20} /> },
  { id: 'social', label: 'Study Buddies', icon: <Users size={20} /> },
  { id: 'profile', label: 'My Profile', icon: <User size={20} /> },
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
  { id: 0, title: "First Steps", cefr: CEFRLevel.A1, minWpm: 0, description: "Simple words and greetings.", isBoss: false, icon: "🌱" },
  { id: 1, title: "Daily Items", cefr: CEFRLevel.A1, minWpm: 15, description: "Common objects around you.", isBoss: false, icon: "🍎" },
  { id: 2, title: "Introductions", cefr: CEFRLevel.A1, minWpm: 20, description: "Introducing yourself.", isBoss: false, icon: "👋" },
  { id: 3, title: "A1 Boss: Speed Run", cefr: CEFRLevel.A1, minWpm: 30, description: "Prove your mastery of the basics.", isBoss: true, icon: "⚔️" },
  
  // World 2: Building Blocks (A2)
  { id: 4, title: "The City", cefr: CEFRLevel.A2, minWpm: 25, description: "Navigating urban life.", isBoss: false, icon: "🏙️" },
  { id: 5, title: "Routine", cefr: CEFRLevel.A2, minWpm: 30, description: "Describing your day.", isBoss: false, icon: "⏰" },
  { id: 6, title: "Feelings", cefr: CEFRLevel.A2, minWpm: 35, description: "Expressing emotions.", isBoss: false, icon: "🎭" },
  { id: 7, title: "A2 Boss: Precision", cefr: CEFRLevel.A2, minWpm: 40, description: "Accuracy is key.", isBoss: true, icon: "🐉" },

  // World 3: Fluency (B1)
  { id: 8, title: "Travel Log", cefr: CEFRLevel.B1, minWpm: 35, description: "Writing about trips.", isBoss: false, icon: "✈️" },
  { id: 9, title: "Opinions", cefr: CEFRLevel.B1, minWpm: 40, description: "Agreeing and disagreeing.", isBoss: false, icon: "🗣️" },
  { id: 10, title: "B1 Boss: Endurance", cefr: CEFRLevel.B1, minWpm: 50, description: "Longer paragraphs await.", isBoss: true, icon: "🏰" },

  // World 4: Mastery (B2+)
  { id: 11, title: "Abstract Concepts", cefr: CEFRLevel.B2, minWpm: 45, description: "Discussing ideas.", isBoss: false, icon: "🧠" },
  { id: 12, title: "Professional", cefr: CEFRLevel.C1, minWpm: 50, description: "Business and formal language.", isBoss: false, icon: "💼" },
  { id: 13, title: "Final Boss: The Poet", cefr: CEFRLevel.C2, minWpm: 60, description: "Complex literary structures.", isBoss: true, icon: "👑" },
];
