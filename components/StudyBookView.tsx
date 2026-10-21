import React from 'react';
import { StudyBook } from '../types';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight } from 'lucide-react';

interface StudyBookViewProps {
  book: StudyBook;
  onOpenChapter: (chapterId: string) => void;
  onBack: () => void;
}

const UNIT_LABELS: Record<string, string> = {
  vocabulary: '词',
  grammar: '语法点',
  phrases: '短语',
  mixed: '项',
};

const StudyBookView: React.FC<StudyBookViewProps> = ({ book, onOpenChapter, onBack }) => {
  const total = book.totalItems || 0;
  const done = book.completedItems || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const unitLabel = UNIT_LABELS[book.type] ?? '项';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> 返回学习书库
      </button>

      {/* 书信息 */}
      <div className="glass-panel border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-neon/20 to-neon-2/10 border border-white/[0.06] flex items-center justify-center">
            <BookOpen size={30} className="text-neon" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white leading-tight">{book.title}</h1>
            {book.author && <p className="text-sm text-muted mt-1">{book.author}</p>}
            <div className="flex items-center gap-2 mt-2">
              {book.level && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neon-2/15 text-neon-2 border border-neon-2/25">
                  {book.level}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-muted border border-white/10">
                {book.chapters.length} 章
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted mb-1.5">
            <span>全书进度</span>
            <span>
              {done}/{total} {unitLabel} · {pct}%
            </span>
          </div>
          <div className="w-full h-2 bg-line/70 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon to-neon-2 rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 章节列表 */}
      <div className="space-y-3">
        {book.chapters.map((chapter, i) => {
          const cTotal = chapter.items.length;
          const cDone = chapter.items.filter((it) => (it.box ?? 1) >= 2).length;
          const cCompleted = cTotal > 0 && cDone >= cTotal;
          return (
            <button
              key={chapter.id}
              onClick={() => onOpenChapter(chapter.id)}
              className="group w-full text-left p-4 bg-surface-2/50 hover:bg-surface-3/80 border border-white/[0.06] hover:border-neon/45 rounded-xl transition-all duration-200 flex items-center gap-4"
            >
              <div
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                  cCompleted ? 'bg-green-600/20 text-green-300 border border-green-700/40' : 'bg-white/5 text-muted border border-white/10'
                }`}
              >
                {cCompleted ? <CheckCircle2 size={18} /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-200 group-hover:text-white text-sm truncate">{chapter.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 max-w-[200px] h-1 bg-line/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neon to-neon-2 rounded-full"
                      style={{ width: `${cTotal > 0 ? Math.round((cDone / cTotal) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted">{cDone}/{cTotal}</span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-faint group-hover:text-neon transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StudyBookView;
