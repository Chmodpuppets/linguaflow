import { ScriptPack, ScriptItem, Language } from '../types';
import { EL_MAP, transliterateFromMap } from '../services/scriptTransliterate';

// 希腊语：拉丁转写 → 希腊字母（二义的 η/υ 留作虚拟键盘练习，不强行拉丁映射）
const build = (group: string, latinList: string[]): ScriptItem[] =>
  latinList.map((l) => {
    const answer = transliterateFromMap(l, EL_MAP);
    return {
      id: `el-${group}-${l}`,
      group,
      prompt: l,
      answer,
      romaji: l,
      audioText: answer,
    };
  });

// 22 个有明确单字符拉丁映射的字母（排除 η/υ 的二义）
const ALPHABET = [
  'a', 'v', 'g', 'd', 'e', 'z', 'th', 'i', 'k', 'l', 'm', 'n',
  'ks', 'o', 'p', 'r', 's', 't', 'f', 'ch', 'ps', 'w',
];

// 常见词：练整词拼写产出
const WORDS = ['ellas', 'philos', 'theos', 'kosmos', 'polis', 'gramma', 'historia', 'anthropo'];

export const EL_GREEK_PACK: ScriptPack = {
  id: 'el-greek',
  language: Language.Greek,
  name: '希腊语 · 字母与拼写',
  description:
    '从拉丁转写主动写出希腊字母与单词。覆盖 22 个清晰字母与常见词（η/υ 因拉丁二义，建议用虚拟键盘点按）。生成式练习——不显示答案，逼你产出。',
  groups: ['字母表', '常见词'],
  items: [
    ...build('字母表', ALPHABET),
    ...build('常见词', WORDS),
  ],
  transliterate: (input) => {
    // 希腊 sigma 词尾正字法：词尾的 σ 写作 ς
    const r = transliterateFromMap(input, EL_MAP);
    return r.replace(/σ$/, 'ς');
  },
};
