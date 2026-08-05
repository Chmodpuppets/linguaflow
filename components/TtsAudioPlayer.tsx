import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Play, Pause, Square, Repeat, Scissors, X, Loader2 } from "lucide-react";
import { fetchSpeechUrl } from "../services/aiService";
import { getCachedTtsUrl, setCachedTtsUrl, deleteCachedTtsUrl } from "../services/ttsCache";

/**
 * TTS 复读播放器：生成一次、缓存全文对应的音频 URL；带进度条 / 速度 / A-B 区间循环。
 *
 * 用法：
 * 1. 设置 ref；调用 ref.current.play() 触发首次合成并播放。
 * 2. 之后点击播放/暂停按钮或外部触发 ref.current.play()/pause() 即可。
 * 3. A / B 按钮：按下时把当前 currentTime 记为 A/B。两个都设好 + 循环开启后，
 *    到达 B 时自动 seek 回 A，实现跟读/区间反复听。
 *
 * 设计要点：
 * - 缓存按文本内容做键（text → url），同一句话再点直接复用，零 API 成本。
 * - text prop 变化视为新内容，自动清掉旧音频、复位 A/B。
 * - Qwen 不可用时返回 null，播放按钮变为禁用、提示降级到浏览器自带的 WebSpeech。
 * - 不在 UI 上显示计时器，避免长篇习得焦虑；m:ss 即可。
 */
export interface TtsAudioPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  isPlaying: () => boolean;
}

export interface TtsAudioPlayerProps {
  text: string;
  /** 强制使用某个音色（例如"用 Cherry"），不传则用 AIConfig 中保存的默认音色 */
  voice?: string;
  /** 外部控制的倍速（与上面"朗读 1x"按钮联动）；0.5~2.0 */
  speed: number;
  /** 是否启用 Web Speech 降级；文本非空但 Qwen 不可用时回落到浏览器朗读 */
  webSpeechLang?: string;
  /** 折叠状态由父组件控制（默认渲染即可，按需隐藏） */
  className?: string;
  /** 播放状态变化回调（用于 toolbar 图标同步）。true=正在播放（不论 audio 还是 WebSpeech） */
  onPlayingChange?: (playing: boolean) => void;
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

const TtsAudioPlayer = forwardRef<TtsAudioPlayerHandle, TtsAudioPlayerProps>(function TtsAudioPlayer(
  { text, voice, speed, webSpeechLang, className = "", onPlayingChange },
  ref
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 缓存由 services/ttsCache 提供（应用内共享：TypingView 与 RPGView 同段文本互免调用）
  const wsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(true);

  // 当前真正播放的文本（URL 一旦拿到就锁定，避免 fetch 中途切换）
  const loadingForTextRef = useRef<string | null>(null);

  // 复用共享缓存：text prop 变化时，先看 ttsCache 里有同段文本的 URL 没
  useEffect(() => {
    setError(null);
    const cached = getCachedTtsUrl(text, voice);
    if (cached) {
      setAudioUrl(cached);
    } else {
      setAudioUrl(null);
      setCurrentTime(0);
      setDuration(0);
      setPointA(null);
      setPointB(null);
    }
  }, [text]);

  // 切速：写到 audio / utterance
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = speed;
    // Web Speech 端：utterance 在 playWithWebSpeech 中已经按当前 speed 写入。
  }, [speed]);

  // A-B 循环：到达 B 时自动 seek 回 A
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (
        loopEnabled &&
        pointA !== null &&
        pointB !== null &&
        pointB > pointA &&
        a.currentTime >= pointB
      ) {
        a.currentTime = pointA;
      }
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [loopEnabled, pointA, pointB, audioUrl]);

  const fetchAndSet = useCallback(async (): Promise<string | null> => {
    // 已有就直返
    const cached = getCachedTtsUrl(text, voice);
    if (cached) {
      setAudioUrl(cached);
      return cached;
    }
    loadingForTextRef.current = text;
    setLoading(true);
    setError(null);
    const url = await fetchSpeechUrl(text, voice);
    if (loadingForTextRef.current !== text) return null; // 用户已经切走

    if (url) {
      setCachedTtsUrl(text, voice, url);
      setAudioUrl(url);
      setLoading(false);
      return url;
    }
    setLoading(false);
    setError("Qwen TTS 不可用，已回落到浏览器语音（不可设 AB/进度）");
    return null;
  }, [text, voice]);

  const playWithWebSpeech = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("当前环境不支持语音合成");
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (webSpeechLang) u.lang = webSpeechLang;
    u.rate = speed;
    u.onstart = () => setIsPlaying(true);
    u.onend = () => {
      setIsPlaying(false);
      wsUtteranceRef.current = null;
    };
    u.onerror = () => {
      setIsPlaying(false);
      wsUtteranceRef.current = null;
    };
    wsUtteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [text, speed, webSpeechLang]);

  const play = useCallback(async () => {
    if (!text.trim()) return;
    const a = audioRef.current;
    if (audioUrl && a) {
      const startFrom =
        pointA !== null && pointB !== null && loopEnabled && pointB > pointA
          ? pointA
          : 0;
      a.currentTime = startFrom;
      setCurrentTime(startFrom);
      try {
        await a.play();
        setIsPlaying(true);
      } catch (e) {
        console.warn("audio.play failed", e);
      }
      return;
    }
    const url = await fetchAndSet();
    if (!url) {
      // 降级到 Web Speech（仍然能听一遍，但不可设 AB / 进度）
      playWithWebSpeech();
    }
  }, [audioUrl, fetchAndSet, loopEnabled, pointA, pointB, playWithWebSpeech, text]);

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) {
      a.pause();
      setIsPlaying(false);
    }
    if (wsUtteranceRef.current) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    pause();
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
      setCurrentTime(0);
    }
  }, [pause]);

  useImperativeHandle(
    ref,
    () => ({
      play,
      pause,
      stop,
      isPlaying: () => isPlaying,
    }),
    [play, pause, stop, isPlaying]
  );

  // 暂停/播放时切速写入
  const handleAudioPlay = () => setIsPlaying(true);
  const handleAudioPauseOrEnd = () => setIsPlaying(false);
  const handleAudioLoaded = () => {
    const a = audioRef.current;
    if (a) setDuration(a.duration);
  };
  const handleAudioTime = () => {
    const a = audioRef.current;
    if (a) setCurrentTime(a.currentTime);
  };

  // 状态变更时通知父组件（toolbar 图标同步）
  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  // 拖动进度
  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    const a = audioRef.current;
    if (a && isFinite(a.duration) && a.duration > 0) {
      a.currentTime = t;
      setCurrentTime(t);
    }
  };

  const aPct = useMemo(
    () => (duration > 0 && pointA !== null ? (pointA / duration) * 100 : null),
    [duration, pointA]
  );
  const bPct = useMemo(
    () => (duration > 0 && pointB !== null ? (pointB / duration) * 100 : null),
    [duration, pointB]
  );
  const loopWidthPct = useMemo(() => {
    if (aPct === null || bPct === null) return null;
    return Math.max(0, bPct - aPct);
  }, [aPct, bPct]);

  const onSetA = () => {
    setPointA(currentTime);
    if (pointB !== null && currentTime >= pointB) {
      setPointB(null); // A 越过 B 时清掉 B
    }
  };
  const onSetB = () => {
    if (pointA !== null && currentTime <= pointA) {
      // B 在 A 之前不允许
      return;
    }
    setPointB(currentTime);
  };
  const onClearAB = () => {
    setPointA(null);
    setPointB(null);
  };

  // 卸载时暂停（共享缓存全局生效，跨视图复用，不在卸载清）
  useEffect(() => {
    return () => {
      pause();
    };
  }, [pause]);

  // 只有当 audioUrl 存在时，speed 也要随 user 设置实时写到 <audio>
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = speed;
  }, [speed, audioUrl]);

  return (
    <div className={`glass-panel rounded-lg p-3 border border-white/10 space-y-2 ${className}`}>
      {/* 真实 audio 元素（用户看不到，靠 play/pause 控件控制） */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onPlay={handleAudioPlay}
          onPause={handleAudioPauseOrEnd}
          onEnded={handleAudioPauseOrEnd}
          onLoadedMetadata={handleAudioLoaded}
          onTimeUpdate={handleAudioTime}
          onError={() => {
            // 预签名 URL 过期 / 网络抖动 → 清掉这帧缓存让用户重试时重新合成。
            // 共享缓存按 (text, voice) 键删；不打断当前 UI。
            deleteCachedTtsUrl(text, voice);
            setError("音频加载失败，可能 URL 已过期。下次点播放会自动重新合成。");
          }}
        />
      )}

      {/* 行 1：进度条 + A/B 标记 */}
      <div className="relative pt-2 pb-1">
        {/* A-B 高亮带 */}
        {loopWidthPct !== null && aPct !== null && (
          <div
            className="absolute top-1 bottom-1 bg-neon/20 rounded pointer-events-none"
            style={{
              left: `${aPct}%`,
              width: `${loopWidthPct}%`,
            }}
          />
        )}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={Math.min(currentTime, duration || 0)}
          onChange={onSeek}
          disabled={!audioUrl || duration === 0}
          className="w-full h-2 bg-surface-3 rounded-full appearance-none cursor-pointer accent-neon disabled:opacity-40 relative z-10"
        />
        {/* A / B 标线 */}
        {aPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20 pointer-events-none"
            style={{ left: `calc(${aPct}% - 1px)` }}
            title={`A = ${fmt(pointA ?? 0)}`}
          />
        )}
        {bPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-pink-400 z-20 pointer-events-none"
            style={{ left: `calc(${bPct}% - 1px)` }}
            title={`B = ${fmt(pointB ?? 0)}`}
          />
        )}
        {/* 时间码 */}
        <div className="flex justify-between text-[10px] text-muted mt-1 tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* 行 2：控件 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={isPlaying ? pause : play}
          disabled={loading || !text.trim()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isPlaying
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "bg-neon text-white hover:bg-neon/90 shadow-glow-sm"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={isPlaying ? "暂停" : loading ? "正在合成..." : "播放"}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
          <span>{loading ? "合成中" : isPlaying ? "暂停" : "播放"}</span>
        </button>

        <button
          onClick={stop}
          disabled={!audioUrl}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted hover:text-white hover:bg-surface-3 disabled:opacity-30"
          title="停止并回到开头"
        >
          <Square size={12} fill="currentColor" />
          停止
        </button>

        <div className="flex items-center gap-1 border-l border-line-strong pl-2">
          <button
            onClick={onSetA}
            disabled={!audioUrl || duration === 0}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-30"
            title="在当前位置设 A（循环起点）"
          >
            <Scissors size={12} /> A
            {pointA !== null && <span className="tabular-nums">{fmt(pointA)}</span>}
          </button>
          <button
            onClick={onSetB}
            disabled={!audioUrl || duration === 0 || pointA === null}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 disabled:opacity-30"
            title="在当前位置设 B（循环终点）"
          >
            <Scissors size={12} /> B
            {pointB !== null && <span className="tabular-nums">{fmt(pointB)}</span>}
          </button>
          <button
            onClick={onClearAB}
            disabled={pointA === null && pointB === null}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted hover:text-white hover:bg-surface-3 disabled:opacity-30"
            title="清除 A/B"
          >
            <X size={12} />
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => setLoopEnabled(e.target.checked)}
            disabled={pointA === null || pointB === null}
            className="accent-neon"
          />
          <Repeat size={12} className={loopEnabled ? "text-neon" : ""} />
          A→B 循环
        </label>
      </div>

      {error && (
        <p className="text-[11px] text-amber-400/80 leading-tight">{error}</p>
      )}
      {pointA !== null && pointB !== null && (
        <p className="text-[11px] text-muted leading-tight">
          区间 {fmt(pointA)} → {fmt(pointB)}（时长 {fmt(pointB - pointA)}）将循环播放。拖动进度条可越过 AB 区间。
        </p>
      )}
    </div>
  );
});

export default TtsAudioPlayer;
