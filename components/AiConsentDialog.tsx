import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ShieldCheck } from 'lucide-react';
import {
  AI_CONSENT_REQUEST_EVENT,
  AI_CONSENT_CHANGED_EVENT,
  AiConsentRequestDetail,
  setAiConsent,
  dismissAiConsent,
} from '../services/aiConsent';

/**
 * 全局 AI 调用授权弹窗：由 aiService 网络出口在首次调用时派发事件唤起。
 * 一次授权适用于全站；用户可在「我的资料 → 模型设置 → AI 调用授权」随时关闭。
 */
const AiConsentDialog: React.FC = () => {
  const [detail, setDetail] = useState<AiConsentRequestDetail | null>(null);

  useEffect(() => {
    const onRequest = (e: Event) => {
      setDetail((e as CustomEvent<AiConsentRequestDetail>).detail || { feature: 'AI 功能', model: '当前模型' });
    };
    const onChanged = () => setDetail(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detail) dismissAiConsent();
    };
    window.addEventListener(AI_CONSENT_REQUEST_EVENT, onRequest);
    window.addEventListener(AI_CONSENT_CHANGED_EVENT, onChanged);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(AI_CONSENT_REQUEST_EVENT, onRequest);
      window.removeEventListener(AI_CONSENT_CHANGED_EVENT, onChanged);
      window.removeEventListener('keydown', onKey);
    };
  }, [detail]);

  if (!detail) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => dismissAiConsent()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-consent-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-3/95 p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 md:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon/15 text-neon">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="ai-consent-title" className="text-lg font-bold text-white">允许 LinguaFlow 调用 AI？</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              「{detail.feature}」需要调用 AI，将使用你配置的 <span className="text-neon-2">{detail.model}</span> 处理。
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismissAiConsent()}
            aria-label="暂不决定"
            className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-relaxed text-muted">
          <p className="flex gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-neon-2" />
            <span><strong className="text-white">用你自己的 Key</strong>：应用与本站服务器均不内置任何 API 密钥。Key 由你在「模型设置」里填写并保存在本机浏览器；若开启云端同步，模型配置（含 Key）会随备份同步到你的账号以便在其它设备恢复。</span>
          </p>
          <p className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-faint">①</span>
            <span><strong className="text-white">会发送</strong>：你输入的文本、当前练习内容、目标语言与等级；不会发送密码。</span>
          </p>
          <p className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-faint">②</span>
            <span><strong className="text-white">线上版会经本站服务器中转</strong>（为绕过浏览器跨域限制，仅允许白名单厂商域名）；服务器不存储你的 Key。</span>
          </p>
          <p className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-faint">③</span>
            <span><strong className="text-white">AI 对话内容按合规要求留痕 180 天</strong>；日志只包含对话文本与模型名。</span>
          </p>
          <p className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-faint">④</span>
            <span>可随时在「我的资料 → 模型设置 → AI 调用授权」关闭；关闭后相关功能改用本地兜底，其它学习功能不受影响。</span>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => setAiConsent('granted')}
            className="flex-1 rounded-xl bg-gradient-to-r from-neon to-neon-2 py-2.5 text-sm font-bold text-white shadow-glow-neon transition-all hover:brightness-110"
          >
            允许使用 AI
          </button>
          <button
            type="button"
            onClick={() => setAiConsent('denied')}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-white/20 hover:text-white"
          >
            不使用 AI（本地兜底）
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-faint">
          选择只保存在本机，之后不会再重复询问；关闭弹窗 = 本次不调用。
        </p>
      </div>
    </div>,
    document.body
  );
};

export default AiConsentDialog;
