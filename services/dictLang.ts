/**
 * 词典语言层：语言码归一化、按文字系统的词形清洗、活用还原候选。
 *
 * 为什么要独立一层：
 *  - 全站「学习语言」用的是 types.ts 的 Language 枚举（'English' / 'Japanese' …），
 *    书库里存的是 ISO 码（'ja-JP' / 'es' …），词典包目录用的是短码（'en' / 'ja' …）。
 *    三种口径混着传，历史上就出现过「明明是英文词却查不到词典」的静默失败。
 *    这里统一收口到 DictLang，其它模块只管把原始值丢进来。
 *  - 英语的 a-z 清洗 / 复数后缀规则对日语、韩语完全不适用（会把整词洗成空串），
 *    所以按文字系统分开处理，并各自带一套活用还原规则。
 */
import { Language } from '../types';

export type DictLang = 'en' | 'ja' | 'ko' | 'es';

export interface DictLangMeta {
  lang: DictLang;
  /** 设置卡上的中文名 */
  label: string;
  /** 该语言的自称 */
  native: string;
  /** 释义语言（目前统一中文） */
  gloss: string;
  /** 一句话说明数据来源，设置卡展示 */
  source: string;
}

export const DICT_LANGS: DictLangMeta[] = [
  { lang: 'en', label: '英语', native: 'English', gloss: '中文', source: 'ECDICT（MIT）' },
  { lang: 'ja', label: '日语', native: '日本語', gloss: '中文', source: 'JMdict / jamdict-cn（CC BY-SA 4.0）' },
  { lang: 'ko', label: '韩语', native: '한국어', gloss: '中文', source: 'Open Yonsei Korean Vocabulary（CC BY-SA 3.0）' },
  { lang: 'es', label: '西班牙语', native: 'Español', gloss: '中文', source: 'WikDict / DBnary（CC BY-SA）' },
];

export const isDictLang = (v: unknown): v is DictLang =>
  v === 'en' || v === 'ja' || v === 'ko' || v === 'es';

const ALIASES: Record<string, DictLang> = {
  en: 'en', 'en-us': 'en', 'en-gb': 'en', english: 'en', 英语: 'en', 英文: 'en',
  ja: 'ja', 'ja-jp': 'ja', jp: 'ja', japanese: 'ja', 日本語: 'ja', 日语: 'ja', 日文: 'ja',
  ko: 'ko', 'ko-kr': 'ko', kr: 'ko', korean: 'ko', 한국어: 'ko', 韩语: 'ko', 韓語: 'ko', 韩文: 'ko',
  es: 'es', 'es-es': 'es', 'es-419': 'es', spanish: 'es', español: 'es', 西班牙语: 'es', 西語: 'es', 西语: 'es',
  // 其它 App 支持的语言暂时没有离线词库，保留映射但返回 null，避免误发请求
};

/** 把任意来源的语言标识收敛成词典短码；没有对应词库时返回 null。 */
export const normalizeDictLang = (raw?: string | null): DictLang | null => {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  // 兼容 'ja-JP' 这类只取前两位的 BCP-47 标签
  const head = key.split(/[-_]/)[0];
  return ALIASES[head] || null;
};

/** 词典短码 → App 的 Language 枚举（TTS 选音色用）。 */
export const dictLangToLanguage = (lang: DictLang): Language => {
  switch (lang) {
    case 'ja': return Language.Japanese;
    case 'ko': return Language.Korean;
    case 'es': return Language.Spanish;
    default: return Language.English;
  }
};

/** 按文字系统判断一段文本更像哪门语言（用于拉丁字母词回退到英语词典）。 */
export const detectDictLang = (raw: string): DictLang | null => {
  const s = (raw || '').trim();
  if (!s) return null;
  for (const ch of s) {
    const cp = ch.codePointAt(0) || 0;
    if (cp >= 0x3040 && cp <= 0x30ff) return 'ja';       // 假名
    if (cp >= 0xac00 && cp <= 0xd7a3) return 'ko';       // 谚文
    if (cp >= 0x4e00 && cp <= 0x9fff) return 'ja';       // 汉字：日语词优先（中文另有 TTS 处理）
  }
  return null;
};

const FOLD_ACCENTS = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * 按语言清洗词头。返回空串表示「这个词的文字系统跟词典不匹配」，调用方应直接跳过。
 * 注意：日语/韩语不能套用英语的 a-z 规则，否则整词会被洗掉。
 */
export const normalizeWord = (raw: string, lang: DictLang = 'en'): string => {
  const s = (raw || '').replace(/[’‘]/g, "'").trim().toLowerCase();
  if (!s) return '';
  if (lang === 'ja') {
    // 平假名 / 片假名 / 汉字 / 々 / 长音；纯拉丁词不属于日语词典
    const cleaned = s
      .replace(/^[^ぁ-んァ-ヶ一-龯々ー〇]+/u, '')
      .replace(/[^ぁ-んァ-ヶ一-龯々ー〇]+$/u, '');
    return /[ぁ-んァ-ヶ一-龯々ー]/u.test(cleaned) ? cleaned : '';
  }
  if (lang === 'ko') {
    const cleaned = s
      .replace(/^[^가-힣ㄱ-ㅎㅏ-ㅣ]+/u, '')
      .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]+$/u, '');
    return /[가-힣ㄱ-ㅎ]/u.test(cleaned) ? cleaned : '';
  }
  if (lang === 'es') {
    // 西班牙语重音字母是合法词头，保留 Unicode 字母
    return s.replace(/^[^\p{L}']+/u, '').replace(/[^\p{L}\-']+$/u, '').replace(/'/g, "'");
  }
  return s.replace(/^[^a-z]+/, '').replace(/[^a-z'-]+$/, '');
};

// ---------------------------------------------------------------- 英语 / 西语词形

const EN_SUFFIXES: Array<[RegExp, string[]]> = [
  [/ies$/, ['y']],
  [/ied$/, ['y']],
  [/ying$/, ['ie', 'y']],
  [/es$/, ['', 'e']],
  [/ed$/, ['', 'e']],
  [/ing$/, ['', 'e']],
  [/er$/, ['', 'e']],
  [/est$/, ['', 'e']],
  [/ly$/, ['', 'le']],
  [/s$/, ['']],
  [/d$/, ['']],
];

const ES_SUFFIXES: Array<[RegExp, string[]]> = [
  [/aciones$/, ['ación', 'ar']],
  [/imientos$/, ['imiento', 'ar']],
  [/mente$/, ['o', 'a', '']],
  [/iendo$/, ['ir', 'er', '']],
  [/ando$/, ['ar', '']],
  [/ados?$/, ['ar', 'ado', '']],
  [/idos?$/, ['er', 'ir', 'ido', '']],
  [/aron$/, ['ar']],
  [/ieron$/, ['ir', 'er']],
  [/aron$/, ['ar']],
  [/aba$/, ['ar']],
  [/ía$/, ['ir', 'er', 'ar']],
  [/es$/, ['', 'o', 'a']],
  [/s$/, ['']],
  [/o$/, ['a']],
  [/a$/, ['o']],
];

// ---------------------------------------------------------------- 日语活用还原
//
// 思路：不做完整形态分析，只做「候选生成」。对一个活用形，按后缀表剥掉词尾并
// 补回可能的基本形，再让词典去判断哪个候选真的存在。多生成几个不存在的词没有
// 副作用（一次 Map 查询而已），但能覆盖阅读里绝大多数动词/形容词变形。
const JP_ENDINGS: Array<[string, string[]]> = [
  // 一段动词（-る）与礼貌形
  ['ました', ['る', '']], ['ませんでした', ['る', '']], ['ません', ['る', '']],
  ['ます', ['る', '']], ['ない', ['る', '']], ['なかった', ['る', '']],
  ['たら', ['る', '']], ['たり', ['る', '']], ['たい', ['る']], ['たがる', ['る']],
  ['れば', ['る', '']], ['よう', ['る']], ['られる', ['る']], ['させる', ['る']],
  ['させられる', ['る']], ['られる', ['る']], ['てる', ['る']], ['てた', ['る']],
  ['ちゃう', ['る']], ['ちゃった', ['る']], ['なさい', ['る']], ['ろ', ['る']],
  ['ず', ['る', '']], ['ぬ', ['る']], ['ん', ['る']], ['そう', ['る', '']],
  ['ながら', ['る', '']], ['すぎる', ['る', '']], ['直す', ['']],
  // 过去 / て形 / 条件（五段也会命中，下面再补 u 行转换）
  ['ました', ['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る']],
  ['ました', []], ['た', ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む']],
  ['て', ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む']],
  ['で', ['ぐ', 'ぶ', 'ぬ', 'む']],
  ['った', ['る', 'う', 'つ']], ['いた', ['く', 'ぐ']], ['いた', ['く']],
  // 促音便：買って→買う / 待って→待つ / 乗って→乗る / 行って→行く（行く是不规则）
  ['って', ['う', 'つ', 'る', 'く', '']],
  ['った', ['う', 'つ', 'る', 'く', '']],
  ['んだ', ['ぬ', 'ぶ', 'む']], ['した', ['する']], ['して', ['する']],
  ['します', ['する']], ['しない', ['する']], ['される', ['する']],
  ['来た', ['来る']], ['きた', ['来る']], ['来ます', ['来る']], ['きます', ['来る']],
  ['来ない', ['来る']], ['こない', ['来る']],
  // い形容词
  ['くなかった', ['い']], ['かった', ['い']], ['くない', ['い']], ['くて', ['い']],
  ['く', ['い']], ['さ', ['い']], ['そう', ['い']], ['すぎる', ['い']],
  // な形容词 / 名词化
  ['な', ['']], ['の', ['']], ['に', ['']], ['だ', ['']], ['だった', ['']],
  ['ではない', ['']], ['じゃない', ['']], ['です', ['']], ['でした', ['']],
];

// 五十音的「い段 → う段」，用于把 読み / 書い 还原成 読む / 書く
const JP_I_TO_U: Record<string, string> = {
  い: 'う', き: 'く', し: 'す', ち: 'つ', に: 'ぬ', ひ: 'ふ', み: 'む', り: 'る',
  ぎ: 'ぐ', じ: 'ず', ぢ: 'づ', び: 'ぶ', ぴ: 'ぷ', ゐ: 'う',
  え: 'う', け: 'く', せ: 'す', て: 'つ', ね: 'ぬ', へ: 'ふ', め: 'む', れ: 'る',
  お: 'う', こ: 'く', そ: 'す', と: 'つ', の: 'ぬ', ほ: 'ふ', も: 'む', ろ: 'る',
};

// ---------------------------------------------------------------- 韩语词尾 / 助词

const KO_ENDINGS = [
  '았습니다', '었습니다', '했습니다', '습니다', 'ㅂ니다', '습니다',
  '았어요', '었어요', '해요', '어요', '아요', '여요', '예요', '이에요',
  '았다', '었다', '했다', '였다', '는다', '는다', '다',
  '고', '지만', '니까', '으니까', '면서', '며', '면', '으면', '어서', '아서', '서',
  '은', '는', '이', '가', '을', '를', '의', '에', '에게', '에서', '로', '으로',
  '와', '과', '도', '만', '까지', '부터', '께', '한테', '처럼', '보다', '밖에',
  '습니까', 'ㅂ니까', '세요', '으세요', '자', '을까', '려고', '려면',
  '히', '게', '운', '운', '적인', '적', '들', '님', '씨',
];

const latinCandidates = (word: string, lang: 'en' | 'es'): string[] => {
  const out = new Set<string>();
  const rules = lang === 'en' ? EN_SUFFIXES : ES_SUFFIXES;
  for (const [re, repls] of rules) {
    if (!re.test(word)) continue;
    const stem = word.replace(re, '');
    for (const r of repls) if (stem + r !== word) out.add(stem + r);
    if (lang === 'en' && /ing$|ed$|er$|est$/.test(word)) out.add(stem + stem.slice(-1)); // running → run
  }
  if (lang === 'es') {
    const folded = FOLD_ACCENTS(word);
    if (folded !== word) out.add(folded);
    // 反方向：用户写了不带重音的形式，词典里可能带重音
    out.add(folded.replace(/s$/, ''));
  }
  return [...out].filter((w) => w.length >= 2 && w !== word);
};

// 长后缀优先：`書いた` 应该先试 `いた→く`（得 書く），而不是先被短后缀 `た`
// 生成十几个无效候选把 alt 预算吃光。
const JP_ENDINGS_BY_SPECIFICITY = [...JP_ENDINGS].sort((a, b) => b[0].length - a[0].length);

const jaCandidates = (word: string): string[] => {
  const out = new Set<string>();
  for (const [suffix, repls] of JP_ENDINGS_BY_SPECIFICITY) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    if (!stem) continue;
    for (const r of repls) {
      const cand = stem + r;
      if (cand && cand !== word) out.add(cand);
    }
    // 五段：词干以い/え/お段假名结尾时，补一个う段基本形
    const last = stem.slice(-1);
    if (JP_I_TO_U[last]) out.add(stem.slice(0, -1) + JP_I_TO_U[last]);
    if (last === 'し' || last === 'ち' || last === 'い') out.add(stem.slice(0, -1) + 'る');
    out.add(stem); // 食べたり → 食べ → 食べる 之外，也试试词干本身
  }
  // 片假名 ↔ 平假名：外来语两种写法都可能进词典
  const kata = word.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const hira = word.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  if (kata !== word) out.add(kata);
  if (hira !== word) out.add(hira);
  // 促音 / 长音
  if (word.endsWith('ー')) out.add(word.slice(0, -1));
  return [...out].filter((w) => w.length >= 1 && w !== word).slice(0, 40);
};

const koCandidates = (word: string): string[] => {
  const out = new Set<string>();
  for (const suf of KO_ENDINGS) {
    if (!word.endsWith(suf) || word.length <= suf.length) continue;
    const stem = word.slice(0, -suf.length);
    out.add(stem);
    out.add(stem + '다');
    out.add(stem + '하다');
  }
  if (!word.endsWith('다')) out.add(word + '다');
  return [...out].filter((w) => w.length >= 1 && w !== word).slice(0, 30);
};

/** 生成可能的词典基本形；调用方按顺序查，命中即返回。 */
export const wordCandidates = (word: string, lang: DictLang): string[] => {
  switch (lang) {
    case 'ja': return jaCandidates(word);
    case 'ko': return koCandidates(word);
    case 'es': return latinCandidates(word, 'es');
    default: return latinCandidates(word, 'en');
  }
};
