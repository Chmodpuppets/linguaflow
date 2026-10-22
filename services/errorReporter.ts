
// 前端错误监控：window.onerror + unhandledrejection 自动上报到服务器 /log/error。
// 自包含（不 import 项目模块，避免循环依赖）；无服务器（开源版）自动 no-op、零开销。

const KEY_SERVER = 'linguaflow_sync_server';
const KEY_TOKEN = 'linguaflow_sync_token';
const KEY_ANON = 'linguaflow_anon_id';

const getServerUrl = (): string => {
  try {
    const local = (localStorage.getItem(KEY_SERVER) || '').trim().replace(/\/+$/, '');
    if (local) return local;
  } catch {
    /* ignore */
  }
  return (process.env.COMMUNITY_URL || '').trim().replace(/\/+$/, '');
};

const getUser = (): string => {
  try {
    return (localStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_ANON) || 'anonymous').slice(0, 32);
  } catch {
    return 'anonymous';
  }
};

let lastKey = '';
let lastAt = 0;

const report = (payload: { message: string; stack: string; source: string }) => {
  try {
    const base = getServerUrl();
    if (!base) return; // 开源版 / 无服务器 → 不上报

    // 去重：5 秒内相同错误只上报一次，防刷屏
    const key = payload.message.slice(0, 120);
    const now = Date.now();
    if (key === lastKey && now - lastAt < 5000) return;
    lastKey = key;
    lastAt = now;

    fetch(`${base}/log/error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        url: location.href.slice(0, 500),
        user: getUser(),
      }),
      keepalive: true,
    }).catch(() => {
      /* 上报失败静默 */
    });
  } catch {
    /* ignore */
  }
};

export const initErrorReporting = (): void => {
  try {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => {
      report({
        message: e.message || 'Unknown error',
        stack: (e.error && (e.error as { stack?: string }).stack) || '',
        source: e.filename || '',
      });
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      report({
        message: 'Unhandled rejection: ' + String(r?.message || r).slice(0, 200),
        stack: r?.stack || '',
        source: '',
      });
    });
  } catch {
    /* ignore */
  }
};
