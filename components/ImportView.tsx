
import React, { useState } from 'react';
import { UserProfile, UserContent, VocabularyItem, Language } from '../types';
import { saveLibraryItem, saveVocabularyItem } from '../services/storageService';
import { generateWordDetails } from '../services/aiService';
import { Upload, Scissors, BookPlus, Sparkles, AlertTriangle, Link as LinkIcon, CheckCircle2 } from 'lucide-react';

interface ImportViewProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
}

const ImportView: React.FC<ImportViewProps> = ({ user }) => {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'ok' | 'warn'; msg: string } | null>(null);

  const lang: Language = user.learningLanguage;

  const extractWords = (raw: string): string[] => {
    const tokens = raw
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    const freq = new Map<string, number>();
    for (const w of tokens) freq.set(w, (freq.get(w) || 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map((e) => e[0]);
  };

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setStatus({ type: 'info', msg: '正在抓取网页……' });
    try {
      const res = await fetch(url.trim());
      const html = await res.text();
      // 粗略去标签、取正文文本
      const plain = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      setText(plain.slice(0, 4000));
      if (!title) setTitle(url.split('/').slice(-1)[0] || '导入内容');
      setStatus({ type: 'ok', msg: '已抓取，可编辑后保存或提取词汇。' });
    } catch (e) {
      setStatus({
        type: 'warn',
        msg: '该网址被浏览器 CORS 限制无法直接抓取。请复制页面文字，粘贴到上方文本框（本地解析，无需联网）。',
      });
    } finally {
      setBusy(false);
    }
  };

  const saveToMemoryBank = () => {
    if (text.trim().length < 10) {
      setStatus({ type: 'warn', msg: '请先粘贴或抓取一些内容。' });
      return;
    }
    const item: UserContent = {
      id: crypto.randomUUID(),
      title: title.trim() || text.slice(0, 30) + '…',
      content: text.trim(),
      notes: `从导入内容创建 · ${new Date().toLocaleDateString()}`,
      language: lang,
      createdAt: Date.now(),
    };
    saveLibraryItem(item);
    setStatus({ type: 'ok', msg: '已存入「记忆库」，可去那里点「练习」做打字训练。' });
  };

  const extractVocab = async () => {
    if (text.trim().length < 10) {
      setStatus({ type: 'warn', msg: '请先粘贴内容再提取词汇。' });
      return;
    }
    setBusy(true);
    setStatus({ type: 'info', msg: '正在提取高频词并补充释义……' });
    const words = extractWords(text);
    let added = 0;
    for (const w of words) {
      let details = { definition: '（离线占位，联网后可由 AI 补充）', example: '', partOfSpeech: '词性' };
      try {
        const d = await generateWordDetails(w, lang, user.nativeLanguage);
        details = { definition: d.definition, example: d.example, partOfSpeech: d.partOfSpeech };
      } catch {
        /* 离线时保留占位 */
      }
      const item: VocabularyItem = {
        id: crypto.randomUUID(),
        word: w,
        definition: details.definition,
        exampleSentence: details.example,
        partOfSpeech: details.partOfSpeech,
        language: lang,
        createdAt: Date.now(),
      };
      saveVocabularyItem(item);
      added += 1;
    }
    setStatus({ type: 'ok', msg: `已从内容中提取并加入词库 ${added} 个单词，去「词汇」复习。` });
    setBusy(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Upload size={22} className="text-primary" /> 导入你的内容
        </h1>
        <p className="text-muted text-sm mt-1">
          学你<b className="text-white">自己</b>感兴趣的材料——追的剧、读的文章、工作的文档。粘进来就能变成打字、词汇和记忆练习。
        </p>
      </div>

      {status && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            status.type === 'ok'
              ? 'border-green-700/40 bg-green-900/10 text-green-300'
              : status.type === 'warn'
              ? 'border-yellow-700/40 bg-yellow-900/10 text-yellow-200'
              : 'border-line-strong bg-surface/60 text-gray-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {status.type === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            <span>{status.msg}</span>
          </div>
        </div>
      )}

      {/* URL fetch */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-card border border-line rounded-lg px-3">
          <LinkIcon size={16} className="text-muted" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴文章/网页网址（受 CORS 限制时请用下方粘贴）"
            className="flex-1 bg-transparent py-2.5 outline-none text-sm text-white placeholder:text-faint"
          />
        </div>
        <button
          onClick={fetchUrl}
          disabled={busy}
          className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? '抓取中…' : '抓取'}
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="给这段内容起个标题（可选）"
        className="w-full bg-card border border-line rounded-lg px-3 py-2.5 outline-none text-sm text-white placeholder:text-faint"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="在此粘贴文本（YouTube 字幕、新闻、文档……）。本地解析，不上传第三方。"
        className="w-full h-56 bg-card border border-line rounded-lg p-3 outline-none text-sm text-white placeholder:text-faint resize-none custom-scrollbar"
      />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={saveToMemoryBank}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-white text-sm font-bold hover:bg-secondary/80"
        >
          <BookPlus size={16} /> 存入记忆库
        </button>
        <button
          onClick={extractVocab}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/80 disabled:opacity-50"
        >
          <Scissors size={16} /> 提取词汇进词库
        </button>
        <span className="flex items-center gap-1 text-xs text-muted self-center">
          <Sparkles size={14} /> 高频词自动去重，释义由 AI 补充
        </span>
      </div>

      <div className="text-xs text-faint border-t border-line pt-3">
        隐私说明：内容仅保存在你本地浏览器（localStorage），不会上传到任何服务器。通过网址抓取在浏览器端可能因跨域（CORS）失败，此时请手动复制文字粘贴。
      </div>
    </div>
  );
};

export default ImportView;
