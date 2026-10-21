// 冒烟测试：验证云同步服务器的社交 + 备份全链路（无 AI、非实时）
// 用法：先 `npm start` 起服务，再 `node scripts/smoke.mjs [BASE]`
// 默认 BASE = http://127.0.0.1:8787

const BASE = process.argv[2] || 'http://127.0.0.1:8787';
let pass = 0;
let fail = 0;

const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name);
  }
};

const json = (method, path, token, body) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // 1. 健康检查
  const h = await fetch(`${BASE}/health`);
  ok(h.ok, 'GET /health');

  // 2. 注册两个用户
  const A = await json('POST', '/auth/register', null, { username: 'Alice', language: 'ja' });
  const B = await json('POST', '/auth/register', null, { username: 'Bob', language: 'en' });
  ok(!!A.body?.token && A.body?.friendCode?.length === 6, 'register Alice → token + 6 位好友码');
  ok(!!B.body?.token && B.body?.friendCode?.length === 6, 'register Bob');

  // 3. 读 / 更新我的状态
  const me = await json('GET', '/me', A.body.token);
  ok(me.body?.username === 'Alice', 'GET /me');
  const put = await json('PUT', '/me', A.body.token, { streak: 5, language: 'ja', lastActiveDay: today });
  ok(put.body?.streak === 5, 'PUT /me streak=5');

  // 4. 加好友（A 加 B）
  const add = await json('POST', '/friends', A.body.token, { friendCode: B.body.friendCode });
  ok(add.body?.friend?.username === 'Bob', 'POST /friends（A 加 B）');

  // 5. 好友列表
  const friends = await json('GET', '/friends', A.body.token);
  ok(friends.body?.length === 1 && friends.body[0]?.username === 'Bob', 'GET /friends 含 Bob');

  // 6. 提醒（nudge）
  const nudge = await json('POST', `/friends/${B.body.id}/nudge`, A.body.token);
  ok(nudge.body?.ok === true, 'POST /friends/:id/nudge');
  const nudges = await json('GET', '/nudges', B.body.token);
  ok(nudges.body?.length >= 1 && nudges.body[0]?.fromUsername === 'Alice', 'GET /nudges（Bob 收到 Alice 提醒）');

  // 7. 整包备份往返
  const up = await json('PUT', '/sync', A.body.token, { hello: 'world', n: 1 });
  ok(up.body?.ok === true, 'PUT /sync');
  const down = await json('GET', '/sync', A.body.token);
  ok(down.body?.blob?.hello === 'world', 'GET /sync 往返一致');

  // 8. 鉴权：无 token 应 401
  const unauth = await json('GET', '/me', null);
  ok(unauth.status === 401, 'GET /me 无 token → 401');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
