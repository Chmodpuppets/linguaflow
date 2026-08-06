
import React, { useState, useEffect } from 'react';
import { UserProfile, ErrorPattern, ErrorPatternType, Language } from '../types';
import { getErrorPatterns } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../constants';
import { Target, AlertCircle, Clock, Flame } from 'lucide-react';

interface ErrorPatternsViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

// ErrorPatternType → 中文可读名（面板主标题用，兜底用存储时写入的 label）
const TYPE_LABELS: Partial<Record<ErrorPatternType, string>> = {
  kana_dakuon: '浊音 / 半浊音',
  kana_youon: '拗音',
  kana_confusion: '假名形近混淆',
  spelling: '拼写',
  tense: '时态',
  particle: '助词 / 介词',
  word_order: '语序',
  collocation: '搭配 / 用词',
  register: '语体 / 敬语',
  agreement: '一致性（性数格）',
  dictation_miss: '听写漏写 / 错写',
  other: '其他',
};

const relTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const HOUR = 3600000;
  const DAY = 86400000;
  if (diff < HOUR) return '不到 1 小时前';
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return new Date(ts).toLocaleDateString();
};

const ErrorPatternsView: React.FC<ErrorPatternsViewProps> = ({ user }) => {
  const [lang, setLang] = useState<Language>(user.learningLanguage);
  const [patterns, setPatterns] = useState<ErrorPattern[]>([]);

  useEffect(() => {
    setPatterns(getErrorPatterns(lang).sort((a, b) => b.count - a.count));
  }, [lang, user]);

  const maxCount = Math.max(1, ...patterns.map((p) => p.count));

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="text-neon" /> 我的错误模式
          </h2>
          <p className="text-muted text-sm">
            从自由写、听写、文字特训中自动沉淀的高频错误类型，帮你看见自己的薄弱点。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="bg-dark border border-line-strong rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-secondary outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className="flex-1 glass-panel rounded-2xl flex flex-col items-center justify-center text-muted text-center px-6">
          <AlertCircle size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-semibold text-white">还没有错误模式数据</p>
          <p className="text-sm mt-2 max-w-md leading-relaxed">
            在「墨程」里完成自由写或听写、在「文字特训」里练字形，系统会自动把高频错误按类型归类到这里。
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          {patterns.map((p) => {
            const label = TYPE_LABELS[p.type] ?? p.label ?? p.type;
            const w = Math.round((p.count / maxCount) * 100);
            return (
              <div key={p.id} className="glass-panel rounded-xl p-5 border border-line-strong hover:border-neon/40 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-white">{label}</span>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-faint">{p.type}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                      <span className="flex items-center gap-1"><Flame size={13} className="text-orange-400" /> 累计 {p.count} 次</span>
                      <span className="flex items-center gap-1"><Clock size={13} /> 最近 {relTime(p.lastSeen)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-neon">{p.count}</div>
                    <div className="text-[10px] text-faint">出现次数</div>
                  </div>
                </div>

                {/* 频率条 */}
                <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-neon to-neon-2" style={{ width: `${w}%` }} />
                </div>

                {/* 典型错例 */}
                {p.examples && p.examples.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wide text-faint mb-1.5">典型错例</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.examples.map((ex, i) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-dark/60 border border-line-strong text-xs text-gray-200 break-all">
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 关联维度 */}
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-neon/10 text-neon text-[10px] border border-neon/20">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ErrorPatternsView;
