// ==================== 学习搭子社交 + 云同步（可选轻后端，无 AI，非实时）====================
// 定位：多邻国式「一起连胜」——服务器只存最小社交数据（昵称 / 好友关系 / streak），
// 无 AI、无实时推送：一切在「打开本页 / 点同步」时拉取。学习数据本体仍本地。
// feature flag：未配置服务器地址 = 纯本地模式，本模块函数前置校验抛错，UI 据此降级。

import { exportAllData, importAllData } from './storageService';

const KEY_SERVER = 'linguaflow_sync_server';
const KEY_TOKEN = 'linguaflow_sync_token';
const KEY_LAST = 'linguaflow_sync_last_at';

export interface FriendProfile {
  id: number;
  username: string;
  friendCode: string;
  language: string | null;
  streak: number;
  lastActiveDay: string | null;
}
export type MyProfile = FriendProfile;

export interface Nudge {
  id: number;
  fromUsername: string;
  createdAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  streak: number;
  language: string | null;
  lastActiveDay: string | null;
}

// --- 服务器地址（feature flag 开关）---
export const getServerUrl = (): string => {
  try {
    const local = (localStorage.getItem(KEY_SERVER) || '').trim().replace(/\/+$/, '');
    if (local) return local;
  } catch {
    /* ignore */
  }
  // 线上版在构建时内置默认地址（process.env.COMMUNITY_URL 由 vite define 注入）；
  // 开源版该值为空，社区保持纯本地，用户可在界面自配或自托管。
  return (process.env.COMMUNITY_URL || '').trim().replace(/\/+$/, '');
};

// 当前发行版：online = 线上版（内置社区地址）；oss = 开源版
export const getAppEdition = (): 'online' | 'oss' =>
  (process.env.APP_EDITION || 'oss') === 'online' ? 'online' : 'oss';

export const setServerUrl = (url: string): void => {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) localStorage.setItem(KEY_SERVER, clean);
  else localStorage.removeItem(KEY_SERVER);
};

export const isCloudSyncEnabled = (): boolean => !!getServerUrl();

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(KEY_TOKEN);
  } catch {
    return null;
  }
};

export const isRegistered = (): boolean => !!getToken();

export const getLastSyncAt = (): number | null => {
  try {
    const v = localStorage.getItem(KEY_LAST);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};

// 本地「今天」日期串（YYYY-MM-DD，按设备本地时区）
export const todayString = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// 统一请求：自动带 Bearer token，把服务端错误透出
async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const base = getServerUrl();
  if (!base) throw new Error('未配置服务器地址');
  const token = getToken();
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore non-JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `请求失败（${res.status}）`);
  }
  return data as T;
}

// --- 身份 ---
export const register = async (username: string, password: string, language: string): Promise<MyProfile> => {
  const data = await api<{ token: string } & MyProfile>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, language }),
  });
  localStorage.setItem(KEY_TOKEN, data.token);
  return data;
};

export const login = async (username: string, password: string): Promise<MyProfile> => {
  const data = await api<{ token: string } & MyProfile>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(KEY_TOKEN, data.token);
  return data;
};

// 换服务器 / 退出登录：清除本机身份与同步记录（不碰学习数据）
export const resetCloudIdentity = (): void => {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_LAST);
};

// 修改密码
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  await api('/me/password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
};

// 注销账号：服务器删除账号 + 脱敏日志；本地清除身份
export const deleteAccount = async (): Promise<void> => {
  await api('/me', { method: 'DELETE' });
  resetCloudIdentity();
};

// 意见反馈
export const submitFeedback = async (kind: string, content: string, contact: string): Promise<void> => {
  await api('/feedback', { method: 'POST', body: JSON.stringify({ kind, content, contact }) });
};

// --- 我的状态同步（打开页面时 push）---
export const pushMyStatus = async (streak: number, language: string): Promise<MyProfile> => {
  return api<MyProfile>('/me', {
    method: 'PUT',
    body: JSON.stringify({ streak, language, lastActiveDay: todayString() }),
  });
};

// --- 好友 ---
export const listFriends = (): Promise<FriendProfile[]> => api('/friends');

export const addFriend = (friendCode: string): Promise<{ ok: boolean; friend: FriendProfile }> =>
  api('/friends', { method: 'POST', body: JSON.stringify({ friendCode: friendCode.trim().toUpperCase() }) });

export const removeFriend = (id: number): Promise<{ ok: boolean }> => api(`/friends/${id}`, { method: 'DELETE' });

export const nudgeFriend = (id: number): Promise<{ ok: boolean }> => api(`/friends/${id}/nudge`, { method: 'POST' });

// --- 提醒 ---
export const listNudges = (): Promise<Nudge[]> => api('/nudges');
export const clearNudges = (): Promise<{ ok: boolean }> => api('/nudges', { method: 'DELETE' });

// --- 排行榜（公开）---
export const listLeaderboard = (limit = 20): Promise<LeaderboardEntry[]> =>
  api(`/leaderboard?limit=${limit}`);

// 共同连胜：双方今天都活跃才计，取二者 streak 较小值（用各自 last_active_day 对齐"今天"）
export const computeCommonStreak = (
  myStreak: number,
  myLastDay: string | null,
  friendStreak: number,
  friendLastDay: string | null,
  today: string
): number => {
  if (!myLastDay || !friendLastDay) return 0;
  if (myLastDay !== today || friendLastDay !== today) return 0;
  return Math.min(myStreak, friendStreak);
};

// --- 整包备份（可选，复用 exportAllData / importAllData）---
export const syncToCloud = async (): Promise<number> => {
  const data = await exportAllData();
  const meta = await api<{ ok: boolean; updatedAt: number }>('/sync', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const at = meta.updatedAt ?? Date.now();
  localStorage.setItem(KEY_LAST, String(at));
  return at;
};

export const syncFromCloud = async (): Promise<number> => {
  const meta = await api<{ blob: unknown; updatedAt: number }>('/sync');
  await importAllData(meta.blob);
  const at = meta.updatedAt ?? Date.now();
  localStorage.setItem(KEY_LAST, String(at));
  return at;
};

// ==================== 自动同步（线上版：登录自动拉取 + 学习后自动推送）====================
// 开源版（无服务器/未登录）自动 no-op，零开销。

const hashString = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
};

let lastPushedHash = '';
let autoSyncStarted = false;

const currentHash = async (): Promise<string> => {
  try {
    const data = await exportAllData();
    return hashString(JSON.stringify(data));
  } catch {
    return '';
  }
};

// 登录/注册后调用：服务器有数据则拉取恢复（跨设备）；无数据则把本地推上去（首次上传）。
// 返回是否「拉取并恢复」了服务器数据（调用方据此决定要不要刷新页面）。
export const syncOnLogin = async (): Promise<boolean> => {
  try {
    await syncFromCloud();
    lastPushedHash = await currentHash();
    return true;
  } catch (e) {
    // 仅当「服务器无数据」时把本地推上去；网络等其它错误不动，避免覆盖服务器
    if (e instanceof Error && /no data/i.test(e.message)) {
      try {
        await syncToCloud();
      } catch {
        /* ignore */
      }
    }
    lastPushedHash = await currentHash();
    return false;
  }
};

// 数据变更后自动推送（幂等：仅当内容哈希变化才推）
export const pushIfDirty = async (): Promise<void> => {
  if (!isRegistered()) return; // 未登录不推送
  try {
    const hash = await currentHash();
    if (hash && hash !== lastPushedHash) {
      lastPushedHash = hash;
      await syncToCloud();
    }
  } catch {
    /* 静默：同步失败不影响使用 */
  }
};

// 应用启动时调用一次：为（可能稍后才登录的）用户开启自动同步
export const startAutoSync = (): void => {
  if (autoSyncStarted) return;
  autoSyncStarted = true;
  setInterval(() => {
    void pushIfDirty();
  }, 30000);
  const flush = () => {
    void pushIfDirty();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
};
