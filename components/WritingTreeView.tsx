
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WritingNode, CEFRLevel, Language, GuidedWritingFeedback, GuidedMode, ErrorPatternType, REGISTER_LABELS, CompositionGenre, GENRE_LABELS, PRACTICE_TYPE_LABELS, CYCLE_STAGE_LABELS, TargetExam } from '../types';
import { ensureGrowthTree, saveWritingTree, addActivity, addErrorCards } from '../services/storageService';
import { analyzeGuidedWriting, generateSpeech } from '../services/aiService';
import { romajiToKana } from '../services/romajiKana';
import { countWords } from '../services/textUtils';
import {
  FolderTree, FileText, ChevronRight, ChevronDown, Lock, CheckCircle2,
  Sparkles, Wand2, Volume2, ArrowRight, AlertCircle, PenLine, BookOpen
} from 'lucide-react';
import WritingLanguageGate from './WritingLanguageGate';
import CompositionEditor from './CompositionEditor';
import { ExamScoreCard } from './ExamScoreCard';

interface WritingTreeViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const WritingTreeView: React.FC<WritingTreeViewProps> = ({ user, onUpdateUser }) => {
  const userLevel = user.progress[user.learningLanguage]?.cefrLevel ?? CEFRLevel.A1;
  const [nodes, setNodes] = useState<WritingNode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<GuidedWritingFeedback | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNodes(ensureGrowthTree(user.learningLanguage, userLevel));
  }, [user.learningLanguage, userLevel]);

  const active = nodes.find((n) => n.id === activeId) || null;

  // 日语 romaji 自动转假名（与引导式写作一致）
  const normalizedInput = useMemo(() => {
    if (user.learningLanguage === Language.Japanese && input && /^[\x00-\x7F\s]+$/.test(input)) {
      return romajiToKana(input, false);
    }
    return input;
  }, [input, user.learningLanguage]);

  const persist = (next: WritingNode[]) => {
    setNodes(next);
    saveWritingTree(next);
  };

  const selectNode = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    const isWriting = n.type === 'task' || n.type === 'composition';
    if (isWriting && !n.unlocked && !n.completed) return; // 锁定不可选
    setActiveId(id);
    if (n.type === 'task') setInput(n.content ?? '');
    setFeedback(null);
    setError(null);
  };

  const toggleExpand = (id: string) => {
    persist(nodes.map((n) => (n.id === id ? { ...n, isExpanded: !n.isExpanded } : n)));
  };

  const submit = async () => {
    if (!active || !input.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      // 重写/打磨类节点走 revision 模式：AI 分两层反馈（重写建议 + 语言精修）
      const isRewrite = !!active.practiceType && (active.practiceType === 'rewrite' || active.cycleStage === 'rewrite');
      const mode: GuidedMode = isRewrite ? 'revision' : 'scaffold';
      // 考试视角：task 节点也支持考试/自由开关（节点 examMode + 该语言有对应考试）
      const taskHasExam = !!active.defaultExam && active.defaultExam !== 'none';
      const targetExam = taskHasExam && active.examMode ? active.defaultExam : undefined;
      const ctx = { template: active.scaffold, hint: active.scaffoldHint, register: active.register ? REGISTER_LABELS[active.register] : undefined };
      const fb = await analyzeGuidedWriting(
        normalizedInput,
        user.learningLanguage,
        user.nativeLanguage,
        active.cefrLevel ?? userLevel,
        mode,
        ctx,
        targetExam
      );
      setFeedback(fb);
      // 错题沉淀：写作树任务的错误全部进错题本（闭环）
      if (fb.issues && fb.issues.length > 0) {
        addErrorCards(fb.issues.map((it) => ({
          original: it.original,
          correction: it.fix,
          reason: it.reason,
          language: user.learningLanguage,
        })));
      }
      // 重写建议沉淀：带弱项维度的建议进「错误模式引擎」，驱动每日弱项练习（建立重复练习闭环）
      if (isRewrite && fb.revision?.points?.length) {
        const revCards = fb.revision.points
          .filter((p) => p.type)
          .map((p) => ({
            original: p.point,
            correction: p.detail,
            reason: `重写焦点：${fb.revision!.focus}`,
            language: user.learningLanguage,
            type: p.type as ErrorPatternType,
            tags: ['spine', 'rewrite'],
          }));
        if (revCards.length) addErrorCards(revCards);
      }
    } catch (e) {
      setError('AI 批改失败，请检查网络/API Key 后重试。');
    }
    setAnalyzing(false);
  };

  // 完成任务：标记 completed + 存内容 + 解锁同主题下一 task + 发 XP
  const completeTask = (taskId: string) => {
    const task = nodes.find((n) => n.id === taskId);
    if (!task || !task.parentId) return;
    const siblings = nodes
      .filter((n) => n.parentId === task.parentId && n.type === 'task')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = siblings.findIndex((s) => s.id === taskId);
    const next = nodes.map((n) => {
      if (n.id === taskId) return { ...n, completed: true, content: normalizedInput, updatedAt: Date.now() };
      if (idx >= 0 && idx + 1 < siblings.length && n.id === siblings[idx + 1].id) {
        return { ...n, unlocked: true };
      }
      return n;
    });
    persist(next);
    const xp = feedback?.isCorrect ? 20 : 10;
    const { user: updated } = addActivity(
      user,
      'tree_writing',
      user.learningLanguage,
      xp,
      `成长树·${task.title}${feedback?.isCorrect ? ' ✓' : ' ✗'}`,
      { wordCount: countWords(normalizedInput, user.learningLanguage) }
    );
    onUpdateUser(updated);
  };

  // 保存作文（分段内容 + 总词数）到树
  const saveComposition = (compId: string, sections: WritingNode['sections'], wordCount: number) => {
    const next = nodes.map((n) =>
      n.id === compId
        ? {
            ...n,
            sections,
            wordCount,
            content: (sections ?? []).map((s) => s.content).join('\n\n'),
            updatedAt: Date.now(),
          }
        : n
    );
    persist(next);
  };

  // 完成作文：标记 completed + 发 XP（作文权重更高）
  const completeComposition = (compId: string) => {
    const comp = nodes.find((n) => n.id === compId);
    const next = nodes.map((n) => (n.id === compId ? { ...n, completed: true, progress: 100, updatedAt: Date.now() } : n));
    persist(next);
    const xp = 50;
    const { user: updated } = addActivity(
      user,
      'tree_writing',
      user.learningLanguage,
      xp,
      `成长树·作文 ${comp?.title ?? ''}`,
      { wordCount: comp?.wordCount ?? 0 }
    );
    onUpdateUser(updated);
  };

  // 持久化作文体裁（用户切换体裁时调用，避免刷新后回落默认体裁）
  const saveGenre = (compId: string, genre: CompositionGenre) => {
    const next = nodes.map((n) => (n.id === compId ? { ...n, genre, updatedAt: Date.now() } : n));
    persist(next);
  };

  // 持久化考试视角开关（用户切换「考试 / 自由」时调用）
  const saveExamMode = (compId: string, examMode: boolean) => {
    const next = nodes.map((n) => (n.id === compId ? { ...n, examMode, updatedAt: Date.now() } : n));
    persist(next);
  };

  const speak = (text: string) => {
    if (text) generateSpeech(text, { lang: user.learningLanguage });
  };

  // 树渲染
  const renderTree = (parentId: string | null, depth = 0) => {
    const children = nodes.filter((n) => n.parentId === parentId);
    if (children.length === 0) return null;
    return (
      <div className={depth > 0 ? 'ml-3 border-l border-line-strong/50' : ''}>
        {children.map((node) => {
          const isTask = node.type === 'task';
          const isComp = node.type === 'composition';
          const isLeaf = isTask || isComp;
          const locked = isLeaf && !node.unlocked && !node.completed;
          return (
            <div key={node.id}>
              <div
                onClick={() => (isLeaf ? selectNode(node.id) : toggleExpand(node.id))}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm mb-1 select-none transition-all duration-200 border
                  ${activeId === node.id ? 'bg-neon/15 text-white border-neon/40 shadow-glow-sm' : 'text-muted hover:bg-surface-3/70 hover:text-white border-transparent hover:translate-x-0.5'}
                  ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {!isLeaf && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(node.id);
                    }}
                    className="p-0.5 rounded hover:bg-white/10"
                  >
                    {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
                {node.type === 'root' ? (
                  <PenLine size={16} className="text-purple-400 flex-shrink-0" />
                ) : node.type === 'theme' ? (
                  <FolderTree size={16} className="text-blue-400 flex-shrink-0" />
                ) : node.type === 'composition' ? (
                  <BookOpen size={16} className="text-amber-400 flex-shrink-0" />
                ) : node.completed ? (
                  <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                ) : locked ? (
                  <Lock size={14} className="text-muted flex-shrink-0" />
                ) : (
                  <FileText size={16} className="text-teal-400 flex-shrink-0" />
                )}
                <span className="relative flex-1 group/tooltip">
                  <span className="truncate block font-medium">{node.title}</span>
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover/tooltip:block z-50 px-2 py-1 rounded-md bg-gray-900 text-white text-xs whitespace-nowrap border border-gray-700 shadow-lg">
                    {node.title}
                  </span>
                </span>
                {isTask && node.cefrLevel && (
                  <span className="text-[10px] text-muted flex-shrink-0">{node.cefrLevel}</span>
                )}
                {isComp && (
                  <>
                    <span className="text-[10px] text-amber-300/80 flex-shrink-0">作文</span>
                    {node.genre && (
                      <span className="text-[10px] text-amber-200/70 flex-shrink-0">{GENRE_LABELS[node.genre]}</span>
                    )}
                  </>
                )}
                {(isTask || isComp) && node.register && (
                  <span className="text-[10px] text-purple-300/80 flex-shrink-0">{REGISTER_LABELS[node.register]}</span>
                )}
                {node.spine && node.cycleStage && (
                  <span className="text-[10px] text-sky-300/80 flex-shrink-0">{CYCLE_STAGE_LABELS[node.cycleStage]}</span>
                )}
                {node.type === 'composition' && node.examMode && node.defaultExam && node.defaultExam !== 'none' && (
                  <span className="text-[10px] text-amber-300/80 flex-shrink-0">{node.defaultExam}</span>
                )}
              </div>
              {node.isExpanded && renderTree(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const completedCount = nodes.filter((n) => n.type === 'task' && n.completed).length;
  const totalCount = nodes.filter((n) => n.type === 'task').length;

  return (
    <WritingLanguageGate user={user} onUpdateUser={onUpdateUser} featureName="写作树">
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4">
      {/* 左：成长树 */}
      <div className="w-full lg:w-1/3 glass-panel rounded-xl flex flex-col overflow-hidden shadow-card">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2 bg-surface/40">
          <PenLine size={18} className="text-violet-300 drop-shadow-[0_0_6px_rgba(139,92,246,0.7)]" />
          <span className="font-bold text-gray-300">写作成长树</span>
          <span className="ml-auto text-xs text-muted">
            {completedCount} / {totalCount} 完成
          </span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">{renderTree(null)}</div>
      </div>

      {/* 右：编辑器 */}
      <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden shadow-card">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted">
            <PenLine size={64} className="mb-4 opacity-20" />
            <p className="text-lg">从左侧选择一个解锁的写作任务或作文</p>
            <p className="text-sm opacity-50 mt-1">完成当前任务，解锁同主题下一题</p>
          </div>
        ) : active.type === 'composition' ? (
          <CompositionEditor
            node={active}
            user={user}
            onSave={(sections, wc) => saveComposition(active.id, sections, wc)}
            onComplete={() => completeComposition(active.id)}
            onGenreChange={(g) => saveGenre(active.id, g)}
            examMode={active.examMode}
            onExamModeChange={(v) => saveExamMode(active.id, v)}
          />
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="mb-4">
              <div className="text-xs text-muted">{active.cefrLevel ?? userLevel} · 写作任务{active.register ? ` · ${REGISTER_LABELS[active.register]}语气` : ''}</div>
              {active.spine && active.practiceType && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-200">{PRACTICE_TYPE_LABELS[active.practiceType]}</span>
                  {active.cycleStage && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-200">{CYCLE_STAGE_LABELS[active.cycleStage]}</span>
                  )}
                </div>
              )}
              <h3 className="text-xl font-bold text-white mt-1">{active.title}</h3>
              {active.register && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-xs text-purple-200">
                  <span className="opacity-70">要求语气</span>
                  <span className="font-semibold">{REGISTER_LABELS[active.register]}</span>
                </div>
              )}
              {/* 考试/自由视角开关：仅当该语言有对应考试时显示（沿用节点 examMode 持久化） */}
              {active.defaultExam && active.defaultExam !== 'none' && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="inline-flex rounded-lg overflow-hidden border border-line-strong text-xs">
                    <button
                      onClick={() => active.examMode === false && saveExamMode(active.id, true)}
                      className={`px-3 py-1 font-semibold transition-colors ${active.examMode !== false ? 'bg-amber-500/20 text-amber-200' : 'text-muted hover:text-white'}`}
                    >考试</button>
                    <button
                      onClick={() => active.examMode !== false && saveExamMode(active.id, false)}
                      className={`px-3 py-1 font-semibold transition-colors ${active.examMode === false ? 'bg-neon/20 text-neon' : 'text-muted hover:text-white'}`}
                    >自由</button>
                  </div>
                  <span className="text-[10px] text-faint">{active.examMode !== false ? `按 ${active.defaultExam} 维度评分` : '不评分，仅通用反馈'}</span>
                </div>
              )}
            </div>

            {/* 脚手架模板 / 情境 */}
            {active.scaffold ? (
              <div className="bg-dark/50 border border-line-strong rounded-xl p-4 mb-4">
                <div className="text-xs text-muted mb-2">句型模板（＿＿＿ 处填你的内容）</div>
                <div className="text-2xl font-bold text-white font-mono leading-relaxed">
                  {active.scaffold.split('___').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="text-violet-300 underline decoration-dotted px-1 drop-shadow-[0_0_6px_rgba(139,92,246,0.7)]">＿＿＿</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="text-sm text-muted mt-2">提示：{active.scaffoldHint}</div>
              </div>
            ) : (
              <div className="bg-dark/50 border border-line-strong rounded-xl p-4 mb-4">
                <div className="text-xs text-muted mb-1">情境</div>
                <div className="text-sm text-gray-300">{active.scaffoldHint}</div>
              </div>
            )}

            {/* 作答 + 批改 */}
            {!feedback ? (
              <div className="space-y-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    user.learningLanguage === Language.Japanese
                      ? '用日语写……（可输入罗马字，自动转假名）'
                      : `用 ${user.learningLanguage} 写……`
                  }
                  className="w-full bg-dark/50 border border-white/10 rounded-xl p-4 text-lg text-gray-200 outline-none focus:ring-2 focus:ring-neon/40 focus:border-neon/40 focus:shadow-glow-sm resize-none transition-all duration-300"
                  rows={3}
                  autoFocus
                />
                {user.learningLanguage === Language.Japanese &&
                  input.trim() &&
                  /^[\x00-\x7F\s]+$/.test(input) &&
                  normalizedInput && (
                    <div className="text-xs text-muted bg-dark/30 border border-line-strong rounded-lg p-2">
                      → 转为假名：<span className="text-secondary font-mono">{normalizedInput}</span>
                    </div>
                  )}
                {error && (
                  <div className="flex items-center gap-2 text-red-300 text-sm">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}
                <button
                  onClick={submit}
                  disabled={!input.trim() || analyzing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzing ? (
                    <>
                      <Sparkles className="animate-spin" size={18} /> 批改中
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} /> 提交批改
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <div
                  className={`p-4 rounded-xl flex items-center gap-3 page-enter ${
                    feedback.isCorrect ? 'bg-green-600/20 text-green-300 border border-green-500/30 shadow-[0_0_20px_-4px_rgba(74,222,128,0.45)]' : 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {feedback.isCorrect ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  <div>
                    <div className="font-bold text-lg">{feedback.isCorrect ? '✓ 不错！' : '✗ 再看看'}</div>
                    <div className="text-xs opacity-80">预估等级 {feedback.cefrEstimation} · 完成 XP {feedback.isCorrect ? '+20' : '+10'}</div>
                  </div>
                </div>

                <div className="bg-dark/30 border border-line-strong rounded-xl p-4">
                  <div className="text-xs text-muted mb-1 flex items-center gap-2">
                    AI 改写
                    <button
                      onClick={() => speak(feedback.correctedText)}
                      className="text-secondary hover:underline inline-flex items-center gap-1"
                    >
                      <Volume2 size={14} /> 听发音
                    </button>
                  </div>
                  <div className="text-gray-200 font-mono leading-relaxed">{feedback.correctedText}</div>
                </div>

                {feedback.revision ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* 重写建议：读者 / 目的 / 内容 / 结构 */}
                    <div className="space-y-3">
                      <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                        <span className="text-violet-300">✎ 重写建议</span>
                        <span className="text-[10px] font-normal text-muted">读者 / 目的 / 内容 / 结构</span>
                      </h4>
                      <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
                        <div className="text-xs text-violet-200 mb-2 font-semibold">本次焦点：{feedback.revision.focus}</div>
                        <ul className="space-y-2">
                          {feedback.revision.points.map((p, i) => (
                            <li key={i} className="text-sm text-gray-200">
                              <span className="font-medium text-violet-100">{p.point}</span>
                              <p className="text-xs text-muted mt-0.5">{p.detail}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {/* 语言精修：用词 / 语法 / 拼写 */}
                    <div className="space-y-3">
                      <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                        <span className="text-green-300">⌁ 语言精修</span>
                        <span className="text-[10px] font-normal text-muted">用词 / 语法 / 拼写</span>
                      </h4>
                      {feedback.issues.length > 0 ? (
                        feedback.issues.map((it, i) => (
                          <div key={i} className="bg-dark/30 border border-line-strong rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="text-red-300 line-through flex-1">{it.original}</span>
                              <ArrowRight size={16} className="text-muted" />
                              <span className="text-green-300 font-medium flex-1">{it.fix}</span>
                            </div>
                            <p className="mt-2 text-xs text-muted pl-1 border-l-2 border-line-strong">{it.reason}</p>
                          </div>
                        ))
                      ) : (
                        <div className="bg-dark/30 border border-line-strong rounded-lg p-3 text-sm text-green-300">无明显语法 / 用词问题，这一稿语言很干净。</div>
                      )}
                    </div>
                  </div>
                ) : (
                  feedback.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-white font-semibold text-sm">具体问题</h4>
                      {feedback.issues.map((it, i) => (
                        <div key={i} className="bg-dark/30 border border-line-strong rounded-lg p-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-red-300 line-through flex-1">{it.original}</span>
                            <ArrowRight size={16} className="text-muted" />
                            <span className="text-green-300 font-medium flex-1">{it.fix}</span>
                          </div>
                          <p className="mt-2 text-xs text-muted pl-1 border-l-2 border-line-strong">{it.reason}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 考试评分卡：考试视角下展示全维度评分（与作文编辑器共用 ExamScoreCard） */}
                {feedback.examScores && (
                  <ExamScoreCard exam={(active.defaultExam ?? 'none') as TargetExam} scores={feedback.examScores} />
                )}

                <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 text-sm text-gray-200">
                  <span className="font-bold text-secondary">教练的话：</span>
                  {feedback.encouragement}
                </div>

                {feedback.registerNote && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-sm text-gray-200">
                    <span className="font-bold text-purple-300">语体点评：</span>
                    {feedback.registerNote}
                  </div>
                )}

                <button
                  onClick={() => completeTask(active.id)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  完成并解锁下一题 <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </WritingLanguageGate>
  );
};

export default WritingTreeView;
