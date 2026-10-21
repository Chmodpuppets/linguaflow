// 造一批「假学习搭子」数据，让排行榜 / 一起连胜看起来有人气。
// 假用户以 is_seed=1 标记，方便以后一键清除。
//
// 用法（在 server/ 目录）：
//   node scripts/seed.mjs 30          # 插入 30 个假用户（默认）
//   node scripts/seed.mjs --clear     # 清除所有 is_seed=1 的假用户
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
const db = new Database(join(dataDir, 'linguaflow.db'));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
const genToken = () => randomBytes(24).toString('base64url');

const NAMES = [
  'Lily', '阿伟', 'Emma', '小王', 'Sakura', '老张', 'Anna', '小美', 'Tom', 'Kenji',
  'Momo', '大壮', 'Sara', '小宇', 'David', 'Nana', 'Kevin', '小雅', 'Marco', 'Sofia',
  'Leo', '阿强', 'Yuki', 'Jack', '小米', 'Carlos', 'Nina', '小陈', 'Luna', '小明',
  'Hana', '小周', 'Ivan', '娜娜', 'Ren', '小刘', 'Amy', '阿杰', 'Mia', '小林',
];
const LANGS = ['ja', 'en', 'ko', 'es', 'de', 'fr'];

const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

if (process.argv.includes('--clear')) {
  const n = db.prepare('DELETE FROM users WHERE is_seed = 1').run();
  console.log(`已清除 ${n.changes} 个假用户`);
  process.exit(0);
}

// 幂律分布：多数人连胜短，少数人大神
const streakFor = () => {
  const r = Math.random();
  if (r < 0.6) return 1 + Math.floor(Math.random() * 10); // 60%: 1–10
  if (r < 0.88) return 11 + Math.floor(Math.random() * 40); // 28%: 11–50
  if (r < 0.97) return 51 + Math.floor(Math.random() * 100); // 9%: 51–150
  return 151 + Math.floor(Math.random() * 500); // 3%: 151–650
};

const count = Number(process.argv[2] || 30);
const todayStr = today();
const ins = db.prepare(
  `INSERT INTO users (username, friend_code, language, streak, last_active_day, token, created_at, is_seed)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
);

const tx = db.transaction(() => {
  for (let i = 0; i < count; i++) {
    const base = NAMES[i % NAMES.length];
    const username = count <= NAMES.length ? base : `${base}${Math.floor(i / NAMES.length) + 1}`;
    const lastActive = Math.random() < 0.85 ? todayStr : null; // 85% 今天活跃
    ins.run(username, genCode(), LANGS[i % LANGS.length], streakFor(), lastActive, genToken(), Date.now());
  }
});
tx();
console.log(`已插入 ${count} 个假用户（is_seed=1），可用 node scripts/seed.mjs --clear 一键清除`);
