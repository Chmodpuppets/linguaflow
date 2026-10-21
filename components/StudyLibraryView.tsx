import React, { useState, useEffect } from 'react';
import { UserProfile, StudyBook } from '../types';
import { getStudyBooks, ensureBuiltInStudyBooks, saveStudyBook } from '../services/storageService';
import { BookOpen, Library, ArrowRight, Plus } from 'lucide-react';
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

  // IndexedDB 异步加载 + 首次 seed 内置书
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureBuiltInStudyBooks(user.learningLanguage);
      const list = await getStudyBooks(user.learningLanguage);
      if (alive) {
        setBooks(list);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user.learningLanguage]);

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? null;
  const selectedChapter = selectedBook?.chapters.find((c) => c.id === selectedChapterId) ?? null;

  // 练习后同步 book（进度/统计）
  const handleBookUpdate = (updated: StudyBook) => {
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  // 导入完成：入库 + 刷新书架
  const handleImported = async (book: StudyBook) => {
    await saveStudyBook(book);
    setShowImport(false);
    const list = await getStudyBooks(user.learningLanguage);
    setBooks(list);
  };

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
