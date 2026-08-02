
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WritingNode, CEFRLevel, Language, GuidedWritingFeedback } from '../types';
import { ensureGrowthTree, saveWritingTree, addActivity } from '../services/storageService';
import { analyzeGuidedWriting, generateSpeech } from '../services/aiService';
import { romajiToKana } from '../services/romajiKana';
import { countWords } from '../services/textUtils';
import {
  FolderTree, FileText, ChevronRight, ChevronDown, Lock, CheckCircle2,
  Sparkles, Wand2, Volume2, ArrowRight, AlertCircle, PenLine
} from 'lucide-react';

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
    if (n && n.type === 'task' && !n.unlocked && !n.completed) return; // 锁定不可选
    setActiveId(id);
    setInput(n?.content ?? '');
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
      const ctx = { template: active.scaffold, hint: active.scaffoldHint };
      const fb = await analyzeGuidedWriting(
        normalizedInput,
        user.learningLanguage,
        user.nativeLanguage,
        active.cefrLevel ?? userLevel,
        'scaffold',
        ctx
      );
      setFeedback(fb);
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

  const speak = (text: string) => {
    if (text) generateSpeech(text, { lang: user.learningLanguage });
  };

  // 树渲染
  const renderTree = (parentId: string | null, depth = 0) => {
    const children = nodes.filter((n) => n.parentId === parentId);
    if (children.length === 0) return null;
    return (
      <div className={depth > 0 ? 'ml-3 border-l border-gray-700/50' : ''}>
        {children.map((node) => {
          const isTask = node.type === 'task';
          const locked = isTask && !node.unlocked && !node.completed;
          return (
            <div key={node.id}>
              <div
                onClick={() => (isTask ? selectNode(node.id) : toggleExpand(node.id))}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm mb-1 select-none transition-all border
                  ${activeId === node.id ? 'bg-secondary/20 text-white border-secondary/30' : 'text-gray-400 hover:bg-gray-800 border-transparent'}
                  ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {!isTask && (
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
                ) : node.completed ? (
                  <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                ) : locked ? (
                  <Lock size={14} className="text-gray-500 flex-shrink-0" />
                ) : (
                  <FileText size={16} className="text-teal-400 flex-shrink-0" />
                )}
                <span className="truncate flex-1 font-medium">{node.title}</span>
                {isTask && node.cefrLevel && (
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{node.cefrLevel}</span>
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4">
      {/* 左：成长树 */}
      <div className="w-full lg:w-1/3 bg-card border border-gray-700 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2 bg-gray-900/50">
          <PenLine size={18} className="text-secondary" />
          <span className="font-bold text-gray-300">写作成长树</span>
          <span className="ml-auto text-xs text-gray-500">
            {completedCount} / {totalCount} 完成
          </span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">{renderTree(null)}</div>
      </div>

      {/* 右：编辑器 */}
      <div className="flex-1 bg-card border border-gray-700 rounded-xl flex flex-col overflow-hidden">
        {!active || active.type !== 'task' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <PenLine size={64} className="mb-4 opacity-20" />
            <p className="text-lg">从左侧选择一个解锁的写作任务</p>
            <p className="text-sm opacity-50 mt-1">完成当前任务，解锁同主题下一题</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="mb-4">
              <div className="text-xs text-gray-500">{active.cefrLevel ?? userLevel} · 写作任务</div>
              <h3 className="text-xl font-bold text-white mt-1">{active.title}</h3>
            </div>

            {/* 脚手架模板 / 情境 */}
            {active.scaffold ? (
              <div className="bg-dark/50 border border-gray-700 rounded-xl p-4 mb-4">
                <div className="text-xs text-gray-500 mb-2">句型模板（＿＿＿ 处填你的内容）</div>
                <div className="text-2xl font-bold text-white font-mono leading-relaxed">
                  {active.scaffold.split('___').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="text-secondary underline decoration-dotted px-1">＿＿＿</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="text-sm text-gray-400 mt-2">提示：{active.scaffoldHint}</div>
              </div>
            ) : (
              <div className="bg-dark/50 border border-gray-700 rounded-xl p-4 mb-4">
                <div className="text-xs text-gray-500 mb-1">情境</div>
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
                  className="w-full bg-dark/50 border border-gray-700 rounded-xl p-4 text-lg text-gray-200 outline-none focus:ring-2 focus:ring-secondary resize-none"
                  rows={3}
                  autoFocus
                />
                {user.learningLanguage === Language.Japanese &&
                  input.trim() &&
                  /^[\x00-\x7F\s]+$/.test(input) &&
                  normalizedInput && (
                    <div className="text-xs text-gray-400 bg-dark/30 border border-gray-700 rounded-lg p-2">
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
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className={`p-4 rounded-xl flex items-center gap-3 ${
                    feedback.isCorrect ? 'bg-green-600/20 text-green-300' : 'bg-amber-600/20 text-amber-300'
                  }`}
                >
                  {feedback.isCorrect ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  <div>
                    <div className="font-bold text-lg">{feedback.isCorrect ? '✓ 不错！' : '✗ 再看看'}</div>
                    <div className="text-xs opacity-80">预估等级 {feedback.cefrEstimation} · 完成 XP {feedback.isCorrect ? '+20' : '+10'}</div>
                  </div>
                </div>

                <div className="bg-dark/30 border border-gray-700 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
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

                {feedback.issues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-white font-semibold text-sm">具体问题</h4>
                    {feedback.issues.map((it, i) => (
                      <div key={i} className="bg-dark/30 border border-gray-700 rounded-lg p-3 text-sm">
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
                  <span className="font-bold text-secondary">教练的话：</span>
                  {feedback.encouragement}
                </div>

                <button
                  onClick={() => completeTask(active.id)}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 flex items-center justify-center gap-2"
                >
                  完成并解锁下一题 <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WritingTreeView;
