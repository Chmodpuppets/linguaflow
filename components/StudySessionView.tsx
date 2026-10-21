import React, { useState } from 'react';
import { StudyBook, StudyItem, StudyItemQuality, Language, UserProfile } from '../types';
import { reviewStudyItem, recomputeStudyBookStats, saveStudyBook, addActivity, saveVocabularyItem, promoteStudyItemToVocabulary, getVocabulary } from '../services/storageService';
import { evaluateProductionSentence } from '../services/aiService';
import { ArrowLeft, Layers, MousePointerClick, Type, PenLine, PenTool, Loader2, BookA, Check } from 'lucide-react';

type StudyMode = 'flashcard' | 'recognition' | 'recall' | 'cloze' | 'production';

const MODES: Array<{ id: StudyMode; label: string; icon: React.ReactNode }> = [
  { id: 'flashcard', label: '看词', icon: <Layers size={15} /> },
  { id: 'recognition', label: '认词', icon: <MousePointerClick size={15} /> },
  { id: 'recall', label: '回忆', icon: <Type size={15} /> },
  { id: 'cloze', label: '填空', icon: <PenLine size={15} /> },
  { id: 'production', label: '造句', icon: <PenTool size={15} /> },
];

interface StudySessionViewProps {
  book: StudyBook;
  chapterId: string;
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  nativeLanguage: Language;
  onBack: () => void;
  onBookUpdate: (updated: StudyBook) => void;
}

const StudySessionView: React.FC<StudySessionViewProps> = ({ book, chapterId, user, onUpdateUser, nativeLanguage, onBack, onBookUpdate }) => {
  const chapter = book.chapters.find((c) => c.id === chapterId);
  const [items, setItems] = useState<StudyItem[]>(() => chapter?.items ?? []);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<StudyMode>('flashcard');
  const [revealed, setRevealed] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ ok: boolean; quality: StudyItemQuality; msg?: string } | null>(null);
  const [productionText, setProductionText] = useState('');
  const [productionResult, setProductionResult] = useState<{ quality: StudyItemQuality; feedback: string } | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [done, setDone] = useState(false);
  const [promoteState, setPromoteState] = useState<'idle' | 'added' | 'exists'>('idle');

  if (!chapter || items.length === 0) {
    return (
      <div className="text-center py-20 text-muted">
        <p>本章节暂无内容。</p>
        <button onClick={onBack} className="mt-4 text-neon hover:underline">
          返回
        </button>
      </div>
    );
  }

  const current = items[idx];
  const total = items.length;

  // grammar 类型不适用「回忆 / 填空」（语法点无法按词形反写 / 挖空），仅保留看词 / 认词 / 造句
  const availableModes = MODES.filter(
    (m) => current.type !== 'grammar' || (m.id !== 'recall' && m.id !== 'cloze')
  );

  // 写回：更新 items → 重算 book 统计 → saveStudyBook + 通知父组件
  const persist = (newItems: StudyItem[]) => {
    setItems(newItems);
    const ci = book.chapters.findIndex((c) => c.id === chapterId);
    const newBook = recomputeStudyBookStats({
      ...book,
      chapters: book.chapters.map((c, i) => (i === ci ? { ...c, items: newItems } : c)),
      lastStudiedAt: Date.now(),
    });
    saveStudyBook(newBook).catch(() => {});
    onBookUpdate(newBook);
  };

  const advance = (quality: StudyItemQuality) => {
    const updated = reviewStudyItem(current, quality);
    const newItems = items.map((i) => (i.id === updated.id ? updated : i));
    persist(newItems);
    // 复习 +XP（good=2, ok=1, poor=0）
    if (quality !== 'poor') {
      const xp = quality === 'good' ? 2 : 1;
      const { user: updatedUser } = addActivity(
        user,
        'vocabulary',
        book.language,
        xp,
        `学习书库复习：${current.prompt}`,
        { word: current.prompt }
      );
      onUpdateUser(updatedUser);
    }
    // 重置当前模式状态
    setRevealed(false);
    setOptions([]);
    setInput('');
    setResult(null);
    setProductionText('');
    setProductionResult(null);
    setPromoteState('idle');
    // 下一 item 类型若不支持当前模式（grammar 无 recall/cloze），回退 flashcard
    const next = items[idx + 1];
    if (next && next.type === 'grammar' && (mode === 'recall' || mode === 'cloze')) {
      setMode('flashcard');
    }
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else {
      setDone(true);
    }
  };

  // 加入词汇库（仅 word / phrase）
  const handlePromote = () => {
    if (current.type !== 'word' && current.type !== 'phrase') return;
    const exists = getVocabulary().some(
      (v) => v.word.toLowerCase() === current.prompt.toLowerCase() && v.language === book.language
    );
    if (exists) {
      setPromoteState('exists');
      return;
    }
    const vocab = promoteStudyItemToVocabulary(current, book.language);
    saveVocabularyItem(vocab);
    setPromoteState('added');
  };

  const switchMode = (m: StudyMode) => {
    setMode(m);
    setRevealed(false);
    setOptions([]);
    setInput('');
    setResult(null);
    setProductionText('');
    setProductionResult(null);
  };

  const buildOptions = (item: StudyItem): string[] => {
    const others = items.filter((i) => i.id !== item.id).map((i) => i.answer);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    return [item.answer, ...shuffled].sort(() => Math.random() - 0.5);
  };

  const makeCloze = (item: StudyItem): string => {
    const ex = item.examples[0] || '';
    const esc = item.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cloze = ex.replace(new RegExp(esc, 'gi'), '____');
    return cloze === ex ? `${ex} ____` : cloze;
  };

  const isCorrect = (text: string, target: string): boolean =>
    text.trim().toLowerCase() === target.trim().toLowerCase();

  const handlePickOption = (opt: string) => {
    if (result) return;
    const ok = opt === current.answer;
    setResult(ok ? { ok, quality: 'good' } : { ok, quality: 'poor', msg: `正确答案：${current.answer}` });
  };

  const handleSubmitInput = () => {
    if (result || !input.trim()) return;
    if (isCorrect(input, current.prompt)) {
      setResult({ ok: true, quality: 'good' });
    } else {
      setResult({ ok: false, quality: 'poor', msg: `正确答案：${current.prompt}` });
    }
  };

  const handleProduction = async () => {
    if (!productionText.trim() || evaluating) return;
    setEvaluating(true);
    try {
      const r = await evaluateProductionSentence(current, productionText, nativeLanguage);
      setProductionResult(r);
    } catch {
      setProductionResult({ quality: 'poor', feedback: '评分失败，请重试。' });
    } finally {
      setEvaluating(false);
    }
  };

  if (done) {
    const completed = items.filter((i) => (i.box ?? 1) >= 2).length;
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-2">本章学习完成</h2>
        <p className="text-muted mb-6">
          本章 {total} 个学习点，其中 {completed} 个已掌握（Box ≥ 2）。
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
        >
          返回章节
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors">
          <ArrowLeft size={16} /> 退出
        </button>
        <span className="text-sm text-muted">
          {idx + 1} / {total}
        </span>
      </div>
      <div className="w-full h-1.5 bg-line/70 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon to-neon-2 rounded-full transition-[width] duration-300"
          style={{ width: `${Math.round((idx / total) * 100)}%` }}
        />
      </div>

      {/* 模式切换 */}
      <div className="flex flex-wrap gap-2">
        {availableModes.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              mode === m.id ? 'bg-neon text-white shadow-glow-neon' : 'bg-white/5 text-muted hover:text-white border border-white/10'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* 练习卡 */}
      <div className="glass-panel rounded-2xl p-8 text-center">
        <span className="inline-block text-xs font-mono text-neon-2 px-2 py-0.5 bg-neon-2/10 rounded-full border border-neon-2/20 mb-4">
          {current.type}
          {current.partOfSpeech ? ` · ${current.partOfSpeech}` : ''}
        </span>

        {/* Flashcard */}
        {mode === 'flashcard' && (
          <div>
            <div className="text-3xl font-bold text-white mb-6">{current.prompt}</div>
            {current.pronunciation && (
              <div className="text-neon-2 text-lg font-medium -mt-4 mb-6">{current.pronunciation}</div>
            )}
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
              >
                显示答案
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-xl text-left">
                  <p className="text-gray-200 text-sm mb-3">{current.answer}</p>
                  {current.pattern && (
                    <p className="text-neon-2 text-xs font-mono mb-3">{current.pattern}</p>
                  )}
                  {current.examples.map((ex, i) => (
                    <p key={i} className="text-muted text-xs italic mb-1">
                      "{ex}"
                    </p>
                  ))}
                  {current.variations && current.variations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {current.variations.map((v, i) => (
                        <span key={i} className="text-[10px] text-neon-2 px-2 py-0.5 bg-neon-2/10 rounded-full">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                  {current.collocations && current.collocations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {current.collocations.map((c, i) => (
                        <span key={i} className="text-[10px] text-neon px-2 py-0.5 bg-neon/10 rounded-full">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {(current.type === 'word' || current.type === 'phrase') && (
                  <button
                    onClick={handlePromote}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      promoteState === 'added'
                        ? 'bg-green-600/20 text-green-300 border-green-700/40'
                        : promoteState === 'exists'
                        ? 'bg-white/5 text-muted border-white/10'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:border-neon/50 hover:text-white'
                    }`}
                  >
                    {promoteState === 'added' ? '✓ 已加入词汇库' : promoteState === 'exists' ? '已在词汇库中' : '加入词汇库'}
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => advance('poor')} className="py-3 rounded-xl bg-red-600/20 text-red-300 border border-red-700/40 font-bold hover:bg-red-600/30">
                    还没记住
                  </button>
                  <button onClick={() => advance('ok')} className="py-3 rounded-xl bg-yellow-600/20 text-yellow-300 border border-yellow-700/40 font-bold hover:bg-yellow-600/30">
                    差不多
                  </button>
                  <button onClick={() => advance('good')} className="py-3 rounded-xl bg-green-600/20 text-green-300 border border-green-700/40 font-bold hover:bg-green-600/30">
                    记住了
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recognition */}
        {mode === 'recognition' && (
          <div>
            <div className="text-3xl font-bold text-white mb-6">{current.prompt}</div>
            <p className="text-muted text-sm mb-4">选出正确的释义</p>
            {options.length === 0 && !result ? (
              <button
                onClick={() => setOptions(buildOptions(current))}
                className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
              >
                开始
              </button>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handlePickOption(opt)}
                    disabled={result !== null}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:border-neon/50 transition-colors text-sm disabled:opacity-60"
                  >
                    {opt}
                  </button>
                ))}
                {result && (
                  <div className="space-y-3">
                    <div className={`text-sm font-bold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {result.ok ? '✓ 正确' : `✗ ${result.msg}`}
                    </div>
                    <button onClick={() => advance(result.quality)} className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80">
                      继续 →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recall */}
        {mode === 'recall' && (
          <div>
            <div className="p-4 bg-white/5 rounded-xl text-left mb-6">
              <p className="text-gray-200 text-sm">{current.answer}</p>
            </div>
            <p className="text-muted text-sm mb-3">写出对应的词 / 短语</p>
            {!result ? (
              <div>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitInput();
                  }}
                  placeholder="输入答案…"
                  className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-4 py-3 text-white text-center placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition mb-4"
                />
                <button onClick={handleSubmitInput} className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon">
                  提交
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`text-sm font-bold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? '✓ 正确' : `✗ ${result.msg}`}
                </div>
                <button onClick={() => advance(result.quality)} className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80">
                  继续 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cloze */}
        {mode === 'cloze' && (
          <div>
            <div className="p-4 bg-white/5 rounded-xl text-left mb-6">
              <p className="text-gray-200 text-sm leading-relaxed">{makeCloze(current)}</p>
            </div>
            <p className="text-muted text-sm mb-3">填入被挖空的词</p>
            {!result ? (
              <div>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitInput();
                  }}
                  placeholder="输入答案…"
                  className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-4 py-3 text-white text-center placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition mb-4"
                />
                <button onClick={handleSubmitInput} className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon">
                  提交
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`text-sm font-bold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? '✓ 正确' : `✗ ${result.msg}`}
                </div>
                <button onClick={() => advance(result.quality)} className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80">
                  继续 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Production */}
        {mode === 'production' && (
          <div>
            <div className="text-2xl font-bold text-white mb-2">{current.prompt}</div>
            {current.pattern && <p className="text-neon-2 text-xs font-mono mb-2">{current.pattern}</p>}
            <p className="text-muted text-xs mb-5">{current.answer}</p>
            {!productionResult ? (
              <div>
                <textarea
                  value={productionText}
                  onChange={(e) => setProductionText(e.target.value)}
                  placeholder={current.type === 'grammar' ? `用「${current.prompt}」的句型造一个自己的句子…` : `用 "${current.prompt}" 造一个自己的句子…`}
                  className="w-full h-28 bg-surface-2/70 border border-line-strong rounded-xl p-4 text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition resize-none text-sm mb-4"
                />
                <button
                  onClick={handleProduction}
                  disabled={!productionText.trim() || evaluating}
                  className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {evaluating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> AI 评分中…
                    </>
                  ) : (
                    '提交 AI 评分'
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl text-left border ${
                    productionResult.quality === 'good'
                      ? 'border-green-700/40 bg-green-900/10'
                      : productionResult.quality === 'poor'
                      ? 'border-red-700/40 bg-red-900/10'
                      : 'border-yellow-700/40 bg-yellow-900/10'
                  }`}
                >
                  <p
                    className={`font-bold mb-1 ${
                      productionResult.quality === 'good'
                        ? 'text-green-300'
                        : productionResult.quality === 'poor'
                        ? 'text-red-300'
                        : 'text-yellow-300'
                    }`}
                  >
                    {productionResult.quality === 'good' ? '✓ 用得不错' : productionResult.quality === 'poor' ? '✗ 需要改进' : '~ 基本可以'}
                  </p>
                  <p className="text-gray-300 text-sm">{productionResult.feedback}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setProductionText('');
                      setProductionResult(null);
                    }}
                    className="py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-bold hover:bg-white/10"
                  >
                    再试一次
                  </button>
                  <button onClick={() => advance(productionResult.quality)} className="py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80">
                    继续 →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudySessionView;
