// 合规日志：把「用户提问 + AI 返回」上报到服务器留存（备案要求至少 6 个月，可回溯查询）。
// 自包含：不 import 任何项目内模块，避免与 aiService / storageService / communityService 产生循环依赖。
// 仅当配置了服务器（线上版内置地址，或用户自配）才启用；开源版 / 纯本地不记录、零开销。

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

const getAnonId = (): string => {
  try {
    let id = localStorage.getItem(KEY_ANON);
    if (!id) {
      id = 'anon-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(KEY_ANON, id);
    }
    return id;
  } catch {
    return 'anon-unknown';
  }
};

const MAX_LEN = 20000; // 单条提问/返回最长字符，防日志被异常大文本撑爆

export const logChat = (entry: { model?: string; prompt: string; response: string }): void => {
  try {
    const base = getServerUrl();
    if (!base) return; // 无服务器（开源版）→ 不记录

    const token = localStorage.getItem(KEY_TOKEN) || null;
    fetch(`${base}/log/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user: token ? token.slice(0, 12) : getAnonId(), // 兜底标识，服务端优先用 token 解析用户名
        module: 'ai',
        model: entry.model || '',
        prompt: entry.prompt.slice(0, MAX_LEN),
        response: entry.response.slice(0, MAX_LEN),
      }),
      keepalive: true, // 页面卸载时也尽量送达
    }).catch(() => {
      /* 静默：日志失败绝不影响主流程 */
    });
  } catch {
    /* ignore */
  }
};
