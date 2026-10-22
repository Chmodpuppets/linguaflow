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
    is_seed INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT
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
  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    stack TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    user TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    user TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT ''
  );
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
  password_hash: string | null;
}

// 轻量迁移：给已存在的旧库补列（新库由上面的 CREATE TABLE 直接带上）
const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
if (!cols.some((c) => c.name === 'is_seed')) {
  db.exec('ALTER TABLE users ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0');
}
if (!cols.some((c) => c.name === 'password_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
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

export const createUser = (username: string, language: string, friendCode: string, token: string, passwordHash: string | null): UserRow => {
  const info = db
    .prepare('INSERT INTO users (username, friend_code, language, streak, token, created_at, password_hash) VALUES (?, ?, ?, 0, ?, ?, ?)')
    .run(username, friendCode, language, token, Date.now(), passwordHash);
  return getUserById(Number(info.lastInsertRowid))!;
};

export const getUserById = (id: number): UserRow | undefined =>
  db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

export const getUserByUsername = (username: string): UserRow | undefined =>
  db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;

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

// --- 前端错误监控 ---
export interface ErrorLogRow {
  id: number;
  created_at: number;
  message: string;
  stack: string;
  source: string;
  url: string;
  user_agent: string;
  user: string;
}

export const insertErrorLog = (e: { message: string; stack: string; source: string; url: string; userAgent: string; user: string }): void => {
  db.prepare(
    'INSERT INTO error_logs (created_at, message, stack, source, url, user_agent, user) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(Date.now(), e.message, e.stack, e.source, e.url, e.userAgent, e.user);
};

export const listErrorLogs = (limit: number): ErrorLogRow[] => {
  return db.prepare('SELECT * FROM error_logs ORDER BY id DESC LIMIT ?').all(limit) as ErrorLogRow[];
};

// --- 意见反馈 ---
export interface FeedbackRow {
  id: number;
  created_at: number;
  user: string;
  kind: string;
  content: string;
  contact: string;
}

export const insertFeedback = (e: { user: string; kind: string; content: string; contact: string }): void => {
  db.prepare('INSERT INTO feedback (created_at, user, kind, content, contact) VALUES (?, ?, ?, ?, ?)')
    .run(Date.now(), e.user, e.kind, e.content, e.contact);
};

export const listFeedback = (limit: number): FeedbackRow[] => {
  return db.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT ?').all(limit) as FeedbackRow[];
};

// --- 账号管理 ---
export const updatePassword = (userId: number, passwordHash: string): void => {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
};

// 注销：删用户 + 好友关系 + 提醒 + 同步数据（合规对话日志不删，由 anonymizeChatLogs 脱敏）
export const deleteUser = (userId: number): void => {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM friendships WHERE user_a = ? OR user_b = ?').run(userId, userId);
    db.prepare('DELETE FROM nudges WHERE from_user = ? OR to_user = ?').run(userId, userId);
    db.prepare('DELETE FROM sync_data WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  tx();
};

// 合规日志脱敏：注销后把用户标识替换为占位符，日志内容保留（备案要求留存 ≥6 个月）
export const anonymizeChatLogs = (username: string): void => {
  db.prepare("UPDATE chat_logs SET user = '[已注销]' WHERE user = ?").run(username);
};
