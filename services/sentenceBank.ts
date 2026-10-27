// 句子库：阅读时划选一句就存下来，供右侧「我的收藏」与后续复习使用。
// 存 localStorage（与词库一致），按书 + 语言过滤，最多保留 500 条。

import { Language } from '../types';
import { uuid } from '../utils/uuid';
import { repairIds } from '../utils/idRepair';

export interface SentenceItem {
  id: string;
  text: string;
  language: Language;
  /** 来源书（可选） */
  bookId?: string;
  bookTitle?: string;
  /** 来源页（0-based） */
  page?: number;
  createdAt: number;
}

const STORAGE_KEY_SENTENCE_BANK = 'linguaflow_sentence_bank';
const MAX_SENTENCES = 500;

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

export const getSentences = (filter?: { bookId?: string; language?: Language }): SentenceItem[] => {
    let all: SentenceItem[] = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY_SENTENCE_BANK);
        const parsed = raw ? JSON.parse(raw) : [];
        // 先剔除非对象脏数据，再修历史脏 id（早期 uuid 会重复，按 id 删除会误删）
        all = Array.isArray(parsed) ? parsed.filter((s: unknown) => s && typeof s === 'object') : [];
    } catch {
        all = [];
    }
    const repaired = repairIds(all);
    if (repaired.changed) {
        try {
            localStorage.setItem(STORAGE_KEY_SENTENCE_BANK, JSON.stringify(repaired.list));
        } catch {
            /* 配额满：忽略 */
        }
        all = repaired.list;
    }
    let out = all.filter((s) => s && typeof s.text === 'string' && s.text.trim());
    if (filter?.bookId) out = out.filter((s) => s.bookId === filter.bookId);
    if (filter?.language) out = out.filter((s) => s.language === filter.language);
    return out.sort((a, b) => b.createdAt - a.createdAt);
};

/** 收藏一句；重复（忽略大小写/空白）直接返回原列表 */
export const saveSentence = (item: Omit<SentenceItem, 'id' | 'createdAt'>): SentenceItem[] => {
    const text = normalize(item.text);
    if (!text) return getSentences();
    const existing = getSentences();
    const key = text.toLowerCase();
    if (existing.some((s) => normalize(s.text).toLowerCase() === key)) {
        return existing;
    }
    const entry: SentenceItem = { ...item, text, id: uuid(), createdAt: Date.now() };
    const next = [entry, ...existing].slice(0, MAX_SENTENCES);
    try {
        localStorage.setItem(STORAGE_KEY_SENTENCE_BANK, JSON.stringify(next));
    } catch {
        /* 配额满：保留内存态，下一次再写 */
    }
    return next;
};

export const deleteSentence = (id: string): SentenceItem[] => {
    const next = getSentences().filter((s) => s.id !== id);
    try {
        localStorage.setItem(STORAGE_KEY_SENTENCE_BANK, JSON.stringify(next));
    } catch {
        /* ignore */
    }
    return next;
};
