
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WritingNode, CEFRLevel, Language, GuidedWritingFeedback, GuidedMode, ErrorPatternType, REGISTER_LABELS, CompositionGenre, GENRE_LABELS, PRACTICE_TYPE_LABELS, CYCLE_STAGE_LABELS, TargetExam, CustomDirectionSeed } from '../types';
import { ensureGrowthTree, saveWritingTree, addActivity, addErrorCards } from '../services/storageService';
import { analyzeGuidedWriting, generateSpeech } from '../services/aiService';
import { getCustomDirections, updateCustomDirection, deleteCustomDirection, regenerateCustomDirection, buildCustomDirectionNodes, MAX_CUSTOM_DIRECTIONS } from '../services/customDirectionService';
import { romajiToKana } from '../services/romajiKana';
import { countWords } from '../services/textUtils';
import {
  FolderTree, FileText, ChevronRight, ChevronDown, Lock, CheckCircle2,
  Sparkles, Wand2, Volume2, ArrowRight, AlertCircle, PenLine, BookOpen,
  Plus, MoreHorizontal, Pencil, RefreshCw, Trash2, Search
} from 'lucide-react';
import WritingLanguageGate from './WritingLanguageGate';
import CompositionEditor from './CompositionEditor';
import CustomDirectionModal from './CustomDirectionModal';
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

  // 树导航（P3）：搜索过滤 + 全部展开/折叠
  const [query, setQuery] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);

  // 自定义写作方向（用户私人枝干）
  const [showDirModal, setShowDirModal] = useState(false);
  const [dirMenuFor, setDirMenuFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dirBusy, setDirBusy] = useState(false);

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

  // 自定义方向管理菜单：document 级 click-away 关闭。
  // 不用 fixed 遮罩：侧栏面板（backdrop-blur/overflow）构成堆叠上下文，根层级遮罩会盖住菜单项。
  useEffect(() => {
    if (!dirMenuFor) return;
    const close = () => setDirMenuFor(null);
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [dirMenuFor]);

  // --- 自定义写作方向 ---
  const customThemes = nodes.filter((n) => n.type === 'theme' && n.tags?.includes('custom'));
  const findSeed = (id: string) => getCustomDirections(user.learningLanguage).find((s) => s.id === id);

  const handleDirectionCreated = (seed: CustomDirectionSeed) => {
    setShowDirModal(false);
    const fresh = ensureGrowthTree(user.learningLanguage, userLevel);
    persist(fresh.map((n) => (n.id === seed.id ? { ...n, isExpanded: true } : n)));
  };

  const handleRenameDirection = (themeId: string) => {
    const title = renameValue.trim();
    const seed = findSeed(themeId);
    if (!title || !seed) return;
    updateCustomDirection(user.learningLanguage, { ...seed, title });
    persist(nodes.map((n) => (n.id === themeId ? { ...n, title, updatedAt: Date.now() } : n)));
    setRenameFor(null);
  };

  // 重新生成：替换该方向全部任务节点（进度重置，弹窗已二次确认），保留枝干展开态
  const handleRegenerateDirection = async (themeId: string) => {
    const seed = findSeed(themeId);
    if (!seed || dirBusy) return;
    if (!window.confirm(`重新生成「${seed.title}」？该方向下的所有任务会被替换，已写内容与进度会丢失。`)) return;
    setDirMenuFor(null);
    setDirBusy(true);
    try {
      const next = await regenerateCustomDirection(seed, userLevel, user.nativeLanguage);
      const fresh = ensureGrowthTree(user.learningLanguage, userLevel);
      const wasExpanded = fresh.find((n) => n.id === themeId)?.isExpanded ?? true;
      const rebuilt = [
        ...fresh.filter((n) => n.id !== themeId && n.parentId !== themeId),
        ...buildCustomDirectionNodes(next, userLevel, Date.now()).map((n) => (n.id === themeId ? { ...n, isExpanded: wasExpanded } : n)),
      ];
      persist(rebuilt);
      if (activeId && !rebuilt.some((n) => n.id === activeId)) setActiveId(null);
    } finally {
      setDirBusy(false);
    }
  };

  const handleDeleteDirection = (themeId: string) => {
    const seed = findSeed(themeId);
    if (!seed) return;
    if (!window.confirm(`删除方向「${seed.title}」？该方向下的全部任务与进度都会移除。`)) return;
    setDirMenuFor(null);
    deleteCustomDirection(user.learningLanguage, themeId);
    const remaining = nodes.filter((n) => n.id !== themeId && n.parentId !== themeId);
    persist(remaining);
    if (activeId && !remaining.some((n) => n.id === activeId)) setActiveId(null);
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

  // 重写：保留当前任务，清空反馈与输入回到作答态（rewrite 类节点基于反馈重写的关键入口）
  const rewrite = () => {
    setInput('');
    setFeedback(null);
    setError(null);
  };

  // 预构建 parentId → children 索引，避免 renderTree 里每个节点都全量 filter（O(n²) → O(n)）
  const childrenMap = useMemo(() => {
    const map: Record<string, WritingNode[]> = {};
    for (const n of nodes) {
      const key = n.parentId ?? '__root__';
      (map[key] ||= []).push(n);
    }
    return map;
  }, [nodes]);

  // 搜索过滤：匹配 title/scaffoldHint 的节点 + 其祖先链（其余隐藏）
  const visibleSet = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set<string>();
    for (const n of nodes) {
      const hit = n.title.toLowerCase().includes(q) || (n.scaffoldHint ?? '').toLowerCase().includes(q);
      if (!hit) continue;
      matched.add(n.id);
      let cur = n.parentId;
      while (cur) {
        matched.add(cur);
        cur = nodes.find((x) => x.id === cur)?.parentId ?? null;
      }
    }
    return matched;
  }, [query, nodes]);

  // 定位到第一个「解锁且未完成」的 task/composition，并展开其祖先链
  const goToNext = () => {
    const first = nodes.find((n) => (n.type === 'task' || n.type === 'composition') && n.unlocked && !n.completed);
    if (!first) return;
    const ancestors = new Set<string>();
    let cur = first.parentId;
    while (cur) {
      ancestors.add(cur);
      cur = nodes.find((x) => x.id === cur)?.parentId ?? null;
    }
    persist(nodes.map((n) => (ancestors.has(n.id) ? { ...n, isExpanded: true } : n)));
    setQuery('');
    selectNode(first.id);
  };

  // 全部展开/折叠（仅分组节点）
  const toggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    persist(nodes.map((n) => (n.type === 'theme' || n.type === 'root' ? { ...n, isExpanded: next } : n)));
  };

  // 树渲染
  const renderTree = (parentId: string | null, depth = 0, visible?: Set<string> | null) => {
    const children = childrenMap[parentId ?? '__root__'] ?? [];
    const shown = visible ? children.filter((c) => visible.has(c.id)) : children;
    if (shown.length === 0) return null;
    return (
      <div className={depth > 0 ? 'ml-3 border-l border-line-strong/50' : ''}>
        {shown.map((node) => {
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
                ) : node.type === 'theme' && node.tags?.includes('custom') ? (
                  <Sparkles size={16} className="text-fuchsia-400 flex-shrink-0" />
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
                {node.type === 'theme' && node.tags?.includes('custom') && (
                  <div className="relative flex-shrink-0">
                    <button
                      aria-label="方向管理菜单"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDirMenuFor(dirMenuFor === node.id ? null : node.id);
                      }}
                      className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {dirMenuFor === node.id && (
                      <div className="absolute right-0 top-6 z-30 w-32 bg-surface border border-line-strong rounded-lg py-1 text-xs shadow-xl">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDirMenuFor(null);
                            setRenameValue(node.title);
                            setRenameFor(node.id);
                          }}
                          className="w-full px-3 py-1.5 text-left text-muted hover:text-white hover:bg-white/10 flex items-center gap-1.5"
                        >
                          <Pencil size={12} /> 重命名
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateDirection(node.id);
                          }}
                          disabled={dirBusy}
                          className="w-full px-3 py-1.5 text-left text-muted hover:text-white hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <RefreshCw size={12} /> 重新生成
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDirection(node.id);
                          }}
                          className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-400/10 flex items-center gap-1.5"
                        >
                          <Trash2 size={12} /> 删除方向
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {node.isExpanded && renderTree(node.id, depth + 1, visible)}
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
          {dirBusy && (
            <span className="flex items-center gap-1 text-[10px] text-neon">
              <RefreshCw size={10} className="animate-spin" /> 生成中
            </span>
          )}
          <span className="ml-auto text-xs text-muted">
            {completedCount} / {totalCount} 完成
          </span>
        </div>
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1.5">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索任务…"
              className="w-full bg-dark/40 border border-line-strong rounded-lg pl-7 pr-2 py-1.5 text-xs text-gray-200 placeholder:text-faint outline-none focus:ring-2 focus:ring-neon/40 transition"
            />
          </div>
          <button
            onClick={goToNext}
            title="定位到下一个未完成任务"
            className="px-2.5 rounded-lg border border-line-strong text-xs text-muted hover:text-white hover:border-neon/50 transition whitespace-nowrap"
          >
            下一步
          </button>
          <button
            onClick={toggleAll}
            title={allExpanded ? '折叠全部' : '展开全部'}
            className="px-2.5 rounded-lg border border-line-strong text-xs text-muted hover:text-white hover:border-neon/50 transition whitespace-nowrap"
          >
            {allExpanded ? '折叠' : '展开'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {renderTree(null, 0, visibleSet)}
          {customThemes.length < MAX_CUSTOM_DIRECTIONS ? (
            <button
              onClick={() => setShowDirModal(true)}
              className="mt-2 w-full py-2.5 rounded-lg border-2 border-dashed border-line-strong hover:border-fuchsia-400/60 text-xs text-muted hover:text-white flex items-center justify-center gap-1.5 transition"
            >
              <Plus size={14} /> 添加我的写作方向
            </button>
          ) : (
            <p className="mt-2 text-center text-[10px] text-faint">自定义方向已达上限（{MAX_CUSTOM_DIRECTIONS} 个）</p>
          )}
        </div>
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

                <div className="flex gap-2">
                  <button
                    onClick={rewrite}
                    className="flex-1 py-3 rounded-xl bg-surface-3/70 border border-line-strong text-gray-200 font-bold hover:bg-white/10 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} /> 再写一版
                  </button>
                  <button
                    onClick={() => completeTask(active.id)}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold shadow-glow-sm hover:brightness-110 hover:shadow-glow-neon active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    完成并解锁下一题 <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 自定义方向：创建弹窗 + 重命名弹窗（菜单关闭由 document click-away 处理） */}
      {showDirModal && (
        <CustomDirectionModal
          lang={user.learningLanguage}
          level={userLevel}
          nativeLanguage={user.nativeLanguage}
          currentCount={customThemes.length}
          onClose={() => setShowDirModal(false)}
          onCreated={handleDirectionCreated}
        />
      )}
      {renameFor && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setRenameFor(null)}>
          <div className="glass-panel border border-neon/30 rounded-2xl p-5 w-full max-w-sm animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Pencil size={16} className="text-neon-2" /> 重命名方向
            </h3>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameDirection(renameFor)}
              maxLength={12}
              placeholder="方向名"
              className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameFor(null)} className="px-4 py-2 text-sm text-muted hover:text-white transition">取消</button>
              <button
                onClick={() => handleRenameDirection(renameFor)}
                disabled={!renameValue.trim()}
                className="px-4 py-2 rounded-xl bg-neon text-white text-sm font-bold hover:bg-neon/80 transition disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </WritingLanguageGate>
  );
};

export default WritingTreeView;
