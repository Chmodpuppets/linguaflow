// 跨语言「拉丁/罗马字输入 → 目标字形」转写工具。
// 字形特训的生成式闭环依赖它：用户打拉丁字母 → 转成目标字形 → 与答案比对。
// 每种语言一个映射/算法，纯前端、无后端。

/**
 * 通用查表转写：按 key 长度降序做最长匹配，逐字符替换。
 * map 的 key 是拉丁片段（可多字符，如 'ch'），value 是目标字形或字形串。
 * 未命中的字符原样保留（便于混合输入）。
 */
export function transliterateFromMap(input: string, map: Record<string, string>): string {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const lower = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    for (const k of keys) {
      if (lower.startsWith(k, i)) {
        out += map[k];
        i += k.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += lower[i];
      i += 1;
    }
  }
  return out;
}

// ---- 俄语西里尔转写（常见 transliteration，多字符优先）----
export const RU_MAP: Record<string, string> = {
  sch: 'щ', sh: 'ш', ch: 'ч', zh: 'ж', yu: 'ю', ya: 'я', yo: 'ё', kh: 'х',
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', j: 'й',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т',
  u: 'у', f: 'ф', c: 'ц', y: 'ы', h: 'х', w: 'в', x: 'кс', q: 'кв', "'": 'ъ',
};

// ---- 希腊字母转写 ----
export const EL_MAP: Record<string, string> = {
  th: 'θ', ch: 'χ', ps: 'ψ', ph: 'φ', ks: 'ξ',
  a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', i: 'ι', k: 'κ', l: 'λ',
  m: 'μ', n: 'ν', o: 'ο', p: 'π', r: 'ρ', s: 'σ', t: 'τ', y: 'υ', f: 'φ', x: 'χ', w: 'ω',
};

// ---- 韩语 Hangul 组合（revised romanization 反向解析 → 音节块）----
// 支持多音节整词连写：按"初声 + 中声 + 韵尾"逐音节切分，应用修订罗马字音节边界规则。
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 音节首初声：罗马字 → CHO 下标（'ng' 不作初声）
const INITIAL: Record<string, number> = {
  g: 0, k: 15, kk: 1, n: 2, d: 3, t: 16, tt: 4, r: 5, l: 5, m: 6,
  b: 7, p: 17, pp: 8, s: 9, ss: 10, j: 12, jj: 13, ch: 14, h: 18,
};
// 中声：先匹配三字母组合，再两字母，最后单字母
const VOWEL3: Record<string, number> = { yae: 3, yeo: 6, wae: 10 };
const VOWEL2: Record<string, number> = {
  ya: 2, ye: 7, yo: 12, yu: 17, wa: 9, wo: 13, we: 14, wi: 15,
  ui: 19, eo: 4, eu: 18, oe: 11, ae: 1,
};
const VOWEL1: Record<string, number> = { a: 0, e: 5, i: 20, o: 8, u: 13 };
// 终声（韵尾）：罗马字 → JONG 下标。仅覆盖单字母 + 'ng'，双收音复合（ㄳ 等）暂不处理
const BATCHIM: Record<string, number> = { k: 1, t: 7, p: 17, m: 16, n: 4, l: 8, ng: 21, h: 27 };

// k/t/p 既是 ㄱ/ㄷ/ㅂ 的韵尾拼写，也是 ㅋ/ㅌ/ㅍ 的初声拼写。
// 修订罗马字约定：元音后的 k/t/p 一律作韵尾（ㄱ/ㄷ/ㅂ），以匹配"국어=gugeo"等常见词。
const BATCHIM_ALWAYS = new Set(['k', 't', 'p']);

function isVowelStart(s: string, i: number): boolean {
  if (i >= s.length) return false;
  return (
    VOWEL3[s.slice(i, i + 3)] !== undefined ||
    VOWEL2[s.slice(i, i + 2)] !== undefined ||
    VOWEL1[s[i]] !== undefined
  );
}

// 从 s[start] 起解析恰好一个 Hangul 音节；返回 {音节, 消耗长度}，无法解析返回 null。
function takeSyllable(s: string, start: number): { syl: string; len: number } | null {
  let i = start;
  let cho = 11; // ㅇ（元音可独立成音节，初声为空）
  const two = s.slice(i, i + 2);
  if (INITIAL[two] !== undefined) { cho = INITIAL[two]; i += 2; }
  else if (INITIAL[s[i]] !== undefined) { cho = INITIAL[s[i]]; i += 1; }

  let jung = -1;
  if (i < s.length) {
    if (VOWEL3[s.slice(i, i + 3)] !== undefined) { jung = VOWEL3[s.slice(i, i + 3)]; i += 3; }
    else if (VOWEL2[s.slice(i, i + 2)] !== undefined) { jung = VOWEL2[s.slice(i, i + 2)]; i += 2; }
    else if (VOWEL1[s[i]] !== undefined) { jung = VOWEL1[s[i]]; i += 1; }
  }
  if (jung < 0) return null;

  let jong = 0;
  if (i < s.length) {
    const c = s[i];
    if (c === 'n' && s[i + 1] === 'g') {
      // 'ng' 的归属：后接元音 → 'n' 作韵尾、'g' 作下一音节初声（한글=hangeul）；
      // 后接辅音或词尾 → 'ng' 整段作 ㅇ 韵尾（상민=sangmin、방=bang）。
      const afterNg = s[i + 2];
      const afterIsVowel = afterNg !== undefined && isVowelStart(s, i + 2);
      if (afterIsVowel) { jong = BATCHIM.n; i += 1; }
      else { jong = BATCHIM.ng; i += 2; }
    } else {
      // 看候选辅音"之后"的字符是否以元音开头：若是，则该辅音实为下一音节初声（无韵尾）。
      const vowelAfter = isVowelStart(s, i + 1);
      const canBatchim = c in BATCHIM;
      if (!vowelAfter && canBatchim) { jong = BATCHIM[c]; i += 1; }
      else if (vowelAfter && BATCHIM_ALWAYS.has(c) && canBatchim) { jong = BATCHIM[c]; i += 1; }
      // 其余情况：该辅音是下一音节的初声，本音节无韵尾
    }
  }

  const code = 0xac00 + (cho * 21 + jung) * 28 + jong;
  return { syl: String.fromCharCode(code), len: i - start };
}

/** 把一个韩文罗马字词（可多音节，无空格）解析为 Hangul 音节串。无法解析的字符原样保留。 */
export function hangulFromRoman(input: string): string {
  const s = input.toLowerCase().replace(/\s+/g, '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const r = takeSyllable(s, i);
    if (r) { out += r.syl; i += r.len; }
    else { out += s[i]; i += 1; }
  }
  return out;
}
