
import React, { useState } from 'react';
import { UserProfile, WritingFeedback, WritingRevisionFeedback, CEFRLevel, ExamScores, TargetExam, IeltsBandScores, JlptScores, TopikScores, DeleScores, ToeflScores, REGISTER_LABELS } from '../types';
import { analyzeWriting, analyzeWritingRevision } from '../services/aiService';
import { addActivity, addErrorCards, addWritingScore } from '../services/storageService';
import { countWords } from '../services/textUtils';
import GuidedWritingView from './GuidedWritingView';
import { Sparkles, ArrowRight, BookCheck, Wand2, Star, AlertCircle } from 'lucide-react';
import WritingLanguageGate from './WritingLanguageGate';
import { TOPICS_BY_LEVEL, WritingTopic } from '../data/writingPrompts';

interface WritingViewProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
}

// 雅思 band 颜色（>=7 绿 / >=6 黄 / >=5 橙 / 其余红）
const ieltsBandColor = (b: number): string =>
  b >= 7 ? 'text-green-400' : b >= 6 ? 'text-yellow-400' : b >= 5 ? 'text-orange-400' : 'text-red-400';

// 托福 0–5 量规颜色（>=4 绿 / >=3 黄 / >=2 橙 / 其余红）
const toeflBandColor = (b: number): string =>
  b >= 4 ? 'text-green-400' : b >= 3 ? 'text-yellow-400' : b >= 2 ? 'text-orange-400' : 'text-red-400';

// 0-100 通用分颜色（>=80 绿 / >=60 黄 / >=40 橙 / 其余红）
const scoreColor100 = (n: number): string =>
  n >= 80 ? 'text-green-400' : n >= 60 ? 'text-yellow-400' : n >= 40 ? 'text-orange-400' : 'text-red-400';

// 0-100 维度小卡（带进度条 + 反馈）
const ExamBar: React.FC<{ label: string; val: number; feedback: string }> = ({ label, val, feedback }) => (
  <div className="bg-dark/50 border border-white/10 rounded-lg p-3 transition-all duration-300 hover:border-neon/25 hover:shadow-glow-sm">
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xl font-bold ${scoreColor100(val)}`}>{val}</span>
    </div>
    <div className="h-1.5 bg-surface-2 rounded-full mt-1 overflow-hidden">
      <div className="h-full xp-bar rounded-full" style={{ width: `${Math.min(100, Math.max(0, val))}%` }} />
    </div>
    <p className="text-xs text-muted mt-1 leading-snug">{feedback}</p>
  </div>
);

// 按考试类型渲染对应评分面板（雅思四项 / JLPT / TOPIK / DELE）
const renderExamPanel = (scores: ExamScores, exam: TargetExam, generalComment: string, cefr: CEFRLevel) => {
  let title = '考试评分';
  let overallNode: React.ReactNode = null;
  let bars: React.ReactNode = null;

  if (exam === 'IELTS') {
    const s = scores as IeltsBandScores;
    title = '雅思写作总分 (IELTS)';
    overallNode = <p className="text-4xl font-bold text-white mt-1">{s.overall.toFixed(1)}</p>;
    bars = (
      <div className="grid grid-cols-2 gap-3">
        {([
          { key: 'taskResponse', label: 'TR 任务回应', val: s.taskResponse },
          { key: 'coherenceCohesion', label: 'CC 连贯衔接', val: s.coherenceCohesion },
          { key: 'lexicalResource', label: 'LR 词汇资源', val: s.lexicalResource },
          { key: 'grammaticalRange', label: 'GRA 语法多样', val: s.grammaticalRange },
        ] as { key: keyof IeltsBandScores['feedback']; label: string; val: number }[]).map((c) => (
          <div key={c.key} className="bg-dark/50 border border-line-strong rounded-lg p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">{c.label}</span>
              <span className={`text-xl font-bold ${ieltsBandColor(c.val)}`}>{c.val.toFixed(1)}</span>
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">{s.feedback[c.key]}</p>
          </div>
        ))}
      </div>
    );
  } else if (exam === 'JLPT') {
    const s = scores as JlptScores;
    title = '日语 JLPT 写作评估';
    overallNode = <p className="text-4xl font-bold text-white mt-1">{s.estimatedLevel}</p>;
    bars = (
      <div className="grid grid-cols-1 gap-3">
        <ExamBar label="文字・語彙" val={s.vocabularyKanji} feedback={s.feedback.vocabularyKanji} />
        <ExamBar label="文法" val={s.grammar} feedback={s.feedback.grammar} />
        <ExamBar label="構成・表現" val={s.composition} feedback={s.feedback.composition} />
      </div>
    );
  } else if (exam === 'TOPIK') {
    const s = scores as TopikScores;
    title = '韩语 TOPIK 写作评估';
    overallNode = <p className="text-4xl font-bold text-white mt-1">Lv {s.estimatedLevel}</p>;
    bars = (
      <div className="grid grid-cols-1 gap-3">
        <ExamBar label="어휘・문법 词汇语法" val={s.vocabGrammar} feedback={s.feedback.vocabGrammar} />
        <ExamBar label="내용 구성 内容组织" val={s.contentOrganization} feedback={s.feedback.contentOrganization} />
        <ExamBar label="표현 表达" val={s.expression} feedback={s.feedback.expression} />
      </div>
    );
  } else if (exam === 'DELE') {
    const s = scores as DeleScores;
    title = '西语 DELE 写作评估';
    overallNode = <p className="text-4xl font-bold text-white mt-1">{s.estimatedLevel}</p>;
    bars = (
      <div className="grid grid-cols-1 gap-3">
        <ExamBar label="gramática 语法" val={s.grammar} feedback={s.feedback.grammar} />
        <ExamBar label="léxico 词汇" val={s.vocabulary} feedback={s.feedback.vocabulary} />
        <ExamBar label="coherencia 连贯" val={s.coherence} feedback={s.feedback.coherence} />
        <ExamBar label="adecuación 语域得体" val={s.taskAdequacy} feedback={s.feedback.taskAdequacy} />
      </div>
    );
  } else if (exam === 'TOEFL') {
    const s = scores as ToeflScores;
    title = '托福写作评分 (TOEFL iBT)';
    overallNode = <p className="text-4xl font-bold text-white mt-1">{s.scaled}<span className="text-base text-muted font-normal"> / 30</span></p>;
    bars = (
      <div className="grid grid-cols-1 gap-3">
        {([
          { key: 'development', label: 'Development 展开度', val: s.development },
          { key: 'organization', label: 'Organization 组织', val: s.organization },
          { key: 'languageUse', label: 'Language Use 语言运用', val: s.languageUse },
        ] as { key: keyof ToeflScores['feedback']; label: string; val: number }[]).map((c) => (
          <div key={c.key} className="bg-dark/50 border border-line-strong rounded-lg p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">{c.label}</span>
              <span className={`text-xl font-bold ${toeflBandColor(c.val)}`}>{c.val.toFixed(1)}<span className="text-xs text-muted font-normal"> /5</span></span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-secondary" style={{ width: `${Math.min(100, Math.max(0, (c.val / 5) * 100))}%` }} />
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">{s.feedback[c.key]}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-xl shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-muted text-sm font-medium">{title}</h3>
          {overallNode}
        </div>
        <div className="text-right max-w-[55%]">
          <p className="text-gray-300 italic text-sm">"{generalComment}"</p>
        </div>
      </div>
      {bars}
      <p className="text-xs text-muted">CEFR 参考：{cefr}</p>
    </div>
  );
};

const WritingView: React.FC<WritingViewProps> = ({ user, onComplete }) => {
  // 按用户当前目标语言的 CEFR 等级选题（无等级记录默认 A1）
  const userLevel = user.progress[user.learningLanguage]?.cefrLevel ?? CEFRLevel.A1;
  const currentTopics: WritingTopic[] = TOPICS_BY_LEVEL[userLevel] ?? TOPICS_BY_LEVEL[CEFRLevel.A1];
  const [activeTopic, setActiveTopic] = useState<WritingTopic | null>(null);
  const activeTopicResolved = activeTopic ?? currentTopics[0];

  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'free' | 'guided'>('free');

  // 二稿改写闭环状态
  const [firstFeedback, setFirstFeedback] = useState<WritingFeedback | null>(null);
  const [firstDraftText, setFirstDraftText] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [revisionResult, setRevisionResult] = useState<WritingRevisionFeedback | null>(null);

  const handleAnalyze = async (isRevision = false) => {
    if (text.length < 10) return;
    setIsAnalyzing(true);
    setFeedback(null);
    setRevisionResult(null);
    setError(null);
    try {
      let result: WritingFeedback;
      if (isRevision && firstFeedback) {
        // 二稿：把首稿 + 上次建议 + 当前二稿一起送审
        result = await analyzeWritingRevision(firstDraftText, text, firstFeedback, user.learningLanguage, user.nativeLanguage, userLevel, user.targetExam, activeTopicResolved?.text);
        setRevisionResult(result as WritingRevisionFeedback);
      } else {
        result = await analyzeWriting(text, user.learningLanguage, user.nativeLanguage, userLevel, user.targetExam, activeTopicResolved?.register, activeTopicResolved?.text);
        setFirstFeedback(result);
        setFirstDraftText(text);
        setRevisionResult(null);
      }
      setFeedback(result);

      // 把 AI 批改指出的错误沉淀为错题卡（自动去重合并，按学习语言隔离）
      if (result.suggestions && result.suggestions.length > 0) {
        addErrorCards(
          result.suggestions.map((s) => ({
            original: s.original,
            correction: s.suggestion,
            reason: s.reason,
            language: user.learningLanguage,
          }))
        );
      }

      // Calculate XP: Base 50 + Length Bonus（CJK 按字符数，拉丁按词数）
      const wordCount = countWords(text, user.learningLanguage);
      const xp = 50 + Math.min(100, Math.floor(wordCount / 2));

      const { user: updatedUser } = addActivity(
          user,
          'writing',
          user.learningLanguage,
          xp,
          `写作练习（${wordCount} 词）`,
          {
              wordCount: wordCount,
              feedback: result.generalComment
          }
      );

      // 沉淀写作评分历史（趋势曲线数据源）：每次首稿/二稿的结构化评分落库
      addWritingScore({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          date: new Date().toISOString().split('T')[0],
          language: user.learningLanguage,
          isRevision: isRevision,
          cefrEstimation: result.cefrEstimation,
          examScores: result.examScores ?? null,
          wordCount: wordCount,
      });

      onComplete(updatedUser);

    } catch (err) {
      console.error(err);
      setError('批改失败（AI 返回格式异常或网络问题）。请重试——不会扣除 XP 或记录趋势。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const useTopic = (topic: WritingTopic) => {
    setActiveTopic(topic);
    setFeedback(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* 模式切换：自由写作 / 引导练习 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('free')}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${mode === 'free' ? 'bg-gradient-to-r from-neon to-neon-2 text-white border-transparent shadow-glow-sm' : 'bg-surface-2/60 border-white/10 text-gray-300 hover:border-neon/40 hover:text-white'}`}
        >
          自由写作
        </button>
        <button
          onClick={() => setMode('guided')}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${mode === 'guided' ? 'bg-gradient-to-r from-neon to-neon-2 text-white border-transparent shadow-glow-sm' : 'bg-surface-2/60 border-white/10 text-gray-300 hover:border-neon/40 hover:text-white'}`}
        >
          引导练习（A1 友好）
        </button>
      </div>

      {mode === 'guided' ? (
        <WritingLanguageGate user={user} onUpdateUser={onComplete} featureName="写作工坊·引导练习">
          <GuidedWritingView user={user} onComplete={onComplete} />
        </WritingLanguageGate>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
      
      {/* Left Column: Input Area */}
      <div className="flex flex-col space-y-4 h-full">
        {/* Topic Suggestion Carousel */}
        <div className="glass-panel p-4 rounded-xl shadow-card">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">写作题目（{userLevel} 级）</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {currentTopics.map((t, i) => (
                    <button
                        key={i}
                        onClick={() => useTopic(t)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition-all duration-200 ${activeTopic === t ? 'bg-neon/20 text-white border-neon/50 shadow-glow-sm' : 'bg-dark/60 border-white/10 text-muted hover:border-neon/35 hover:text-white'}`}
                    >
                        {t.text.slice(0, 22)}…
                    </button>
                ))}
            </div>
            {activeTopicResolved && (
                <div className="mt-3 text-white font-medium bg-dark/50 p-3 rounded-lg border-l-4 border-neon shadow-[inset_0_0_20px_rgba(139,92,246,0.06)]">
                    {activeTopicResolved.text}
                    <span className="block mt-2">
                        <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-neon/15 text-violet-300 border border-neon/30">要求语气：{REGISTER_LABELS[activeTopicResolved.register]}</span>
                    </span>
                </div>
            )}
        </div>

        <div className="flex-grow flex flex-col relative">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`用 ${user.learningLanguage} 写点什么……`}
                className="flex-grow w-full bg-dark/50 border border-white/10 rounded-xl p-6 text-lg leading-relaxed text-gray-200 focus:ring-2 focus:ring-neon/40 focus:border-neon/40 focus:shadow-glow-sm outline-none resize-none transition-all duration-300"
            />
            <div className="absolute bottom-4 right-4 text-muted text-sm font-mono">
                {text.length} 字
            </div>
        </div>

        <button
            onClick={() => handleAnalyze(isRevising)}
            disabled={isAnalyzing || text.length < 10}
            className="w-full py-4 bg-gradient-to-r from-neon to-neon-2 hover:brightness-110 hover:shadow-glow-neon active:scale-[0.99] text-white font-bold rounded-xl shadow-glow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {isAnalyzing ? (
                <>分析中 <Sparkles className="animate-spin" size={18} /></>
            ) : (
                <>{isRevising ? '对比批改（二稿）' : '获取 AI 批改'} <Wand2 size={18} /></>
            )}
        </button>
      </div>

      {/* Right Column: Feedback Area */}
      <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
        {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-800 text-red-300 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold mb-1">批改失败</p>
                    <p className="text-sm text-red-300/80">{error}</p>
                    <button onClick={handleAnalyze} disabled={isAnalyzing || text.length < 10} className="mt-2 text-xs underline hover:text-white disabled:opacity-50">重试</button>
                </div>
            </div>
        )}
        {!feedback ? (
            <div className="h-full flex flex-col items-center justify-center text-faint border-2 border-dashed border-line rounded-xl bg-card/20">
                <BookCheck size={48} className="mb-4 opacity-50" />
                <p>提交你的作文，获取详细批改。</p>
            </div>
        ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                
                {/* XP Badge */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-transparent p-4 rounded-xl border border-yellow-500/20 flex items-center gap-3">
                    <Star size={24} className="text-yellow-400 fill-current animate-pulse" />
                    <div>
                        <h4 className="font-bold text-yellow-100">已收到批改！</h4>
                        <p className="text-xs text-yellow-200/70">你的努力已获得经验值。</p>
                    </div>
                </div>

                {/* 二稿改写闭环入口 */}
                {feedback && !revisionResult && !isRevising && (
                  <button
                    onClick={() => setIsRevising(true)}
                    className="w-full py-3 rounded-xl border border-neon/50 text-violet-300 font-bold hover:bg-neon/15 hover:shadow-glow-sm transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    按批改重写二稿 <ArrowRight size={18} />
                  </button>
                )}
                {isRevising && (
                  <div className="bg-secondary/10 border border-secondary/30 p-4 rounded-xl flex items-center justify-between gap-3">
                    <p className="text-sm text-secondary">二稿模式：参考上方批改修改文字，再点「对比批改」。</p>
                    <button onClick={() => { setIsRevising(false); setRevisionResult(null); }} className="text-xs underline text-muted hover:text-white flex-shrink-0">退出</button>
                  </div>
                )}
                {revisionResult && (
                  <div className="glass-panel p-4 rounded-xl shadow-card space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white">二稿对比</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${revisionResult.improved ? 'bg-green-900/30 text-green-300' : 'bg-amber-900/30 text-amber-300'}`}>{revisionResult.improved ? '有进步' : '仍需努力'}</span>
                    </div>
                    {revisionResult.fixedIssues.length > 0 && (
                      <div>
                        <p className="text-xs text-green-400 mb-1">已修复（{revisionResult.fixedIssues.length}）</p>
                        <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">{revisionResult.fixedIssues.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    )}
                    {revisionResult.remainingIssues.length > 0 && (
                      <div>
                        <p className="text-xs text-red-400 mb-1">仍待改进（{revisionResult.remainingIssues.length}）</p>
                        <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">{revisionResult.remainingIssues.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    )}
                    {revisionResult.fixedIssues.length === 0 && revisionResult.remainingIssues.length === 0 && (
                      <p className="text-sm text-muted">首稿问题已基本解决，保持！</p>
                    )}
                  </div>
                )}

                {/* Score Card — 考试评分（按考试类型渲染面板）或通用 CEFR */}
                {feedback.examScores && user.targetExam ? (
                  renderExamPanel(feedback.examScores, user.targetExam, feedback.generalComment, feedback.cefrEstimation)
                ) : (
                  <div className="glass-panel p-6 rounded-xl shadow-card flex items-center justify-between">
                    <div>
                        <h3 className="text-muted text-sm font-medium">预估等级</h3>
                        <p className="text-3xl font-bold text-white mt-1">{feedback.cefrEstimation}</p>
                    </div>
                    <div className="text-right max-w-[60%]">
                        <p className="text-gray-300 italic">"{feedback.generalComment}"</p>
                    </div>
                  </div>
                )}

                {/* 语体点评（仅当本题有语体要求时出现） */}
                {feedback.registerNote && (
                  <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 text-sm text-gray-200">
                    <span className="font-bold text-secondary">语体点评：</span>{feedback.registerNote}
                  </div>
                )}

                {/* Corrections */}
                <div className="glass-panel rounded-xl shadow-card overflow-hidden">
                    <div className="p-4 bg-surface-2/50 border-b border-white/[0.06] font-semibold text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-yellow-400" />
                        AI 润色版
                    </div>
                    <div className="p-6 text-gray-200 leading-relaxed bg-dark/30">
                        {feedback.correctedText}
                    </div>
                </div>

                {/* Specific Suggestions */}
                <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <BookCheck size={18} className="text-secondary" />
                        具体改进建议
                    </h3>
                    {feedback.suggestions.length === 0 ? (
                        <p className="text-muted italic">没有发现具体错误，写得真好！</p>
                    ) : (
                        feedback.suggestions.map((item, idx) => (
                            <div key={idx} className="bg-surface-2/60 backdrop-blur-lg p-4 rounded-xl border border-white/[0.06] hover:border-neon/30 hover:shadow-glow-sm transition-all duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="w-1/2 p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-red-200 line-through decoration-red-500/50">
                                        {item.original}
                                    </div>
                                    <ArrowRight className="text-muted mt-3 flex-shrink-0" size={20} />
                                    <div className="w-1/2 p-3 bg-green-900/10 border border-green-900/30 rounded-lg text-green-200 font-medium">
                                        {item.suggestion}
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-muted pl-1 border-l-2 border-line-strong">
                                    💡 {item.reason}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
};

export default WritingView;
