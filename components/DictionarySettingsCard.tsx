import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Download, HardDrive, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import {
  DictState,
  getDictionaryState,
  installDictionary,
  uninstallDictionary,
} from '../services/dictionary';
import { SERVER_BASE } from '../services/serverBridge';

const fmtBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

/**
 * 「本地词典」设置卡：把英汉词典下载到本机（IndexedDB），查词就不再调用 AI。
 * - 下载的是静态文件，不发 AI 请求、不消耗任何模型额度
 * - 未安装也能查：线上版还有服务器在线词典（ECDICT 全量）兜底
 */
const DictionarySettingsCard: React.FC = () => {
  const [state, setState] = useState<DictState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getDictionaryState('en').then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, []);

  const handleInstall = useCallback(async (force: boolean) => {
    setBusy(true);
    setMsg(null);
    const done = await installDictionary('en', {
      force,
      onProgress: (p) => setState((prev) => ({
        ...(prev || { lang: 'en', installed: false, installing: true, progress: 0 }),
        installing: true,
        progress: p,
      })),
    });
    setState(done);
    setBusy(false);
    if (done.error) setMsg(done.error);
    else setMsg(force ? '词典已更新' : '词典已安装，之后查词不再调用 AI');
  }, []);

  const handleRemove = useCallback(async () => {
    setBusy(true);
    const next = await uninstallDictionary('en');
    setState(next);
    setBusy(false);
    setMsg('已删除本地词典（服务器在线词典仍可用）');
  }, []);

  const installed = !!state?.installed;
  const installing = busy || !!state?.installing;
  const pct = Math.round((state?.progress ?? 0) * 100);

  return (
    <div className="mt-5 glass-panel border-white/10 rounded-2xl p-4 md:p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <BookOpen size={20} className="text-neon-2" /> 本地词典（离线查词）
        {installed && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
            已安装
          </span>
        )}
      </h3>

      <p className="text-xs text-muted mb-4 leading-relaxed">
        阅读划词、生词本自动填释义都用<b className="text-white">本地词典</b>（英汉，ECDICT 精简单词表），
        <b className="text-white">不再为每个单词调用 AI</b>。下载的是静态词库文件，不消耗任何模型额度，装好后断网也能查。
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon/10 text-neon">
              <HardDrive size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">英语 → 中文</div>
              <div className="text-[11px] text-muted">
                {installed
                  ? `${(state?.entries || 0).toLocaleString()} 词 · ${fmtBytes(state?.bytes)} · v${state?.version || '—'}`
                  : `约 5.7 万词 · 1.9 MB${installing ? ` · 下载中 ${pct}%` : ''}`}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {installed ? (
              <>
                <button
                  onClick={() => handleInstall(true)}
                  disabled={installing}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-gray-200 border border-white/10 transition hover:bg-white/10 disabled:opacity-50"
                  title="重新下载最新版本"
                >
                  {installing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  更新
                </button>
                <button
                  onClick={handleRemove}
                  disabled={installing}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-faint transition hover:text-red-400 disabled:opacity-50"
                  title="删除本地词典（释放空间）"
                >
                  <Trash2 size={13} /> 删除
                </button>
              </>
            ) : (
              <button
                onClick={() => handleInstall(false)}
                disabled={installing}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-neon to-neon-2 px-3 py-1.5 text-[11px] font-bold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {installing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {installing ? `下载中 ${pct}%` : '下载到本机'}
              </button>
            )}
          </div>
        </div>

        {installing && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon to-neon-2 transition-all"
              style={{ width: `${Math.max(3, pct)}%` }}
            />
          </div>
        )}

        {msg && (
          <p className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${msg.includes('失败') || msg.includes('不支持') ? 'text-amber-300' : 'text-emerald-300'}`}>
            <CheckCircle2 size={12} /> {msg}
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        未安装也能查词：{SERVER_BASE
          ? '线上版会走本站服务器的全量词典（约 40 万词，实时查询、无需下载），装了本地包则优先本地、离线可用。'
          : '自部署版没有服务器词典，建议下载本地包；未安装时查不到的词才会退回 AI。'}
      </p>
      {SERVER_BASE && (
        <p className="mt-1 text-[10px] text-faint">
          在线词典接口：<span className="font-mono">{SERVER_BASE}/dict/lookup</span>
        </p>
      )}
    </div>
  );
};

export default DictionarySettingsCard;
