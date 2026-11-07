// 「本书收藏的生词」索引：阅读时加进词库的词，同时按书记一条，供右栏「我的生词」跨天回看。
// 词库本身仍在 storageService（VocabularyItem），这里只是 书 → 词 的索引，不重复存释义以外的数据。

const STORAGE_KEY_BOOK_WORDS = 'linguaflow_book_words';
const MAX_PER_BOOK = 300;

export interface BookWord {
    word: string;
    meaning: string;
    addedAt: number;
}

type BookWordMap = Record<string, BookWord[]>;

const readAll = (): BookWordMap => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_BOOK_WORDS);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? (parsed as BookWordMap) : {};
    } catch {
        return {};
    }
};

const writeAll = (map: BookWordMap) => {
    try {
        localStorage.setItem(STORAGE_KEY_BOOK_WORDS, JSON.stringify(map));
    } catch {
        /* 配额满：忽略，下次再写 */
    }
};

export const getBookWords = (bookId: string): BookWord[] => {
    if (!bookId) return [];
    const list = readAll()[bookId];
    if (!Array.isArray(list)) return [];
    return list.filter((w) => w && typeof w.word === 'string' && w.word.trim());
};

/** 记录「这本书收藏了某个词」；同一个词只留一条（释义取最新） */
export const addBookWord = (bookId: string, word: string, meaning: string): BookWord[] => {
    const clean = word.trim();
    if (!bookId || !clean) return getBookWords(bookId);
    const all = readAll();
    const list = getBookWords(bookId);
    const idx = list.findIndex((w) => w.word.toLowerCase() === clean.toLowerCase());
    const entry: BookWord = { word: clean, meaning: (meaning || '').trim(), addedAt: Date.now() };
    const next = idx >= 0 ? list.map((w, i) => (i === idx ? entry : w)) : [...list, entry];
    all[bookId] = next.slice(-MAX_PER_BOOK);
    writeAll(all);
    return all[bookId];
};

export const removeBookWord = (bookId: string, word: string): BookWord[] => {
    const all = readAll();
    const next = getBookWords(bookId).filter((w) => w.word.toLowerCase() !== word.toLowerCase());
    all[bookId] = next;
    writeAll(all);
    return next;
};
