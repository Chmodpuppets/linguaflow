/**
 * 历史词条「读时修复」：把词典上线前存进去、definition / partOfSpeech 为空的词条补上释义。
 *
 * 为什么需要它：
 *  词典只在「新增单词 → 自动填充」和「阅读划词 → 加入词库」两条写入路径上生效，
 *  不会回头改老数据。用户词库里那些早期词条就会一直显示空白 + 「词性」占位。
 *
 * 设计约束（和项目里 idRepair.ts 同一套惯例）：
 *  - 幂等：只补空字段，已有内容一律保留；没有待补词条时返回同一引用、零写入。
 *  - 零 AI：只走 lookupWord（本地包 → 服务器词典 → null），不触发 aiConsent 闸门、不花额度。
 *  - 有界：单次最多处理 MAX_AUTO 条、并发上限 CONCURRENCY，避免词库很大时进页面打几百个请求。
 *  - 词典查不到的词记进会话级 notFound，下次不再重试（force 可强制重试）。
 */
import type { VocabularyItem } from '../types';
import { lookupWord } from './dictionary';
import { updateVocabularyItems } from './storageService';

export const MAX_AUTO_REPAIR = 40;
const CONCURRENCY = 4;

const notFound = new Set<string>();
const cacheKey = (lang: string, word: string) => `${lang}:${word.trim().toLowerCase()}`;

export const isIncompleteVocab = (item: VocabularyItem): boolean =>
  !item.definition?.trim() || !item.partOfSpeech?.trim();

/** 当前列表里还缺释义 / 词性的条数（给设置按钮用）。 */
export const countIncompleteVocab = (list: VocabularyItem[]): number =>
  list.reduce((n, i) => n + (isIncompleteVocab(i) ? 1 : 0), 0);

export interface RepairResult {
  scanned: number;
  attempted: number;
  fixed: number;
  /** 词典里也没查到，仍为空白 */
  missing: number;
  /** 修复后的列表；没有变化时就是传入的同一个引用 */
  items: VocabularyItem[];
}

/**
 * 批量补释义。写回是一次 localStorage 全量替换（updateVocabularyItems），
 * 不是逐条 updateVocabularyItem —— 后者会让 40 条变成 40 次全量序列化。
 */
export const repairVocabulary = async (
  list: VocabularyItem[],
  lang: string,
  opts: { max?: number; force?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<RepairResult> => {
  if (!list.length) return { scanned: 0, attempted: 0, fixed: 0, missing: 0, items: list };

  const max = opts.max ?? MAX_AUTO_REPAIR;
  const pending = list
    .filter(isIncompleteVocab)
    .filter((i) => opts.force || !notFound.has(cacheKey(lang, i.word)))
    .slice(0, max);

  if (!pending.length) {
    return { scanned: list.length, attempted: 0, fixed: 0, missing: 0, items: list };
  }

  const updated = new Map<string, VocabularyItem>();
  let done = 0;
  let cursor = 0;
  const total = pending.length;

  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= total) return;
      const item = pending[idx];
      try {
        const hit = await lookupWord(item.word, lang);
        if (hit) {
          updated.set(item.id, {
            ...item,
            definition: item.definition?.trim() ? item.definition : hit.meaning,
            partOfSpeech: item.partOfSpeech?.trim() ? item.partOfSpeech : hit.pos,
          });
          notFound.delete(cacheKey(lang, item.word));
        } else {
          notFound.add(cacheKey(lang, item.word));
        }
      } catch {
        // 词典失败不能影响词库本身；当次跳过，不记 notFound，下次还能重试
      }
      done += 1;
      opts.onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));

  const fixes = [...updated.values()];
  if (!fixes.length) {
    return { scanned: list.length, attempted: total, fixed: 0, missing: total, items: list };
  }
  const written = updateVocabularyItems(fixes);
  if (!written) {
    return { scanned: list.length, attempted: total, fixed: 0, missing: total, items: list };
  }
  const items = list.map((i) => updated.get(i.id) || i);
  return { scanned: list.length, attempted: total, fixed: written, missing: total - written, items };
};

/** 手动重试时清掉「查不到」的缓存。 */
export const clearVocabRepairMisses = (): void => notFound.clear();
