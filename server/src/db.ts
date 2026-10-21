import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'linguaflow.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    friend_code TEXT UNIQUE NOT NULL,
    language TEXT,
    streak INTEGER NOT NULL DEFAULT 0,
    last_active_day TEXT,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    is_seed INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a INTEGER NOT NULL,
    user_b INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_a, user_b)
  );
  CREATE TABLE IF NOT EXISTS nudges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user INTEGER NOT NULL,
    to_user INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_data (
    user_id INTEGER PRIMARY KEY,
    blob TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    user TEXT NOT NULL DEFAULT '',
    module TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    response TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_logs_user ON chat_logs(user);
`);

export interface UserRow {
  id: number;
  username: string;
  friend_code: string;
  language: string | null;
  streak: number;
  last_active_day: string | null;
  token: string;
  created_at: number;
  is_seed: number;
}

// 轻量迁移：给已存在的旧库补 is_seed 列（新库由上面的 CREATE TABLE 直接带上）
const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
if (!cols.some((c) => c.name === 'is_seed')) {
  db.exec('ALTER TABLE users ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0');
}

export interface LeaderboardRow {
  username: string;
  streak: number;
  language: string | null;
  last_active_day: string | null;
}

export const listLeaderboard = (limit: number): LeaderboardRow[] => {
  return db
    .prepare('SELECT username, streak, language, last_active_day FROM users ORDER BY streak DESC, id ASC LIMIT ?')
    .all(limit) as LeaderboardRow[];
};

export const createUser = (username: string, language: string, friendCode: string, token: string): UserRow => {
  const info = db
    .prepare('INSERT INTO users (username, friend_code, language, streak, token, created_at) VALUES (?, ?, ?, 0, ?, ?)')
    .run(username, friendCode, language, token, Date.now());
  return getUserById(Number(info.lastInsertRowid))!;
};

export const getUserById = (id: number): UserRow | undefined =>
  db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

export const getUserByToken = (token: string): UserRow | undefined =>
  db.prepare('SELECT * FROM users WHERE token = ?').get(token) as UserRow | undefined;

export const getUserByFriendCode = (code: string): UserRow | undefined =>
  db.prepare('SELECT * FROM users WHERE friend_code = ?').get(code) as UserRow | undefined;

export const countUsers = (): number => {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return row.n;
};

export const updateStatus = (id: number, streak: number, language: string | null, lastActiveDay: string | null): void => {
  db.prepare('UPDATE users SET streak = ?, language = ?, last_active_day = ? WHERE id = ?').run(
    streak,
    language,
    lastActiveDay,
    id
  );
};

export const listFriends = (userId: number): UserRow[] => {
  return db
    .prepare(
      `SELECT u.* FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
       WHERE f.user_a = ? OR f.user_b = ?
       ORDER BY u.streak DESC`
    )
    .all(userId, userId, userId) as UserRow[];
};

export const addFriendship = (a: number, b: number): boolean => {
  if (a === b) return false;
  const exists = db
    .prepare('SELECT 1 FROM friendships WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)')
    .get(a, b, b, a);
  if (exists) return false;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  db.prepare('INSERT INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)').run(lo, hi, Date.now());
  return true;
};

export const removeFriendship = (a: number, b: number): void => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(lo, hi);
};

export const addNudge = (from: number, to: number): void => {
  db.prepare('INSERT INTO nudges (from_user, to_user, created_at) VALUES (?, ?, ?)').run(from, to, Date.now());
};

export interface NudgeRow {
  id: number;
  fromUsername: string;
  createdAt: number;
}

export const listNudges = (to: number): NudgeRow[] => {
  return db
    .prepare(
      `SELECT n.id, u.username AS fromUsername, n.created_at AS createdAt
       FROM nudges n JOIN users u ON u.id = n.from_user
       WHERE n.to_user = ?
       ORDER BY n.created_at DESC`
    )
    .all(to) as NudgeRow[];
};

export const clearNudges = (to: number): void => {
  db.prepare('DELETE FROM nudges WHERE to_user = ?').run(to);
};

// 整包备份（可选，学习数据本体仍本地）
export interface SyncRow {
  blob: string;
  updated_at: number;
}

export const getSync = (userId: number): SyncRow | undefined => {
  return db.prepare('SELECT blob, updated_at FROM sync_data WHERE user_id = ?').get(userId) as SyncRow | undefined;
};

export const putSync = (userId: number, blob: string): number => {
  const now = Date.now();
  db.prepare(
    `INSERT INTO sync_data (user_id, blob, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at`
  ).run(userId, blob, now);
  return now;
};

// --- 合规对话日志（备案：留存 ≥6 个月，可回溯查询用户提问与 AI 返回）---

export interface ChatLogRow {
  id: number;
  created_at: number;
  user: string;
  module: string;
  model: string;
  prompt: string;
  response: string;
}

export const insertChatLog = (e: { user: string; module: string; model: string; prompt: string; response: string }): void => {
  db.prepare(
    'INSERT INTO chat_logs (created_at, user, module, model, prompt, response) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(Date.now(), e.user, e.module, e.model, e.prompt, e.response);
};

export const queryChatLogs = (q: { start: number; end: number; user: string; keyword: string; limit: number }): ChatLogRow[] => {
  const conds: string[] = ['created_at >= ?', 'created_at <= ?'];
  const args: unknown[] = [q.start, q.end];
  if (q.user) {
    conds.push('user = ?');
    args.push(q.user);
  }
  if (q.keyword) {
    const like = `%${q.keyword}%`;
    conds.push('(prompt LIKE ? OR response LIKE ?)');
    args.push(like, like);
  }
  const sql = `SELECT id, created_at, user, module, model, prompt, response FROM chat_logs WHERE ${conds.join(' AND ')} ORDER BY id DESC LIMIT ?`;
  return db.prepare(sql).all(...args, q.limit) as ChatLogRow[];
};

export const purgeChatLogs = (before: number): number => {
  const r = db.prepare('DELETE FROM chat_logs WHERE created_at < ?').run(before);
  return r.changes;
};
