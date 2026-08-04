import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile, WritingNode, CEFRLevel, Language, CompositionGenre, GENRE_LABELS, REGISTER_LABELS
} from '../types';
import { ensureGrowthTree, saveWritingTree, addActivity } from '../services/storageService';
import { countWords } from '../services/textUtils';
import { SUPPORTED_LANGUAGES } from '../constants';
import CompositionEditor from './CompositionEditor';
import { Layers, BookOpen, CheckCircle2, Lock, PenLine, ChevronRight, Filter } from 'lucide-react';

interface Props {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

type StatusFilter = 'all' | 'available' | 'completed' | 'locked';

const CompositionStudioView: React.FC<Props> = ({ user, onUpdateUser }) => {
  const lang = user.learningLanguage;
  const flag = SUPPORTED_LANGUAGES.find((l) => l.id === lang)?.flag ?? '🌐';
  const userLevel = user.progress[lang]?.cefrLevel ?? CEFRLevel.A1;

  const [nodes, setNodes] = useState<WritingNode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<CompositionGenre | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    setNodes(ensureGrowthTree(lang, userLevel));
    setActiveId(null);
  }, [lang, userLevel]);

  const persist = (next: WritingNode[]) => {
    setNodes(next);
    saveWritingTree(next);
  };

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

  const saveGenre = (compId: string, genre: CompositionGenre) => {
    const next = nodes.map((n) => (n.id === compId ? { ...n, genre, updatedAt: Date.now() } : n));
    persist(next);
  };

  const completeComposition = (compId: string) => {
    const comp = nodes.find((n) => n.id === compId);
    const next = nodes.map((n) => (n.id === compId ? { ...n, completed: true, progress: 100, updatedAt: Date.now() } : n));
    persist(next);
    const xp = 50;
    const { user: updated } = addActivity(
      user,
      'tree_writing',
      lang,
      xp,
      `成长树·作文 ${comp?.title ?? ''}`,
      { wordCount: comp?.wordCount ?? 0 }
    );
    onUpdateUser(updated);
  };

  const active = nodes.find((n) => n.id === activeId) || null;

  // 按主题分组所有作文节点，并应用筛选
  const grouped = useMemo(() => {
    const themes = nodes.filter((n) => n.type === 'theme');
    const result = themes.map((th) => {
      const comps = nodes
        .filter((n) => n.type === 'composition' && n.parentId === th.id)
        .filter((c) => genreFilter === 'all' || (c.genre ?? 'argumentative') === genreFilter)
        .filter((c) => {
          if (statusFilter === 'all') return true;
          const locked = !c.unlocked && !c.completed;
          if (statusFilter === 'locked') return locked;
          if (statusFilter === 'completed') return !!c.completed;
          if (statusFilter === 'available') return c.unlocked && !c.completed;
          return true;
        });
      return { theme: th, comps };
    }).filter((g) => g.comps.length > 0);
    return result;
  }, [nodes, genreFilter, statusFilter]);

  const totalComps = nodes.filter((n) => n.type === 'composition').length;
  const doneComps = nodes.filter((n) => n.type === 'composition' && n.completed).length;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-180px)] gap-4">
      {/* 左：筛选 + 作文列表 */}
      <div className="w-full lg:w-1/3 bg-card border border-gray-700 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-secondary" />
            <span className="font-bold text-gray-300">作文流水线</span>
            <span className="ml-auto text-xs text-gray-500">{flag} {lang} · {doneComps}/{totalComps}</span>
          </div>
          {/* 筛选器 */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter size={12} /> 体裁
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setGenreFilter('all')}
                className={`text-[11px] px-2 py-1 rounded-full border ${genreFilter === 'all' ? 'bg-secondary/20 border-secondary/40 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
              >全部</button>
              {(Object.keys(GENRE_LABELS) as CompositionGenre[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenreFilter(g)}
                  className={`text-[11px] px-2 py-1 rounded-full border ${genreFilter === g ? 'bg-secondary/20 border-secondary/40 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                >{GENRE_LABELS[g]}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'available', 'completed', 'locked'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[11px] px-2 py-1 rounded-full border ${statusFilter === s ? 'bg-primary/20 border-primary/40 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                >{s === 'all' ? '全部状态' : s === 'available' ? '可写' : s === 'completed' ? '已完成' : '未解锁'}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
          {grouped.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-10">没有符合条件的作文</p>
          )}
          {grouped.map(({ theme, comps }) => (
            <div key={theme.id}>
              <div className="text-xs text-gray-500 font-semibold px-1 mb-1 flex items-center gap-1">
                <BookOpen size={12} /> {theme.title}
              </div>
              {comps.map((c) => {
                const locked = !c.unlocked && !c.completed;
                return (
                  <button
                    key={c.id}
                    disabled={locked}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-2.5 rounded-lg mb-1 border transition-all flex items-center gap-2
                      ${activeId === c.id ? 'bg-secondary/20 border-secondary/40' : 'border-transparent hover:bg-gray-800'}
                      ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {c.completed ? (
                      <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" />
                    ) : locked ? (
                      <Lock size={14} className="text-gray-500 flex-shrink-0" />
                    ) : (
                      <PenLine size={15} className="text-amber-400 flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-200 truncate">{c.title.replace(/\s*·\s*主题作文$/, '')}</span>
                      <span className="block text-[10px] text-gray-500">
                        {c.genre ? GENRE_LABELS[c.genre] : '作文'}
                        {c.register ? ` · ${REGISTER_LABELS[c.register]}` : ''}
                        {c.wordCount ? ` · ${c.wordCount}词` : ''}
                      </span>
                    </span>
                    <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 右：作文编辑器 */}
      <div className="flex-1 bg-card border border-gray-700 rounded-xl flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Layers size={64} className="mb-4 opacity-20" />
            <p className="text-lg">从左侧选择一篇作文开始写</p>
            <p className="text-sm opacity-50 mt-1">可按体裁 / 状态筛选，切换体裁会改变提纲骨架</p>
          </div>
        ) : (
          <CompositionEditor
            node={active}
            user={user}
            onSave={(sections, wc) => saveComposition(active.id, sections, wc)}
            onComplete={() => completeComposition(active.id)}
            onGenreChange={(g) => saveGenre(active.id, g)}
          />
        )}
      </div>
    </div>
  );
};

export default CompositionStudioView;
