import { Language } from '../types';
import { RAW_CHAPTERS as JLPT_CHAPTERS } from './studyBooks/jlptVocabulary';
import { RAW_CHAPTERS as TOPIK_CHAPTERS } from './studyBooks/topikVocabulary';

/**
 * 新人 A1 起步词：词库为空时一键导入，避免「AI 推荐复习词汇 → 点进去词库是空的」。
 *
 * 数据源优先复用内置学习书（内容已 review、零 AI 依赖），不另造一份词表：
 * - 日语：JLPT N5/N4（≈ CEFR A1）
 * - 韩语：TOPIK I 初级（≈ CEFR A1）
 * - 英语：手写的最小高频集（内置英语书是语法 / 短语 / fluency，不是 A1 词汇）
 * 其余语言暂无内置起步词 → 返回空数组，UI 降级为「手动添加」。
 */

export interface StarterWord {
  word: string;
  pronunciation?: string;
  definition: string;
  example: string;
  partOfSpeech: string;
}

type BuiltinRaw = {
  prompt: string;
  pronunciation?: string;
  answer: string;
  partOfSpeech?: string;
  examples?: string[];
};

const fromBuiltin = (chapters: { items: BuiltinRaw[] }[], limit: number): StarterWord[] =>
  chapters
    .flatMap((c) => c.items)
    .slice(0, limit)
    .map((it) => ({
      word: it.prompt,
      pronunciation: it.pronunciation,
      definition: it.answer,
      example: it.examples?.[0] || '',
      partOfSpeech: it.partOfSpeech || '',
    }));

const EN_A1: StarterWord[] = [
  { word: 'hello', definition: '你好', example: 'Hello, my name is Mike.（你好，我叫 Mike。）', partOfSpeech: '感叹词' },
  { word: 'thank you', definition: '谢谢', example: 'Thank you for your help.（谢谢你的帮助。）', partOfSpeech: '短语' },
  { word: 'name', definition: '名字', example: 'What is your name?（你叫什么名字？）', partOfSpeech: '名词' },
  { word: 'today', definition: '今天', example: 'Today is Monday.（今天是星期一。）', partOfSpeech: '名词' },
  { word: 'tomorrow', definition: '明天', example: 'See you tomorrow.（明天见。）', partOfSpeech: '名词' },
  { word: 'water', definition: '水', example: 'I drink water every day.（我每天喝水。）', partOfSpeech: '名词' },
  { word: 'food', definition: '食物', example: 'The food is very good.（这食物很好吃。）', partOfSpeech: '名词' },
  { word: 'friend', definition: '朋友', example: 'She is my friend.（她是我的朋友。）', partOfSpeech: '名词' },
  { word: 'family', definition: '家人', example: 'I love my family.（我爱我的家人。）', partOfSpeech: '名词' },
  { word: 'house', definition: '房子', example: 'My house is small.（我的房子很小。）', partOfSpeech: '名词' },
  { word: 'work', definition: '工作', example: 'I work in Shenzhen.（我在深圳工作。）', partOfSpeech: '动词' },
  { word: 'school', definition: '学校', example: 'The school is near here.（学校就在附近。）', partOfSpeech: '名词' },
  { word: 'good', definition: '好的', example: 'This is a good idea.（这是个好主意。）', partOfSpeech: '形容词' },
  { word: 'please', definition: '请', example: 'Coffee, please.（请给我咖啡。）', partOfSpeech: '副词' },
  { word: 'sorry', definition: '对不起', example: 'Sorry, I am late.（对不起，我迟到了。）', partOfSpeech: '感叹词' },
  { word: 'yes', definition: '是', example: 'Yes, I understand.（是的，我明白了。）', partOfSpeech: '副词' },
];

export const getStarterVocab = (lang: Language): StarterWord[] => {
  switch (lang) {
    case Language.Japanese:
      return fromBuiltin(JLPT_CHAPTERS, 20);
    case Language.Korean:
      return fromBuiltin(TOPIK_CHAPTERS, 20);
    case Language.English:
      return EN_A1;
    default:
      return [];
  }
};

export const getStarterVocabLabel = (lang: Language): string => {
  switch (lang) {
    case Language.Japanese:
      return 'JLPT N5/N4 · A1 高频词';
    case Language.Korean:
      return 'TOPIK I · A1 高频词';
    case Language.English:
      return 'CEFR A1 · 日常高频词';
    default:
      return 'A1 起步词';
  }
};
