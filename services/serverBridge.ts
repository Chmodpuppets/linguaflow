/**
 * 线上轻后端（同源 `/api/*`）的连接判定 —— **全站唯一来源**。
 *
 * 历史上这个条件在多个文件里各写一遍（`!!COMMUNITY_URL && !!token`），
 * 只要有一处漏判，表现就是「AI 一直失败 / 只有本地兜底」，排查成本极高
 * （见 .workbuddy/memory：中转开关是 useLlmProxy，没登录时 token 为空 → 退回
 * 浏览器直连 → 必被 CORS 拦）。所以收口到这里，新增走服务端的能力一律复用它。
 *
 * 注意：开源版构建时 `process.env.COMMUNITY_URL` 为空 → `isServerReady()` 恒 false，
 * 所有服务端能力自动降级为纯本地，不需要在每个调用点再判发行版。
 */
const RAW_SERVER = process.env.COMMUNITY_URL || '';

/**
 * 线上轻后端的基地址（含 `/api`）。
 *
 * 写成 `RAW_SERVER ? ... : ''` 而不是直接链式调用，是为了让打包器能把开源版
 * （构建时 `COMMUNITY_URL` 被替换为空串）整段折叠成 `''` —— 于是所有依赖它的
 * 服务端路径都会变成不可达死代码被摇掉，**开源版产物里连 `/tts/audio` 这个字符串都不存在**。
 */
export const SERVER_BASE = RAW_SERVER ? RAW_SERVER.trim().replace(/\/+$/, '') : '';

/** 同步 token（登录轻后端后写入）；未登录为空 → 服务端能力不可用 */
export const getSyncToken = (): string => {
  try {
    return localStorage.getItem('linguaflow_sync_token') || '';
  } catch {
    return '';
  }
};

/** 有服务器地址 + 有 token 才走中转。少了任何一个都会退回浏览器直连（多半被 CORS 拦）。 */
export const isServerReady = (): boolean => !!SERVER_BASE && !!getSyncToken();

/** 拼服务端路径：`serverApi('/llm/chat')` */
export const serverApi = (path: string): string =>
  `${SERVER_BASE}${path.startsWith('/') ? path : `/${path}`}`;

/** 带 token 的请求头（可叠加额外字段） */
export const authHeaders = (extra?: Record<string, string>): Record<string, string> => ({
  Authorization: `Bearer ${getSyncToken()}`,
  ...(extra || {}),
});
