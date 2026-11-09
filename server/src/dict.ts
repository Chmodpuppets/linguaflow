/**
 * 在线词典（只读）：`GET /dict/lookup?w=abandon`
 *
 * 数据：`<DATA_DIR>/dict/en.db` —— 由 `scripts/build-dict-db.mjs` 从 ECDICT（MIT）生成，
 * 约 40 万英语单词 + 词形变化表，SQLite 主键索引，单次查询 < 1ms。
 *
 * 为什么要它：阅读时「每个单词都问一次大模型」又慢又费钱。装上这个库以后，
 * 常用词走前端离线包（/dict/en/*.json.gz），生僻词和变形词落到这里，
 * 只有词典真查不到时才需要 AI。
 *
 * 该接口**不需要登录**（查词是只读公开数据），但按 IP 限流防止被刷。
 * 文件缺失时返回 503，不影响其它接口。
 */
import type { Hono } from 'hono';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import Database from 'better-sqlite3';

interface DictRow {
  word: string;
  ph: string;
  mean: string;
  pos: string;
}

const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
const DB_PATH = join(dataDir, 'dict', 'en.db');

let db: Database.Database | null = null;
let openFailed = false;
let cachedCount = -1;

const openDb = (): Database.Database | null => {
  if (db) return db;
  if (openFailed) return null;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma('cache_size = -8000'); // 8MB 页缓存，够热词索引了
    return db;
  } catch {
    openFailed = true;
    return null;
  }
};

const SUFFIXES: Array<[RegExp, string[]]> = [
  [/ies$/, ['y']],
  [/ied$/, ['y']],
  [/es$/, ['', 'e']],
  [/ed$/, ['', 'e']],
  [/ing$/, ['', 'e']],
  [/er$/, ['', 'e']],
  [/est$/, ['', 'e']],
  [/ly$/, ['', 'le']],
  [/s$/, ['']],
  [/d$/, ['']],
];

const variants = (w: string): string[] => {
  const out: string[] = [];
  for (const [re, repls] of SUFFIXES) {
    if (!re.test(w)) continue;
    const stem = w.replace(re, '');
    for (const r of repls) out.push(stem + r);
    if (/ing$|ed$|er$|est$/.test(w)) out.push(stem + stem.slice(-1));
  }
  return out.filter((x) => x.length >= 2 && x !== w);
};

const lookupSync = (d: Database.Database, word: string): DictRow | null => {
  const exact = d.prepare('SELECT word, ph, mean, pos FROM words WHERE word = ?').get(word) as DictRow | undefined;
  if (exact) return exact;

  const form = d.prepare('SELECT lemma FROM forms WHERE form = ?').get(word) as { lemma: string } | undefined;
  if (form) {
    const hit = d.prepare('SELECT word, ph, mean, pos FROM words WHERE word = ?').get(form.lemma) as DictRow | undefined;
    if (hit) return hit;
  }

  for (const cand of variants(word)) {
    const hit = d.prepare('SELECT word, ph, mean, pos FROM words WHERE word = ?').get(cand) as DictRow | undefined;
    if (hit) return hit;
  }
  return null;
};

export const dictEnabled = (): boolean => openDb() !== null;

export const registerDictRoutes = (app: Hono<any>, deps: { clientIp: (c: any) => string }): void => {
  // 内存态限流：单 IP 每小时 1200 次查词（正常人一页书也就几十次）
  const hits = new Map<string, { count: number; resetAt: number }>();
  const RATE_MAX = Number(process.env.DICT_RATE_LIMIT || 1200);
  const WINDOW_MS = 60 * 60 * 1000;
  const limited = (ip: string): boolean => {
    const now = Date.now();
    const rec = hits.get(ip);
    if (!rec || rec.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return false;
    }
    rec.count += 1;
    return rec.count > RATE_MAX;
  };

  app.get('/dict/lookup', (c) => {
    const ip = deps.clientIp(c);
    if (limited(ip)) return c.json({ found: false, error: 'too many requests' }, 429);

    const raw = String(c.req.query('w') || '');
    const word = raw
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/^[^a-z]+/, '')
      .replace(/[^a-z'-]+$/, '');
    if (!word || word.length > 40) return c.json({ found: false, error: 'bad word' }, 400);

    const d = openDb();
    if (!d) return c.json({ found: false, error: '词典未安装：把 en.db 放到 data/dict/ 下' }, 503);

    const row = lookupSync(d, word);
    if (!row) {
      c.header('Cache-Control', 'public, max-age=86400');
      return c.json({ found: false }, 404);
    }

    c.header('Cache-Control', 'public, max-age=604800');
    return c.json({
      found: true,
      word: row.word,
      phonetic: row.ph || '',
      meaning: row.mean || '',
      pos: row.pos || '',
    });
  });

  app.get('/dict/stats', (c) => {
    const d = openDb();
    if (!d) return c.json({ ready: false, error: '词典未安装' }, 503);
    if (cachedCount < 0) {
      try {
        cachedCount = (d.prepare('SELECT count(*) AS n FROM words').get() as { n: number }).n;
      } catch {
        cachedCount = 0;
      }
    }
    let size = 0;
    try {
      size = statSync(DB_PATH).size;
    } catch {
      /* ignore */
    }
    return c.json({ ready: true, language: 'en', entries: cachedCount, bytes: size, source: 'ECDICT (MIT)' });
  });
};
