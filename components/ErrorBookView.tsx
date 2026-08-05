
import React, { useState, useEffect } from 'react';
import { UserProfile, ErrorCard } from '../types';
import {
  getErrorBook,
  updateErrorCard,
  deleteErrorCard,
  getDueErrorCards,
  reviewErrorCard,
  progressQuests,
} from '../services/storageService';
import { BookX, Search, Trash2, Repeat, Check, XCircle, Layers, AlertCircle } from 'lucide-react';

interface ErrorBookViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const ErrorBookView: React.FC<ErrorBookViewProps> = ({ user, onUpdateUser }) => {
  const [items, setItems] = useState<ErrorCard[]>([]);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'browse' | 'review'>('browse');
  const [dueCount, setDueCount] = useState(0);

  // Review state
  const [queue, setQueue] = useState<ErrorCard[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewDone, setReviewDone] = useState(0);

  useEffect(() => {
    const list = getErrorBook().filter((c) => c.language === user.learningLanguage);
    setItems(list);
    setDueCount(getDueErrorCards().filter((c) => c.language === user.learningLanguage).length);
  }, [user.learningLanguage, user]);

  const startReview = () => {
    const due = getDueErrorCards().filter((c) => c.language === user.learningLanguage);
    setQueue(due);
    setReviewIdx(0);
    setReviewDone(0);
    setRevealed(false);
    setViewMode('review');
  };

  const handleReview = (known: boolean) => {
    const current = queue[reviewIdx];
    if (!current) return;
    const updated = reviewErrorCard(current, known);
    updateErrorCard(updated);
    const updatedUser = progressQuests(user, 'vocab_review', 1);
    onUpdateUser(updatedUser);
    setReviewDone((d) => d + 1);
    setRevealed(false);
    if (reviewIdx + 1 < queue.length) {
      setReviewIdx((i) => i + 1);
    } else {
      setQueue([]);
    }
  };

  const handleDelete = (id: string) => {
    deleteErrorCard(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDueCount(getDueErrorCards().filter((c) => c.language === user.learningLanguage).length);
  };

  const filteredItems = items.filter(
    (i) =>
      i.original.toLowerCase().includes(filter.toLowerCase()) ||
      i.correction.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookX className="text-red-400" /> 错题本
          </h2>
          <p className="text-muted text-sm">
            为 {user.learningLanguage} 沉淀的写作错误，间隔复习强化弱项。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setViewMode('browse')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                viewMode === 'browse' ? 'bg-neon text-white shadow-glow-neon' : 'text-muted hover:text-white'
              }`}
            >
              <Layers size={16} className="inline mr-1 -mt-0.5" /> 全部错题
            </button>
            <button
              onClick={startReview}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                viewMode === 'review' ? 'bg-neon text-white shadow-glow-neon' : 'text-muted hover:text-white'
              }`}
            >
              <Repeat size={16} className="inline mr-1 -mt-0.5" /> 复习{dueCount > 0 ? ` (${dueCount})` : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Review Mode (SRS) */}
      {viewMode === 'review' && (
        <div className="max-w-2xl mx-auto w-full">
          {queue.length > 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <div className="flex justify-between items-center mb-4 text-xs text-muted">
                <span>复习进度 {reviewDone}/{queue.length}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  Box {queue[reviewIdx]?.box ?? 1}
                </span>
              </div>
              <div className="text-sm text-muted mb-1">你的错误写法</div>
              <div className="text-2xl font-bold text-red-300 line-through decoration-red-500/50 mb-2">
                {queue[reviewIdx]?.original}
              </div>

              {!revealed ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setRevealed(true)}
                    className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
                  >
                    显示正确写法
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-4 bg-white/5 rounded-xl text-left">
                    <div className="text-green-300 font-medium text-lg mb-2">{queue[reviewIdx]?.correction}</div>
                    <p className="text-gray-300 text-sm">{queue[reviewIdx]?.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleReview(false)}
                      className="py-3 rounded-xl bg-red-600/20 text-red-300 border border-red-700/40 font-bold hover:bg-red-600/30 flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} /> 还会错
                    </button>
                    <button
                      onClick={() => handleReview(true)}
                      className="py-3 rounded-xl bg-green-600/20 text-green-300 border border-green-700/40 font-bold hover:bg-green-600/30 flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> 记住了
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <Repeat size={40} className="text-green-400 mx-auto mb-4" />
              <div className="text-xl font-bold text-white mb-1">本轮复习完成 🎉</div>
              <p className="text-muted text-sm mb-6">你刚刚复习了 {reviewDone} 个错题。间隔复习让弱项不再弱。</p>
              <button
                onClick={() => setViewMode('browse')}
                className="px-6 py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
              >
                返回错题本
              </button>
            </div>
          )}
        </div>
      )}

      {/* Browse (all) */}
      {viewMode === 'browse' && (
        <div className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-line-strong bg-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="搜索错误写法或正确写法…"
                className="w-full bg-dark border border-line-strong rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-secondary focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
            {items.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted">
                <AlertCircle size={48} className="mb-4 opacity-30" />
                <p>还没有错题。</p>
                <p className="text-sm mt-1">写完作文并获取 AI 批改后，指出的错误会自动收集到这里。</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="col-span-full text-center text-muted py-12">没有找到匹配项。</div>
            ) : (
              filteredItems.map((card) => (
                <div key={card.id} className="bg-dark/40 border border-line-strong rounded-xl p-4 hover:border-neon/40 transition-all group relative hover:shadow-glow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-red-300 line-through decoration-red-500/40 text-sm break-words">{card.original}</div>
                      <div className="text-green-300 font-medium text-sm mt-1 break-words">✓ {card.correction}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="text-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 ml-2 flex-shrink-0"
                      title="删除错题"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-muted text-xs mt-2 leading-snug border-l-2 border-neon/40 pl-2">{card.reason}</p>
                  <div className="mt-3 flex justify-between text-[10px] text-faint">
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Box {card.box}</span>
                    <span>累计出错 {card.lapses} 次</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorBookView;
