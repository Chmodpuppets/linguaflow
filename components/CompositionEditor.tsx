import React, { useState, useEffect } from 'react';
import {
  WritingNode, UserProfile, WritingFeedback, REGISTER_LABELS, TargetExam, CEFRLevel,
  CompositionGenre, GENRE_LABELS, ReferenceEssay
} from '../types';
import { analyzeWriting, generateSpeech, generateReferenceEssay } from '../services/aiService';
import { buildCompositionSections } from '../data/growthTree';
import { countWords } from '../services/textUtils';
import { addErrorCards } from '../services/storageService';
import { Sparkles, Wand2, Volume2, ArrowRight, AlertCircle, BookOpen } from 'lucide-react';

interface Props {
  node: WritingNode;
  user: UserProfile;
  onSave: (sections: WritingNode['sections'], wordCount: number) => void;
  onComplete: () => void;
  // 体裁切换时通知父级持久化 genre 到节点
  onGenreChange?: (genre: CompositionGenre) => void;
  // 考试视角开关：true=按 defaultExam 评分；false=自由写作（仅通用反馈）。变更时持久化到节点
  examMode?: boolean;
  onExamModeChange?: (examMode: boolean) => void;
}

// 考试评分卡：各考试的全维度配置（维度条 + 估算等级/总分）
interface ExamDim { key: string; label: string; max: number; }
const EXAM_SCORECARD: Partial<Record<TargetExam, { dims: ExamDim[]; levelKey: string; levelLabel: string }>> = {
  IELTS: {
    dims: [
      { key: 'taskResponse', label: '任务回应 TR', max: 9 },
      { key: 'coherenceCohesion', label: '连贯衔接 CC', max: 9 },
      { key: 'lexicalResource', label: '词汇资源 LR', max: 9 },
      { key: 'grammaticalRange', label: '语法广度 GRA', max: 9 },
    ],
    levelKey: 'overall', levelLabel: '总分 (9 分制)',
  },
  TOEFL: {
    dims: [
      { key: 'development', label: '展开 Development', max: 5 },
      { key: 'organization', label: '结构 Organization', max: 5 },
      { key: 'languageUse', label: '语言运用', max: 5 },
    ],
    levelKey: 'scaled', levelLabel: '换算分 (0-30)',
  },
  JLPT: {
    dims: [
      { key: 'vocabularyKanji', label: '文字・語彙', max: 100 },
      { key: 'grammar', label: '文法', max: 100 },
      { key: 'composition', label: '構成・表現', max: 100 },
    ],
    levelKey: 'estimatedLevel', levelLabel: '估算等级',
  },
  TOPIK: {
    dims: [
      { key: 'vocabGrammar', label: '词汇语法', max: 100 },
      { key: 'contentOrganization', label: '内容构成', max: 100 },
      { key: 'expression', label: '表达', max: 100 },
    ],
    levelKey: 'estimatedLevel', levelLabel: '估算等级',
  },
  DELE: {
    dims: [
      { key: 'grammar', label: '语法', max: 100 },
      { key: 'vocabulary', label: '词汇', max: 100 },
      { key: 'coherence', label: '连贯衔接', max: 100 },
      { key: 'taskAdequacy', label: '任务适配', max: 100 },
    ],
    levelKey: 'estimatedLevel', levelLabel: '估算等级',
  },
};

const CompositionEditor: React.FC<Props> = ({ node, user, onSave, onComplete, onGenreChange, examMode: examModeProp, onExamModeChange }) => {
  const userLevel = user.progress[user.learningLanguage]?.cefrLevel ?? CEFRLevel.A1;
  const exam = node.defaultExam ?? 'none';
  // 该语言是否启用考试评分（defaultExam 非 none）
  const hasExam = !!node.defaultExam && node.defaultExam !== 'none';
  const [sections, setSections] = useState<NonNullable<WritingNode['sections']>>(
    node.sections?.map((s) => ({ ...s })) ?? []
  );
  const [genre, setGenre] = useState<CompositionGenre>(node.genre ?? 'argumentative');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState(true);
  // 参考范文 / 提纲（AI 按需生成，不预置静态库）
  const [reference, setReference] = useState<ReferenceEssay | null>(null);
  const [genRef, setGenRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  // 考试视角开关：默认跟随节点持久化的 examMode，首次无记录时按该语言是否启用考试决定
  const [examMode, setExamMode] = useState<boolean>(examModeProp ?? hasExam);

  const toggleExamMode = () => {
    const next = !examMode;
    setExamMode(next);
    onExamModeChange?.(next);
  };

  // 切换节点时同步内容
  useEffect(() => {
    setSections(node.sections?.map((s) => ({ ...s })) ?? []);
    setGenre(node.genre ?? 'argumentative');
    setFeedback(null);
    setError(null);
    setReference(null);
    setRefError(null);
    setExamMode(examModeProp ?? hasExam);
  }, [node.id]);

  const totalTarget = sections.reduce((a, s) => a + s.targetWords, 0);
  const totalWords = sections.reduce((a, s) => a + countWords(s.content, user.learningLanguage), 0);

  const setSectionContent = (idx: number, val: string) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, content: val } : s)));
  };

  const essayText = sections.map((s) => s.content.trim()).filter(Boolean).join('\n\n');

  // 切换体裁：重建提纲骨架，尽量按标题保留已写内容，并通知父级持久化 genre
  const handleGenreChange = (g: CompositionGenre) => {
    if (g === genre) return;
    const rebuilt = buildCompositionSections(node.cefrLevel ?? userLevel, g, user.learningLanguage);
    const byTitle = new Map<string, string>(sections.map((s) => [s.title, s.content]));
    const merged = rebuilt.map((s, i) => ({ ...s, id: `${node.id}-s${i}`, content: byTitle.get(s.title) ?? '' }));
    setGenre(g);
    setSections(merged);
    onGenreChange?.(g);
    onSave(merged, merged.reduce((a, s) => a + countWords(s.content, user.learningLanguage), 0));
  };

  const submit = async () => {
    if (!essayText.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      // 真实考题（node.prompt）优先；缺省时回退到主题标题。评分与范文都对照此题。
      const taskPrompt = node.prompt ?? node.title.replace(/\s*·\s*主题作文$/, '');
      const fb = await analyzeWriting(
        essayText,
        user.learningLanguage,
        user.nativeLanguage,
        node.cefrLevel ?? userLevel,
        examMode ? exam : undefined,
        node.register,
        taskPrompt
      );
      setFeedback(fb);
      // 错题沉淀：作文批改指出的错误全部进错题本（闭环）
      if (fb.suggestions && fb.suggestions.length > 0) {
        addErrorCards(fb.suggestions.map((s) => ({
          original: s.original,
          correction: s.suggestion,
          reason: s.reason,
          language: user.learningLanguage,
        })));
      }
    } catch (e) {
      setError('批改失败（AI 返回格式异常或网络问题）。请重试——不会扣除 XP 或记录趋势。');
    }
    setAnalyzing(false);
  };

  // 生成参考范文 / 提纲（按体裁、等级、语体、考试框架）
  const handleGenerateReference = async () => {
    if (genRef) return;
    setGenRef(true);
    setRefError(null);
    try {
      const taskPrompt = node.prompt ?? node.title.replace(/\s*·\s*主题作文$/, '');
      const ref = await generateReferenceEssay({
        topic: taskPrompt,
        language: user.learningLanguage,
        nativeLanguage: user.nativeLanguage,
        cefrLevel: node.cefrLevel ?? userLevel,
        genre,
        register: node.register,
        exam: examMode ? (node.defaultExam ?? 'none') : 'none',
      });
      setReference(ref);
    } catch (e) {
      setRefError('参考范文生成失败，请检查网络/API Key 后重试。');
    }
    setGenRef(false);
  };

  const handleSave = () => {
    onSave(
      sections.map((s) => ({ ...s })),
      totalWords
    );
  };

  const speak = (text: string) => {
    if (text) generateSpeech(text, { lang: user.learningLanguage });
  };

  // 考试评分卡（考试视角下渲染完整 examScores）
  const cfg = EXAM_SCORECARD[exam];
  const es = feedback?.examScores as Record<string, any> | null | undefined;
  const esFb = (es?.feedback ?? {}) as Record<string, string>;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mb-4">
        <div className="text-xs text-muted">
          {node.cefrLevel} · 主题作文 · {GENRE_LABELS[genre]}
          {node.register ? ` · ${REGISTER_LABELS[node.register]}语气` : ''} · 目标 {totalTarget} 词（已写 {totalWords}）
        </div>
        <h3 className="text-xl font-bold text-white mt-1">{node.title}</h3>
        {/* 真实考题：评分与参考范文都对照此任务，学生也需先看清题目 */}
        {node.prompt && (
          <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="text-[10px] uppercase tracking-wide text-amber-300/80 mb-1">题目要求 · Task</div>
            <p className="text-sm text-amber-100/90 leading-relaxed">{node.prompt}</p>
          </div>
        )}
        {node.register && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neon/15 border border-neon/30 text-xs text-neon">
            <span className="opacity-70">要求语气</span>
            <span className="font-semibold">{REGISTER_LABELS[node.register]}</span>
          </div>
        )}
        {/* 体裁切换 */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted">体裁</span>
          <select
            value={genre}
            onChange={(e) => handleGenreChange(e.target.value as CompositionGenre)}
            className="bg-dark/60 border border-line-strong rounded-lg px-2 py-1 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-neon"
          >
            {(Object.keys(GENRE_LABELS) as CompositionGenre[]).map((g) => (
              <option key={g} value={g}>{GENRE_LABELS[g]}</option>
            ))}
          </select>
          <span className="text-[10px] text-faint">切换会改变提纲骨架</span>
        </div>
        {/* 考试视角开关：仅当该语言有对应考试（defaultExam 非 none）时显示 */}
        {hasExam && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted">视角</span>
            <div className="inline-flex rounded-lg border border-line-strong overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => examMode || toggleExamMode()}
                className={`px-3 py-1 font-semibold transition-colors ${examMode ? 'bg-amber-500/20 text-amber-200' : 'text-muted hover:text-white'}`}
              >考试</button>
              <button
                type="button"
                onClick={() => examMode && toggleExamMode()}
                className={`px-3 py-1 font-semibold transition-colors ${!examMode ? 'bg-neon/20 text-neon' : 'text-muted hover:text-white'}`}
              >自由</button>
            </div>
            <span className="text-[10px] text-faint">{examMode ? `按 ${exam} 维度评分` : '不评分，仅通用反馈'}</span>
          </div>
        )}
      </div>

      {/* 提纲骨架 */}
      <div className="mb-4">
        <button
          onClick={() => setShowOutline((v) => !v)}
          className="text-xs text-muted hover:text-neon inline-flex items-center gap-1"
        >
          <BookOpen size={14} /> {showOutline ? '收起提纲' : '查看提纲骨架'}
        </button>
        {showOutline && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sections.map((s) => {
              const w = countWords(s.content, user.learningLanguage);
              const pct = Math.min(100, Math.round((w / s.targetWords) * 100));
              return (
                <div key={s.id} className="bg-dark/40 border border-line-strong hover:border-neon/30 rounded-lg p-2 text-center transition-colors">
                  <div className="text-xs text-gray-300 truncate">{s.title}</div>
                  <div className="text-[10px] text-muted mt-1">{w}/{s.targetWords} 词</div>
                  <div className="h-1.5 bg-surface-3 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-neon" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 分段写作 */}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300 font-medium">{s.title}</span>
              <span className="text-[10px] text-muted">目标 {s.targetWords} 词</span>
            </div>
            <textarea
              value={s.content}
              onChange={(e) => setSectionContent(i, e.target.value)}
              placeholder={`用 ${user.learningLanguage} 写这一段……`}
              className="w-full bg-dark/60 border border-line-strong rounded-xl p-3 text-base text-gray-200 outline-none focus:ring-2 focus:ring-neon resize-none"
              rows={4}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        <button
          onClick={submit}
          disabled={!essayText.trim() || analyzing}
          className="flex-1 min-w-[140px] py-3 rounded-xl bg-gradient-to-r from-neon to-neon-2 text-white font-bold flex items-center justify-center gap-2 shadow-glow-neon disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? <><Sparkles className="animate-spin" size={18} /> 批改中</> : <><Wand2 size={18} /> 提交批改</>}
        </button>
        <button
          onClick={handleGenerateReference}
          disabled={genRef}
          className="px-4 py-3 rounded-xl bg-neon-2/15 text-neon-2 border border-neon-2/40 font-bold hover:bg-neon-2/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {genRef ? <><Sparkles className="animate-spin" size={18} /> 生成中</> : <><BookOpen size={18} /> 生成参考范文</>}
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-3 rounded-xl bg-surface-3/50 text-gray-300 border border-line-strong font-bold hover:bg-surface-3 flex items-center gap-2"
        >
          保存草稿
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-300 text-sm mt-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {refError && (
        <div className="flex items-center gap-2 text-red-300 text-sm mt-3">
          <AlertCircle size={16} /> {refError}
        </div>
      )}

      {/* 参考范文 / 提纲 */}
      {reference && (
        <div className="mt-4 bg-dark/30 border border-indigo-500/30 rounded-xl p-4 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-semibold text-sm">参考范文 · {GENRE_LABELS[genre]}</h4>
            <button
              onClick={() => speak(reference.essay)}
              className="text-neon-2 hover:underline inline-flex items-center gap-1 text-xs"
            >
              <Volume2 size={14} /> 听发音
            </button>
          </div>
          {reference.outline.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-muted mb-1">提纲要点（母语）</div>
              <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                {reference.outline.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-xs text-muted mb-1">参考范文全文（{user.learningLanguage}）</div>
            <div className="text-gray-200 leading-relaxed whitespace-pre-wrap font-mono text-sm">{reference.essay}</div>
          </div>
        </div>
      )}

      {/* 反馈 */}
      {feedback && (
        <div className="space-y-4 mt-6 animate-in slide-in-from-bottom-2">
          {/* 考试评分卡：考试视角下展示全维度评分 + 估算等级/总分 + 逐维度点评 */}
          {examMode && es && cfg && (
            <div className="bg-dark/30 border border-amber-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span className="text-amber-300">考试评分 · {exam}</span>
                </h4>
                <span className="text-xs text-amber-200/80">{cfg.levelLabel}：<b className="text-amber-100">{String(es[cfg.levelKey])}</b></span>
              </div>
              {cfg.dims.map((d) => {
                const v = typeof es[d.key] === 'number' ? (es[d.key] as number) : undefined;
                const fb = esFb[d.key];
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{d.label}</span>
                      <span className="text-sm text-neon font-bold">{v} / {d.max}</span>
                    </div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-neon" style={{ width: `${Math.min(100, Math.round(((v ?? 0) / d.max) * 100))}%` }} />
                    </div>
                    {fb && <p className="text-xs text-muted mt-1">{fb}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-dark/30 border border-line-strong rounded-xl p-4">
            <div className="text-xs text-muted mb-1 flex items-center gap-2">
              AI 改写 / 参考
              <button onClick={() => speak(feedback.correctedText)} className="text-neon-2 hover:underline inline-flex items-center gap-1">
                <Volume2 size={14} /> 听发音
              </button>
            </div>
            <div className="text-gray-200 font-mono leading-relaxed whitespace-pre-wrap">{feedback.correctedText}</div>
          </div>

          {feedback.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-white font-semibold text-sm">具体问题</h4>
              {feedback.suggestions.map((it, i) => (
                <div key={i} className="bg-dark/30 border border-line-strong rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-red-300 line-through flex-1">{it.original}</span>
                    <ArrowRight size={16} className="text-muted" />
                    <span className="text-green-300 font-medium flex-1">{it.suggestion}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted pl-1 border-l-2 border-line-strong">{it.reason}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-neon/10 border border-neon/30 rounded-xl p-4 text-sm text-gray-200">
            <span className="font-bold text-neon">教练的话：</span>{feedback.generalComment}
          </div>

          {feedback.registerNote && (
            <div className="bg-neon/10 border border-neon/30 rounded-xl p-4 text-sm text-gray-200">
              <span className="font-bold text-neon">语体点评：</span>{feedback.registerNote}
            </div>
          )}

          <button
            onClick={onComplete}
            className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon flex items-center justify-center gap-2"
          >
            完成作文 <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CompositionEditor;
