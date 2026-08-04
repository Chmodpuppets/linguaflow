
import React from 'react';
import { UserProfile, Language } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';
import { ensureLanguageProgress } from '../services/storageService';
import { Globe, CheckCircle2, Clock, ArrowRight, PenLine } from 'lucide-react';

// 写作功能目前支持的语言（写作树 + 引导练习 scaffold 模板）
export const WRITING_SUPPORTED_LANGUAGES: Language[] = [Language.Japanese, Language.English, Language.Korean];

interface WritingLanguageGateProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  featureName: string;
  children: React.ReactNode;
}

/**
 * 语言门控：当用户的学习语言不在写作支持列表中时，
 * 显示"目前仅支持部分语言，其他语言待开发"提示页，
 * 并允许用户一键切换到任一已支持语言。
 */
const WritingLanguageGate: React.FC<WritingLanguageGateProps> = ({
  user,
  onUpdateUser,
  featureName,
  children,
}) => {
  const isSupported = WRITING_SUPPORTED_LANGUAGES.includes(user.learningLanguage);

  if (isSupported) return <>{children}</>;

  const switchToLanguage = (lang: Language) => {
    let updated = { ...user, learningLanguage: lang };
    updated = ensureLanguageProgress(updated, lang);
    onUpdateUser(updated);
  };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.id === user.learningLanguage);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-lg w-full">
        {/* 图标 + 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-4">
            <PenLine size={32} className="text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{featureName} · 语言选择</h2>
          <p className="text-muted text-sm">
            {featureName}目前仅支持部分语言。你的学习语言是
            <span className="text-secondary font-semibold mx-1">
              {currentLang?.flag} {currentLang?.label}
            </span>
            ，请选择下方已支持的语言开始体验。
          </p>
        </div>

        {/* 已支持语言：切换入口 */}
        <div className="bg-card border border-line-strong rounded-xl p-4 mb-6">
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-400" /> 已支持 · 点击切换
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WRITING_SUPPORTED_LANGUAGES.map((langId) => {
              const lang = SUPPORTED_LANGUAGES.find((l) => l.id === langId)!;
              return (
                <button
                  key={langId}
                  onClick={() => switchToLanguage(langId)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold hover:brightness-110 transition-all"
                >
                  <span className="text-lg">{lang.flag}</span>
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 全部语言可用性概览 */}
        <div className="bg-card border border-line-strong rounded-xl p-4">
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe size={14} /> 全部语言支持情况
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const supported = WRITING_SUPPORTED_LANGUAGES.includes(lang.id);
              const isCurrent = user.learningLanguage === lang.id;
              return (
                <div
                  key={lang.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    supported
                      ? 'bg-green-900/10 border-green-700/30 text-green-300'
                      : 'bg-surface-2/30 border-line-strong/50 text-muted'
                  } ${isCurrent ? 'ring-1 ring-secondary' : ''}`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="flex-1 truncate">{lang.label}</span>
                  {supported ? (
                    <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <span className="text-[10px] text-faint flex items-center gap-0.5 flex-shrink-0">
                      <Clock size={10} /> 待开发
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-faint mt-4">
          更多语言的写作内容正在开发中，敬请期待 🚀
        </p>
      </div>
    </div>
  );
};

export default WritingLanguageGate;
