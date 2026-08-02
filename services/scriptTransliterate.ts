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
// 下方 *_R 罗马字表与 jamo 表严格同序，因此可直接用 indexOf 取组合 index。
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const CHO_R = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', 'ng', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG_R = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG_R = ['', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];

function matchLongest(s: string, table: string[]): string | null {
  const sorted = [...table].sort((a, b) => b.length - a.length);
  for (const r of sorted) if (s.startsWith(r)) return r;
  return null;
}

function parseSyllable(roman: string): string | null {
  let s = roman.toLowerCase();
  let cho = 11; // 默认 ㅇ（元音可独立成音节）
  const choM = matchLongest(s, CHO_R);
  if (choM) { cho = CHO_R.indexOf(choM); s = s.slice(choM.length); }
  const jungM = matchLongest(s, JUNG_R);
  if (!jungM) return null;
  const jung = JUNG_R.indexOf(jungM);
  s = s.slice(jungM.length);
  let jong = 0;
  if (s.length > 0) {
    const jongM = matchLongest(s, JONG_R);
    if (jongM) jong = JONG_R.indexOf(jongM);
  }
  const code = 0xac00 + (cho * 21 + jung) * 28 + jong;
  return String.fromCharCode(code);
}

/** 把一个韩文罗马字词（可多音节，无空格）解析为 Hangul 音节串。无法解析的字符原样保留。 */
export function hangulFromRoman(input: string): string {
  const lower = input.toLowerCase().replace(/\s+/g, '');
  let out = '';
  let i = 0;
  while (i < lower.length) {
    let matched: string | null = null;
    for (let len = Math.min(8, lower.length - i); len >= 1; len--) {
      const syl = parseSyllable(lower.slice(i, i + len));
      if (syl) { matched = syl; i += len; break; }
    }
    if (matched) out += matched;
    else { out += lower[i]; i += 1; }
  }
  return out;
}
