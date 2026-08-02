import { ScriptPack, ScriptItem, Language } from '../types';

// 阿拉伯语 28 个基础字母（按标准 abjad 顺序）。
// answer 一律用「基础形态」Unicode 码位（孤立形式）：浏览器在渲染时会自动应用
// 上下文连写形态，而我们存储/比对的始终是基础码位，因此键盘点按与答案校验完全一致，
// 不需要自己实现阿拉伯连写（shaping）算法。
// prompt 用标准拉丁转写（无歧义线索）：重音字母用 ḥ ṣ ṭ ẓ ḍ ʿ 等区分，避免与轻音字母混淆。
const AR_ABJAD: [string, string][] = [
  ['a', 'ا'],   // alif
  ['b', 'ب'],   // baa
  ['t', 'ت'],   // taa（轻）
  ['th', 'ث'],  // thaa
  ['j', 'ج'],   // jeem
  ['ḥ', 'ح'],   // ḥaa
  ['kh', 'خ'],  // khaa
  ['d', 'د'],   // daar
  ['dh', 'ذ'],  // dhaal
  ['r', 'ر'],   // raa
  ['z', 'ز'],   // zay
  ['s', 'س'],   // seen
  ['sh', 'ش'],  // sheen
  ['ṣ', 'ص'],   // ṣaad
  ['ḍ', 'ض'],   // ḍaad
  ['ṭ', 'ط'],   // ṭaa（重）
  ['ẓ', 'ظ'],   // ẓaa
  ['ʿ', 'ع'],   // ayn
  ['gh', 'غ'],  // ghayn
  ['f', 'ف'],   // faa
  ['q', 'ق'],   // qaaf
  ['k', 'ك'],   // kaaf
  ['l', 'ل'],   // laam
  ['m', 'م'],   // meem
  ['n', 'ن'],   // noon
  ['h', 'ه'],   // haa（轻）
  ['w', 'و'],   // waaw
  ['y', 'ي'],   // yaa
];

const build = (group: string, rows: [string, string][]): ScriptItem[] =>
  rows.map(([prompt, answer]) => ({
    id: `${group}-${prompt}`,
    group,
    prompt,
    answer,
    audioText: answer,
  }));

export const AR_ABJAD_PACK: ScriptPack = {
  id: 'ar-abjad',
  language: Language.Arabic,
  name: '阿拉伯语 · 字母表',
  description:
    '从标准拉丁转写或听音主动点按写出阿拉伯字母。覆盖 28 个基础字母。生成式练习——不显示字形答案，逼你从记忆里产出，专治阿拉伯文"认得出却写不出、连写看不懂"。',
  groups: ['字母表'],
  items: build('字母表', AR_ABJAD),
  // 无 transliterate：阿拉伯连写复杂，走虚拟键盘点按（浏览器自动连写渲染，比对用基础码位）
};
