import { ScriptPack, ScriptItem, Language } from '../types';
import { RU_MAP, transliterateFromMap } from '../services/scriptTransliterate';

// 俄语：拉丁转写 → 西里尔。扩展 RU_MAP 以覆盖硬/软符号（无独立发音的字母）
const RU_EXT: Record<string, string> = { ...RU_MAP, hard: 'ъ', soft: 'ь' };

const build = (group: string, latinList: string[]): ScriptItem[] =>
  latinList.map((l) => {
    const answer = transliterateFromMap(l, RU_EXT);
    return {
      id: `ru-${group}-${l}`,
      group,
      prompt: l,
      answer,
      romaji: l,
      audioText: answer,
    };
  });

// 33 个西里尔字母（含硬/软符号）
const ALPHABET = [
  'a', 'b', 'v', 'g', 'd', 'e', 'yo', 'zh', 'z', 'i', 'j', 'k', 'l',
  'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'h', 'c', 'ch', 'sh', 'sch',
  'hard', 'y', 'soft', 'eh', 'yu', 'ya',
];

// 常见词：练整词拼写产出
const WORDS = ['privet', 'spasibo', 'da', 'net', 'mir', 'gorod', 'kot', 'ryba', 'voda', 'sol', 'drug', 'nos'];

export const RU_CYRILLIC_PACK: ScriptPack = {
  id: 'ru-cyrillic',
  language: Language.Russian,
  name: '俄语西里尔 · 字母与拼写',
  description:
    '从拉丁转写主动写出西里尔字母与单词。覆盖 33 个字母与常见词。生成式练习——不显示答案，逼你产出，专治"认识俄文却写不出字母"。',
  groups: ['字母表', '常见词'],
  items: [
    ...build('字母表', ALPHABET),
    ...build('常见词', WORDS),
  ],
  transliterate: (input) => transliterateFromMap(input, RU_EXT),
};
