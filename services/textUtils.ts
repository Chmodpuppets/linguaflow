import { Language } from '../types';

// CJK 语言：日/中/韩——无空格分词，按字符数统计
const CJK_LANGS = new Set<Language>([Language.Japanese, Language.Chinese, Language.Korean]);

export function isCJK(lang: Language): boolean {
  return CJK_LANGS.has(lang);
}

/**
 * 统计"词/字"数，用于写作 XP 与字数显示。
 * - CJK 语言（日/中/韩）：去除空白后的字符数（标点计入，因为假名/汉字标点也是产出）。
 *   修复旧实现 `split(/\s+/)` 对日语恒为 1、导致写作树 XP（wordDiff>20）永远发不出的 bug。
 * - 拉丁语言：按空格分词。
 */
export function countWords(text: string, lang: Language): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  if (isCJK(lang)) {
    return trimmed.replace(/\s+/g, '').length;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}
