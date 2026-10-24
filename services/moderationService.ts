// 内容安全机制（生成式 AI 服务合规的最低技术措施）：
//   1) 本地拦截词：默认空（不拦截），由部署方通过 .env 的 MODERATION_BLOCKLIST
//      或运行时配置填入自己维护的词表 —— 仓库不内置任何敏感词，避免误伤与维护风险。
//   2) 可选远端审核：配置 remoteUrl 后，把文本 POST 给审核服务（阿里云/腾讯云/自建均可），
//      约定返回 { ok: boolean, reason?: string }。远端失败不阻断（宁可用不可用）。
// 调用点：aiService 的 callProvider / callProviderStream（AI 输入、输出双向）。

const KEY = 'linguaflow_moderation';

export interface ModerationConfig {
  /** 本地拦截词（命中即拒） */
  blocked: string[];
  /** 远端审核接口（OpenAI 无关，约定 POST { text } → { ok, reason? }） */
  remoteUrl?: string;
  /** 远端鉴权头（可选，作为 Authorization 原样发送） */
  remoteKey?: string;
}

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

const parseEnvList = (raw: string | undefined): string[] =>
  (raw || '')
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const getModerationConfig = (): ModerationConfig => {
  let local: Partial<ModerationConfig> = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) local = JSON.parse(raw) as Partial<ModerationConfig>;
  } catch {
    /* ignore */
  }
  const envBlocked = parseEnvList(process.env.MODERATION_BLOCKLIST);
  const blocked = Array.from(new Set([...(local.blocked || []), ...envBlocked])).filter(Boolean);
  return {
    blocked,
    remoteUrl: (local.remoteUrl || process.env.MODERATION_URL || '').trim() || undefined,
    remoteKey: (local.remoteKey || process.env.MODERATION_KEY || '').trim() || undefined,
  };
};

export const saveModerationConfig = (c: Partial<ModerationConfig>): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
};

/**
 * 审核一段文本（AI 输入或输出）。
 * 默认配置为空 → 永远放行（不改变现有用户体验）。
 */
export const moderate = async (text: string, side: 'input' | 'output'): Promise<ModerationResult> => {
  const t = (text || '').trim();
  if (!t) return { ok: true };

  const cfg = getModerationConfig();

  // 1) 本地拦截词
  if (cfg.blocked.length) {
    const hit = cfg.blocked.find((w) => w && t.includes(w));
    if (hit) {
      return { ok: false, reason: side === 'input' ? '你的输入包含不适宜内容，请调整后重试。' : 'AI 生成内容未通过安全检查，已拦截。' };
    }
  }

  // 2) 远端审核（失败不阻断，保证可用性）
  if (cfg.remoteUrl) {
    try {
      const res = await fetch(cfg.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.remoteKey ? { Authorization: cfg.remoteKey } : {}),
        },
        body: JSON.stringify({ text: t.slice(0, 4000), side }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; allowed?: boolean; reason?: string };
        const allowed = data.ok ?? data.allowed ?? true;
        if (!allowed) {
          return { ok: false, reason: data.reason || (side === 'input' ? '你的输入未通过内容审核，请调整后重试。' : 'AI 生成内容未通过审核，已拦截。') };
        }
      }
    } catch {
      /* 远端不可用 → 放行 */
    }
  }

  return { ok: true };
};
