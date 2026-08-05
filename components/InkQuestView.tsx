import React, { useState, useMemo, useRef } from 'react';
import { UserProfile, CEFRLevel, Language } from '../types';
import {
  addActivity,
  getInkQuestCards,
  saveInkQuestCard,
  deleteInkQuestCard,
  InkQuestCard,
  getInkQuestStory,
  appendInkQuestStory,
  InkQuestStory,
  getInkQuestListeningItems,
  saveInkQuestListeningItem,
  updateInkQuestListeningAttempt,
  deleteInkQuestListeningItem,
  InkQuestListeningItem,
  CustomWritingPrompt,
  getCustomWritingPrompts,
} from '../services/storageService';
import {
  getInkQuestCoachFeedback,
  getInkQuestScaffold,
  getInkQuestDictationSentence,
  getInkQuestStoryContinuation,
  InkQuestCoachFeedback,
  languageToSpeechLang,
} from '../services/aiService';
import { countWords } from '../services/textUtils';
import { getInkQuestSeason, INK_QUEST_SEASON_COUNT, InkQuestCardDef } from '../data/inkQuestSeasons';
import TtsAudioPlayer, { TtsAudioPlayerHandle } from './TtsAudioPlayer';
import {
  Feather,
  Sparkles,
  Check,
  CheckCircle2,
  Loader2,
  Trash2,
  Dices,
  BookOpen,
  PenLine,
  Headphones,
  ScrollText,
  Swords,
  ChevronLeft,
  ChevronRight,
  Mic,
  Wand2,
  ListMusic,
} from 'lucide-react';

interface InkQuestViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

type Mode = 'free' | 'dictation';
type RightTab = 'handbook' | 'story' | 'duel' | 'listening';

const SCORE_LABELS: { key: keyof InkQuestCoachFeedback['scores']; label: string }[] = [
  { key: 'grammar', label: '语法' },
  { key: 'fluency', label: '流畅' },
  { key: 'vocabulary', label: '词汇' },
  { key: 'task', label: '扣题' },
];

const CJK_LANGS = new Set<Language>([Language.Japanese, Language.Chinese, Language.Korean]);
const WEEKLY_BENCHMARK: Partial<Record<CEFRLevel, number>> = {
  A1: 3,
  A2: 4,
  B1: 5,
  B2: 6,
  C1: 7,
  C2: 7,
};

// 自建写作题按语体给出生成性引导（中文提示，不显示答案）
const REGISTER_HINTS: Record<string, string[]> = {
  casual: ['用轻松口语的语气写'],
  neutral: ['用中性、自然的语气写'],
  polite: ['注意用礼貌语体表达'],
  formal: ['用正式书面语写'],
  business: ['用商务 / 专业口吻写'],
};

const tokenize = (text: string, lang: Language): string[] => {
  const t = (text || '').trim();
  if (!t) return [];
  if (CJK_LANGS.has(lang)) return Array.from(t).filter((c) => !/\s/.test(c));
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
};

// 用 LCS 标记 original 中哪些 token 出现在 user 文本里（用于听写对照高亮）
const markMatched = (orig: string[], user: string[]): boolean[] => {
  const n = orig.length;
  const m = user.length;
  if (n === 0) return [];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = orig[i] === user[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (orig[i] === user[j]) {
      matched[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return matched;
};

// 计算听写对照：original vs user，返回逐 token 匹配与百分比
const buildComparison = (sentence: string, userText: string, lang: Language) => {
  const origTok = tokenize(sentence, lang);
  const userTok = tokenize(userText, lang);
  const matched = markMatched(origTok, userTok);
  const hit = matched.filter(Boolean).length;
  const pct = origTok.length ? Math.round((hit / origTok.length) * 100) : 0;
  return { origTok, matched, pct };
};

const mondayOf = (d: Date): Date => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

interface WeekStat {
  count: number;
  words: number;
  avg: number | null;
}

const statFor = (cards: InkQuestCard[], since: Date, until: Date, lang: Language): WeekStat => {
  const inRange = cards.filter((c) => {
    const t = new Date(c.date + 'T00:00:00');
    return t >= since && t < until;
  });
  const count = inRange.length;
  const words = inRange.reduce((s, c) => s + (c.wordCount ?? countWords(c.userText, c.language)), 0);
  const scored = inRange.filter((c) => c.scores);
  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce(
            (s, c) =>
              s + (c.scores!.grammar + c.scores!.fluency + c.scores!.vocabulary + c.scores!.task) / 4,
            0
          ) / scored.length
        )
      : null;
  return { count, words, avg };
};

const InkQuestView: React.FC<InkQuestViewProps> = ({ user, onUpdateUser }) => {
  const lang = user.learningLanguage;
  const level: CEFRLevel = user.progress[lang]?.cefrLevel ?? CEFRLevel.A1;

  const [seasonIndex, setSeasonIndex] = useState(0);
  const season = useMemo(() => getInkQuestSeason(seasonIndex), [seasonIndex]);

  const [mode, setMode] = useState<Mode>('free');
  const [rightTab, setRightTab] = useState<RightTab>('handbook');

  const [activeCardId, setActiveCardId] = useState<string>(season.cards[0]?.id ?? '');
  const [customPrompt, setCustomPrompt] = useState<CustomWritingPrompt | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const customItems = useMemo(() => getCustomWritingPrompts(lang), [lang]);
  const activeCard: InkQuestCardDef | undefined = useMemo(() => {
    if (customPrompt) {
      return {
        id: 'custom:' + customPrompt.id,
        theme: customPrompt.text,
        prompts: REGISTER_HINTS[customPrompt.register] ?? ['自由发挥，写出你想写的内容'],
        minSentences: 2,
        maxSentences: 4,
      };
    }
    return season.cards.find((c) => c.id === activeCardId) ?? season.cards[0];
  }, [customPrompt, activeCardId, season]);

  const [text, setText] = useState('');
  const [scaffold, setScaffold] = useState<string[]>([]);
  const [loadingScaffold, setLoadingScaffold] = useState(false);
  const [feedback, setFeedback] = useState<InkQuestCoachFeedback | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedThisRound, setSavedThisRound] = useState(false);
  const [handbook, setHandbook] = useState<InkQuestCard[]>(() => getInkQuestCards(lang));
  const [listeningLib, setListeningLib] = useState<InkQuestListeningItem[]>(() => getInkQuestListeningItems(lang));
  const [currentListeningId, setCurrentListeningId] = useState<string | null>(null);
  const [expandedListenId, setExpandedListenId] = useState<string | null>(null);
  const analyzedRef = useRef(false);

  // 听写模式
  const [dictationSentence, setDictationSentence] = useState<string | null>(null);
  const [dictationLoading, setDictationLoading] = useState(false);
  const [dictationRevealed, setDictationRevealed] = useState(false);
  const ttsPlayerRef = useRef<TtsAudioPlayerHandle | null>(null);

  // 故事线
  const [story, setStory] = useState<InkQuestStory | null>(() => getInkQuestStory(lang));
  const [storyLoading, setStoryLoading] = useState(false);

  const wordCount = countWords(text, lang);

  const resetRound = () => {
    setText('');
    setScaffold([]);
    setFeedback(null);
    setError(null);
    setSavedThisRound(false);
    setDictationSentence(null);
    setDictationRevealed(false);
    setCurrentListeningId(null);
    analyzedRef.current = false;
  };

  const reloadListeningLib = () => setListeningLib(getInkQuestListeningItems(lang));

  const switchSeason = (idx: number) => {
    const next = ((idx % INK_QUEST_SEASON_COUNT) + INK_QUEST_SEASON_COUNT) % INK_QUEST_SEASON_COUNT;
    setSeasonIndex(next);
    setActiveCardId(getInkQuestSeason(next).cards[0]?.id ?? '');
    setCustomPrompt(null);
    setShowCustomPicker(false);
    resetRound();
  };

  const selectCard = (id: string) => {
    setActiveCardId(id);
    setCustomPrompt(null);
    setShowCustomPicker(false);
    resetRound();
  };

  const pickCustomPrompt = (cp: CustomWritingPrompt) => {
    setCustomPrompt(cp);
    setShowCustomPicker(false);
    resetRound();
  };

  const fetchScaffold = async () => {
    if (!activeCard) return;
    setLoadingScaffold(true);
    try {
      const words = await getInkQuestScaffold(activeCard.theme, lang, level);
      setScaffold(words);
    } catch {
      setScaffold([]);
    } finally {
      setLoadingScaffold(false);
    }
  };

  const insertScaffold = (w: string) => {
    setText((t) => (t ? `${t} ${w}` : w));
  };

  const submitTheme = activeCard
    ? mode === 'dictation'
      ? `听写 · ${activeCard.theme}`
      : activeCard.theme
    : activeCard?.theme ?? '';

  const handleSubmit = async () => {
    if (!activeCard || text.trim().length < 3) {
      setError(mode === 'dictation' ? '先写一点点再校对吧～' : '先写一点点再交给教练吧～');
      return;
    }
    if (analyzedRef.current) return; // 防止重复提交计 XP

    // 听写模式：走本地 LCS 即时对照（零 API 调用、零等待），并落库 attempts + 发少量 XP
    if (mode === 'dictation' && dictationSentence) {
      const c = buildComparison(dictationSentence, text, lang);
      if (currentListeningId) {
        updateInkQuestListeningAttempt(currentListeningId, {
          text: text.trim(),
          pct: c.pct,
          at: Date.now(),
        });
        reloadListeningLib();
      }
      setDictationRevealed(true);
      const wc = countWords(text, lang);
      const xp = 8 + Math.min(20, wc);
      const { user: updated } = addActivity(
        user,
        'writing',
        lang,
        xp,
        `墨程·听写：${submitTheme}（匹配 ${c.pct}%）`,
        { wordCount: wc }
      );
      onUpdateUser(updated);
      analyzedRef.current = true;
      return;
    }

    // 自由写模式：交给 AI 教练（需要等 token 返回）
    setAnalyzing(true);
    setError(null);
    try {
      const fb = await getInkQuestCoachFeedback(user, text.trim(), submitTheme, lang, user.nativeLanguage, level);
      setFeedback(fb);
      analyzedRef.current = true;

      const wc = countWords(text, lang);
      const xp = 20 + Math.min(80, wc);
      const { user: updated } = addActivity(
        user,
        'writing',
        lang,
        xp,
        `墨程：${submitTheme}（${wc} 字）`,
        { wordCount: wc }
      );
      onUpdateUser(updated);
    } catch (e) {
      console.error(e);
      setError('教练开小差了，稍后重试一下～');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!activeCard || !feedback) return;
    const card: InkQuestCard = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      language: lang,
      seasonId: season.id,
      cardId: activeCard.id,
      theme: submitTheme,
      userText: text.trim(),
      highlight: feedback.highlight || text.trim(),
      coachComment: feedback.comment,
      scores: feedback.scores,
      wordCount: countWords(text, lang),
      createdAt: Date.now(),
    };
    saveInkQuestCard(card);
    setHandbook(getInkQuestCards(lang));
    setSavedThisRound(true);
  };

  const handleDelete = (id: string) => {
    deleteInkQuestCard(id);
    setHandbook(getInkQuestCards(lang));
  };

  // 听写：生成一句（自动入库到听力库）
  const generateDictation = async () => {
    if (!activeCard) return;
    setDictationLoading(true);
    setDictationRevealed(false);
    setDictationSentence(null);
    setCurrentListeningId(null);
    try {
      const s = await getInkQuestDictationSentence(activeCard.theme, lang, level);
      if (!s) {
        setDictationSentence('');
        return;
      }
      setDictationSentence(s);
      const item: InkQuestListeningItem = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        language: lang,
        seasonId: season.id,
        cardId: activeCard.id,
        theme: activeCard.theme,
        sentence: s,
        createdAt: Date.now(),
        attempts: [],
      };
      saveInkQuestListeningItem(item);
      setCurrentListeningId(item.id);
      reloadListeningLib();
    } catch {
      setDictationSentence('');
    } finally {
      setDictationLoading(false);
    }
  };

  // 对照原文时，把这次结果记入听力库（若有对应入库项）
  const toggleReveal = () => {
    setDictationRevealed((v) => {
      const next = !v;
      if (next && currentListeningId && dictationSentence) {
        const c = buildComparison(dictationSentence, text, lang);
        if (c) {
          updateInkQuestListeningAttempt(currentListeningId, {
            text: text.trim(),
            pct: c.pct,
            at: Date.now(),
          });
          reloadListeningLib();
        }
      }
      return next;
    });
  };

  // 从听力库点「重做」：把该句载入听写台
  const replayListening = (item: InkQuestListeningItem) => {
    setMode('dictation');
    setActiveCardId(item.cardId);
    setText('');
    setFeedback(null);
    setError(null);
    setSavedThisRound(false);
    setDictationSentence(item.sentence);
    setDictationRevealed(false);
    setCurrentListeningId(item.id);
    analyzedRef.current = false;
  };

  // 故事线：把最近亮点织进旅程日记
  const weaveStory = async () => {
    const recent = handbook.slice(0, 3).map((c) => c.highlight).filter(Boolean);
    if (recent.length === 0) {
      setError('先收几句亮点进手帐，才能织成故事哦～');
      return;
    }
    setStoryLoading(true);
    try {
      const para = await getInkQuestStoryContinuation(
        user,
        lang,
        level,
        story?.text ?? '',
        recent
      );
      if (para) {
        const updated = appendInkQuestStory(lang, para);
        setStory(updated);
      }
    } catch {
      /* 静默失败，保留现有故事 */
    } finally {
      setStoryLoading(false);
    }
  };

  // 听写对照
  const comparison = useMemo(() => {
    if (!dictationRevealed || !dictationSentence) return null;
    return buildComparison(dictationSentence, text, lang);
  }, [dictationRevealed, dictationSentence, text, lang]);

  // 成长对决（本周 vs 上周）
  const duel = useMemo(() => {
    const now = new Date();
    const thisMon = mondayOf(now);
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const nextMon = new Date(thisMon);
    nextMon.setDate(nextMon.getDate() + 7);
    return {
      thisWeek: statFor(handbook, thisMon, nextMon, lang),
      lastWeek: statFor(handbook, lastMon, thisMon, lang),
    };
  }, [handbook, lang]);

  if (!activeCard) {
    return <div className="mx-auto max-w-4xl p-8 text-muted">本赛季还没有写作卡，敬请期待～</div>;
  }

  const benchmark = WEEKLY_BENCHMARK[level] ?? 4;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* 赛季横幅 + 切换 + 模式切换 */}
      <section className="rounded-2xl border border-line bg-gradient-to-br from-primary/15 via-surface-2 to-surface-2 p-5">
        <div className="flex items-center gap-2 text-primary">
          <Feather size={18} />
          <span className="text-sm font-bold uppercase tracking-wide">{season.title}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{season.blurb}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => switchSeason(seasonIndex - 1)}
            className="rounded-lg border border-line-strong bg-surface-3/40 p-1.5 text-muted transition-colors hover:text-white"
            title="上一个赛季"
          >
            <ChevronLeft size={16} />
          </button>
          {season.cards.map((c) => {
            const active = c.id === activeCard.id;
            return (
              <button
                key={c.id}
                onClick={() => selectCard(c.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-primary/15 text-white'
                    : 'border-line-strong bg-surface-3/40 text-muted hover:text-white'
                }`}
              >
                {c.theme.length > 10 ? c.theme.slice(0, 10) + '…' : c.theme}
              </button>
            );
          })}
          <button
            onClick={() => switchSeason(seasonIndex + 1)}
            className="rounded-lg border border-line-strong bg-surface-3/40 p-1.5 text-muted transition-colors hover:text-white"
            title="下一个赛季"
          >
            <ChevronRight size={16} />
          </button>
          {customItems.length > 0 && (
            <button
              onClick={() => setShowCustomPicker((v) => !v)}
              className={`ml-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                customPrompt
                  ? 'border-fuchsia-400 bg-fuchsia-500/15 text-white'
                  : 'border-line-strong bg-surface-3/40 text-muted hover:text-white'
              }`}
              title="选择你自建的写作题"
            >
              ✏️ 我的自建 ({customItems.length})
            </button>
          )}
        </div>

        {showCustomPicker && customItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {customItems.map((cp) => (
              <button
                key={cp.id}
                onClick={() => pickCustomPrompt(cp)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  customPrompt?.id === cp.id
                    ? 'border-fuchsia-400 bg-fuchsia-500/15 text-white'
                    : 'border-line-strong bg-surface-3/40 text-gray-200 hover:border-fuchsia-400'
                }`}
              >
                {cp.text.length > 10 ? cp.text.slice(0, 10) + '…' : cp.text}
              </button>
            ))}
          </div>
        )}

        {/* 模式切换：自由写 / 听写 */}
        <div className="mt-4 inline-flex rounded-lg border border-line-strong bg-surface-3/40 p-1">
          <button
            onClick={() => {
              setMode('free');
              resetRound();
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'free' ? 'bg-primary text-white' : 'text-muted hover:text-white'
            }`}
          >
            <PenLine size={14} /> 自由写
          </button>
          <button
            onClick={() => {
              setMode('dictation');
              resetRound();
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'dictation' ? 'bg-primary text-white' : 'text-muted hover:text-white'
            }`}
          >
            <Headphones size={14} /> 听写
          </button>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 写作台 / 听写台 */}
        <section className="md:col-span-2 space-y-4 rounded-2xl border border-line bg-surface-2 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">{activeCard.theme}</h3>
              {customPrompt && (
                <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300">
                  自建题
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {mode === 'free'
                ? `建议 ${activeCard.minSentences}–${activeCard.maxSentences} 句 · 用 ${lang} 自由写，不需要完美`
                : `点「生成听写句」→ 听 AI 朗读 → 用 ${lang} 把听到的写下来`}
            </p>
          </div>

          {mode === 'free' && (
            <div className="flex flex-wrap gap-2">
              {activeCard.prompts.map((p, i) => (
                <span key={i} className="rounded-full bg-surface-3/60 px-3 py-1 text-xs text-gray-300">
                  {p}
                </span>
              ))}
            </div>
          )}

          {mode === 'free' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={fetchScaffold}
                disabled={loadingScaffold}
                className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-3/40 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:text-white disabled:opacity-50"
              >
                {loadingScaffold ? <Loader2 size={14} className="animate-spin" /> : <Dices size={14} />}
                来点 {lang} 词汇灵感
              </button>
              {scaffold.map((w, i) => (
                <button
                  key={i}
                  onClick={() => insertScaffold(w)}
                  className="rounded-lg border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-xs text-secondary transition-colors hover:bg-secondary/20"
                  title="点按插入到输入框"
                >
                  {w}
                </button>
              ))}
            </div>
          )}

          {/* 听写模式：生成 + 播放 + 对照 */}
          {mode === 'dictation' && (
            <div className="space-y-3">
              <button
                onClick={generateDictation}
                disabled={dictationLoading}
                className="flex items-center gap-2 rounded-xl border border-secondary/50 bg-secondary/10 px-4 py-2.5 text-sm font-bold text-secondary transition hover:bg-secondary/20 disabled:opacity-60"
              >
                {dictationLoading ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                {dictationLoading ? '生成中…' : dictationSentence ? '换一句' : '生成听写句'}
              </button>

              {dictationSentence !== null && (
                <>
                  {dictationSentence ? (
                    <>
                      <TtsAudioPlayer
                        ref={ttsPlayerRef}
                        text={dictationSentence}
                        speed={1}
                        webSpeechLang={languageToSpeechLang(lang)}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <button
                          onClick={toggleReveal}
                          className="rounded-lg border border-line-strong bg-surface-3/40 px-3 py-1.5 font-semibold text-gray-300 transition hover:text-white"
                        >
                          {dictationRevealed ? '隐藏原文' : '对照原文'}
                        </button>
                        <span>听 2–3 遍再写，效果最好</span>
                      </div>
                      {dictationRevealed && comparison && (
                        <div className="rounded-xl border border-line bg-dark/40 p-3">
                          <div className="mb-1 text-[11px] font-semibold text-muted">原文</div>
                          <p className="text-sm leading-relaxed">
                            {comparison.origTok.map((tok, i) => (
                              <span
                                key={i}
                                className={
                                  comparison.matched[i]
                                    ? 'text-green-400'
                                    : 'text-red-400 underline decoration-red-400/50'
                                }
                              >
                                {tok}
                              </span>
                            ))}
                          </p>
                          <div className="mt-2 text-[11px] text-muted">
                            你抓到了 <span className="font-bold text-green-400">{comparison.pct}%</span> 的内容
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-amber-400/80">这句没生成出来，换一张卡或重试一下～</p>
                  )}
                </>
              )}
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === 'dictation' ? '把你听到的写下来…' : '在这里用目标语言写下来…'}
            rows={7}
            className="w-full resize-none rounded-xl border border-line-strong bg-dark/50 p-4 text-white outline-none focus:border-secondary"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">约 {wordCount} 字/词</span>
            {mode === 'dictation' ? (
              <button
                onClick={handleSubmit}
                disabled={dictationSentence === null || dictationSentence === ''}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                校对完成（本地）
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={analyzing}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-60"
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {analyzing ? '教练评改中…' : '交给教练'}
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* 教练小条 */}
          {feedback && (
            <div className="space-y-3 rounded-xl border border-secondary/30 bg-dark/40 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 text-secondary">
                <Sparkles size={16} />
                <span className="text-sm font-bold">教练小条</span>
              </div>
              {feedback.highlight && (
                <div>
                  <div className="text-[11px] font-semibold text-muted">✨ 最亮眼的一句</div>
                  <p className="text-sm text-white">{feedback.highlight}</p>
                </div>
              )}
              {feedback.fix && (
                <div>
                  <div className="text-[11px] font-semibold text-muted">🔧 最该改的一处</div>
                  <p className="text-sm text-white">{feedback.fix}</p>
                  {feedback.fixReasonZh && <p className="mt-1 text-xs text-gray-400">💡 {feedback.fixReasonZh}</p>}
                </div>
              )}
              {feedback.rewrite && (
                <div>
                  <div className="text-[11px] font-semibold text-muted">✍️ 更自然的一版</div>
                  <p className="whitespace-pre-wrap text-sm text-gray-200">{feedback.rewrite}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {SCORE_LABELS.map((s) => {
                  const v = feedback.scores[s.key];
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="w-8 text-[11px] text-muted">{s.label}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`h-2 w-3 rounded-sm ${n <= v ? 'bg-secondary' : 'bg-line-strong'}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {feedback.comment && <p className="text-xs text-primary">{feedback.comment}</p>}
              <button
                onClick={handleSave}
                disabled={savedThisRound}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/80 disabled:opacity-50"
              >
                {savedThisRound ? <Check size={14} /> : <BookOpen size={14} />}
                {savedThisRound ? '已收进手帐' : '收进手帐'}
              </button>
            </div>
          )}
        </section>

        {/* 右侧：手帐 / 故事线 / 成长对决 */}
        <section className="space-y-3 rounded-2xl border border-line bg-surface-2 p-5">
          <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-3/40 p-1">
            {([
              { id: 'handbook', label: '手帐', icon: <BookOpen size={13} /> },
              { id: 'story', label: '故事线', icon: <ScrollText size={13} /> },
              { id: 'listening', label: '听力库', icon: <ListMusic size={13} /> },
              { id: 'duel', label: '对决', icon: <Swords size={13} /> },
            ] as { id: RightTab; label: string; icon: React.ReactNode }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  rightTab === t.id ? 'bg-primary text-white' : 'text-muted hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {rightTab === 'handbook' && (
            <>
              <div className="flex items-center gap-2 text-white">
                <BookOpen size={18} />
                <span className="text-sm font-bold">我的手帐</span>
                <span className="ml-auto text-xs text-muted">{handbook.length}</span>
              </div>
              {handbook.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-xs text-muted">
                  还没有收藏的句子。<br />写完交给教练，挑一句亮点收进来吧～
                </div>
              ) : (
                <div className="max-h-[34rem] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                  {handbook.map((c) => (
                    <div key={c.id} className="group rounded-xl border border-line bg-dark/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-secondary">{c.theme}</span>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-white">{c.highlight}</p>
                      <span className="mt-1 block text-[10px] text-faint">{c.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {rightTab === 'listening' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <ListMusic size={18} />
                <span className="text-sm font-bold">听力库</span>
                <span className="ml-auto text-xs text-muted">{listeningLib.length}</span>
              </div>
              <p className="text-[11px] text-muted">
                听写模式生成的句子会自动留在这里，可重听、重做，反复磨耳朵。
              </p>
              {listeningLib.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-xs text-muted">
                  还没有听力素材。<br />切到「听写」模式，点「生成听写句」就会自动存进来～
                </div>
              ) : (
                <div className="max-h-[34rem] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                  {listeningLib.map((it) => {
                    const best = it.attempts && it.attempts.length ? Math.max(...it.attempts.map((a) => a.pct)) : null;
                    const expanded = expandedListenId === it.id;
                    return (
                      <div key={it.id} className="group rounded-xl border border-line bg-dark/40 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-secondary">{it.theme}</span>
                          <button
                            onClick={() => {
                              deleteInkQuestListeningItem(it.id);
                              reloadListeningLib();
                              if (expandedListenId === it.id) setExpandedListenId(null);
                            }}
                            className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-white">{it.sentence}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            onClick={() => setExpandedListenId(expanded ? null : it.id)}
                            className="rounded-lg border border-line-strong bg-surface-3/40 px-2.5 py-1 text-[11px] font-semibold text-gray-300 transition hover:text-white"
                          >
                            {expanded ? '收起播放器' : '▶ 重听'}
                          </button>
                          <button
                            onClick={() => replayListening(it)}
                            className="rounded-lg border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-secondary transition hover:bg-secondary/20"
                          >
                            重做
                          </button>
                          {best !== null && (
                            <span className="ml-auto text-[11px] text-muted">
                              最佳 <span className="font-bold text-green-400">{best}%</span>
                            </span>
                          )}
                        </div>
                        {expanded && (
                          <div className="mt-2">
                            <TtsAudioPlayer
                              text={it.sentence}
                              speed={1}
                              webSpeechLang={languageToSpeechLang(lang)}
                            />
                          </div>
                        )}
                        {it.attempts && it.attempts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {it.attempts.slice(0, 5).map((a, i) => (
                              <span
                                key={i}
                                className={`rounded px-1.5 py-0.5 text-[10px] ${
                                  a.pct >= 80
                                    ? 'bg-green-500/15 text-green-400'
                                    : a.pct >= 50
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-red-500/15 text-red-400'
                                }`}
                              >
                                {a.pct}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {rightTab === 'story' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <ScrollText size={18} />
                <span className="text-sm font-bold">旅程日记</span>
              </div>
              {story?.text ? (
                <div className="max-h-[28rem] space-y-3 overflow-y-auto custom-scrollbar whitespace-pre-wrap rounded-xl border border-line bg-dark/40 p-3 text-sm leading-relaxed text-gray-200">
                  {story.text}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-xs text-muted">
                  还没有故事。<br />收几句亮点进手帐，AI 会把它们织成一段属于你的旅程日记。
                </div>
              )}
              <button
                onClick={weaveStory}
                disabled={storyLoading || handbook.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-50"
              >
                {storyLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {storyLoading ? '编织中…' : story?.text ? '续写一段' : '用今日亮点织成故事'}
              </button>
              {handbook.length === 0 && (
                <p className="text-center text-[11px] text-muted">先收几句亮点进手帐吧～</p>
              )}
            </div>
          )}

          {rightTab === 'duel' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Swords size={18} />
                <span className="text-sm font-bold">成长对决</span>
              </div>
              <p className="text-[11px] text-muted">和「上周的自己」比，纯本地数据，无需联网。</p>

              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: '本周', s: duel.thisWeek, accent: 'text-green-400' },
                  { label: '上周', s: duel.lastWeek, accent: 'text-gray-400' },
                ] as { label: string; s: WeekStat; accent: string }[]).map((col) => (
                  <div key={col.label} className="rounded-xl border border-line bg-dark/40 p-3">
                    <div className={`text-[11px] font-semibold ${col.accent}`}>{col.label}</div>
                    <div className="mt-1 text-2xl font-bold text-white">{col.s.count}</div>
                    <div className="text-[10px] text-faint">篇 · {col.s.words} 字</div>
                    <div className="mt-1 text-[11px] text-muted">
                      均分 {col.s.avg ?? '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* 对决进度条 */}
              <div>
                <div className="mb-1 flex justify-between text-[10px] text-muted">
                  <span>篇数对比</span>
                  <span>
                    {duel.thisWeek.count} / {Math.max(duel.lastWeek.count, benchmark)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-line-strong">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (duel.thisWeek.count / Math.max(duel.lastWeek.count, benchmark, 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {duel.lastWeek.count > 0 && duel.thisWeek.count < duel.lastWeek.count && (
                <p className="rounded-lg bg-surface-3/60 p-2 text-[11px] text-muted">
                  再写 {duel.lastWeek.count - duel.thisWeek.count} 篇就追平上周啦！
                </p>
              )}
              {duel.thisWeek.count >= duel.lastWeek.count && duel.lastWeek.count > 0 && (
                <p className="rounded-lg bg-green-500/10 p-2 text-[11px] text-green-400">
                  本周已经超越上周，保持住！
                </p>
              )}
              <p className="text-[11px] text-faint">AI 建议目标：本周 {benchmark} 篇（{level}）</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InkQuestView;
