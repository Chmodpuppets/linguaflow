/**
 * 本地词典（离线查词）——代替「每个单词都问一次 AI」。
 *
 * 数据来源有两条路，优先级从高到低：
 *  1) 浏览器本地包：`/dict/<lang>/part-N.json.gz`（按语言分别生成，装进 IndexedDB 后可离线查词）。
 *  2) 服务器在线词典：`{SERVER_BASE}/dict/lookup?w=&lang=`（各语言全量 SQLite 索引）。
 * 两条都查不到才返回 null，由调用方决定要不要退回 AI。
 *
 * 设计约束：
 *  - 不引入依赖：IDB 手写、gzip 用浏览器原生 DecompressionStream。
 *  - 语言标识统一走 `dictLang.ts`：全站同时存在 Language 枚举、BCP-47、短码三种口径。
 *  - 词典安装是**静态资源下载**，不经过 AI 授权闸门，也不消耗任何模型额度。
 */

import { SERVER_BASE } from './serverBridge';
import {
  DictLang,
  DICT_LANGS,
  detectDictLang,
  isDictLang,
  normalizeDictLang,
  normalizeWord as normalizeWordForLang,
  wordCandidates,
} from './dictLang';

export { DICT_LANGS, normalizeDictLang, isDictLang } from './dictLang';
export type { DictLang, DictLangMeta } from './dictLang';

const DB_NAME = 'linguaflow_dict';
const STORE = 'packs';
const DB_VERSION = 1;

export interface DictEntry {
  /** 词条原形（查 abandoned 会返回 abandon） */
  word: string;
  phonetic: string;
  meaning: string;
  pos: string;
  source: 'local' | 'server';
}

export interface DictManifestPart {
  file: string;
  words: number;
  forms: number;
  bytes: number;
}

export interface DictManifest {
  lang: string;
  name: string;
  version: string;
  entries: number;
  forms: number;
  bytes: number;
  parts: DictManifestPart[];
  source?: string;
  license?: string;
}

export interface DictState {
  lang: DictLang;
  installed: boolean;
  version?: string;
  entries?: number;
  bytes?: number;
  name?: string;
  /** 正在下载 */
  installing: boolean;
  /** 0~1 */
  progress: number;
  error?: string;
}

type WordRow = [phonetic: string, meaning: string, pos: string, frq: number];

interface PackCache {
  lang: string;
  version: string;
  words: Map<string, WordRow>;
  forms: Map<string, string>;
}

const state: Record<string, DictState> = {};
const packCache = new Map<string, PackCache>();
const serverCache = new Map<string, DictEntry | null>();
const SERVER_CACHE_MAX = 800;

const emptyState = (lang: DictLang): DictState => ({
  lang,
  installed: false,
  installing: false,
  progress: 0,
});

const dictBase = (lang: string) => `/dict/${lang}`;

/** 静态资源地址：dev 由 vite public/ 提供，线上由 Caddy 从站点根目录提供 */
const assetUrl = (path: string) => path;

// ---------------------------------------------------------------- IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;
const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB，无法保存词典'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('打开 IndexedDB 失败'));
  });
  return dbPromise;
};

interface StoredPack {
  lang: string;
  version: string;
  manifest: DictManifest;
  parts: ArrayBuffer[];
  installedAt: number;
}

const idbGet = async (key: string): Promise<StoredPack | undefined> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as StoredPack | undefined);
    req.onerror = () => reject(req.error);
  });
};

const idbPut = async (key: string, value: StoredPack): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbDelete = async (key: string): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ---------------------------------------------------------------- 解压 / 解析

const gunzip = async (buf: ArrayBuffer): Promise<string> => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 gzip 解压（DecompressionStream），请升级浏览器');
  }
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
};

const buildCache = async (stored: StoredPack): Promise<PackCache> => {
  const words = new Map<string, WordRow>();
  const forms = new Map<string, string>();
  for (const part of stored.parts) {
    const text = await gunzip(part);
    const data = JSON.parse(text) as { w: Record<string, WordRow>; f: Record<string, string> };
    for (const [k, v] of Object.entries(data.w || {})) words.set(k, v);
    for (const [k, v] of Object.entries(data.f || {})) forms.set(k, v);
  }
  return { lang: stored.lang, version: stored.version, words, forms };
};

// ---------------------------------------------------------------- 安装

/** 防止语言码被拼进静态资源路径（来源可能是 localStorage / URL 参数）。 */
const checkedLang = (lang: DictLang): DictLang => {
  if (!isDictLang(lang)) throw new Error(`不支持的词典语言：${String(lang)}`);
  return lang;
};

export const fetchManifest = async (lang: DictLang = 'en'): Promise<DictManifest> => {
  const l = checkedLang(lang);
  const res = await fetch(assetUrl(`${dictBase(l)}/manifest.json`), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`词典清单下载失败（HTTP ${res.status}）`);
  return (await res.json()) as DictManifest;
};

const downloadPart = async (
  lang: DictLang,
  part: DictManifestPart,
  version: string,
  onChunk?: (loaded: number) => void
): Promise<ArrayBuffer> => {
  // 带版本号：词典更新后不会命中旧分片的浏览器缓存
  const res = await fetch(assetUrl(`${dictBase(lang)}/${part.file}?v=${encodeURIComponent(version)}`));
  if (!res.ok) throw new Error(`分片 ${part.file} 下载失败（HTTP ${res.status}）`);
  if (!res.body || !onChunk) return await res.arrayBuffer();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onChunk(loaded);
    }
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
};

/**
 * 下载并安装词典包。已装同一版本时直接返回（force=true 可强制更新）。
 * 只下载静态文件，不发任何 AI 请求。
 */
export const installDictionary = async (
  lang: DictLang = 'en',
  opts: { force?: boolean; onProgress?: (progress: number, state: DictState) => void } = {}
): Promise<DictState> => {
  checkedLang(lang);
  const current = { ...(state[lang] || emptyState(lang)), installing: true, progress: 0, error: undefined };
  state[lang] = current;
  opts.onProgress?.(0, current);

  try {
    const manifest = await fetchManifest(lang);
    const existing = await idbGet(lang).catch(() => undefined);
    if (!opts.force && existing && existing.version === manifest.version) {
      const done: DictState = {
        lang,
        installed: true,
        installing: false,
        progress: 1,
        version: existing.version,
        entries: manifest.entries,
        bytes: manifest.bytes,
        name: manifest.name,
      };
      state[lang] = done;
      opts.onProgress?.(1, done);
      return done;
    }

    const total = manifest.parts.reduce((sum, p) => sum + p.bytes, 0) || manifest.bytes || 1;
    let loaded = 0;
    const parts: ArrayBuffer[] = [];
    for (const part of manifest.parts) {
      const buf = await downloadPart(lang, part, manifest.version, (n) => {
        const p = Math.min(0.99, (loaded + n) / total);
        const s = { ...state[lang], progress: p };
        state[lang] = s;
        opts.onProgress?.(p, s);
      });
      parts.push(buf);
      loaded += part.bytes;
      const p = Math.min(0.99, loaded / total);
      state[lang] = { ...state[lang], progress: p };
      opts.onProgress?.(p, state[lang]);
    }

    const stored: StoredPack = {
      lang,
      version: manifest.version,
      manifest,
      parts,
      installedAt: Date.now(),
    };
    await idbPut(lang, stored);
    packCache.delete(lang);

    const done: DictState = {
      lang,
      installed: true,
      installing: false,
      progress: 1,
      version: manifest.version,
      entries: manifest.entries,
      bytes: manifest.bytes,
      name: manifest.name,
    };
    state[lang] = done;
    opts.onProgress?.(1, done);
    return done;
  } catch (e) {
    const failed: DictState = {
      ...(state[lang] || emptyState(lang)),
      installing: false,
      error: e instanceof Error ? e.message : String(e),
    };
    state[lang] = failed;
    return failed;
  }
};

export const uninstallDictionary = async (lang: DictLang = 'en'): Promise<DictState> => {
  await idbDelete(lang).catch(() => {});
  packCache.delete(lang);
  serverCache.clear();
  const next = emptyState(lang);
  state[lang] = next;
  return next;
};

/** 读取安装状态（不会触发下载，也不会把整包读进内存） */
export const getDictionaryState = async (lang: DictLang = 'en'): Promise<DictState> => {
  if (state[lang]?.installed || state[lang]?.installing) return state[lang];
  const stored = await idbGet(lang).catch(() => undefined);
  if (!stored) {
    state[lang] = emptyState(lang);
    return state[lang];
  }
  state[lang] = {
    lang,
    installed: true,
    installing: false,
    progress: 1,
    version: stored.version,
    entries: stored.manifest?.entries,
    bytes: stored.manifest?.bytes,
    name: stored.manifest?.name,
  };
  return state[lang];
};

/** 设置页一次拿到所有语言包的状态（只读，不触发下载）。 */
export const getAllDictionaryStates = async (): Promise<Record<DictLang, DictState>> => {
  const out = {} as Record<DictLang, DictState>;
  await Promise.all(DICT_LANGS.map(async ({ lang }) => {
    out[lang] = await getDictionaryState(lang);
  }));
  return out;
};

// ---------------------------------------------------------------- 查询

/**
 * 按语言清洗词头（兼容旧调用方）。英语之外的文字系统各有规则，详见 dictLang.ts。
 * 不传语言时按英语处理。
 */
export { normalizeWordForLang as normalizeWord };

const loadPack = async (lang: DictLang): Promise<PackCache | null> => {
  const cached = packCache.get(lang);
  if (cached) return cached;
  const stored = await idbGet(lang).catch(() => undefined);
  if (!stored) return null;
  const built = await buildCache(stored);
  packCache.set(lang, built);
  return built;
};

/** 释义里常带 "a. / vt. " 前缀，词性已经单独返回了，展示时去掉更干净 */
const POS_PREFIX = /^(n|v|vt|vi|a|adj|ad|adv|prep|conj|pron|num|int|art|aux|abbr)\.\s*/i;
const stripPosPrefix = (meaning: string): string => {
  const trimmed = meaning.replace(POS_PREFIX, '').trim();
  return trimmed || meaning;
};

const fromRow = (word: string, row: WordRow): DictEntry => ({
  word,
  phonetic: row[0] || '',
  meaning: stripPosPrefix(row[1] || ''),
  pos: row[2] || '',
  source: 'local',
});

const lookupLocal = async (word: string, lang: DictLang): Promise<DictEntry | null> => {
  const pack = await loadPack(lang);
  if (!pack) return null;

  const exact = pack.words.get(word);
  if (exact) return fromRow(word, exact);

  const lemma = pack.forms.get(word);
  if (lemma) {
    const row = pack.words.get(lemma);
    if (row) return fromRow(lemma, row);
  }

  for (const cand of wordCandidates(word, lang)) {
    const row = pack.words.get(cand);
    if (row) return fromRow(cand, row);
  }
  return null;
};

const lookupServer = async (word: string, lang: DictLang): Promise<DictEntry | null> => {
  if (!SERVER_BASE) return null;
  const key = `${lang}:${word}`;
  if (serverCache.has(key)) return serverCache.get(key) ?? null;
  try {
    // 把活用还原候选一并交给服务端：服务端只维护索引，不必再写一套日语/韩语形态规则。
    const alts = wordCandidates(word, lang).slice(0, 20).join(',');
    const qs = new URLSearchParams({ w: word, lang });
    if (alts) qs.set('alt', alts);
    const res = await fetch(
      `${SERVER_BASE}/dict/lookup?${qs.toString()}`,
      { signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(4500) : undefined }
    );
    if (!res.ok) {
      if (res.status === 404) {
        serverCache.set(key, null);
        return null;
      }
      return null;
    }
    const data = (await res.json()) as Partial<DictEntry> & { found?: boolean };
    if (!data || data.found === false || !data.meaning) return null;
    const entry: DictEntry = {
      word: data.word || word,
      phonetic: data.phonetic || '',
      meaning: stripPosPrefix(data.meaning || ''),
      pos: data.pos || '',
      source: 'server',
    };
    if (serverCache.size > SERVER_CACHE_MAX) serverCache.clear();
    serverCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
};

/** 单语言查询：本地包 → 服务器在线词典。词形还原规则由 dictLang.ts 按语言提供。 */
const lookupIn = async (word: string, lang: DictLang): Promise<DictEntry | null> => {
  const local = await lookupLocal(word, lang);
  if (local) return local;
  return await lookupServer(word, lang);
};

/**
 * 查词入口。`lang` 可以是 Language 枚举（'English'）、BCP-47（'ja-JP'）或短码（'ja'）。
 *
 * 回退顺序：目标语言 → 按文字系统推断的语言 → 拉丁字母词补查英语。
 * 最后一条是给「学日语的人在记英文单词」这类场景用的，也修掉了历史上
 * 「传 'English' 进来被当成非 'en' 直接 return null」的静默失败。
 */
export const lookupWord = async (raw: string, lang: string = 'en'): Promise<DictEntry | null> => {
  const primary = normalizeDictLang(lang);
  const guessed = detectDictLang(raw);
  const ordered: DictLang[] = [];
  for (const l of [primary, guessed, /^[\p{L}\s'-]+$/u.test((raw || '').trim()) ? 'en' as DictLang : null]) {
    if (l && !ordered.includes(l)) ordered.push(l);
  }
  for (const l of ordered) {
    const word = normalizeWordForLang(raw, l);
    if (!word || word.length > 40) continue;
    const hit = await lookupIn(word, l);
    if (hit) return hit;
  }
  return null;
};

/** 批量补释义：查到的写回 meaning / ipa / pos，查不到的保持原样 */
export const enrichWords = async <T extends { word: string; meaning?: string; ipa?: string; pos?: string }>(
  list: T[],
  lang: string = 'en'
): Promise<T[]> => {
  if (!list.length) return list;
  const out: T[] = [];
  let changed = false;
  for (const item of list) {
    if (item.meaning && item.meaning.trim()) {
      out.push(item);
      continue;
    }
    const hit = await lookupWord(item.word, lang);
    if (hit) {
      out.push({ ...item, meaning: hit.meaning, ipa: item.ipa || hit.phonetic, pos: item.pos || hit.pos });
      changed = true;
    } else {
      out.push(item);
    }
  }
  return changed ? out : list;
};

/**
 * 线上版首次打开时静默预装英语词典（约 1.9MB，一次性）。
 * 其它语言不预装 —— 首次进站不该一口气下 4 个包，交给用户在设置页按需下载。
 * 已装同版本会直接命中缓存，不重复下载；失败不影响任何功能。
 */
export const preinstallForEdition = (): void => {
  const edition = (process.env.APP_EDITION || 'oss') === 'online' ? 'online' : 'oss';
  if (edition !== 'online') return;
  const run = () => {
    void getDictionaryState('en')
      .then((s) => (s.installed || s.installing ? s : installDictionary('en')))
      .catch(() => {});
  };
  if (typeof window === 'undefined') return;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 3000);
};
