/**
 * TTS 音频持久化缓存（IndexedDB，存 Blob 本身）。
 *
 * 与 `ttsCache.ts`（内存 URL 缓存）的分工：
 * - ttsCache：会话内最快，存 Qwen 返回的 URL / data: / object: URL，16 条 LRU。
 * - ttsBlobCache：跨会话，把音频**内容**存成 Blob，永不过期、无预签名 URL 失效问题。
 *   刷新页面后第一次点同一个词即可命中，0 次 Qwen 调用。
 *
 * 设计要点：
 * - 所有 API 都吞掉异常并返回空值：IndexedDB 被禁用 / 隐私模式 / 配额满时，
 *   自动退回 ttsCache 的内存缓存，绝不阻断播放。
 * - 配额：最多 200 条 / 20MB，超出按创建时间删最旧。
 * - object URL 按 key 复用（每个条目最多一个），避免每次命中都 createObjectURL 造成泄漏；
 *   清缓存时统一 revoke。
 */
const DB_NAME = 'linguaflow-tts';
const STORE = 'audio';
const DB_VERSION = 1;
const MAX_ENTRIES = 200;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SINGLE_BLOB = 2 * 1024 * 1024;

interface TtsBlobRecord {
  key: string;
  blob?: Blob;          // 能抓到音频内容时存 Blob（永不过期）
  url?: string;         // 抓不到时（CDN 无 CORS）退存 URL + expiresAt
  expiresAt?: number;   // 毫秒时间戳；来自 Qwen output.audio.expires_at，留 10 分钟安全余量
  size: number;
  createdAt: number;
  lastUsed: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
const objectUrls = new Map<string, string>();

/** 生成与 ttsCache 相同的键，保证两层缓存、删除失效条目时对得上 */
export const ttsBlobKey = (text: string, voice?: string): string => `${voice || ''}||${text}`;

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
};

const reqToPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const getTtsBlob = async (key: string): Promise<Blob | null> => {
  try {
    const db = await openDb();
    if (!db) return null;
    const rec = await reqToPromise<TtsBlobRecord | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    );
    if (!rec?.blob) return null;
    // 更新 lastUsed（不阻断命中）
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const fresh = await reqToPromise<TtsBlobRecord | undefined>(store.get(key));
      if (fresh) store.put({ ...fresh, lastUsed: Date.now() });
    } catch { /* 只读场景更新失败无所谓 */ }
    return rec.blob;
  } catch { return null; }
};

export const putTtsBlob = async (key: string, blob: Blob): Promise<boolean> => {
  try {
    if (!blob || blob.size === 0 || blob.size > MAX_SINGLE_BLOB) return false;
    const db = await openDb();
    if (!db) return false;
    const now = Date.now();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ key, blob, size: blob.size, createdAt: now, lastUsed: now } as TtsBlobRecord);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
    await trim(db);
    return true;
  } catch { return false; }
};

export const deleteTtsBlob = async (key: string): Promise<void> => {
  releaseObjectUrl(key);
  try {
    const db = await openDb();
    if (!db) return;
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
  } catch { /* ignore */ }
};

export const clearTtsBlobCache = async (): Promise<void> => {
  objectUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
  objectUrls.clear();
  try {
    const db = await openDb();
    if (!db) return;
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch { /* ignore */ }
};

/** 抓不到 Blob 时（Qwen OSS CDN 不返回 CORS 头）退而存 URL + 精确过期时间。 */
export const putTtsUrl = async (key: string, url: string, expiresAt?: number): Promise<boolean> => {
  try {
    if (!url || !/^https?:\/\//.test(url)) return false;
    const db = await openDb();
    if (!db) return false;
    const now = Date.now();
    const rec: TtsBlobRecord = { key, url, expiresAt, size: 0, createdAt: now, lastUsed: now };
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
    await trim(db);
    return true;
  } catch { return false; }
};

/** 读持久化的 URL；已过期自动删条目并返回 null，让调用方重新合成。 */
export const getTtsUrl = async (key: string): Promise<string | null> => {
  try {
    const db = await openDb();
    if (!db) return null;
    const rec = await reqToPromise<TtsBlobRecord | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    );
    if (!rec?.url) return null;
    if (rec.expiresAt && Date.now() >= rec.expiresAt) {
      await deleteTtsBlob(key);
      return null;
    }
    return rec.url;
  } catch { return null; }
};

/** 命中持久化 Blob 时生成可播放的 object: URL；同一 key 复用同一个，避免泄漏 */
export const ttsBlobToObjectUrl = (key: string, blob: Blob): string | null => {
  try {
    const existing = objectUrls.get(key);
    if (existing) return existing;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
    return url;
  } catch { return null; }
};

const releaseObjectUrl = (key: string): void => {
  const u = objectUrls.get(key);
  if (u) {
    try { URL.revokeObjectURL(u); } catch {}
    objectUrls.delete(key);
  }
};

/** 配额清理：超条数或超总大小时，按创建时间删最旧 */
const trim = async (db: IDBDatabase): Promise<void> => {
  try {
    const all = await reqToPromise<TtsBlobRecord[]>(
      db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    );
    let count = all.length;
    let bytes = all.reduce((s, r) => s + (r.size || 0), 0);
    if (count <= MAX_ENTRIES && bytes <= MAX_BYTES) return;
    all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const r of all) {
      if (count <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
      store.delete(r.key);
      releaseObjectUrl(r.key);
      count--;
      bytes -= r.size || 0;
    }
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch { /* 清理失败不影响本次写入 */ }
};

/** 缓存统计（排障 / QA 用） */
export const getTtsBlobStats = async (): Promise<{ count: number; bytes: number }> => {
  try {
    const db = await openDb();
    if (!db) return { count: 0, bytes: 0 };
    const all = await reqToPromise<TtsBlobRecord[]>(
      db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    );
    return { count: all.length, bytes: all.reduce((s, r) => s + (r.size || 0), 0) };
  } catch { return { count: 0, bytes: 0 }; }
};
