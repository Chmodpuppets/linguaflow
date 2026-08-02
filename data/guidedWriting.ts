import { Language, CEFRLevel } from '../types';

// 句型填空模板：含 ___ 的句型，让学习者填空产出完整句
export interface GuidedTemplate {
  id: string;
  template: string;       // 含 ___ 的句型，如「私は ___ です。」
  hint: string;           // 母语提示填什么
  answerExample: string;  // 示例答案（仅供参考，校验由 AI 完成）
}

// 按语言 × 等级维护的句型模板库。当前日语 A1 优先（用户画像），结构通用可扩展。
export const GUIDED_TEMPLATES: Partial<Record<Language, Partial<Record<CEFRLevel, GuidedTemplate[]>>>> = {
  [Language.Japanese]: {
    [CEFRLevel.A1]: [
      { id: 'ja-a1-1', template: '私は ___ です。', hint: '填你的职业（如：学生 / 会社員）', answerExample: '学生' },
      { id: 'ja-a1-2', template: 'これは ___ です。', hint: '填一件物品（如：本 / ペン / 電話）', answerExample: '本' },
      { id: 'ja-a1-3', template: '___ が好きです。', hint: '填你喜欢的事物（如：犬 / 音楽 / 日本語）', answerExample: '犬' },
      { id: 'ja-a1-4', template: '今日は ___ です。', hint: '填今天星期几（如：月曜日 / 火曜日）', answerExample: '月曜日' },
      { id: 'ja-a1-5', template: '私の名前は ___ です。', hint: '填你的名字', answerExample: '田中' },
      { id: 'ja-a1-6', template: '___ にいます。', hint: '填你在哪里（如：学校 / 家 / 会社）', answerExample: '学校' },
      { id: 'ja-a1-7', template: '___ を食べます。', hint: '填你吃的东西（如：ご飯 / パン / 肉）', answerExample: 'ご飯' },
      { id: 'ja-a1-8', template: '___ へ行きます。', hint: '填你去的地方（如：学校 / 仕事 / 家）', answerExample: '学校' },
    ],
  },
};

// 情境库：通用（不绑语言），按等级。给中文情境，让学习者用目标语言写 1-3 句。
export const GUIDED_PROMPTS: Partial<Record<CEFRLevel, string[]>> = {
  [CEFRLevel.A1]: [
    '用目标语言介绍你自己：叫什么、是哪国人。',
    '用目标语言说一样你喜欢的食物。',
    '用目标语言说说你今天早上做了什么。',
    '用目标语言描述你房间里的一件东西在哪里。',
    '用目标语言说说你的一个爱好。',
    '用目标语言说现在几点、你正在做什么。',
    '用目标语言介绍你的一位朋友：叫什么、是哪国人。',
  ],
  [CEFRLevel.A2]: [
    '用目标语言描述你上个周末做了什么（用过去时）。',
    '用目标语言说说你明天的计划。',
    '用目标语言比较你喜欢的两种食物。',
    '用目标语言描述你的日常作息（至少三句）。',
  ],
};

export function getGuidedTemplate(lang: Language, level: CEFRLevel): GuidedTemplate | null {
  const list = GUIDED_TEMPLATES[lang]?.[level];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function getGuidedPrompt(level: CEFRLevel): string {
  const list = GUIDED_PROMPTS[level] ?? GUIDED_PROMPTS[CEFRLevel.A1] ?? [];
  if (list.length === 0) return '用目标语言写一句话描述你现在的心情。';
  return list[Math.floor(Math.random() * list.length)];
}

export function hasGuidedTemplates(lang: Language, level: CEFRLevel): boolean {
  const list = GUIDED_TEMPLATES[lang]?.[level];
  return !!list && list.length > 0;
}
