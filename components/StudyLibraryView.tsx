import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, StudyBook, StudyItem } from '../types';
import { getStudyBooks, ensureBuiltInStudyBooks, saveStudyBook, getDueStudyItems } from '../services/storageService';
import { BookOpen, Library, ArrowRight, Plus, RotateCcw } from 'lucide-react';
import StudyBookView from './StudyBookView';
import StudySessionView from './StudySessionView';
import StudyBookImportDialog from './StudyBookImportDialog';

const TYPE_LABELS: Record<string, string> = {
  vocabulary: '词汇书',
  grammar: '语法书',
  phrases: '短语书',
  mixed: '综合',
};

const UNIT_LABELS: Record<string, string> = {
  vocabulary: '词',
  grammar: '语法点',
  phrases: '短语',
  mixed: '项',
};

interface StudyLibraryViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const StudyLibraryView: React.FC<StudyLibraryViewProps> = ({ user, onUpdateUser }) => {
  const [books, setBooks] = useState<StudyBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  // 到期复习：按书分组的 dueDate <= now 条目
  const [dueByBook, setDueByBook] = useState<Record<string, StudyItem[]>>({});
  const [reviewMode, setReviewMode] = useState(false);
  // 进入复习时的条目快照 —— 练完 due 会清零，若直接读 dueByBook 会立刻踢回书详情
  const [reviewItems, setReviewItems] = useState<StudyItem[]>([]);

  const refreshDue = useCallback(async () => {
    try {
      const due = await getDueStudyItems();
      const grouped: Record<string, StudyItem[]> = {};
      for (const d of due) {
        // 内置书的初始 dueDate = 建书那一刻，即「立即可学」。
        // 只有真正复习过（reviews > 0）又到期了的条目才算「待复习」，
        // 否则新书一进来就会显示 210 条待复习，语义是错的。
        if ((d.item.reviews ?? 0) === 0) continue;
        (grouped[d.bookId] ??= []).push(d.item);
      }
      setDueByBook(grouped);
    } catch {
      setDueByBook({});
    }
  }, []);

  // IndexedDB 异步加载 + 首次 seed 内置书
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureBuiltInStudyBooks(user.learningLanguage);
      const list = await getStudyBooks(user.learningLanguage);
      if (alive) {
        setBooks(list);
        setLoading(false);
        await refreshDue();
      }
    })();
    return () => {
      alive = false;
    };
  }, [user.learningLanguage, refreshDue]);

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? null;
  const selectedChapter = selectedBook?.chapters.find((c) => c.id === selectedChapterId) ?? null;

  // 练习后同步 book（进度/统计），并刷新到期队列（刚练过的条目 dueDate 已推后）
  const handleBookUpdate = (updated: StudyBook) => {
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    refreshDue();
  };

  // 导入完成：入库 + 刷新书架
  const handleImported = async (book: StudyBook) => {
    await saveStudyBook(book);
    setShowImport(false);
    const list = await getStudyBooks(user.learningLanguage);
    setBooks(list);
    refreshDue();
  };

  const totalDue = books.reduce((s, b) => s + (dueByBook[b.id]?.length ?? 0), 0);

  // 复习模式：只练进入时快照下来的到期条目（可跨章）。优先于章节练习。
  if (selectedBook && reviewMode && reviewItems.length > 0) {
    const due = reviewItems;
    const firstChapterId =
      selectedBook.chapters.find((c) => c.items.some((it) => due.some((d) => d.id === it.id)))?.id
      ?? selectedBook.chapters[0]?.id
      ?? '';
    return (
      <StudySessionView
        book={selectedBook}
        chapterId={firstChapterId}
        dueItems={due}
        user={user}
        onUpdateUser={onUpdateUser}
        nativeLanguage={user.nativeLanguage}
        onBack={() => {
          setReviewMode(false);
          setReviewItems([]);
          setSelectedChapterId(null);
        }}
        onBookUpdate={handleBookUpdate}
      />
    );
  }

  // 章节练习视图
  if (selectedBook && selectedChapter) {
    return (
      <StudySessionView
        book={selectedBook}
        chapterId={selectedChapter.id}
        user={user}
        onUpdateUser={onUpdateUser}
        nativeLanguage={user.nativeLanguage}
        onBack={() => setSelectedChapterId(null)}
        onBookUpdate={handleBookUpdate}
      />
    );
  }

  // 书详情视图
  if (selectedBook) {
    return (
      <StudyBookView
        book={selectedBook}
        onOpenChapter={(id) => setSelectedChapterId(id)}
        dueCount={dueByBook[selectedBook.id]?.length ?? 0}
        onStartReview={() => {
          setReviewItems(dueByBook[selectedBook.id] ?? []);
          setReviewMode(true);
        }}
        onBack={() => {
          setSelectedBookId(null);
          setSelectedChapterId(null);
        }}
      />
    );
  }

  // 书架
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={22} className="text-neon" /> 学习书库
          </h1>
          <p className="text-muted text-sm mt-1">
            词汇书 / 语法书 / 短语书结构化学习：看词、认词、用词，一章学完再造句。
          </p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon shrink-0"
        >
          <Plus size={16} /> 导入书籍
        </button>
      </div>

      {/* 到期复习入口：SRS 的 dueDate 若不读出来，间隔重复等于没生效 */}
      {!loading && totalDue > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
          <RotateCcw size={20} className="text-amber-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-200">今日待复习 {totalDue} 条</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">
              间隔重复已排到今天 · 分布在 {Object.keys(dueByBook).length} 本书
            </div>
          </div>
          <button
            onClick={() => {
              const first = books.find((b) => (dueByBook[b.id]?.length ?? 0) > 0);
              if (first) {
                setSelectedBookId(first.id);
                setReviewItems(dueByBook[first.id] ?? []);
                setReviewMode(true);
              }
            }}
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-400 text-amber-950 text-sm font-bold hover:brightness-110 transition"
          >
            开始复习
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon/25 border-t-neon" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-line rounded-2xl">
          <Library size={48} className="mx-auto text-faint mb-4" />
          <p className="text-muted mb-2">学习书库还是空的。</p>
          <p className="text-sm text-faint">导入一本词汇书 / 语法书开始学习。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {books.map((book) => {
            const total = book.totalItems || 0;
            const done = book.completedItems || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const dueN = dueByBook[book.id]?.length ?? 0;
            return (
              <button
                key={book.id}
                onClick={() => setSelectedBookId(book.id)}
                className="group text-left p-4 bg-surface-2/50 hover:bg-surface-3/80 border border-white/[0.06] hover:border-neon/45 hover:shadow-glow-sm rounded-2xl transition-all duration-200 flex gap-4"
              >
                {/* 封面占位 */}
                <div className="shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br from-neon/20 to-neon-2/10 border border-white/[0.06] flex items-center justify-center">
                  <BookOpen size={28} className="text-neon" />
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-200 group-hover:text-white text-base leading-snug truncate">
                        {book.title}
                      </h3>
                      {book.author && <p className="text-xs text-muted truncate">{book.author}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neon/15 text-neon border border-neon/25">
                      {TYPE_LABELS[book.type] ?? book.type}
                    </span>
                  </div>

                  <p className="text-xs text-muted mt-1">
                    {book.chapters.length} 章 · {book.level ? `${book.level} · ` : ''}
                    {done}/{total} {UNIT_LABELS[book.type] ?? '项'}
                  </p>

                  {dueN > 0 && (
                    <span className="mt-1.5 inline-flex w-fit items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      <RotateCcw size={10} /> {dueN} 条待复习
                    </span>
                  )}

                  <div className="w-full h-1.5 bg-line/70 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-neon to-neon-2 rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold w-full justify-center mt-3">
                    {done > 0 ? '继续学习' : '开始学习'} <ArrowRight size={16} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 导入对话框 */}
      {showImport && (
        <StudyBookImportDialog
          language={user.learningLanguage}
          nativeLanguage={user.nativeLanguage}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
};

export default StudyLibraryView;
