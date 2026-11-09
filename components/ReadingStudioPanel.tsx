import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Book, BookVideo, Language } from '../types';
import { bilibiliEmbedUrl, bilibiliLabel, bilibiliWatchUrl, isB23ShortLink, parseBilibiliInput } from '../utils/bilibili';
import { updateBookVideos } from '../services/storageService';
import { extractReadingAssist, getReadingAssistModelLabel, hasUsableProvider, ReadingAssist, ReadingWord } from '../services/aiService';
import { deleteSentence, getSentences, SentenceItem } from '../services/sentenceBank';
import { BookWord, getBookWords } from '../services/bookVocab';
import { Bookmark, Check, ExternalLink, Layers, Loader2, Minimize2, PanelRight, Plus, RefreshCw, Sparkles, Trash2, Video } from 'lucide-react';

interface ReadingStudioPanelProps {
  book: Book;
  /** 当前页（0-based），用于按页缓存提取结果 */
  pageIndex: number;
  /** 当前页正文 */
  text: string;
  nativeLanguage: Language;
  cefrLevel?: string;
  /** 已加入词库的词（小写比对） */
  addedWords: Set<string>;
  /** 句子库变更信号：变化即重新读取 */
  collectRev: number;
  onAddWord: (w: { word: string; meaning: string; partOfSpeech: string }) => void;
  /** 提取结果回调（父组件用它给划词补释义，不触发渲染） */
  onAssist?: (a: ReadingAssist | null) => void;
}

// 按「书 + 页 + 语言」缓存提取结果：翻回去看同一页不再花 token
const ASSIST_CACHE = new Map<string, ReadingAssist>();

// 无 AI 时的兜底：只挑「看起来像生词」的长词，没有释义（提示语会说明）
const COMMON_LONG_WORDS = new Set([
  'because', 'without', 'through', 'themselves', 'something', 'anything', 'everything', 'nothing',
  'thought', 'brought', 'between', 'against', 'morning', 'evening', 'another', 'already',
  'certain', 'perhaps', 'possible', 'together', 'however', 'whether', 'instead', 'towards',
  'already', 'immediately', 'suddenly', 'usually', 'finally', 'quietly', 'quickly', 'slowly',
  'before', 'behind', 'beside', 'beneath', 'beyond', 'during', 'around', 'across', 'almost',
  'comfortable', 'different', 'appearance', 'beautiful', 'important', 'wonderful', 'interesting',
  'different', 'possible', 'necessary', 'probably', 'certainly', 'especially', 'generally',
  'understand', 'remember', 'consider', 'continue', 'remember', 'expected', 'received', 'finished',
  'morning', 'evening', 'country', 'company', 'business', 'question', 'answer', 'family',
  'children', 'friends', 'yourself', 'ourselves', 'themselves', 'something', 'anything',
  'everybody', 'somebody', 'nobody', 'without', 'throughout', 'although', 'therefore', 'however',
  'perhaps', 'together', 'already', 'another', 'because', 'between', 'against', 'toward', 'towards',
  'sometimes', 'usually', 'finally', 'quickly', 'quietly', 'suddenly', 'immediately',
]);

const localWordCandidates = (text: string): ReadingWord[] => {
  const seen = new Set<string>();
  const out: ReadingWord[] = [];
  const tokens = text.split(/[^A-Za-z'’-]+/);
  for (const raw of tokens) {
    const word = raw.replace(/^['’-]+|['’-]+$/g, '');
    if (word.length < 8) continue;
    const low = word.toLowerCase();
    if (seen.has(low) || COMMON_LONG_WORDS.has(low)) continue;
    seen.add(low);
    out.push({ word, meaning: '', pos: '' });
    if (out.length >= 8) break;
  }
  return out;
};

const ReadingStudioPanel: React.FC<ReadingStudioPanelProps> = ({
  book,
  pageIndex,
  text,
  nativeLanguage,
  cefrLevel,
  addedWords,
  collectRev,
  onAddWord,
  onAssist,
}) => {
  // --- 视频 ---
  const [videos, setVideos] = useState<BookVideo[]>(book.videos ?? []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [draft, setDraft] = useState('');
  const [videoErr, setVideoErr] = useState<string | null>(null);

  useEffect(() => {
    setVideos(book.videos ?? []);
    setActiveIdx(0);
    setDraft('');
    setVideoErr(null);
  }, [book.id]);

  const activeVideo = videos[activeIdx];

  // 挂载 / 移除视频：写回 IndexedDB（读-改-写事务，不动阅读进度）
  const persistVideos = (next: BookVideo[]) => {
    setVideos(next);
    void updateBookVideos(book.id, next);
  };

  const handleAddVideo = () => {
    const parsed = parseBilibiliInput(draft);
    if (!parsed) {
      setVideoErr(
        isB23ShortLink(draft)
          ? 'b23.tv 短链在浏览器里解不开跳转，请先打开它，再把跳转后的完整链接（含 BV 号）粘进来'
          : '没识别到 BV / av 号，粘贴 B 站视频链接或 BV 号试试'
      );
      return;
    }
    const dup = videos.some((v) => (parsed.bvid && v.bvid === parsed.bvid) || (parsed.aid && v.aid === parsed.aid));
    if (dup) {
      setVideoErr('这个视频已经挂过了');
      return;
    }
    const next = [...videos, parsed];
    persistVideos(next);
    setActiveIdx(next.length - 1);
    setDraft('');
    setVideoErr(null);
  };

  const handleRemoveVideo = (idx: number) => {
    const next = videos.filter((_, i) => i !== idx);
    persistVideos(next);
    setActiveIdx((cur) => Math.max(0, Math.min(cur, next.length - 1)));
  };

  // 视频浮窗：整卡 position:fixed（DOM 不重建，iframe 不会重新加载）。
  // 拖拽/缩放期间**只改 DOM style**（不 setState），松手才落一次 state + localStorage ——
  // 否则每个 mousemove 都重渲整块面板（几十个词条），肉眼就是卡。
  const [floating, setFloating] = useState<boolean>(() => localStorage.getItem('linguaflow_video_float') === '1');
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem('linguaflow_video_pos');
      if (raw) {
        const p = JSON.parse(raw);
        if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return { x: p.x, y: p.y };
      }
    } catch {
      /* ignore */
    }
    return { x: Math.max(16, window.innerWidth - 520), y: 84 };
  });
  const [floatW, setFloatW] = useState<number>(() => {
    const saved = Number(localStorage.getItem('linguaflow_video_float_w'));
    return Number.isFinite(saved) && saved >= 300 ? saved : 480;
  });
  const floatBoxRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<null | { mode: 'move' | 'resize'; startX: number; startY: number; left: number; top: number; w: number }>(null);
  const [gesture, setGesture] = useState<null | 'move' | 'resize'>(null);

  const toggleFloat = () => {
    setFloating((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('linguaflow_video_float', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const beginGesture = (e: React.MouseEvent, mode: 'move' | 'resize') => {
    if (!floating) return;
    const el = floatBoxRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    gestureRef.current = { mode, startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top, w: rect.width };
    setGesture(mode);
  };

  const onGestureMove = (e: React.MouseEvent) => {
    const g = gestureRef.current;
    const el = floatBoxRef.current;
    if (!g || !el) return;
    const dx = e.clientX - g.startX;
    if (g.mode === 'move') {
      const dy = e.clientY - g.startY;
      const l = Math.max(4, Math.min(window.innerWidth - 140, g.left + dx));
      const t = Math.max(4, Math.min(window.innerHeight - 64, g.top + dy));
      el.style.left = `${l}px`;
      el.style.top = `${t}px`;
    } else {
      const w = Math.max(300, Math.min(Math.min(960, window.innerWidth - 40), g.w + dx));
      el.style.width = `${w}px`;
    }
  };

  const endGesture = () => {
    const g = gestureRef.current;
    const el = floatBoxRef.current;
    gestureRef.current = null;
    setGesture(null);
    if (!g || !el) return;
    const rect = el.getBoundingClientRect();
    const pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
    const w = Math.round(rect.width);
    setFloatPos(pos);
    setFloatW(w);
    try {
      localStorage.setItem('linguaflow_video_pos', JSON.stringify(pos));
      localStorage.setItem('linguaflow_video_float_w', String(w));
    } catch {
      /* ignore */
    }
  };

  // --- 意群 & 难词 ---
  const cacheKey = `${book.id}:${pageIndex}:${book.language}`;
  const [assist, setAssist] = useState<ReadingAssist | null>(null);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  /**
   * 只有用户在这一页亲手点过「用 AI 提取」才会发请求。
   * 存成 key 而不是 boolean：翻到下一页 key 就变了 → 自动回到「未授权」，
   * 真正做到「每一页都要经过用户同意」，而不是一次授权全站静默调用。
   */
  const [approvedKey, setApprovedKey] = useState<string | null>(null);

  const aiReady = hasUsableProvider();
  const modelLabel = getReadingAssistModelLabel();

  // 提取耗时（秒）：慢模型时让人看到「还在跑」而不是以为卡死
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    let alive = true;
    const cached = ASSIST_CACHE.get(cacheKey);
    if (cached && (cached.chunks.length > 0 || cached.words.some((w) => w.meaning))) {
      setAssist(cached);
      setLoading(false);
      setFallback(cached.chunks.length === 0 && cached.words.every((w) => !w.meaning));
      return () => { alive = false; };
    }
    if (!aiReady) {
      setAssist({ chunks: [], words: localWordCandidates(text) });
      setFallback(true);
      setLoading(false);
      return () => { alive = false; };
    }
    // 本页还没获得用户同意：一个请求都不发，也不预取下一页（翻页时零 token 消耗）
    if (approvedKey !== cacheKey) {
      setAssist(null);
      setFallback(false);
      setAiError(null);
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    setAssist(null);
    // 兜底超时：请求挂死不至于让骨架屏转一辈子。
    // 注意：以前这里 25s 就 resolve 一个空结果且**不带 error**，于是慢模型（>25s）永远显示
    // 「AI 提取没成功」却没有原因 —— 2026-10-26 修：放宽到 90s，且超时也带上 error 文案。
    const timeout = new Promise<ReadingAssist>((resolve) =>
      setTimeout(
        () => resolve({ chunks: [], words: [], error: '超过 90 秒仍没有返回：模型太慢或被限流，建议换「快模型」或稍后重试' }),
        90000
      )
    );
    Promise.race([
      extractReadingAssist({ text, targetLang: book.language, nativeLang: nativeLanguage, cefrLevel }),
      timeout,
    ])
      .then((r) => {
        const hasContent = r.chunks.length > 0 || r.words.some((w) => w.meaning);
        const value: ReadingAssist = hasContent ? r : { chunks: [], words: localWordCandidates(text) };
        if (hasContent) ASSIST_CACHE.set(cacheKey, value);
        if (!alive) return;
        setAssist(value);
        setFallback(!hasContent);
        setAiError(r.error ?? null);
      })
      .catch((e) => {
        if (!alive) return;
        setAssist({ chunks: [], words: localWordCandidates(text) });
        setFallback(true);
        setAiError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cacheKey, tick, approvedKey, text, book.language, nativeLanguage, cefrLevel, aiReady]);

  const chunks = assist?.chunks ?? [];
  const words = assist?.words ?? [];

  // --- 我的收藏：句子库按书过滤，collectRev 变化即重读 ---
  const [sentences, setSentences] = useState<SentenceItem[]>(() => getSentences({ bookId: book.id }));
  const [bookWords, setBookWords] = useState<BookWord[]>(() => getBookWords(book.id));
  useEffect(() => {
    setSentences(getSentences({ bookId: book.id }));
    setBookWords(getBookWords(book.id));
  }, [book.id, collectRev]);

  // 把当前页提取结果交给父组件（划词时补释义），不进渲染
  useEffect(() => {
    onAssist?.(assist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assist]);

  // 左栏可能比一屏高（视频 + 意群 + 难词），用底部渐隐提示「下面还有」
  const railRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const syncMoreBelow = () => {
    const el = railRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  };
  useEffect(() => {
    const t = setTimeout(syncMoreBelow, 60);
    return () => clearTimeout(t);
  }, [assist, videos.length, loading]);

  // 视频卡：不浮窗时留在右栏，浮窗时 portal 到 body ——
  // 外层 `page-enter` 带 transform（animation-fill-mode: both），
  // 会把 position:fixed 变成「相对该祖先」定位，只有 portal 才能真的贴住视口。
  const videoCard = (
      <div
        ref={floatBoxRef}
        className={floating ? 'fixed z-50' : ''}
        style={floating ? { left: floatPos.x, top: floatPos.y, width: floatW } : undefined}
      >
      <div className={`relative glass-panel rounded-2xl p-3.5 ${floating ? 'shadow-2xl ring-1 ring-neon/25' : ''}`}>
        <div
          onMouseDown={(e) => beginGesture(e, 'move')}
          className={`flex items-center justify-between gap-2 mb-2.5 ${floating ? 'cursor-move select-none' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Video size={15} className="text-neon shrink-0" />
            <h3 className="text-sm font-bold text-white truncate">配套视频</h3>
            {videos.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon/15 text-violet-300 border border-neon/25 shrink-0">
                {videos.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {activeVideo && (
              <>
                {!floating && (
                  <button
                    onClick={toggleFloat}
                    className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition"
                    title="弹出小窗（始终置顶，可拖动）"
                  >
                    <Minimize2 size={14} />
                  </button>
                )}
                <a
                  href={bilibiliWatchUrl(activeVideo)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition"
                  title="在 B 站打开"
                >
                  <ExternalLink size={14} />
                </a>
                {floating && (
                  <button
                    onClick={toggleFloat}
                    className="p-1.5 rounded-lg text-neon-2 hover:bg-white/10 transition"
                    title="还原到右栏"
                  >
                    <PanelRight size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {activeVideo ? (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
              <iframe
                key={bilibiliEmbedUrl(activeVideo)}
                src={bilibiliEmbedUrl(activeVideo)}
                title={activeVideo.title || book.title}
                allowFullScreen
                frameBorder={0}
                scrolling="no"
                className="h-full w-full"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted truncate" title={activeVideo.title || bilibiliLabel(activeVideo)}>
                {activeVideo.title || bilibiliLabel(activeVideo)}
              </span>
              {videos.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  {videos.map((v, i) => (
                    <button
                      key={`${v.bvid ?? v.aid}-${i}`}
                      onClick={() => setActiveIdx(i)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                        i === activeIdx ? 'bg-neon text-white' : 'bg-white/5 text-muted hover:text-white'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-[10px] text-faint leading-relaxed">
                鼠标移到画面上才会出现播放/进度条；浮窗时右下角拖动可放大。
              </p>
              <button
                onClick={() => handleRemoveVideo(activeIdx)}
                className="shrink-0 flex items-center gap-1 text-[10px] text-faint hover:text-red-400 transition"
                title="从这本书移除这个视频"
              >
                <Trash2 size={11} /> 移除
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted leading-relaxed">
              给这本书挂一个 B 站讲解视频，边看边读同一页。
            </p>
            <input
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setVideoErr(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddVideo(); }}
              placeholder="粘贴链接或 BV 号，如 BV1xx411c7mD"
              className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-3 py-2 text-xs text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition"
            />
            <button
              onClick={handleAddVideo}
              disabled={!draft.trim()}
              className="w-full py-2 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 transition disabled:opacity-40"
            >
              挂到《{book.title}》
            </button>
            {videoErr && <p className="text-[11px] text-amber-300 leading-relaxed">{videoErr}</p>}
          </div>
        )}

        {floating && (
          <div
            onMouseDown={(e) => beginGesture(e, 'resize')}
            className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize rounded-sm bg-white/10 transition-colors hover:bg-neon/40"
            title="拖动调整大小"
          />
        )}
      </div>
      {gesture && (
        <div
          className={`fixed inset-0 z-[60] ${gesture === 'resize' ? 'cursor-nwse-resize' : 'cursor-move'}`}
          onMouseMove={onGestureMove}
          onMouseUp={endGesture}
          onMouseLeave={endGesture}
        />
      )}
      </div>
  );

  return (
    <div className="relative">
    {/* 桌面端固定在左栏并自滚动：外层 main 是固定高度 + overflow-hidden，
        不这样限制的话，超过一屏的词汇会被裁掉且页面滚不到（2026-10-26 实测） */}
    <div
      ref={railRef}
      onScroll={syncMoreBelow}
      className="space-y-4 custom-scrollbar pb-1 xl:sticky xl:top-2 xl:max-h-[calc(100vh_-_24rem)] xl:overflow-y-auto xl:pr-1"
    >
      {floating ? createPortal(videoCard, document.body) : videoCard}

      {/* ---------- 意群 & 难词 ---------- */}
      <div className="glass-panel rounded-2xl p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-neon-2" />
            <h3 className="text-sm font-bold text-white">意群 & 难词</h3>
            {assist && !fallback && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                本页已提取
              </span>
            )}
          </div>
          {assist && (
            <button
              onClick={() => { ASSIST_CACHE.delete(cacheKey); setApprovedKey(cacheKey); setTick((t) => t + 1); }}
              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition"
              title="重新提取（会再调用一次 AI）"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 py-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
            ))}
            <p className="text-[11px] text-faint flex items-center gap-1.5 pt-1">
              <Loader2 size={11} className="animate-spin" /> 正在提取本页意群与生词…（已等 {elapsed}s，慢模型可能要 30s+）
            </p>
          </div>
        ) : !assist ? (
          /* 未获用户同意：一个请求都不发（也不预取下一页），等他自己点 */
          <div className="space-y-2.5 py-1">
            <p className="text-[11px] text-muted leading-relaxed">
              这一页还没调用 AI。<b className="text-gray-300">点下面的按钮才会</b>把本页正文发一次给模型，
              翻页不会自动触发，也不会预取下一页。
            </p>
            <button
              onClick={() => setApprovedKey(cacheKey)}
              disabled={!aiReady}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-neon to-neon-2 py-2 text-xs font-bold text-white shadow-glow-neon transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={13} /> 用 AI 提取本页意群与难词
            </button>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-faint">模型：{modelLabel}</span>
              <button
                onClick={() => { setAssist({ chunks: [], words: localWordCandidates(text) }); setFallback(true); }}
                className="text-[10px] font-bold text-faint hover:text-white hover:underline"
                title="只按长度挑词，不联网、无释义"
              >
                先看本地生词候选（不联网）→
              </button>
            </div>
            {!aiReady && (
              <p className="text-[10px] text-amber-300/80 leading-relaxed">
                还没配置模型 Key：到「我的资料 → 模型设置」填一个（推荐 DeepSeek，模型名 deepseek-flash）。
              </p>
            )}
            <p className="text-[10px] text-faint leading-relaxed">
              结果按页缓存（本次打开期间）：同一页重看不再花 token；换书 / 换页都要重新点一次。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chunks.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint mb-1.5">核心意群</p>
                <div className="space-y-1.5">
                  {chunks.map((c, i) => (
                    <div key={i} className="text-xs leading-snug">
                      <span className="text-gray-200">“{c.text}”</span>
                      {c.meaning && <span className="text-muted"> — {c.meaning}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {words.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint mb-1">
                  {fallback ? '生词候选（本地·无释义）' : '难词'}
                </p>
                <div className="divide-y divide-white/5">
                  {words.map((w, i) => {
                    const added = addedWords.has(w.word.toLowerCase()) || addedWords.has(w.word);
                    return (
                      <div key={`${w.word}-${i}`} className="flex items-start justify-between gap-2 py-1.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-gray-100 font-bold text-[13px]">{w.word}</span>
                            {w.ipa && (
                              <span className="text-[11px] font-mono text-neon-2">
                                {w.ipa.startsWith('/') ? w.ipa : `/${w.ipa}/`}
                              </span>
                            )}
                            {w.pos && <span className="text-[10px] text-faint uppercase">{w.pos}</span>}
                          </div>
                          {w.meaning ? (
                            <p className="text-[11px] text-muted leading-snug">{w.meaning}</p>
                          ) : (
                            <p className="text-[11px] text-faint leading-snug">（无释义，点右上角重试）</p>
                          )}
                          {w.example && (
                            <p className="mt-0.5 text-[10px] italic leading-snug text-faint line-clamp-2" title={w.example}>
                              {w.example}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => onAddWord({ word: w.word, meaning: w.meaning, partOfSpeech: w.pos || '' })}
                          disabled={added}
                          title={added ? '已在词库' : '加入词库'}
                          className={`shrink-0 p-1 rounded-md transition ${
                            added ? 'text-green-400 opacity-60 cursor-default' : 'text-muted hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {added ? <Check size={13} /> : <Plus size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {chunks.length === 0 && words.length === 0 && (
              <p className="text-[11px] text-faint py-2">
                本页没有可提取的内容（或这一页太短）。
              </p>
            )}

            {fallback && (
              <div className="border-t border-white/5 pt-2 space-y-1">
                <p className="text-[11px] text-amber-300/85 leading-relaxed">
                  {aiReady
                    ? 'AI 提取没成功，下面是本地生词候选（无释义/例句）。'
                    : '未配置模型：下面是本地生词候选（无释义/例句）。配置后点「用 AI 提取」即可生成意群与释义。'}
                </p>
                <p className="text-[10px] text-amber-200/60 leading-relaxed break-words">
                  原因：{aiError || '未拿到错误信息（可能是旧的失败结果被缓存），点下面「重新提取」再试'}
                </p>
                <button
                  onClick={() => { ASSIST_CACHE.delete(cacheKey); setApprovedKey(cacheKey); setTick((t) => t + 1); }}
                  className="text-[10px] font-bold text-neon-2 hover:underline"
                >
                  再调用一次 AI 重新提取 →
                </button>
              </div>
            )}

            <p className="text-[10px] text-faint flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
              <span className="flex items-center gap-1"><Bookmark size={10} /> 按页缓存，翻页不重复花 token</span>
              <span>· 模型：{modelLabel}</span>
            </p>
          </div>
        )}
      </div>

      {/* ---------- 我的收藏（划词 / 划句） ---------- */}
      <div className="glass-panel rounded-2xl p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Bookmark size={15} className="text-emerald-300" />
            <h3 className="text-sm font-bold text-white">我的收藏</h3>
          </div>
          <span className="text-[10px] text-faint">{bookWords.length + sentences.length} 条</span>
        </div>

        {bookWords.length === 0 && sentences.length === 0 ? (
          <p className="text-[11px] text-faint leading-relaxed">
            在正文里<b className="text-gray-300">划一个词</b>或<b className="text-gray-300">划一句话</b>，这里就会出现「我的生词 / 我的句子」。
          </p>
        ) : (
          <div className="space-y-3">
            {sentences.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint mb-1">我的句子</p>
                <div className="space-y-1.5">
                  {sentences.slice(0, 8).map((s) => (
                    <div key={s.id} className="group flex items-start gap-1.5">
                      <p className="flex-1 text-[11px] leading-snug text-gray-300 line-clamp-2">“{s.text}”</p>
                      <button
                        onClick={() => setSentences(deleteSentence(s.id))}
                        className="shrink-0 p-0.5 rounded text-faint opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        title="删除这句"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bookWords.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint mb-1">我的生词</p>
                <div className="flex flex-wrap gap-1">
                  {bookWords.slice(-14).reverse().map((w) => (
                    <span
                      key={w.word}
                      className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-200"
                      title={w.meaning || '已在词库'}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
      {/* 还有内容没露出来时给一层底部渐隐，提示可以继续滚 */}
      {moreBelow && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-12 bg-gradient-to-t from-[#07070e] via-[#07070e]/60 to-transparent xl:block" />
      )}
    </div>
  );
};

export default ReadingStudioPanel;
