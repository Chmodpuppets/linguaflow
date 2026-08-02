import { ScriptPack, ScriptItem, Language } from '../types';
import { romajiToKana } from '../services/romajiKana';

// 日语五十音基础（罗马字表记，覆盖 46 个基础音）
const BASIC_ROMAJI = [
  'a', 'i', 'u', 'e', 'o',
  'ka', 'ki', 'ku', 'ke', 'ko',
  'sa', 'shi', 'su', 'se', 'so',
  'ta', 'chi', 'tsu', 'te', 'to',
  'na', 'ni', 'nu', 'ne', 'no',
  'ha', 'hi', 'fu', 'he', 'ho',
  'ma', 'mi', 'mu', 'me', 'mo',
  'ya', 'yu', 'yo',
  'ra', 'ri', 'ru', 're', 'ro',
  'wa', 'wo', 'n',
];

// 拗音（yōon）：き/し/ち/に/ひ/み/り 行 + 小やゆよ
const YOON_ROMAJI = [
  'kya', 'kyu', 'kyo',
  'sha', 'shu', 'sho',
  'cha', 'chu', 'cho',
  'nya', 'nyu', 'nyo',
  'hya', 'hyu', 'hyo',
  'mya', 'myu', 'myo',
  'rya', 'ryu', 'ryo',
];

// 浊音 / 半浊音（dakuon / handakuon）
const DAKUON_ROMAJI = [
  'ga', 'gi', 'gu', 'ge', 'go',
  'za', 'ji', 'zu', 'ze', 'zo',
  'da', 'di', 'du', 'de', 'do',
  'ba', 'bi', 'bu', 'be', 'bo',
  'pa', 'pi', 'pu', 'pe', 'po',
];

// 用转换器生成字形，保证 romaji→kana 与答案完全一致（无手写错误）
const build = (
  group: string,
  romajiList: string[],
  target: 'hiragana' | 'katakana'
): ScriptItem[] =>
  romajiList.map((r) => {
    const answer = romajiToKana(r, target === 'katakana');
    return {
      id: `${group}-${r}`,
      group,
      prompt: r,
      answer,
      romaji: r,
      targetScript: target,
      audioText: answer,
    };
  });

export const JA_KANA_PACK: ScriptPack = {
  id: 'ja-kana',
  language: Language.Japanese,
  name: '日语五十音 · 拗音 · 浊音',
  description:
    '从罗马字或听音主动写出假名。覆盖平假名、片假名、拗音（きゃ等）与浊音（が等）。生成式练习——不显示答案，逼你从记忆里产出，专治"看得懂却打不出"。',
  groups: [
    '平假名',
    '片假名',
    '拗音（平假名）',
    '拗音（片假名）',
    '浊音（平假名）',
    '浊音（片假名）',
  ],
  items: [
    ...build('平假名', BASIC_ROMAJI, 'hiragana'),
    ...build('片假名', BASIC_ROMAJI, 'katakana'),
    ...build('拗音（平假名）', YOON_ROMAJI, 'hiragana'),
    ...build('拗音（片假名）', YOON_ROMAJI, 'katakana'),
    ...build('浊音（平假名）', DAKUON_ROMAJI, 'hiragana'),
    ...build('浊音（片假名）', DAKUON_ROMAJI, 'katakana'),
  ],
};

// 已上线的字形包（按语言检索）；后续新增语言在此追加
export const SCRIPT_PACKS: ScriptPack[] = [JA_KANA_PACK];

export const getScriptPackForLanguage = (lang: Language): ScriptPack | null =>
  SCRIPT_PACKS.find((p) => p.language === lang) ?? null;
