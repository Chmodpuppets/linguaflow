// 每日给指定用户 +1 streak（模拟每日打卡，demo 用，让排行榜动起来）
// 靠 systemd timer 每天跑一次；手动多跑会多加，属预期。
//
// 用法（在 server/ 目录）：
//   node scripts/streak-tick.mjs --user=Mike        # Mike streak +1
//   node scripts/streak-tick.mjs --code=SLY34F      # 按好友码定位
//   node scripts/streak-tick.mjs --user=Mike --reset # 清零
import Database from 'better-sqlite3';
import { join } from 'node:path';

const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
const db = new Database(join(dataDir, 'linguaflow.db'));

const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const argv = process.argv.slice(2);
const reset = argv.includes('--reset');
const userArg = argv.find((a) => a.startsWith('--user='));
const codeArg = argv.find((a) => a.startsWith('--code='));
const username = userArg ? userArg.slice('--user='.length) : null;
const code = codeArg ? codeArg.slice('--code='.length) : null;

let user;
if (username) user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
else if (code) user = db.prepare('SELECT * FROM users WHERE friend_code = ?').get(code.toUpperCase());
else {
  console.error('请指定 --user=昵称 或 --code=好友码');
  process.exit(1);
}

if (!user) {
  console.error('找不到该用户');
  process.exit(1);
}

if (reset) {
  db.prepare('UPDATE users SET streak = 0, last_active_day = NULL WHERE id = ?').run(user.id);
  console.log(`已清零 ${user.username} 的 streak`);
} else {
  db.prepare('UPDATE users SET streak = streak + 1, last_active_day = ? WHERE id = ?').run(today(), user.id);
  console.log(`${user.username} streak ${user.streak} → ${user.streak + 1}`);
}
