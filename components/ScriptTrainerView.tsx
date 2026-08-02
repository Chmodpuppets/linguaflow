
import React, { useState, useRef, useMemo } from 'react';
import { UserProfile, ScriptPack, ScriptItem } from '../types';
import { getScriptPacks, getScriptPackForLanguage } from '../data/scriptPacks';
import { getDueScriptItems, reviewScriptCard, addActivity } from '../services/storageService';
import { generateSpeech } from '../services/aiService';
import { PenLine, Volume2, Check, RotateCcw, Keyboard, ArrowRight, Eye } from 'lucide-react';

interface ScriptTrainerViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const ScriptTrainerView: React.FC<ScriptTrainerViewProps> = ({ user, onUpdateUser }) => {
  const packs = useMemo(() => getScriptPacks(), []);
  const [packId, setPackId] = useState<string>('');
  const selectedPack: ScriptPack = useMemo(() => {
    const byId = packs.find(p => p.id === packId);
    if (byId) return byId;
    return getScriptPackForLanguage(user.learningLanguage) || packs[0];
  }, [packs, packId, user.learningLanguage]);

  const [group, setGroup] = useState<string>('');
  const [queue, setQueue] = useState<ScriptItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });

  const reviewedRef = useRef(0);
  const correctRef = useRef(0);

  const current = queue[idx];

  // 虚拟键盘：当前分组去重后的字形
  const keyboardKeys = useMemo(() => {
    if (!selectedPack || !group) return [];
    const set = new Set<string>();
    selectedPack.items.filter(i => i.group === group).forEach(i => set.add(i.answer));
    return Array.from(set);
  }, [selectedPack, group]);

  const selectPack = (id: string) => {
    setPackId(id);
    setGroup('');
    setSessionDone(false);
  };

  const startGroup = (g: string) => {
    if (!selectedPack) return;
    const items = selectedPack.items.filter(it => it.group === g);
    let due = getDueScriptItems(selectedPack.id, items);
    if (due.length === 0) due = items; // 全部已熟也可整体复习
    setGroup(g);
    setQueue(due);
    setIdx(0);
    setInput('');
    setRevealed(false);
    setLastCorrect(null);
    setSessionDone(false);
    setStats({ reviewed: 0, correct: 0 });
    reviewedRef.current = 0;
    correctRef.current = 0;
  };

  const evaluate = (raw: string): boolean => {
    if (!current) return false;
    let userAnswer = (raw || '').trim();
    // 纯 ASCII（拉丁/罗马字）且有转换器时，转成目标字形再比对
    if (/^[\x00-\x7F]+$/.test(userAnswer) && selectedPack.transliterate) {
      userAnswer = selectedPack.transliterate(userAnswer, current);
    }
    return userAnswer === current.answer;
  };

  const submit = () => {
    if (!current || revealed) return;
    if (!input.trim()) return;
    const ok = evaluate(input);
    reviewScriptCard(selectedPack.id, current.id, ok);
    setLastCorrect(ok);
    setRevealed(true);
    if (ok) correctRef.current += 1;
  };

  // 看答案（主动跳过，记为未掌握）
  const revealSkip = () => {
    if (!current || revealed) return;
    reviewScriptCard(selectedPack.id, current.id, false);
    setLastCorrect(false);
    setRevealed(true);
  };

  const next = () => {
    reviewedRef.current += 1;
    setStats({ reviewed: reviewedRef.current, correct: correctRef.current });
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      setInput('');
      setRevealed(false);
      setLastCorrect(null);
    } else {
      finishSession();
      setSessionDone(true);
    }
  };

  const finishSession = () => {
    const rev = reviewedRef.current;
    const cor = correctRef.current;
    if (rev <= 0) return;
    const xp = cor * 3 + (rev - cor) * 1; // 对 +3，错 +1
    const { user: updated } = addActivity(
      user,
      'script',
      selectedPack.language,
      xp,
      `字形特训：${selectedPack.name} · ${group} 共 ${rev} 个，正确 ${cor}`,
      { count: rev }
    );
    onUpdateUser(updated);
  };

  const speak = (text: string) => {
    if (text) generateSpeech(text, { lang: selectedPack.language });
  };

  const hasTransliterate = !!selectedPack.transliterate;

  // 分组选择
  if (!group || sessionDone) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* 语言切换 tab */}
        <div className="flex flex-wrap gap-2 mb-6">
          {packs.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPack(p.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                p.id === selectedPack.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-gray-700 text-gray-300 hover:border-secondary'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <PenLine className="text-secondary" /> 选择要特训的分组
          </h3>
          <p className="text-gray-400 text-sm mt-1">{selectedPack.description}</p>
        </div>

        {sessionDone && (
          <div className="bg-card border border-gray-700 rounded-2xl p-8 text-center mb-6">
            <div className="text-3xl mb-2">{stats.correct === stats.reviewed ? '🎉' : '💪'}</div>
            <div className="text-xl font-bold text-white mb-1">本轮完成</div>
            <p className="text-gray-400 text-sm mb-4">
              共 {stats.reviewed} 个，答对 {stats.correct} 个。间隔复习让字形真正长进肌肉记忆。
            </p>
            <button
              onClick={() => startGroup(group)}
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center justify-center gap-2 mx-auto"
            >
              <RotateCcw size={18} /> 再来一轮
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedPack.groups.map((g) => {
            const count = selectedPack.items.filter(i => i.group === g).length;
            return (
              <button
                key={g}
                onClick={() => startGroup(g)}
                className="bg-card border border-gray-700 hover:border-secondary rounded-2xl p-6 text-left transition-colors group"
              >
                <div className="text-lg font-bold text-white mb-1 group-hover:text-secondary transition-colors">{g}</div>
                <div className="text-xs text-gray-500">{count} 个字形</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 训练中
  return (
    <div className="max-w-2xl mx-auto">
      {/* 进度条 */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <button onClick={() => { setGroup(''); setSessionDone(false); }} className="text-gray-400 hover:text-white">
          ← {selectedPack.name} · {group}
        </button>
        <span className="text-gray-500">{Math.min(idx + 1, queue.length)} / {queue.length}</span>
      </div>

      <div className="bg-card border border-gray-700 rounded-2xl p-8 text-center">
        <div className="text-xs text-gray-500 mb-2">
          请写出对应字形{hasTransliterate ? '（输入罗马字 / 拉丁字母）' : '（点按下方键盘）'}
        </div>
        <div className="text-4xl font-bold text-white mb-4 tracking-widest font-mono">
          {current.prompt}
        </div>

        <button
          onClick={() => speak(current.audioText || current.answer)}
          className="flex items-center justify-center gap-2 mx-auto mb-6 text-gray-400 hover:text-secondary transition-colors"
        >
          <Volume2 size={18} /> 听发音
        </button>

        {!revealed ? (
          <div className="space-y-4">
            {hasTransliterate ? (
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="输入罗马字 / 拉丁字母"
                autoFocus
                className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-3 text-center text-2xl text-white font-mono outline-none focus:border-secondary"
              />
            ) : (
              <div className="text-sm text-gray-500 py-2">该文字无简单拉丁映射，请用下方键盘点按字形。</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={submit}
                disabled={!input.trim() && hasTransliterate}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} /> 提交
              </button>
              <button
                onClick={revealSkip}
                className="px-4 py-3 rounded-xl bg-gray-700/50 text-gray-300 border border-gray-600 font-bold hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <Eye size={18} /> 看答案
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl text-2xl font-bold font-mono ${lastCorrect ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}>
              {lastCorrect ? '✓ 正确' : '✗ 正确答案'}：{current.answer}
            </div>
            <button
              onClick={next}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center justify-center gap-2"
            >
              {idx + 1 < queue.length ? '下一个' : '完成'} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* 虚拟键盘（跨语言通用：直接点按目标字形） */}
      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Keyboard size={14} /> 或直接点按字形
        </div>
        <div className="flex flex-wrap gap-2">
          {keyboardKeys.map((k) => (
            <button
              key={k}
              onClick={() => setInput(prev => prev + k)}
              disabled={revealed}
              className="w-11 h-11 rounded-lg bg-dark border border-gray-700 text-lg text-white hover:border-secondary disabled:opacity-40 transition-colors"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScriptTrainerView;
