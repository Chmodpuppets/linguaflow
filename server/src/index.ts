import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import {
  createUser,
  countUsers,
  getUserById,
  getUserByToken,
  getUserByFriendCode,
  updateStatus,
  listFriends,
  addFriendship,
  removeFriendship,
  addNudge,
  listNudges,
  clearNudges,
  getSync,
  putSync,
  listLeaderboard,
  insertChatLog,
  queryChatLogs,
  purgeChatLogs,
  type UserRow,
} from './db';

type Env = { Variables: { user: UserRow } };

const app = new Hono<Env>();

const MAX_BODY = Number(process.env.MAX_BODY_BYTES || 25 * 1024 * 1024);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// —— 公网暴露期的防滥用（内存态，重启清零）——
// 总注册人数上限：到顶后拒绝新注册，防止被脚本刷爆磁盘/数据库
const MAX_USERS = Number(process.env.MAX_USERS || 500);
// 单 IP 每小时注册次数上限
const REGISTER_RATE_LIMIT = Number(process.env.REGISTER_RATE_LIMIT || 20);
const RATE_WINDOW_MS = 60 * 60 * 1000;
const regHits = new Map<string, { count: number; resetAt: number }>();

const rateLimited = (key: string): boolean => {
  const now = Date.now();
  const rec = regHits.get(key);
  if (!rec || rec.resetAt < now) {
    regHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > REGISTER_RATE_LIMIT;
};

const clientIp = (c: Context<Env>): string => {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress || 'unknown';
};

// —— 合规对话日志（备案：留存 ≥6 个月，可回溯查询）——
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 180);
const LOG_RATE_LIMIT = Number(process.env.LOG_RATE_LIMIT || 500);
const logHits = new Map<string, { count: number; resetAt: number }>();

const rateLimitedLog = (key: string): boolean => {
  const now = Date.now();
  const rec = logHits.get(key);
  if (!rec || rec.resetAt < now) {
    logHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > LOG_RATE_LIMIT;
};

// 好友码：6 位，剔除易混淆字符（0/O/1/I）
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genFriendCode = (): string => {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => FRIEND_CODE_ALPHABET[b % FRIEND_CODE_ALPHABET.length]).join('');
};
const genToken = (): string => randomBytes(24).toString('base64url');

// CORS（匿名 token，无 cookie，默认 `*`；生产可收紧为 CORS_ORIGIN）
app.use('*', async (c: Context<Env>, next: Next) => {
  c.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // 注意：必须用 c.body() 而非 new Response()——后者不会带上 c.header() 设置的 CORS 头
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

// 鉴权：`Authorization: Bearer <token>` → 解析为 user
const auth = async (c: Context<Env>, next: Next) => {
  const authz = c.req.header('Authorization') || '';
  const token = authz.replace(/^Bearer\s+/i, '').trim();
  const user = token ? getUserByToken(token) : undefined;
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
};

const pub = (u: UserRow) => ({
  id: u.id,
  username: u.username,
  friendCode: u.friend_code,
  language: u.language,
  streak: u.streak,
  lastActiveDay: u.last_active_day,
});

app.get('/health', (c) => c.json({ ok: true }));

// 对话日志上报（前端 fire-and-forget）：用户提问 + AI 返回，留存 ≥6 个月
app.post('/log/chat', async (c) => {
  if (rateLimitedLog(clientIp(c))) return c.json({ error: 'too many requests' }, 429);
  const body = await c.req.json().catch(() => null);
  const prompt = String(body?.prompt || '').slice(0, 20000);
  const response = String(body?.response || '').slice(0, 20000);
  if (!prompt && !response) return c.json({ ok: true }); // 空日志直接忽略
  const authz = c.req.header('Authorization') || '';
  const token = authz.replace(/^Bearer\s+/i, '').trim();
  const row = token ? getUserByToken(token) : undefined;
  const user = row ? row.username : String(body?.user || 'anonymous').slice(0, 64);
  insertChatLog({
    user,
    module: String(body?.module || 'ai').slice(0, 32),
    model: String(body?.model || '').slice(0, 64),
    prompt,
    response,
  });
  return c.json({ ok: true });
});

// 日志回溯查询（管理员，X-Admin-Key 鉴权）：按时间 / 用户 / 关键词查
app.get('/log/chat', (c) => {
  if (!ADMIN_KEY || (c.req.header('X-Admin-Key') || '') !== ADMIN_KEY) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const start = Number(c.req.query('start') || 0);
  const end = Number(c.req.query('end') || Date.now());
  const limit = Math.min(Number(c.req.query('limit') || 100), 1000);
  const rows = queryChatLogs({
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : Date.now(),
    user: String(c.req.query('user') || ''),
    keyword: String(c.req.query('q') || ''),
    limit,
  });
  return c.json({ total: rows.length, rows });
});

// 连胜排行榜（公开，无需鉴权）：按 streak 降序
app.get('/leaderboard', (c) => {
  const raw = Number(c.req.query('limit') || '20');
  const limit = Math.min(Number.isFinite(raw) ? raw : 20, 100);
  return c.json(listLeaderboard(limit).map((r, i) => ({ rank: i + 1, ...r })));
});

// 注册：昵称 + 语言 → 发 token + 好友码（零密码，token 即身份）
app.post('/auth/register', async (c) => {
  if (rateLimited(clientIp(c))) {
    return c.json({ error: '注册过于频繁，请稍后再试' }, 429);
  }
  if (countUsers() >= MAX_USERS) {
    return c.json({ error: '本服务器注册名额已满' }, 503);
  }
  const body = await c.req.json().catch(() => null);
  const username = String(body?.username || '').trim().slice(0, 24);
  const language = String(body?.language || '').trim().slice(0, 8) || null;
  if (!username) return c.json({ error: 'username required' }, 400);
  let friendCode = genFriendCode();
  while (getUserByFriendCode(friendCode)) friendCode = genFriendCode();
  const token = genToken();
  const user = createUser(username, language || '', friendCode, token);
  return c.json({ token, ...pub(user) });
});

app.get('/me', auth, (c) => c.json(pub(c.get('user') as UserRow)));

// 同步我的状态（streak / 语言 / 今日活跃）——打开页面时调用，非实时
app.put('/me', auth, async (c) => {
  const user = c.get('user') as UserRow;
  const body = await c.req.json().catch(() => null);
  const rawStreak = Number(body?.streak);
  const clientStreak = Number.isFinite(rawStreak) ? Math.max(0, Math.floor(rawStreak)) : 0;
  // streak 只增不减：防止低 streak 的本地同步把云端（含 demo 打卡脚本涨上去的）值覆盖回 0。
  // 真实断签重置应由服务端按 last_active_day 的天间隔计算，属后续增强。
  const streak = Math.max(clientStreak, user.streak);
  const language = (body?.language ?? user.language ?? '').toString().trim().slice(0, 8) || null;
  const lastActiveDay = (body?.lastActiveDay ?? user.last_active_day ?? '').toString().trim().slice(0, 10) || null;
  updateStatus(user.id, streak, language, lastActiveDay);
  return c.json(pub(getUserById(user.id)!));
});

// 加好友：输入对方好友码
app.post('/friends', auth, async (c) => {
  const user = c.get('user') as UserRow;
  const body = await c.req.json().catch(() => null);
  const code = String(body?.friendCode || '').trim().toUpperCase();
  if (!code) return c.json({ error: 'friendCode required' }, 400);
  const target = getUserByFriendCode(code);
  if (!target) return c.json({ error: '好友码不存在' }, 404);
  if (target.id === user.id) return c.json({ error: '不能加自己' }, 400);
  addFriendship(user.id, target.id);
  return c.json({ ok: true, friend: pub(target) });
});

app.get('/friends', auth, (c) => c.json(listFriends((c.get('user') as UserRow).id).map(pub)));

app.delete('/friends/:id', auth, (c) => {
  const user = c.get('user') as UserRow;
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'bad id' }, 400);
  removeFriendship(user.id, id);
  return c.json({ ok: true });
});

// 提醒好友别断签（非实时，对方下次打开看到）
app.post('/friends/:id/nudge', auth, (c) => {
  const user = c.get('user') as UserRow;
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'bad id' }, 400);
  if (!getUserById(id)) return c.json({ error: 'not found' }, 404);
  addNudge(user.id, id);
  return c.json({ ok: true });
});

app.get('/nudges', auth, (c) => c.json(listNudges((c.get('user') as UserRow).id)));

app.delete('/nudges', auth, (c) => {
  clearNudges((c.get('user') as UserRow).id);
  return c.json({ ok: true });
});

// 整包备份（可选）：学习数据本体的手动快照
app.put('/sync', auth, async (c) => {
  const user = c.get('user') as UserRow;
  const body = await c.req.text();
  if (body.length > MAX_BODY) return c.json({ error: 'payload too large' }, 413);
  try {
    JSON.parse(body);
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const updatedAt = putSync(user.id, body);
  return c.json({ ok: true, updatedAt });
});

app.get('/sync', auth, (c) => {
  const user = c.get('user') as UserRow;
  const row = getSync(user.id);
  if (!row) return c.json({ error: 'no data' }, 404);
  let blob: unknown;
  try {
    blob = JSON.parse(row.blob);
  } catch {
    return c.json({ error: 'corrupted' }, 500);
  }
  return c.json({ blob, updatedAt: row.updated_at });
});

// 留存清理：删除超过 LOG_RETENTION_DAYS 天的日志（默认 180 天，≥ 6 个月）
const purged = purgeChatLogs(Date.now() - LOG_RETENTION_DAYS * 24 * 3600 * 1000);
if (purged > 0) console.log(`purged ${purged} old chat logs`);

const port = Number(process.env.PORT || 8787);
// 默认只绑回环地址：公网无法直连，由同机 Caddy 反代（纵使安全组误放行也打不进来）
const hostname = process.env.HOST || '127.0.0.1';
serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`LinguaFlow sync server listening on http://${hostname}:${info.port}`);
});
