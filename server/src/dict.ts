/**
 * 在线词典（只读）：`GET /dict/lookup?w=abandon&lang=en`
 *
 * 数据：`<DATA_DIR>/dict/<lang>.db` —— 各语言一个 SQLite 库，表结构统一：
 *   words(word TEXT PRIMARY KEY, ph, mean, pos, frq) / forms(form, lemma)
 * 英语来自 ECDICT（MIT），日语来自 JMdict / jamdict-cn（CC BY-SA 4.0），
 * 韩语来自 Open Yonsei（CC BY-SA 3.0），西语来自 WikDict/DBnary（CC BY-SA）。
 * 详见 docs/dictionary.md 与 public/dict/LICENSES.md。
 *
 * 为什么要它：阅读时「每个单词都问一次大模型」又慢又费钱。装上这些库以后，
 * 常用词走前端离线包（/dict/<lang>/*.json.gz），生僻词和变形词落到这里，
 * 只有词典真查不到时才需要 AI。
 *
 * 形态还原不在服务端实现：客户端把活用候选通过 `alt=` 一起传过来，
 * 服务端只负责按索引查，避免日语/韩语规则在前后端各维护一份而漂移。
 *
 * 该接口**不需要登录**（查词是只读公开数据），但按 IP 限流防止被刷。
 * 单个语言的库文件缺失时返回 503，不影响其它语言和其它接口。
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

const LANGS = ['en', 'ja', 'ko', 'es'] as const;
type Lang = (typeof LANGS)[number];
const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
const dbPath = (lang: Lang) => join(dataDir, 'dict', `${lang}.db`);

const dbs = new Map<Lang, Database.Database | null>();
const failed = new Set<Lang>();
const counts = new Map<Lang, number>();

const openDb = (lang: Lang): Database.Database | null => {
  const cached = dbs.get(lang);
  if (cached !== undefined) return cached;
  if (failed.has(lang)) return null;
  try {
    const d = new Database(dbPath(lang), { readonly: true, fileMustExist: true });
    d.pragma('cache_size = -8000'); // 每库 8MB 页缓存
    dbs.set(lang, d);
    return d;
  } catch {
    failed.add(lang);
    dbs.set(lang, null);
    return null;
  }
};

/** 按文字系统清洗词头；与前端 dictLang.ts 的口径保持一致。 */
const normalizeWord = (raw: string, lang: Lang): string => {
  const s = String(raw || '').replace(/[’‘]/g, "'").trim().toLowerCase();
  if (!s) return '';
  if (lang === 'ja') {
    const c = s.replace(/^[^ぁ-んァ-ヶ一-龯々ー〇]+/u, '').replace(/[^ぁ-んァ-ヶ一-龯々ー〇]+$/u, '');
    return /[ぁ-んァ-ヶ一-龯々ー]/u.test(c) ? c : '';
  }
  if (lang === 'ko') {
    const c = s.replace(/^[^가-힣ㄱ-ㅎㅏ-ㅣ]+/u, '').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]+$/u, '');
    return /[가-힣ㄱ-ㅎ]/u.test(c) ? c : '';
  }
  if (lang === 'es') return s.replace(/^[^\p{L}']+/u, '').replace(/[^\p{L}\-']+$/u, '');
  return s.replace(/^[^a-z]+/, '').replace(/[^a-z'-]+$/, '');
};

// 服务端自带的轻量兜底（客户端没传 alt 时也能处理最常见的英语变形）
const EN_SUFFIXES: Array<[RegExp, string[]]> = [
  [/ies$/, ['y']], [/ied$/, ['y']], [/ying$/, ['ie', 'y']],
  [/es$/, ['', 'e']], [/ed$/, ['', 'e']], [/ing$/, ['', 'e']],
  [/er$/, ['', 'e']], [/est$/, ['', 'e']], [/ly$/, ['', 'le']],
  [/s$/, ['']], [/d$/, ['']],
];

const fallbackCandidates = (w: string, lang: Lang): string[] => {
  if (lang !== 'en') return [];
  const out: string[] = [];
  for (const [re, repls] of EN_SUFFIXES) {
    if (!re.test(w)) continue;
    const stem = w.replace(re, '');
    for (const r of repls) if (stem + r !== w) out.push(stem + r);
    if (/ing$|ed$|er$|est$/.test(w)) out.push(stem + stem.slice(-1));
  }
  return out.filter((x) => x.length >= 2);
};

const lookupSync = (d: Database.Database, word: string, alts: string[]): DictRow | null => {
  const exactStmt = d.prepare('SELECT word, ph, mean, pos FROM words WHERE word = ?');
  const formStmt = d.prepare('SELECT lemma FROM forms WHERE form = ?');
  const check = (w: string): DictRow | null => {
    const exact = exactStmt.get(w) as DictRow | undefined;
    if (exact) return exact;
    const form = formStmt.get(w) as { lemma: string } | undefined;
    if (form) return (exactStmt.get(form.lemma) as DictRow | undefined) || null;
    return null;
  };
  const hit = check(word);
  if (hit) return hit;
  for (const a of alts) {
    const row = check(a);
    if (row) return row;
  }
  return null;
};

export const dictEnabled = (): boolean => openDb('en') !== null;

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

    const rawLang = String(c.req.query('lang') || 'en').toLowerCase();
    const lang: Lang = isLang(rawLang) ? rawLang : 'en';
    const word = normalizeWord(String(c.req.query('w') || ''), lang);
    if (!word || word.length > 40) return c.json({ found: false, error: 'bad word' }, 400);

    // alt 由客户端生成（语种专属活用候选）；限 20 个、每个 40 字符，防止被当参数刷
    const alts = String(c.req.query('alt') || '')
      .split(',')
      .map((x) => normalizeWord(x.slice(0, 40), lang))
      .filter((x) => x && x !== word)
      .slice(0, 20);
    if (!alts.length) alts.push(...fallbackCandidates(word, lang).slice(0, 12));

    const d = openDb(lang);
    if (!d) return c.json({ found: false, error: `词典未安装：把 ${lang}.db 放到 data/dict/ 下` }, 503);

    const row = lookupSync(d, word, alts);
    if (!row) {
      c.header('Cache-Control', 'public, max-age=86400');
      return c.json({ found: false }, 404);
    }

    c.header('Cache-Control', 'public, max-age=604800');
    return c.json({
      found: true,
      lang,
      word: row.word,
      phonetic: row.ph || '',
      meaning: row.mean || '',
      pos: row.pos || '',
    });
  });

  app.get('/dict/stats', (c) => {
    const stats = LANGS.map((lang) => {
      const d = openDb(lang);
      if (!d) return { lang, ready: false, entries: 0, bytes: 0 };
      let n = counts.get(lang) ?? -1;
      if (n < 0) {
        try {
          n = (d.prepare('SELECT count(*) AS n FROM words').get() as { n: number }).n;
        } catch {
          n = 0;
        }
        counts.set(lang, n);
      }
      let size = 0;
      try {
        size = statSync(dbPath(lang)).size;
      } catch {
        /* ignore */
      }
      return { lang, ready: true, entries: n, bytes: size };
    });
    const ready = stats.filter((x) => x.ready).length;
    const en = stats[0];
    // 兼容旧调用方：顶层仍保留英语的扁平字段，多语言明细放 languages
    const flat = {
      ready: ready > 0,
      language: 'en',
      entries: en.entries,
      bytes: en.bytes,
      source: 'ECDICT (MIT)',
      languages: stats,
      totalEntries: stats.reduce((s, x) => s + x.entries, 0),
    };
    if (!ready) return c.json({ ...flat, error: '词典未安装' }, 503);
    return c.json(flat);
  });
};
