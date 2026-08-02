
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile, ScriptPack, ScriptItem } from '../types';
import { getScriptPackForLanguage } from '../data/scriptPacks.ja';
import { getDueScriptItems, reviewScriptCard, addActivity } from '../services/storageService';
import { romajiToKana } from '../services/romajiKana';
import { generateSpeech } from '../services/aiService';
import { PenLine, Volume2, Check, X, RotateCcw, Keyboard, ArrowRight, Eye, Languages } from 'lucide-react';

interface ScriptTrainerViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const ScriptTrainerView: React.FC<ScriptTrainerViewProps> = ({ user, onUpdateUser }) => {
  const pack: ScriptPack | null = useMemo(
    () => getScriptPackForLanguage(user.learningLanguage),
    [user.learningLanguage]
  );

  const [group, setGroup] = useState<string>('');
  const [queue, setQueue] = useState<ScriptItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });

  // 用 ref 记录本轮计数，避免闭包拿到旧值
  const reviewedRef = useRef(0);
  const correctRef = useRef(0);

  const current = queue[idx];

  // 虚拟键盘：当前分组去重后的字形
  const keyboardKeys = useMemo(() => {
    if (!pack || !group) return [];
    const set = new Set<string>();
    pack.items.filter(i => i.group === group).forEach(i => set.add(i.answer));
    return Array.from(set);
  }, [pack, group]);

  const startGroup = (g: string) => {
    if (!pack) return;
    const items = pack.items.filter(it => it.group === g);
    let due = getDueScriptItems(pack.id, items);
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

  const evaluate = (raw: string, known: boolean): boolean => {
    if (!current) return false;
    const isKata = current.targetScript === 'katakana';
    let userAnswer = (raw || '').trim();
    // 若输入为纯 ASCII（罗马字）则转换；否则视为已直接写出字形
    if (/^[\x00-\x7F]+$/.test(userAnswer)) {
      userAnswer = romajiToKana(userAnswer, isKata);
    }
    return userAnswer === current.answer;
  };

  const submit = () => {
    if (!current || revealed) return;
    if (!input.trim()) return;
    const ok = evaluate(input, true);
    reviewScriptCard(pack!.id, current.id, ok);
    setLastCorrect(ok);
    setRevealed(true);
    if (ok) correctRef.current += 1;
  };

  // 看答案（主动跳过，记为未掌握）
  const revealSkip = () => {
    if (!current || revealed) return;
    reviewScriptCard(pack!.id, current.id, false);
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
      user.learningLanguage,
      xp,
      `字形特训：${group} 共 ${rev} 个，正确 ${cor}`,
      { count: rev }
    );
    onUpdateUser(updated);
  };

  const speak = (text: string) => {
    if (text) generateSpeech(text, { lang: user.learningLanguage });
  };

  // 未提供该语言的字形包
  if (!pack) {
    return (
      <div className="max-w-3xl mx-auto h-full flex flex-col items-center justify-center text-center">
        <Languages size={48} className="text-gray-600 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">该语言的字形特训包即将上线</h3>
        <p className="text-gray-400 text-sm max-w-md">
          当前已支持：日本語。文字/字母产出特训是数据驱动的——任何语言（韩语 Hangul、俄语西里尔、阿拉伯文等）只要有字形映射包即可接入。
        </p>
        <p className="text-gray-500 text-xs mt-3">你正在学习：{user.learningLanguage}</p>
      </div>
    );
  }

  // 分组选择
  if (!group || sessionDone) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <PenLine className="text-secondary" /> 选择要特训的分组
          </h3>
          <p className="text-gray-400 text-sm mt-1">{pack.description}</p>
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
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center gap-2 mx-auto"
            >
              <RotateCcw size={18} /> 再来一轮
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pack.groups.map((g) => {
            const count = pack.items.filter(i => i.group === g).length;
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
          ← {group}
        </button>
        <span className="text-gray-500">{Math.min(idx + 1, queue.length)} / {queue.length}</span>
      </div>

      <div className="bg-card border border-gray-700 rounded-2xl p-8 text-center">
        <div className="text-xs text-gray-500 mb-2">请写出对应字形（罗马字或听音）</div>
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
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="输入罗马字，如 kya"
              autoFocus
              className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-3 text-center text-2xl text-white font-mono outline-none focus:border-secondary"
            />
            <div className="flex gap-3">
              <button
                onClick={submit}
                disabled={!input.trim()}
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
