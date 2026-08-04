import React, { useState, useRef, useMemo, useEffect } from 'react';
import { UserProfile, ScriptPack, ScriptItem } from '../types';
import { getScriptPacks, getScriptPackForLanguage } from '../data/scriptPacks';
import { getDueScriptItems, reviewScriptCard, addActivity } from '../services/storageService';
import { generateSpeech } from '../services/aiService';
import HandwritePad from './HandwritePad';
import { PenLine, Volume2, Check, RotateCcw, Keyboard, ArrowRight, Eye, HelpCircle, Hand } from 'lucide-react';

interface ScriptTrainerViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

type RevealKind = null | 'correct' | 'wrong' | 'stuck' | 'handwrite';
type SelfRate = null | 'correct' | 'wrong';

// 生成性提示块：只给罗马字/意思 + 再听，绝不展示答案字形（铁律）
const HintBlock: React.FC<{ prompt: string; onSpeak: () => void }> = ({ prompt, onSpeak }) => (
  <div className="bg-dark/60 border border-gray-700 rounded-xl p-4">
    <div className="text-xs text-gray-500 mb-1">提示（生成性脚手架，非答案字形）</div>
    <div className="text-xl font-bold text-gray-200 font-mono tracking-widest">{prompt}</div>
    <button onClick={onSpeak} className="mt-2 flex items-center gap-1 mx-auto text-xs text-gray-400 hover:text-secondary">
      <Volume2 size={14} /> 再听一次
    </button>
  </div>
);

const NextButton: React.FC<{ onClick: () => void; isLast: boolean }> = ({ onClick, isLast }) => (
  <button
    onClick={onClick}
    className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center justify-center gap-2"
  >
    {isLast ? '完成' : '下一个'} <ArrowRight size={18} />
  </button>
);

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
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });
  // 听音模式：隐藏文字线索，仅靠 TTS 发音写出字形
  const [listenMode, setListenMode] = useState(false);
  // 手写产出模式：与 listenMode 正交的输入通道
  const [inputMode, setInputMode] = useState<'keyboard' | 'handwrite'>('keyboard');
  // 揭示状态：null=未揭示；correct/wrong=键盘提交结果；stuck=卡住提示；handwrite=手写自评
  const [revealKind, setRevealKind] = useState<RevealKind>(null);
  const [selfRate, setSelfRate] = useState<SelfRate>(null);
  const [showOverlay, setShowOverlay] = useState(false); // 手写自评对照淡显

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
    setLastCorrect(null);
    setRevealKind(null);
    setSelfRate(null);
    setShowOverlay(false);
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
    if (!current || revealKind) return;
    if (!input.trim()) return;
    const ok = evaluate(input);
    reviewScriptCard(selectedPack.id, current.id, ok);
    setLastCorrect(ok);
    setRevealKind(ok ? 'correct' : 'wrong');
    if (ok) correctRef.current += 1;
  };

  // 铁律：卡住也绝不展示答案字形，只给生成性提示并标记困难（下次提前出现）
  const markStuck = () => {
    if (!current || revealKind) return;
    reviewScriptCard(selectedPack.id, current.id, false);
    setLastCorrect(false);
    setRevealKind('stuck');
  };

  // 手写完成：进入自评环节（仍不展示答案，由用户主动"对照"才淡显）
  const finishHandwrite = () => {
    if (!current || revealKind) return;
    setRevealKind('handwrite');
  };

  // 手写自评：用户自己判断写得对不对，驱动 SRS（纯前端无 OCR，自评最可靠）
  const selfRatePick = (ok: boolean) => {
    if (!current || selfRate) return;
    reviewScriptCard(selectedPack.id, current.id, ok);
    setSelfRate(ok ? 'correct' : 'wrong');
    setLastCorrect(ok);
    if (ok) correctRef.current += 1;
  };

  const next = () => {
    reviewedRef.current += 1;
    setStats({ reviewed: reviewedRef.current, correct: correctRef.current });
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      setInput('');
      setLastCorrect(null);
      setRevealKind(null);
      setSelfRate(null);
      setShowOverlay(false);
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

  // 听音模式：切换卡片时自动播一次（浏览器策略可能拦截首次自动播放，用户仍可点按钮补救）
  useEffect(() => {
    if (listenMode && current && !revealKind) {
      generateSpeech(current.audioText || current.answer, { lang: selectedPack.language });
    }
  }, [listenMode, idx, revealKind, current, selectedPack.language]);

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
      {/* 进度条 + 模式切换 */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <button onClick={() => { setGroup(''); setSessionDone(false); }} className="text-gray-400 hover:text-white">
          ← {selectedPack.name} · {group}
        </button>
        <div className="flex items-center gap-2">
          {/* 输入方式：键盘 / 手写（与听音模式正交） */}
          <div className="flex rounded-lg border border-gray-600 overflow-hidden">
            <button
              onClick={() => setInputMode('keyboard')}
              className={`px-2.5 py-1 text-xs ${inputMode === 'keyboard' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
            >
              键盘
            </button>
            <button
              onClick={() => setInputMode('handwrite')}
              className={`px-2.5 py-1 text-xs flex items-center gap-1 ${inputMode === 'handwrite' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Hand size={13} /> 手写
            </button>
          </div>
          <button
            onClick={() => setListenMode((m) => !m)}
            title="开启后隐藏文字线索，仅靠听音写出字形"
            className={`px-3 py-1 rounded-lg border transition-colors ${listenMode ? 'border-secondary text-secondary bg-secondary/10' : 'border-gray-600 text-gray-400 hover:text-white'}`}
          >
            {listenMode ? '🔊 听音' : '🔈 看字'}
          </button>
          <span className="text-gray-500">{Math.min(idx + 1, queue.length)} / {queue.length}</span>
        </div>
      </div>

      <div className="bg-card border border-gray-700 rounded-2xl p-8 text-center">
        <div className="text-xs text-gray-500 mb-2">
          {listenMode
            ? '听音写出对应字形（已隐藏文字线索）'
            : `根据提示写出对应字形${inputMode === 'handwrite' ? '（手写产出）' : hasTransliterate ? '（输入罗马字 / 拉丁字母）' : '（点按下方键盘）'}`}
        </div>

        {/* 提示：listenMode 显示听音圈；否则显示 prompt（罗马字/意思，绝非答案字形） */}
        {listenMode ? (
          <button
            onClick={() => speak(current.audioText || current.answer)}
            title="点击听发音"
            className="mx-auto mb-4 flex flex-col items-center justify-center w-24 h-24 rounded-full bg-secondary/20 border-2 border-secondary text-secondary hover:bg-secondary/30 transition-colors"
          >
            <Volume2 size={36} />
            <span className="text-xs mt-1">点击听音</span>
          </button>
        ) : (
          <div className="text-4xl font-bold text-white mb-4 tracking-widest font-mono">
            {current.prompt}
          </div>
        )}

        {!listenMode && (
          <button
            onClick={() => speak(current.audioText || current.answer)}
            className="flex items-center justify-center gap-2 mx-auto mb-6 text-gray-400 hover:text-secondary transition-colors"
          >
            <Volume2 size={18} /> 听发音
          </button>
        )}

        {/* 未揭示：输入区 */}
        {!revealKind && inputMode === 'keyboard' && (
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
                onClick={markStuck}
                className="px-4 py-3 rounded-xl bg-gray-700/50 text-gray-300 border border-gray-600 font-bold hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <HelpCircle size={18} /> 卡住了？
              </button>
            </div>
          </div>
        )}

        {!revealKind && inputMode === 'handwrite' && (
          <div className="space-y-4">
            <HandwritePad
              overlayChar={showOverlay ? current.answer : undefined}
              onClear={() => setShowOverlay(false)}
            />
            <button
              onClick={finishHandwrite}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center justify-center gap-2"
            >
              <Check size={18} /> 完成手写
            </button>
          </div>
        )}

        {/* 已揭示 */}
        {revealKind === 'correct' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl text-2xl font-bold bg-green-600/20 text-green-300">✓ 正确！</div>
            <HintBlock prompt={current.prompt} onSpeak={() => speak(current.audioText || current.answer)} />
            <NextButton onClick={next} isLast={idx + 1 >= queue.length} />
          </div>
        )}

        {revealKind === 'wrong' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl text-2xl font-bold bg-red-600/20 text-red-300">✗ 再想想</div>
            <HintBlock prompt={current.prompt} onSpeak={() => speak(current.audioText || current.answer)} />
            <NextButton onClick={next} isLast={idx + 1 >= queue.length} />
          </div>
        )}

        {revealKind === 'stuck' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl text-lg text-gray-300">已标记为待复习 · 下一轮会提前出现</div>
            <HintBlock prompt={current.prompt} onSpeak={() => speak(current.audioText || current.answer)} />
            <NextButton onClick={next} isLast={idx + 1 >= queue.length} />
          </div>
        )}

        {revealKind === 'handwrite' && (
          <div className="space-y-4">
            {!selfRate && (
              <>
                <button
                  onClick={() => setShowOverlay((s) => !s)}
                  className="w-full py-3 rounded-xl bg-gray-700/50 text-gray-200 border border-gray-600 font-bold hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <Eye size={18} /> {showOverlay ? '隐藏标准字形' : '对照标准字形'}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => selfRatePick(true)}
                    className="flex-1 py-3 rounded-xl bg-green-600/30 text-green-300 border border-green-600/50 font-bold hover:bg-green-600/40 flex items-center justify-center gap-2"
                  >
                    <Check size={18} /> 我对了
                  </button>
                  <button
                    onClick={() => selfRatePick(false)}
                    className="flex-1 py-3 rounded-xl bg-red-600/30 text-red-300 border border-red-600/50 font-bold hover:bg-red-600/40 flex items-center justify-center gap-2"
                  >
                    <HelpCircle size={18} /> 我错了
                  </button>
                </div>
              </>
            )}
            {selfRate && (
              <NextButton onClick={next} isLast={idx + 1 >= queue.length} />
            )}
          </div>
        )}
      </div>

      {/* 虚拟键盘（键盘模式 + 未揭示 + 无 transliterate 时） */}
      {inputMode === 'keyboard' && !revealKind && !hasTransliterate && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <Keyboard size={14} /> 或直接点按字形
          </div>
          <div className="flex flex-wrap gap-2">
            {keyboardKeys.map((k) => (
              <button
                key={k}
                onClick={() => setInput(prev => prev + k)}
                disabled={!!revealKind}
                className="w-11 h-11 rounded-lg bg-dark border border-gray-700 text-lg text-white hover:border-secondary disabled:opacity-40 transition-colors"
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptTrainerView;
