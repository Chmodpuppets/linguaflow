import React, { useState, useRef, useMemo, useEffect } from 'react';
import { UserProfile, ScriptPack, ScriptItem, ErrorPatternType } from '../types';
import { getScriptPacks, getScriptPackForLanguage } from '../data/scriptPacks';
import { getDueScriptItems, getCustomScriptItems, reviewScriptCard, addActivity, bumpErrorPattern, getErrorPatterns, markFlywheelStep, commitDailyStreak } from '../services/storageService';
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
  <div className="bg-dark/60 border border-line-strong rounded-xl p-4">
    <div className="text-xs text-muted mb-1">提示（生成性脚手架，非答案字形）</div>
    <div className="text-xl font-bold text-gray-200 font-mono tracking-widest">{prompt}</div>
    <button onClick={onSpeak} className="mt-2 flex items-center gap-1 mx-auto text-xs text-muted hover:text-secondary">
      <Volume2 size={14} /> 再听一次
    </button>
  </div>
);

const NextButton: React.FC<{ onClick: () => void; isLast: boolean }> = ({ onClick, isLast }) => (
  <button
    onClick={onClick}
    className="w-full py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
  >
    {isLast ? '完成' : '下一个'} <ArrowRight size={18} />
  </button>
);

// 把分组标签映射成错误模式类型（用于「个人错误模式引擎」聚合）
const groupToErrorType = (group: string): { type: ErrorPatternType; label: string } => {
  const g = group || '';
  if (g.includes('浊音') || g.includes('半浊音')) return { type: 'kana_dakuon', label: '浊音/半浊音混淆' };
  if (g.includes('拗音')) return { type: 'kana_youon', label: '拗音混淆' };
  if (g.includes('片假名') || g.includes('平假名')) return { type: 'kana_confusion', label: '假名形近混淆' };
  return { type: 'other', label: '字形产出' };
};

const ScriptTrainerView: React.FC<ScriptTrainerViewProps> = ({ user, onUpdateUser }) => {
  const packs = useMemo(() => getScriptPacks(), []);
  // 用户在内容仓库里自建的字形卡：合成一个独立包，走虚拟键盘点按（无 transliterate，符合生成式产出铁律）
  const customItems = useMemo(() => getCustomScriptItems(user.learningLanguage), [user.learningLanguage]);
  const customPack: ScriptPack | null = useMemo(() => {
    if (customItems.length === 0) return null;
    const groups = Array.from(new Set(customItems.map((i) => i.group || '自建')));
    return {
      id: `custom-${user.learningLanguage}`,
      language: user.learningLanguage,
      name: '我的自建字形卡',
      description: '你在内容仓库里自建的字形卡。点按字形产出练习（无自动罗马字校验）。',
      groups,
      items: customItems,
    };
  }, [customItems, user.learningLanguage]);
  const tabPacks = useMemo(() => (customPack ? [...packs, customPack] : packs), [packs, customPack]);
  const [packId, setPackId] = useState<string>('');
  const selectedPack: ScriptPack = useMemo(() => {
    const byId = tabPacks.find((p) => p.id === packId);
    if (byId) return byId;
    return getScriptPackForLanguage(user.learningLanguage) || packs[0];
  }, [tabPacks, packId, user.learningLanguage, packs]);

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
    // 错误模式加权：把「近期高权重错误类型命中本组」的卡片前置，强化弱项
    const patterns = getErrorPatterns(selectedPack.language);
    const weakTags = new Set(patterns.filter((p) => p.count > 0).map((p) => p.tags || []).flat());
    const weighted = [...due].sort((a, b) => (weakTags.has(b.group) ? 1 : 0) - (weakTags.has(a.group) ? 1 : 0));
    setGroup(g);
    setQueue(weighted);
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
    if (!ok) {
      const { type, label } = groupToErrorType(current.group);
      bumpErrorPattern(selectedPack.language, type, label, `${input.trim()}→${current.answer}`, [current.group]);
    }
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
    const fw = markFlywheelStep('script', selectedPack.language);
    let afterUser = updated;
    if (fw.allDone) afterUser = commitDailyStreak(updated);
    onUpdateUser(afterUser);
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
          {tabPacks.map((p) => {
            const isCustom = p.id.startsWith('custom-');
            return (
              <button
                key={p.id}
                onClick={() => selectPack(p.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${
                  p.id === selectedPack.id
                    ? 'bg-gradient-to-r from-neon to-neon-2 text-white border-transparent shadow-glow-sm'
                    : 'bg-surface-2/60 border-white/10 text-gray-300 hover:border-neon/40 hover:text-white'
                }`}
              >
                {isCustom ? `✏️ 我的自建 (${customItems.length})` : p.name}
              </button>
            );
          })}
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <PenLine className="text-secondary" /> 选择要特训的分组
          </h3>
          <p className="text-muted text-sm mt-1">{selectedPack.description}</p>
        </div>

        {sessionDone && (
          <div className="glass-panel rounded-2xl p-8 text-center mb-6 shadow-card page-enter">
            <div className="text-3xl mb-2">{stats.correct === stats.reviewed ? '🎉' : '💪'}</div>
            <div className="text-xl font-bold text-white mb-1">本轮完成</div>
            <p className="text-muted text-sm mb-4">
              共 {stats.reviewed} 个，答对 {stats.correct} 个。间隔复习让字形真正长进肌肉记忆。
            </p>
            <button
              onClick={() => startGroup(group)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
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
                className="glass-panel hover:border-neon/45 hover:shadow-glow-sm hover:-translate-y-0.5 rounded-2xl p-6 text-left transition-all duration-200 group"
              >
                <div className="text-lg font-bold text-white mb-1 group-hover:text-violet-300 transition-colors">{g}</div>
                <div className="text-xs text-muted">{count} 个字形</div>
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
        <button onClick={() => { setGroup(''); setSessionDone(false); }} className="text-muted hover:text-white">
          ← {selectedPack.name} · {group}
        </button>
        <div className="flex items-center gap-2">
          {/* 输入方式：键盘 / 手写（与听音模式正交） */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setInputMode('keyboard')}
              className={`px-2.5 py-1 text-xs transition-all duration-200 ${inputMode === 'keyboard' ? 'bg-neon/25 text-white shadow-glow-sm' : 'text-muted hover:text-white'}`}
            >
              键盘
            </button>
            <button
              onClick={() => setInputMode('handwrite')}
              className={`px-2.5 py-1 text-xs flex items-center gap-1 transition-all duration-200 ${inputMode === 'handwrite' ? 'bg-neon/25 text-white shadow-glow-sm' : 'text-muted hover:text-white'}`}
            >
              <Hand size={13} /> 手写
            </button>
          </div>
          <button
            onClick={() => setListenMode((m) => !m)}
            title="开启后隐藏文字线索，仅靠听音写出字形"
            className={`px-3 py-1 rounded-lg border transition-all duration-200 ${listenMode ? 'border-neon-2/60 text-cyan-300 bg-neon-2/10 shadow-glow-cyan' : 'border-white/10 text-muted hover:text-white'}`}
          >
            {listenMode ? '🔊 听音' : '🔈 看字'}
          </button>
          <span className="text-muted">{Math.min(idx + 1, queue.length)} / {queue.length}</span>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-8 text-center shadow-card">
        <div className="text-xs text-muted mb-2">
          {listenMode
            ? '听音写出对应字形（已隐藏文字线索）'
            : `根据提示写出对应字形${inputMode === 'handwrite' ? '（手写产出）' : hasTransliterate ? '（输入罗马字 / 拉丁字母）' : '（点按下方键盘）'}`}
        </div>

        {/* 提示：listenMode 显示听音圈；否则显示 prompt（罗马字/意思，绝非答案字形） */}
        {listenMode ? (
          <button
            onClick={() => speak(current.audioText || current.answer)}
            title="点击听发音"
            className="mx-auto mb-4 flex flex-col items-center justify-center w-24 h-24 rounded-full bg-neon/15 border-2 border-neon/60 text-violet-300 hover:bg-neon/25 hover:shadow-glow-neon transition-all duration-300 logo-glow"
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
            className="flex items-center justify-center gap-2 mx-auto mb-6 text-muted hover:text-secondary transition-colors"
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
                className="w-full bg-dark border border-white/10 rounded-lg px-4 py-3 text-center text-2xl text-white font-mono outline-none focus:border-neon/50 focus:ring-2 focus:ring-neon/30 focus:shadow-glow-sm transition-all duration-300"
              />
            ) : (
              <div className="text-sm text-muted py-2">该文字无简单拉丁映射，请用下方键盘点按字形。</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={submit}
                disabled={!input.trim() && hasTransliterate}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} /> 提交
              </button>
              <button
                onClick={markStuck}
                className="px-4 py-3 rounded-xl bg-surface-3/50 text-gray-300 border border-line-strong font-bold hover:bg-surface-3 flex items-center justify-center gap-2"
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
              className="w-full py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Check size={18} /> 完成手写
            </button>
          </div>
        )}

        {/* 已揭示 */}
        {revealKind === 'correct' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl text-2xl font-bold bg-green-600/20 text-green-300 border border-green-500/30 shadow-[0_0_20px_-4px_rgba(74,222,128,0.45)] page-enter">✓ 正确！</div>
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
                  className="w-full py-3 rounded-xl bg-surface-3/50 text-gray-200 border border-line-strong font-bold hover:bg-surface-3 flex items-center justify-center gap-2"
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
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <Keyboard size={14} /> 或直接点按字形
          </div>
          <div className="flex flex-wrap gap-2">
            {keyboardKeys.map((k) => (
              <button
                key={k}
                onClick={() => setInput(prev => prev + k)}
                disabled={!!revealKind}
                className="w-11 h-11 rounded-lg bg-dark border border-white/10 text-lg text-white hover:border-neon/60 hover:shadow-glow-sm hover:-translate-y-0.5 disabled:opacity-40 transition-all duration-200"
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
