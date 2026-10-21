import React, { useState, useRef } from 'react';
import { Language, StudyBook, StudyBookType } from '../types';
import { importTextToStudyBook } from '../services/aiService';
import { parseEpub, parsePdf } from '../services/bookImport';
import { X, Loader2, Upload, Sparkles, FileText } from 'lucide-react';

const TYPE_OPTIONS: Array<{ id: StudyBookType; label: string }> = [
  { id: 'vocabulary', label: '词汇书' },
  { id: 'grammar', label: '语法书' },
  { id: 'phrases', label: '短语书' },
  { id: 'mixed', label: '综合' },
];

interface StudyBookImportDialogProps {
  language: Language;
  nativeLanguage: Language;
  onClose: () => void;
  onImported: (book: StudyBook) => void;
}

const StudyBookImportDialog: React.FC<StudyBookImportDialogProps> = ({ language, nativeLanguage, onClose, onImported }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<StudyBookType>('vocabulary');
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'epub' && ext !== 'pdf') {
      setError('仅支持 .epub 或 .pdf 文件。');
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const result = ext === 'epub' ? await parseEpub(file) : await parsePdf(file);
      if (!result.text.trim()) {
        setError('未能从文件中提取到文本。');
        return;
      }
      setText(result.text);
      if (result.author) setAuthor(result.author);
      if (!title.trim()) setTitle(file.name.replace(/\.(epub|pdf)$/i, ''));
    } catch (err) {
      setError(`解析失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!title.trim()) {
      setError('请填写书名。');
      return;
    }
    if (!text.trim()) {
      setError('请先粘贴内容或上传 EPUB / PDF 文件。');
      return;
    }
    setImporting(true);
    setError(null);
    setProgress(null);
    try {
      const book = await importTextToStudyBook(
        text,
        { title: title.trim(), language, type, author: author.trim() || undefined, nativeLanguage },
        (done, total) => setProgress({ done, total })
      );
      onImported(book);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败，请重试。');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-line-strong flex justify-between items-center bg-white/5">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-neon" /> 导入学习书
          </h3>
          <button onClick={onClose} className="text-muted hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* 书名 */}
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1">书名</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：English Collocations in Use"
              className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-4 py-3 text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition"
            />
          </div>

          {/* 类型 */}
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1">书籍类型</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setType(o.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    type === o.id ? 'bg-neon text-white shadow-glow-neon' : 'bg-white/5 text-muted hover:text-white border border-white/10'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 文件上传 */}
          <input ref={fileInputRef} type="file" accept=".epub,.pdf" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || importing}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-line-strong hover:border-neon/50 text-sm text-muted hover:text-white transition disabled:opacity-50"
          >
            {parsing ? (
              <>
                <Loader2 size={16} className="animate-spin text-neon" /> 正在解析文件…
              </>
            ) : (
              <>
                <Upload size={16} /> 上传 EPUB / PDF（自动提取正文）
              </>
            )}
          </button>

          {/* 文本粘贴 */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="或直接粘贴整本书的内容（条目之间留空行，AI 会自动结构化成分章节学习点）"
            className="w-full h-40 bg-surface-2/70 border border-line-strong rounded-xl p-4 text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition resize-none custom-scrollbar text-sm leading-relaxed"
          />

          {/* 进度 / 错误 */}
          {progress && (
            <div className="text-xs text-muted">
              正在 AI 结构化：第 {progress.done}/{progress.total} 部分…
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg text-sm border border-red-700/40 bg-red-900/10 text-red-300">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-line-strong bg-white/5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-muted hover:text-white font-medium">
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !text.trim() || !title.trim()}
            className="px-6 py-2 bg-neon hover:bg-neon/80 text-white rounded-lg font-bold shadow-glow-neon flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> AI 结构化中…
              </>
            ) : (
              <>
                <Sparkles size={16} /> AI 结构化导入
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyBookImportDialog;
