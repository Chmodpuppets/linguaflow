// AI 调用授权（一次授权 + 全局开关）
//
// 全站所有 AI 请求都从 aiService 的网络出口（callProvider / callProviderStream /
// fetchQwenTtsUrl）经过这里；组件层不需要逐个加确认，自动触发的请求（今日任务、
// 阅读意群预取、打字内容生成、TTS 等）也一律被拦住。
//
// 关键行为：出口处 await 用户决定，点「允许」后**原来那次调用直接继续**，
// 不需要用户重新点一次按钮；多个并发请求共用同一次弹窗。

const KEY = 'linguaflow_ai_consent_v1';
export const AI_CONSENT_REQUEST_EVENT = 'linguaflow:ai-consent-request';
export const AI_CONSENT_CHANGED_EVENT = 'linguaflow:ai-consent-changed';

export type AiConsentState = 'unset' | 'granted' | 'denied';

export interface AiConsentRequestDetail {
  /** 触发本次调用的功能名 */
  feature: string;
  /** 实际会处理这段内容的模型 */
  model: string;
}

export const getAiConsentState = (): AiConsentState => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {}
  return 'unset';
};

export const isAiAllowed = (): boolean => getAiConsentState() === 'granted';

class Waiter {
  promise: Promise<boolean>;
  resolve: (v: boolean) => void;
  constructor() {
    let r!: (v: boolean) => void;
    this.promise = new Promise<boolean>((resolve) => { r = resolve; });
    this.resolve = r;
  }
}

let pending: Waiter | null = null;

/** 把选择写入本地，并唤醒所有正在等待的 AI 调用 */
export const setAiConsent = (v: 'granted' | 'denied'): void => {
  try { localStorage.setItem(KEY, v); } catch {}
  try { window.dispatchEvent(new Event(AI_CONSENT_CHANGED_EVENT)); } catch {}
  pending?.resolve(v === 'granted');
  pending = null;
};

/** 关闭弹窗但暂不决定：本次调用按「不允许」处理，下次仍会再问 */
export const dismissAiConsent = (): void => {
  pending?.resolve(false);
  pending = null;
  // 通知 UI 收起弹窗（状态仍为 unset，不写 localStorage）
  try { window.dispatchEvent(new Event(AI_CONSENT_CHANGED_EVENT)); } catch {}
};

/**
 * 请求授权。已允许 → 立即放行；已拒绝 → 立即拒绝并抛 AiDisabledError；
 * 未选择 → 弹出一次模态，等待用户选择（并发调用共用同一个 Promise）。
 */
export const requestAiConsent = (detail: AiConsentRequestDetail): Promise<boolean> => {
  const state = getAiConsentState();
  if (state === 'granted') return Promise.resolve(true);
  if (state === 'denied') return Promise.resolve(false);
  if (pending) return pending.promise;
  pending = new Waiter();
  const p = pending.promise;
  try {
    window.dispatchEvent(new CustomEvent(AI_CONSENT_REQUEST_EVENT, { detail }));
  } catch {
    // 没有 UI 挂载（例如脚本环境）时不能让调用永久挂起
    const w = pending;
    pending = null;
    w.resolve(false);
  }
  return p;
};

export const AI_DISABLED_MESSAGE =
  'AI 调用已关闭：可在「我的资料 → 模型设置 → AI 调用授权」重新开启。当前功能已使用本地兜底。';

export class AiDisabledError extends Error {
  constructor() {
    super(AI_DISABLED_MESSAGE);
    this.name = 'AiDisabledError';
  }
}

export const isAiDisabledError = (e: unknown): boolean =>
  e instanceof AiDisabledError || (e instanceof Error && e.name === 'AiDisabledError');

/** aiService 网络出口统一调用：未获授权就抛 AiDisabledError */
export const assertAiAllowed = async (feature: string, model: string): Promise<void> => {
  const allowed = await requestAiConsent({ feature, model });
  if (!allowed) throw new AiDisabledError();
};
