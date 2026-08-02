
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GuidedWritingFeedback, GuidedMode, CEFRLevel } from '../types';
import { analyzeGuidedWriting, GuidedContext, generateSentenceWords, generateSpeech } from '../services/aiService';
import { addActivity } from '../services/storageService';
import { getGuidedTemplate, getGuidedPrompt, hasGuidedTemplates, GuidedTemplate } from '../data/guidedWriting';
import { Sparkles, Check, ArrowRight, RefreshCw, Lightbulb, Wand2, Volume2, AlertCircle } from 'lucide-react';

interface GuidedWritingViewProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
}

const MODE_INFO: Record<GuidedMode, { name: string; desc: string }> = {
  scaffold: { name: '句型填空', desc: '按模板填空，产出完整句' },
  wordchain: { name: '看词造句', desc: '用给定词造一句话' },
  prompt: { name: '情境一句', desc: '按情境写 1-3 句' },
};

const GuidedWritingView: React.FC<GuidedWritingViewProps> = ({ user, onComplete }) => {
  const userLevel = user.progress[user.learningLanguage]?.cefrLevel ?? CEFRLevel.A1;
  const [mode, setMode] = useState<GuidedMode>('scaffold');

  // 出题状态
  const [template, setTemplate] = useState<GuidedTemplate | null>(null);
  const [words, setWords] = useState<Array<{ word: string; meaning: string }>>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [situation, setSituation] = useState('');

  // 作答与反馈
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<GuidedWritingFeedback | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correctRef = useRef(0);
  const totalRef = useRef(0);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const resetRound = () => { setInput(''); setFeedback(null); setError(null); };

  const loadScaffold = () => { setTemplate(getGuidedTemplate(user.learningLanguage, userLevel)); resetRound(); };
  const loadPrompt = () => { setSituation(getGuidedPrompt(userLevel)); resetRound(); };
  const loadWords = async () => {
    setLoadingWords(true); resetRound();
    try {
      const w = await generateSentenceWords(user.learningLanguage, user.nativeLanguage, userLevel);
      setWords(w);
      if (w.length === 0) setError('生词失败，请重试。');
    } catch { setError('生词失败，请重试。'); }
    setLoadingWords(false);
  };

  // 初始化：有句型模板走 scaffold，否则走 prompt
  useEffect(() => {
    if (hasGuidedTemplates(user.learningLanguage, userLevel)) { setMode('scaffold'); loadScaffold(); }
    else { setMode('prompt'); loadPrompt(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (m: GuidedMode) => {
    setMode(m);
    if (m === 'scaffold') loadScaffold();
    else if (m === 'prompt') loadPrompt();
    else loadWords();
  };

  const buildContext = (): GuidedContext => {
    if (mode === 'scaffold') return { template: template?.template, hint: template?.hint };
    if (mode === 'wordchain') return { words };
    return { situation };
  };

  const submit = async () => {
    if (!input.trim() || analyzing) return;
    setAnalyzing(true); setError(null);
    try {
      const fb = await analyzeGuidedWriting(input, user.learningLanguage, user.nativeLanguage, userLevel, mode, buildContext());
      setFeedback(fb);
      totalRef.current += 1;
      if (fb.isCorrect) correctRef.current += 1;
      setStats({ correct: correctRef.current, total: totalRef.current });
      const xp = fb.isCorrect ? 15 : 5;
      const { user: updated } = addActivity(user, 'writing', user.learningLanguage, xp,
        `引导式写作·${MODE_INFO[mode].name}${fb.isCorrect ? ' ✓' : ' ✗'}`, { mode });
      onComplete(updated);
    } catch (e) {
      setError('AI 批改失败，请检查网络/API Key 后重试。');
    }
    setAnalyzing(false);
  };

  const next = () => {
    if (mode === 'scaffold') loadScaffold();
    else if (mode === 'prompt') loadPrompt();
    else loadWords();
  };

  const speak = (text: string) => { if (text) generateSpeech(text, { lang: user.learningLanguage }); };

  const scaffoldAvailable = hasGuidedTemplates(user.learningLanguage, userLevel);

  return (
    <div className="space-y-4">
      {/* 模式 tab + 统计 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {(Object.keys(MODE_INFO) as GuidedMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              disabled={!scaffoldAvailable && m === 'scaffold'}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                mode === m
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-gray-700 text-gray-300 hover:border-secondary disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {MODE_INFO[m].name}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">本轮 {stats.total} 题 · 答对 {stats.correct}</span>
      </div>
      <p className="text-xs text-gray-500 -mt-2">{MODE_INFO[mode].desc}</p>

      {/* 题目卡 */}
      <div className="bg-card border border-gray-700 rounded-2xl p-6">
        {mode === 'scaffold' && (
          template ? (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-2">按模板写出完整句（＿＿＿ 处填你的内容）</div>
              <div className="text-3xl font-bold text-white font-mono tracking-wide my-4">
                {template.template.split('___').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && <span className="text-secondary underline decoration-dotted px-1">＿＿＿</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-sm text-gray-400">提示：{template.hint}</div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">该语言暂无句型模板，试试「看词造句」或「情境一句」。</div>
          )
        )}

        {mode === 'wordchain' && (
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-3">用下面 3 个词造一句话（可加其他词，但要都用上）</div>
            {loadingWords ? (
              <div className="text-gray-400 py-4 flex items-center justify-center gap-2">
                <Sparkles size={16} className="animate-spin" /> 生成词语中…
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-3">
                {words.map((w, i) => (
                  <div key={i} className="bg-dark/50 border border-gray-600 rounded-xl px-4 py-3">
                    <div className="text-xl font-bold text-white font-mono">{w.word}</div>
                    <div className="text-xs text-gray-400 mt-1">{w.meaning}</div>
                  </div>
                ))}
              </div>
            )}
            {!loadingWords && words.length > 0 && (
              <button onClick={loadWords} className="mt-4 text-xs text-gray-400 hover:text-secondary inline-flex items-center gap-1">
                <RefreshCw size={12} /> 换一组词
              </button>
            )}
          </div>
        )}

        {mode === 'prompt' && (
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2">情境（用目标语言写 1-3 句）</div>
            <div className="text-lg text-white font-medium bg-dark/50 p-4 rounded-lg border-l-4 border-secondary">
              {situation}
            </div>
          </div>
        )}
      </div>

      {/* 输入 + 提交 */}
      {!feedback && (
        <div className="space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`用 ${user.learningLanguage} 写……`}
            className="w-full bg-dark/50 border border-gray-700 rounded-xl p-4 text-lg text-gray-200 outline-none focus:ring-2 focus:ring-secondary resize-none"
            rows={3}
            autoFocus
          />
          {error && (
            <div className="flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle size={16} /> {error}
              <button onClick={submit} className="ml-2 text-xs underline">重试</button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={!input.trim() || analyzing}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? <><Sparkles className="animate-spin" size={18} /> 批改中</> : <><Wand2 size={18} /> 提交批改</>}
            </button>
            <button
              onClick={next}
              className="px-4 py-3 rounded-xl bg-gray-700/50 text-gray-300 border border-gray-600 font-bold hover:bg-gray-700 flex items-center gap-2"
            >
              <RefreshCw size={16} /> 换题
            </button>
          </div>
        </div>
      )}

      {/* 反馈 */}
      {feedback && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2">
          <div className={`p-4 rounded-xl flex items-center gap-3 ${feedback.isCorrect ? 'bg-green-600/20 text-green-300' : 'bg-amber-600/20 text-amber-300'}`}>
            {feedback.isCorrect ? <Check size={24} /> : <Lightbulb size={24} />}
            <div>
              <div className="font-bold text-lg">{feedback.isCorrect ? '✓ 不错！' : '✗ 再看看'}</div>
              <div className="text-xs opacity-80">预估等级 {feedback.cefrEstimation} · 本题 XP {feedback.isCorrect ? '+15' : '+5'}</div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-3 bg-gray-800/50 border-b border-gray-700 text-xs font-bold text-gray-400 flex items-center gap-2">
              <Sparkles size={14} className="text-yellow-400" /> AI 改写
              <button onClick={() => speak(feedback.correctedText)} className="ml-auto text-secondary hover:underline inline-flex items-center gap-1">
                <Volume2 size={14} /> 听发音
              </button>
            </div>
            <div className="p-4 text-gray-200 leading-relaxed font-mono">{feedback.correctedText}</div>
          </div>

          {feedback.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-white font-semibold text-sm">具体问题</h4>
              {feedback.issues.map((it, i) => (
                <div key={i} className="bg-card p-3 rounded-xl border border-gray-700 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-red-300 line-through flex-1">{it.original}</span>
                    <ArrowRight size={16} className="text-gray-500" />
                    <span className="text-green-300 font-medium flex-1">{it.fix}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 pl-1 border-l-2 border-gray-600">{it.reason}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 text-sm text-gray-200">
            <span className="font-bold text-secondary">教练的话：</span>{feedback.encouragement}
          </div>

          <button onClick={next} className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center justify-center gap-2">
            下一题 <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default GuidedWritingView;
