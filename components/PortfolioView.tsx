import React, { useState, useMemo } from 'react';
import { UserProfile, WritingNode, GENRE_LABELS, REGISTER_LABELS } from '../types';
import { getWritingTree } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../constants';
import { GalleryVerticalEnd, FileText, Volume2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { generateSpeech } from '../services/aiService';

interface Props {
  user: UserProfile;
}

const PortfolioView: React.FC<Props> = ({ user }) => {
  const lang = user.learningLanguage;
  const flag = SUPPORTED_LANGUAGES.find((l) => l.id === lang)?.flag ?? '🌐';
  const [expanded, setExpanded] = useState<string | null>(null);

  const compositions = useMemo(() => {
    const tree = getWritingTree();
    return tree
      .filter((n) => n.type === 'composition' && n.completed)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [user, lang]);

  const speak = (text: string) => {
    if (text) generateSpeech(text, { lang });
  };

  const fmtDate = (ts?: number) =>
    ts ? new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <GalleryVerticalEnd size={22} className="text-secondary" />
        <h2 className="text-2xl font-bold text-white">作品集</h2>
        <span className="ml-2 text-sm text-gray-500">已完成作文合集</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        当前语言 {flag} {lang} · 共 {compositions.length} 篇已完成作文
      </p>

      {compositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-500 py-20 border border-dashed border-gray-700 rounded-2xl">
          <FileText size={48} className="mb-3 opacity-30" />
          <p className="text-lg">还没有已完成的作文</p>
          <p className="text-sm opacity-60 mt-1">去「写作树」或「作文流水线」完成一篇作文，就会出现在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {compositions.map((c: WritingNode) => {
            const isOpen = expanded === c.id;
            const wc = c.wordCount ?? 0;
            return (
              <div key={c.id} className="bg-card border border-gray-700 rounded-2xl p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                    <h3 className="font-bold text-white leading-snug">{c.title}</h3>
                  </div>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{fmtDate(c.updatedAt)}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200">
                    {c.genre ? GENRE_LABELS[c.genre] : '作文'}
                  </span>
                  {c.cefrLevel && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-300">{c.cefrLevel}</span>
                  )}
                  {c.register && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200">
                      {REGISTER_LABELS[c.register]}
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-300">{wc} 词</span>
                </div>

                <div
                  className={`mt-3 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap ${
                    isOpen ? '' : 'max-h-28 overflow-hidden'
                  }`}
                >
                  {c.content || '（无正文）'}
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="text-xs text-gray-400 hover:text-secondary inline-flex items-center gap-1"
                  >
                    {isOpen ? <><ChevronUp size={14} /> 收起</> : <><ChevronDown size={14} /> 展开全文</>}
                  </button>
                  <button
                    onClick={() => speak(c.content)}
                    className="text-xs text-secondary hover:underline inline-flex items-center gap-1 ml-auto"
                  >
                    <Volume2 size={14} /> 听发音
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortfolioView;
