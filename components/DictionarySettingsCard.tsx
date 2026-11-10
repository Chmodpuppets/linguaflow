import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Download, HardDrive, Loader2, RefreshCw, Trash2, Volume2 } from 'lucide-react';
import {
  DictLang,
  DICT_LANGS,
  DictState,
  getAllDictionaryStates,
  installDictionary,
  normalizeDictLang,
  uninstallDictionary,
} from '../services/dictionary';
import { SERVER_BASE } from '../services/serverBridge';

const fmtBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const FLAGS: Record<DictLang, string> = { en: '🇬🇧', ja: '🇯🇵', ko: '🇰🇷', es: '🇪🇸' };

interface Props {
  /** 当前学习语言，用来标「你正在学」；可以传 Language 枚举或 BCP-47 */
  learningLanguage?: string;
}

/**
 * 「本地词典」设置卡：按语言分别下载词库到本机（IndexedDB），查词就不再调用 AI。
 * - 下载的是静态文件，不发 AI 请求、不消耗任何模型额度
 * - 未安装也能查：线上版还有服务器在线词典兜底；自部署版建议至少装当前学习语言
 * - 划词浮层的发音按钮走 playWord，和这里是否安装词典无关
 */
const DictionarySettingsCard: React.FC<Props> = ({ learningLanguage }) => {
  const [states, setStates] = useState<Partial<Record<DictLang, DictState>>>({});
  const [busy, setBusy] = useState<DictLang | null>(null);
  const [msg, setMsg] = useState<{ lang: DictLang; text: string; bad?: boolean } | null>(null);
  const current = normalizeDictLang(learningLanguage);

  useEffect(() => {
    let alive = true;
    void getAllDictionaryStates().then((all) => { if (alive) setStates(all); });
    return () => { alive = false; };
  }, []);

  const handleInstall = useCallback(async (lang: DictLang, force: boolean) => {
    setBusy(lang);
    setMsg(null);
    const done = await installDictionary(lang, {
      force,
      onProgress: (p) => setStates((prev) => ({
        ...prev,
        [lang]: {
          ...(prev[lang] || { lang, installed: false, installing: true, progress: 0 }),
          installing: true,
          progress: p,
        },
      })),
    });
    setStates((prev) => ({ ...prev, [lang]: done }));
    setBusy(null);
    setMsg({
      lang,
      text: done.error || (force ? '词典已更新' : '已安装，之后查词优先走本地词库'),
      bad: !!done.error,
    });
  }, []);

  const handleRemove = useCallback(async (lang: DictLang) => {
    setBusy(lang);
    const next = await uninstallDictionary(lang);
    setStates((prev) => ({ ...prev, [lang]: next }));
    setBusy(null);
    setMsg({ lang, text: SERVER_BASE ? '已删除本地包（服务器在线词典仍可用）' : '已删除本地包' });
  }, []);

  const installedCount = DICT_LANGS.filter(({ lang }) => states[lang]?.installed).length;

  return (
    <div className="mt-5 glass-panel border-white/10 rounded-2xl p-4 md:p-6">
      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2 flex-wrap">
        <BookOpen size={20} className="text-neon-2" /> 本地词典（离线查词）
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted border border-white/10">
          已装 {installedCount}/{DICT_LANGS.length}
        </span>
      </h3>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        阅读划词、生词本自动填释义都优先查<b className="text-white">本地词典</b>，
        <b className="text-white">不再为每个单词调用 AI</b>。四门语言分别下载、分别删除，装好后断网也能查；
        划词浮层里的 <Volume2 size={11} className="inline-block align-[-1px]" /> 是发音，走系统 / 在线语音，不消耗词典。
      </p>

      <div className="space-y-2">
        {DICT_LANGS.map((meta) => {
          const lang = meta.lang;
          const st = states[lang];
          const installed = !!st?.installed;
          const installing = busy === lang || !!st?.installing;
          const pct = Math.round((st?.progress ?? 0) * 100);
          const isCurrent = current === lang;
          return (
            <div
              key={lang}
              className={`rounded-xl border p-3.5 transition ${isCurrent ? 'border-neon/30 bg-neon/[0.04]' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neon/10 text-base">
                    {FLAGS[lang]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white">{meta.label}</span>
                      <span className="text-[10px] text-faint">{meta.native}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon/15 text-neon-2 border border-neon/25">
                          你正在学
                        </span>
                      )}
                      {installed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                          已安装
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {installed
                        ? `${(st?.entries || 0).toLocaleString()} 词 · ${fmtBytes(st?.bytes)} · v${st?.version || '—'}`
                        : `${meta.gloss}释义 · ${meta.source}${installing ? ` · 下载中 ${pct}%` : ''}`}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {installed ? (
                    <>
                      <button
                        onClick={() => handleInstall(lang, true)}
                        disabled={installing}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-gray-200 border border-white/10 transition hover:bg-white/10 disabled:opacity-50"
                        title="重新下载最新版本"
                      >
                        {installing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        更新
                      </button>
                      <button
                        onClick={() => handleRemove(lang)}
                        disabled={installing}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-faint transition hover:text-red-400 disabled:opacity-50"
                        title="删除本地词典（释放空间）"
                      >
                        <Trash2 size={13} /> 删除
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstall(lang, false)}
                      disabled={installing}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-60 ${isCurrent ? 'bg-gradient-to-r from-neon to-neon-2' : 'bg-white/10 border border-white/10'}`}
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

              {msg?.lang === lang && (
                <p className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${msg.bad ? 'text-amber-300' : 'text-emerald-300'}`}>
                  <CheckCircle2 size={12} /> {msg.text}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        未安装也能查词：{SERVER_BASE
          ? '线上版会走本站服务器的全量词典（各语言独立 SQLite，实时查询、无需下载），装了本地包则优先本地、离线可用。'
          : '自部署版没有服务器词典，建议下载你正在学的语言；查不到的词才会退回 AI。'}
      </p>
      {SERVER_BASE && (
        <p className="mt-1 text-[10px] text-faint flex items-center gap-1.5">
          <HardDrive size={11} /> 在线词典接口：<span className="font-mono">{SERVER_BASE}/dict/lookup?lang=…</span>
        </p>
      )}
    </div>
  );
};

export default DictionarySettingsCard;
