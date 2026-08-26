
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserProfile, Book } from '../types';
import { getBooks, saveBook, deleteBook, paginateText } from '../services/storageService';
import { parseEpub, parsePdf } from '../services/bookImport';
import { LibraryBig, Plus, Trash2, X, Book as BookIcon, ArrowRight, FileText, BookPlus, Upload, Loader2 } from 'lucide-react';

interface BooksViewProps {
  user: UserProfile;
  onOpenBook: (book: Book) => void;
}

const BooksView: React.FC<BooksViewProps> = ({ user, onOpenBook }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [cover, setCover] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'warn'; msg: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // IndexedDB 异步加载书架（含 localStorage 旧数据迁移）
  useEffect(() => {
    let alive = true;
    getBooks(user.learningLanguage).then((list) => { if (alive) setBooks(list); });
    return () => { alive = false; };
  }, [user.learningLanguage]);

  // 实时预览分页数
  const pagePreview = useMemo(() => {
    const pages = paginateText(text);
    return pages.length;
  }, [text]);

  const handleImport = async () => {
    const pages = paginateText(text);
    if (pages.length === 0) {
      setImportMsg({ type: 'warn', msg: '请先粘贴一本书或短篇小说的内容。' });
      return;
    }
    const book: Book = {
      id: crypto.randomUUID(),
      title: title.trim() || '未命名书籍',
      author: author.trim() || undefined,
      cover,
      language: user.learningLanguage,
      pages,
      currentPage: 0,
      createdAt: Date.now(),
    };
    setBooks(await saveBook(book));
    setTitle('');
    setAuthor('');
    setCover(undefined);
    setText('');
    setShowImport(false);
    setImportMsg(null);
  };

  // 处理 EPUB / PDF 文件导入
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'epub' && ext !== 'pdf') {
      setImportMsg({ type: 'warn', msg: '仅支持 .epub 或 .pdf 文件。' });
      return;
    }

    setParsing(true);
    setImportMsg(null);
    try {
      const result = ext === 'epub' ? await parseEpub(file) : await parsePdf(file);
      if (!result.text.trim()) {
        setImportMsg({ type: 'warn', msg: '未能从文件中提取到文本。' });
        return;
      }
      setText(result.text);
      setCover(result.cover);
      if (result.author) setAuthor(result.author);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(epub|pdf)$/i, ''));
      }
      setImportMsg({
        type: 'ok',
        msg: `已提取约 ${result.text.length} 字符${result.cover ? ' + 封面' : ''}${result.author ? ` · 作者 ${result.author}` : ''}，确认后点「导入并分页」。`,
      });
    } catch (err) {
      setImportMsg({ type: 'warn', msg: `解析失败：${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setParsing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBooks(await deleteBook(id, user.learningLanguage));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LibraryBig size={22} className="text-neon" /> 书架
          </h1>
          <p className="text-muted text-sm mt-1">
            导入一本书或短篇小说，自动分页，像读一本真正的书一样逐页打字练习。
          </p>
        </div>
        <button
          onClick={() => { setShowImport(true); setImportMsg(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon shrink-0"
        >
          <Plus size={16} /> 导入书籍
        </button>
      </div>

      {/* 导入面板 */}
      {showImport && (
        <div className="glass-panel border border-neon/30 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-neon" /> 导入一本书
            </h2>
            <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition">
              <X size={18} />
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="书名（如：1984）"
            className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition"
          />

          {/* 文件导入：EPUB / PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-line-strong hover:border-neon/50 text-sm text-muted hover:text-white transition disabled:opacity-50"
          >
            {parsing ? (
              <><Loader2 size={16} className="animate-spin text-neon" /> 正在解析文件…</>
            ) : (
              <><Upload size={16} /> 导入 EPUB / PDF 文件（自动提取正文）</>
            )}
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="粘贴整本书或短篇小说的正文（段落之间留空行会自动分页）"
            className="w-full h-64 bg-surface-2/70 border border-line-strong rounded-xl p-4 text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition resize-none custom-scrollbar text-sm leading-relaxed"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {text.trim() ? (
                <>约 <b className="text-white">{pagePreview}</b> 页（每页约 1500 字符）</>
              ) : (
                '正文会按段落边界自动分页，不切断段落'
              )}
            </span>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-2 text-white text-sm font-bold hover:bg-neon-2/80 shadow-glow-cyan"
            >
              <BookPlus size={16} /> 导入并分页
            </button>
          </div>

          {importMsg && (
            <div className={`p-3 rounded-lg text-sm border ${importMsg.type === 'ok' ? 'border-green-700/40 bg-green-900/10 text-green-300' : 'border-yellow-700/40 bg-yellow-900/10 text-yellow-200'}`}>
              {importMsg.msg}
            </div>
          )}
        </div>
      )}

      {/* 书架网格 */}
      {books.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-line rounded-2xl">
          <BookIcon size={48} className="mx-auto text-faint mb-4" />
          <p className="text-muted mb-2">书架还是空的。</p>
          <p className="text-sm text-faint">点击右上角「导入书籍」，粘贴一本书开始你的阅读打字之旅。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {books.map((book) => {
            const total = book.pages.length;
            const progress = Math.min(book.currentPage, total); // 已读页数 = 当前页索引
            const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
            const started = progress > 0;
            const done = progress >= total;
            return (
              <div
                key={book.id}
                className="group p-4 bg-surface-2/50 hover:bg-surface-3/80 border border-white/[0.06] hover:border-neon/45 hover:shadow-glow-sm rounded-2xl transition-all duration-200 flex gap-4"
              >
                {/* 封面（封面/占位） */}
                <div className="shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden bg-surface-3/70 border border-white/[0.06] flex items-center justify-center">
                  {book.cover ? (
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <BookIcon size={28} className="text-faint" />
                  )}
                </div>

                {/* 标题/进度/操作 */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-200 group-hover:text-white text-base leading-snug truncate">{book.title}</h3>
                      {book.author && <p className="text-xs text-muted truncate">{book.author}</p>}
                    </div>
                    <button
                      onClick={() => handleDelete(book.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {total} 页 · {done ? '已读完' : started ? `已读到第 ${progress} 页` : '未开始'}
                  </p>

                  <div className="w-full h-1.5 bg-line/70 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-neon to-neon-2 rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>

                  <button
                    onClick={() => onOpenBook(book)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 transition w-full justify-center mt-3"
                  >
                    {done ? '重新阅读' : started ? '继续阅读' : '开始阅读'} <ArrowRight size={16} />
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

export default BooksView;
