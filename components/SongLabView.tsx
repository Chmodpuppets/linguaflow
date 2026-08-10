
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserProfile, SongPack, SongLine, Language } from '../types';
import {
  getSongPacks,
  saveSongPack,
  deleteSongPack,
  getSongAudio,
  saveSongAudio,
  saveSongClips,
  getSongClip,
} from '../services/storageService';
import { translateTextsBatch, generatePhoneticsBatch } from '../services/aiService';
import { GlassCard } from './ui';
import {
  Music,
  Upload,
  Scissors,
  Play,
  Pause,
  Headphones,
  Trash2,
  Save,
  Disc3,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Wand2,
  ListMusic,
  Plus,
  Languages,
  FileJson,
} from 'lucide-react';

interface SongLabViewProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
  onPractice: (content: { text: string; title: string; notes?: string }) => void;
}

// --- LRC / 纯文本解析 ---

// LRC 行形如 `[mm:ss.xx]歌词` 或 `[mm:ss]歌词`，可一行多时间戳。取首个时间戳。
const LRC_TIME_RE = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;

const parseLrc = (raw: string): SongLine[] => {
  const out: SongLine[] = [];
  let order = 0;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(LRC_TIME_RE);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
    const time = Math.round((min * 60 + sec + frac) * 100) / 100;
    const text = line.replace(/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/g, '').trim();
    if (!text) continue;
    out.push({ id: `l${order++}`, time, text });
  }
  return out;
};

// 纯文本：按空行/换行切段，过短的行合并到上一句，避免切碎一句歌词。
const parsePlain = (raw: string): SongLine[] => {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentences: string[] = [];
  for (const p of paragraphs) {
    const parts = p.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    let buf = '';
    for (const part of parts) {
      if (buf && part.length < 12) buf += part.length ? ' ' + part : buf;
      else if (buf) {
        sentences.push(buf);
        buf = part;
      } else buf = part;
    }
    if (buf) sentences.push(buf);
  }
  return sentences.map((text, i) => ({ id: `l${i}`, text }));
};

const isLrc = (raw: string) => LRC_TIME_RE.test(raw);

// SRT 字幕格式：`HH:MM:SS,mmm --> HH:MM:SS,mmm` 时间轴行后接一句（或多句）歌词。
// 与 LRC（[mm:ss.xx]）可明确区分，用 `-->` 判定。
const SRT_TIME_RE =
  /(\d{1,2}):(\d{1,2}):(\d{1,2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

const parseSrtTime = (h: string, m: string, s: string, ms: string): number => {
  const hh = parseInt(h, 10);
  const mm = parseInt(m, 10);
  const ss = parseInt(s, 10);
  const mmm = parseInt(ms.padEnd(3, '0').slice(0, 3), 10) / 1000;
  return Math.round((hh * 3600 + mm * 60 + ss + mmm) * 100) / 100;
};

// SRT → SongLine[]：每块 = 序号行(可选) + 时间轴行 + 歌词行；提取歌词与时间轴(start/end)。
const parseSrt = (raw: string): SongLine[] => {
  const out: SongLine[] = [];
  let order = 0;
  for (const block of raw.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tcIdx = lines.findIndex((l) => SRT_TIME_RE.test(l));
    if (tcIdx === -1) continue;
    const m = lines[tcIdx].match(SRT_TIME_RE);
    if (!m) continue;
    const time = parseSrtTime(m[1], m[2], m[3], m[4]);
    const end = parseSrtTime(m[5], m[6], m[7], m[8]);
    const text = lines.slice(tcIdx + 1).join(' ').trim();
    if (!text) continue;
    out.push({ id: `l${order++}`, time, start: time, end, text });
  }
  return out;
};

const isSrt = (raw: string) => SRT_TIME_RE.test(raw);

// 跟打校验：去除空白与标点后比较，忽略大小写
const normalizeForCompare = (s: string) =>
  (s || '')
    .replace(/[\s　]+/g, '')
    .replace(/[、。！？…・.,!?~～"'「」『』()（）\-_]/g, '')
    .toLowerCase();

// 编辑距离（Levenshtein），用于分句容错：长音省略 / 促音 / 浊音等少量误差也算通过
const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
};

// 分句容错匹配结果
//  exact = 完全一致；close = 在容差内（允许少量假名误差）；wrong = 差距过大；empty = 未输入
type MatchState = 'empty' | 'exact' | 'close' | 'wrong';
const isForgivingTolerant = (targetNormLen: number, dist: number) =>
  dist <= Math.floor(targetNormLen * 0.2); // 最多允许 20% 个字符误差（仅容忍长音/促音/浊音等假名细节差异）

const matchResult = (input: string, target: string): { state: MatchState; diff: number } => {
  const a = normalizeForCompare(input);
  const b = normalizeForCompare(target);
  if (a.length === 0) return { state: 'empty', diff: b.length };
  if (a === b) return { state: 'exact', diff: 0 };
  // 防漏打：输入比目标明显短（少打超过 1 个字符）一律判未通过，杜绝「没打完就自动通过」。
  // 仅容忍 <=1 个字符的长度差（兼容长音压缩等极少数情况），其余漏打必须补完。
  if (b.length - a.length > 1) return { state: 'wrong', diff: b.length - a.length };
  const dist = levenshtein(a, b);
  if (isForgivingTolerant(b.length, dist)) return { state: 'close', diff: dist };
  return { state: 'wrong', diff: dist };
};

// 一键复制给 AI 的「歌词结构化」Prompt：AI 会先追问歌名/歌手，再返回本 App 可直接导入的 JSON。
const AI_LYRICS_PROMPT = `你是一个歌词结构化助手。用户会告诉你一首歌的歌名和歌手，请按下面流程工作：

1. 如果用户没给全歌名和歌手，先主动追问「是哪首歌？谁唱的？」。
2. 确认后，整理出这首歌的完整歌词，逐句拆分为 JSON。
3. 严格按以下 schema 输出，**只输出 JSON 本身**，不要任何解释、前言，也不要 Markdown 代码块标记（不要 \`\`\`json）。

{
  "title": "歌名",
  "artist": "歌手",
  "language": "Japanese",
  "lines": [
    {
      "text": "原文歌词（目标语言，逐句）",
      "romaji": "该行读音的拉丁字母：日语用 Hepburn romaji（必须正确读出汉字，如 恋→koi、空→sora）、中文用带声调拼音、韩文用罗马字、其他语言用自然拉丁转写",
      "translation": "这一句的中文翻译",
      "time": 0,
      "start": 0,
      "end": 0
    }
  ]
}

要求：
- 每句歌词单独成一个 lines 元素，不要合并多句。
- romaji 必须读出汉字，输出里不得残留任何汉字/假名等非拉丁字符（原文放 text，读音放 romaji）。
- translation 用自然、口语化的中文。
- 如不知道真实音频时间轴，time/start/end 全部填 0；用户之后会在 App 里手动改时间戳。
- 返回必须是合法 JSON，可被 JSON.parse 直接解析。`;

const SongLabView: React.FC<SongLabViewProps> = ({ user, onUpdateUser: _onUpdateUser, onPractice }) => {
  const [tab, setTab] = useState<'build' | 'library'>('build');
  const [view, setView] = useState<'browse' | 'player' | 'session'>('browse');

  // --- builder 状态 ---
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [raw, setRaw] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<SongLine[]>([]);
  const [source, setSource] = useState<'lrc' | 'plain'>('lrc');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'ok' | 'warn'; msg: string } | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // --- library / player 状态 ---
  const [packs, setPacks] = useState<SongPack[]>(() => getSongPacks());
  const [activePack, setActivePack] = useState<SongPack | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipAudioRef = useRef<HTMLAudioElement>(null);

  // 待保存的每句音频片段（导入剪辑包后、保存前暂存于此）；idx -> blob
  const [pendingClips, setPendingClips] = useState<Record<number, Blob>>({});
  // 播放器中每句音频片段的 objectURL；idx -> url
  const [clipUrls, setClipUrls] = useState<Record<number, string>>({});
  const clipUrlsRef = useRef<Record<number, string>>({});
  const applyClipUrls = (map: Record<number, string>) => {
    Object.values(clipUrlsRef.current as Record<string, string>).forEach((u) => URL.revokeObjectURL(u));
    clipUrlsRef.current = map;
    setClipUrls(map);
  };

  // --- 逐句循环精听跟打 会话状态 ---
  const [sessionIdx, setSessionIdx] = useState(0);
  const [sessionInput, setSessionInput] = useState('');
  const [sessionRevealed, setSessionRevealed] = useState(true);
  const [sessionDone, setSessionDone] = useState<Set<number>>(new Set());
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionForgiving, setSessionForgiving] = useState(true); // 分句容错：允许少量假名误差也算通过
  const [awaitingAdvance, setAwaitingAdvance] = useState(false); // 回车两步确认：第一次确认已打对，第二次才进下一句
  const loopRangeRef = useRef<{ start: number; end: number } | null>(null);
  const advanceScheduledRef = useRef(false);

  const lang = user.learningLanguage;

  // 清理 object URLs
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      Object.values(clipUrlsRef.current as Record<string, string>).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [audioPreviewUrl, audioUrl]);

  // --- builder 操作 ---

  // 一键复制「AI 歌词结构化」Prompt 到剪贴板
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_LYRICS_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setStatus({ type: 'warn', msg: '复制失败，请手动选择文本复制。' });
    }
  };

  const handleParse = () => {
    if (raw.trim().length < 4) {
      setStatus({ type: 'warn', msg: '请先粘贴歌词（LRC / SRT 字幕 / 或纯文本）。' });
      return;
    }
    const useSrt = isSrt(raw);
    const useLrc = !useSrt && isLrc(raw);
    const parsed = useSrt ? parseSrt(raw) : useLrc ? parseLrc(raw) : parsePlain(raw);
    if (parsed.length === 0) {
      setStatus({ type: 'warn', msg: '没能解析出任何歌词句，请检查格式。' });
      return;
    }
    setSource(useSrt || useLrc ? 'lrc' : 'plain');
    setLines(parsed);
    setStatus({
      type: 'ok',
      msg: `已切割成 ${parsed.length} 句（${useSrt ? 'SRT 时间轴模式' : useLrc ? 'LRC 时间轴模式' : '纯文本分句模式'}）。可编辑、生成注音/翻译后再保存。`,
    });
  };

  const updateLine = (id: string, patch: Partial<SongLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeLine = (id: string) => setLines((ls) => ls.filter((l) => l.id !== id));

  // 播放器中直接编辑已保存歌曲包的时间轴，并持久化到 storage
  const updateActiveLine = (id: string, patch: Partial<SongLine>) => {
    if (!activePack) return;
    const nextLines = activePack.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
    const nextPack = { ...activePack, lines: nextLines };
    setActivePack(nextPack);
    saveSongPack(nextPack); // 持久化（storageService 会替换同 id）
    setPacks(getSongPacks());
  };

  // 批量生成整首注音（1 次 API 调用），逐句覆盖
  const generateRomaji = async () => {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      const romajis = await generatePhoneticsBatch(
        lines.map((l) => l.text),
        lang
      );
      const next = lines.map((l, i) => ({ ...l, romaji: romajis[i] || l.romaji || '' }));
      setLines(next);
      const ok = next.filter((l) => l.romaji).length;
      setStatus({
        type: ok ? 'ok' : 'warn',
        msg: ok
          ? `已重新生成全部 ${lines.length} 句注音（1 次 API 调用，含汉字读音 / 中文拼音）。`
          : `注音生成失败：AI 未返回有效内容。请检查 AI 模型配置 / 额度 / 网络，或手动填写罗马音。`,
      });
    } catch (e: any) {
      setStatus({
        type: 'warn',
        msg: `注音生成失败：${e?.message || '未知错误'}。请检查 AI 模型配置 / 额度 / 网络，或手动填写罗马音。`,
      });
    } finally {
      setBusy(false);
    }
  };

  // 批量翻译：仅对缺译文的行做一次 API 调用补全
  const generateTranslation = async () => {
    if (lines.length === 0) return;
    const gaps = lines.map((l, i) => ({ i, has: !l.translation && !!l.text })).filter((x) => x.has);
    if (gaps.length === 0) {
      setStatus({ type: 'info', msg: '本歌所有句子已有译文，无需生成。' });
      return;
    }
    setBusy(true);
    try {
      const texts = gaps.map((g) => lines[g.i].text);
      const trs = await translateTextsBatch(texts, lang, user.nativeLanguage);
      const map = new Map<number, string>();
      gaps.forEach((g, k) => {
        if (trs[k]) map.set(g.i, trs[k]);
      });
      setLines((ls) => ls.map((l, i) => (map.has(i) ? { ...l, translation: map.get(i)! } : l)));
      setStatus({
        type: 'ok',
        msg: `已批量生成 ${map.size} 句译文（1 次 API 调用）。`,
      });
    } catch (e: any) {
      setStatus({
        type: 'warn',
        msg: `翻译生成失败：${e?.message || '未知错误'}。请检查 AI 模型配置 / 额度 / 网络，或手动填写译文。`,
      });
    } finally {
      setBusy(false);
    }
  };

  const onPickAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(URL.createObjectURL(f));
  };

  // 解析 JSON 文本并载入歌词（文件导入与粘贴导入共用）。fileName 仅用于状态文案。
  const loadSongJson = (text: string, fileName?: string) => {
    try {
      const data = JSON.parse(text);
      const rawLines: any[] = Array.isArray(data.lines)
        ? data.lines
        : Array.isArray(data)
          ? data
          : null;
      if (!rawLines || rawLines.length === 0) throw new Error('没有可导入的歌词行');
      const parsed: SongLine[] = rawLines
        .map((l: any, i: number) => ({
          id: `l${i}`,
          text: String(l?.text ?? '').trim(),
          time: typeof l?.time === 'number' ? l.time : undefined,
          start: typeof l?.start === 'number' ? l.start : undefined,
          end: typeof l?.end === 'number' ? l.end : undefined,
          clip: l?.clip ? String(l.clip) : undefined,
          romaji: l?.romaji ? String(l.romaji) : undefined,
          translation: l?.translation ? String(l.translation) : undefined,
        }))
        .filter((l) => l.text);
      if (parsed.length === 0) throw new Error('没有有效的歌词文本');
      const hasTime = parsed.some((l) => l.time != null);
      setSource(hasTime ? 'lrc' : 'plain');
      setLines(parsed);
      setStatus({
        type: 'ok',
        msg: `已${fileName ? `从 ${fileName} ` : ''}导入 ${parsed.length} 句（含时间轴 ${parsed.filter((l) => l.time != null).length} 句）。可补 romaji / 译文后保存。`,
      });
    } catch (err: any) {
      setStatus({ type: 'warn', msg: `导入失败：${err?.message || 'JSON 格式不正确'}` });
    }
  };

  // 导入本地 Python 脚本（scripts/song_segmenter.py）生成的 segments.json
  const onImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => loadSongJson(String(reader.result), f.name);
    reader.readAsText(f);
    e.target.value = '';
  };

  // 导入剪辑包里的逐句音频片段：按文件名匹配 segments.json 中的 line.clip
  const onPickClips = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    if (files.length === 0) return;
    const nameToIdx = new Map<string, number>();
    lines.forEach((l, i) => {
      if (l.clip) nameToIdx.set(l.clip, i);
    });
    const next = { ...pendingClips };
    let matched = 0;
    for (const f of files) {
      const idx = nameToIdx.get(f.name);
      if (idx == null) continue;
      next[idx] = f;
      matched++;
    }
    setPendingClips(next);
    if (matched === 0) {
      setStatus({
        type: 'warn',
        msg: '这些音频片段没能匹配到歌词行。请确认文件名与 segments.json 里的 clip 字段一致（如 01.mp3）。',
      });
    } else {
      setStatus({ type: 'ok', msg: `已载入 ${matched} 个逐句音频片段，保存后会随歌曲包一起存到本地。` });
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!title.trim() || lines.length === 0) {
      setStatus({ type: 'warn', msg: '请填写歌名，且至少解析出一句歌词再保存。' });
      return;
    }
    setBusy(true);
    const packId = crypto.randomUUID();
    let audioId: string | undefined;
    if (audioFile) {
      audioId = crypto.randomUUID();
      try {
        await saveSongAudio(audioId, audioFile);
      } catch {
        audioId = undefined;
        setStatus({ type: 'warn', msg: '音频保存失败，歌曲包已存但不含音频。' });
      }
    }
    let hasClips = false;
    const clipEntries = Object.entries(pendingClips as Record<string, Blob>).map(([idx, blob]) => ({ idx: Number(idx), blob }));
    if (clipEntries.length > 0) {
      try {
        await saveSongClips(packId, clipEntries);
        hasClips = true;
      } catch {
        setStatus({ type: 'warn', msg: '逐句音频片段保存失败，歌曲包已存但不含片段。' });
      }
    }
    const pack: SongPack = {
      id: packId,
      title: title.trim(),
      artist: artist.trim() || undefined,
      language: lang,
      lines,
      source,
      audioId,
      hasClips: hasClips || undefined,
      createdAt: Date.now(),
    };
    const next = saveSongPack(pack);
    setPacks(next);
    setStatus({
      type: 'ok',
      msg: `已保存《${pack.title}》，共 ${lines.length} 句${hasClips ? '（含逐句音频片段）' : ''}。`,
    });
    // reset builder
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setRaw('');
    setTitle('');
    setArtist('');
    setLines([]);
    setAudioFile(null);
    setAudioPreviewUrl(null);
    setPendingClips({});
    setBusy(false);
  };

  const handleDeletePack = async (id: string) => {
    const next = await deleteSongPack(id);
    setPacks(next);
  };

  // 导出歌曲包为 JSON（含用户修改过的时间轴 / 注音 / 译文），可直接用「导入 segments.json」再次载入复用
  const exportPack = (pack: SongPack) => {
    const payload = {
      title: pack.title,
      artist: pack.artist,
      language: pack.language,
      source: pack.source,
      lines: pack.lines.map((l) => ({
        text: l.text,
        time: l.time,
        start: l.start,
        end: l.end,
        romaji: l.romaji,
        translation: l.translation,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.title || 'song'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({
      type: 'ok',
      msg: `已导出《${pack.title}》歌词（含你修改的时间轴 / 注音 / 译文）。可再次用「导入 segments.json」载入复用。`,
    });
  };

  // --- player 操作 ---

  const openPack = async (pack: SongPack) => {
    setActivePack(pack);
    // 载入每句音频片段（来自剪辑包）
    const loadedClipUrls: Record<number, string> = {};
    if (pack.hasClips) {
      for (let i = 0; i < pack.lines.length; i++) {
        try {
          const blob = await getSongClip(pack.id, i);
          if (blob) loadedClipUrls[i] = URL.createObjectURL(blob);
        } catch {
          /* 单句片段缺失不影响整体 */
        }
      }
    }
    applyClipUrls(loadedClipUrls);
    if (pack.audioId) {
      try {
        const blob = await getSongAudio(pack.audioId);
        if (blob) {
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          setAudioUrl(URL.createObjectURL(blob));
        }
      } catch {
        setAudioUrl(null);
      }
    } else {
      setAudioUrl(null);
    }
    setCurTime(0);
    setDur(0);
    setIsPlaying(false);
    setView('player');
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    setCurTime(t);
  };

  // 精听：只播该句的独立音频片段（来自剪辑包），没有则回退到整首音频的对应时间段
  const playClip = (idx: number) => {
    const url = clipUrls[idx];
    const a = clipAudioRef.current;
    if (!url || !a) return;
    a.src = url;
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  const clearActive = () => {
    setActivePack(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    Object.values(clipUrlsRef.current as Record<string, string>).forEach((u) => URL.revokeObjectURL(u));
    applyClipUrls({});
    setAudioUrl(null);
    setIsPlaying(false);
    setView('browse');
  };

  // 逐句循环精听跟打：进入会话
  const startSession = () => {
    setView('session');
    setSessionIdx(0);
    setSessionInput('');
    setSessionRevealed(true);
    setSessionDone(new Set());
    setSessionFinished(false);
    advanceScheduledRef.current = false;
    loopRangeRef.current = null;
    setTimeout(() => playSentenceLoop(0), 60);
  };

  // 循环播放某一句：优先用剪辑包片段，否则用整首音频的对应时间段
  const playSentenceLoop = (idx: number) => {
    const a = activePack;
    if (!a) return;
    const line = a.lines[idx];
    if (!line) return;
    clipAudioRef.current?.pause();
    audioRef.current?.pause();
    loopRangeRef.current = null;
    const clip = clipUrls[idx];
    if (clip && clipAudioRef.current) {
      const c = clipAudioRef.current;
      c.loop = true;
      c.src = clip;
      c.currentTime = 0;
      c.play().catch(() => {});
    } else if (audioUrl && line.time != null && audioRef.current) {
      const m = audioRef.current;
      m.loop = false;
      const end =
        idx + 1 < a.lines.length && a.lines[idx + 1].time != null
          ? a.lines[idx + 1].time!
          : dur || m.duration || line.time + 6;
      loopRangeRef.current = { start: line.time, end };
      m.currentTime = line.time;
      m.play().catch(() => {});
    }
  };

  const goToSentence = (idx: number) => {
    if (!activePack || idx < 0 || idx >= activePack.lines.length) return;
    setSessionIdx(idx);
    setSessionInput('');
    setSessionRevealed(true);
    setAwaitingAdvance(false);
    advanceScheduledRef.current = false;
    loopRangeRef.current = null;
    playSentenceLoop(idx);
  };

  const onSessionInput = (v: string) => {
    setSessionInput(v);
    const line = activePack?.lines[sessionIdx];
    if (!line) return;
    const mr = matchResult(v, line.text);
    const passed = (mr.state === 'exact' || (sessionForgiving && mr.state === 'close')) && v.trim().length > 0;
    if (passed && !sessionDone.has(sessionIdx)) {
      const next = new Set(sessionDone);
      next.add(sessionIdx);
      setSessionDone(next);
      // 不再自动跳下一句：通过仅作标记，由用户按回车或点「下一句」主动前进
    }
  };

  // 播放时根据当前时间高亮当前句：只要歌词带 time（LRC 或 Python 生成）即可
  const currentLineIdx = useMemo(() => {
    if (!activePack || !activePack.lines[0]?.time) return -1;
    const ls = activePack.lines;
    for (let i = 0; i < ls.length; i++) {
      const start = ls[i].time!;
      const end = i + 1 < ls.length ? ls[i + 1].time! : Infinity;
      if (curTime >= start && curTime < end) return i;
    }
    return -1;
  }, [activePack, curTime]);

  const practiceLine = (line: SongLine, idx: number) => {
    if (!activePack) return;
    const notes = [
      line.translation ? `[Translation]\n${line.translation}` : '',
      line.romaji ? `[Phonetic Guide]\n${line.romaji}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    onPractice({ text: line.text, title: `${activePack.title} · 第 ${idx + 1} 句`, notes });
  };

  const practiceAll = () => {
    if (!activePack) return;
    const text = activePack.lines.map((l) => l.text).join('\n');
    const notes = [
      activePack.lines.some((l) => l.translation)
        ? `[Translation]\n${activePack.lines.map((l) => l.translation || '').join('\n')}`
        : '',
      activePack.lines.some((l) => l.romaji)
        ? `[Phonetic Guide]\n${activePack.lines.map((l) => l.romaji || '').join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    onPractice({ text, title: `${activePack.title} · 整首`, notes });
  };

  const fmtTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // 解析用户输入的时间字符串：m:ss / mm:ss / m:ss.xx / mm:ss.xx -> 秒数
  const parseTimeInput = (raw: string): number | null => {
    const s = raw.trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (sec >= 60) return null;
    const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
    return Math.round((min * 60 + sec + frac) * 100) / 100;
  };

  // 可编辑时间输入组件：受控显示 fmtTime，blur 时解析并提交；非法输入回滚
  const TimeInput: React.FC<{
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    className?: string;
    placeholder?: string;
  }> = ({ value, onChange, className, placeholder }) => {
    const [text, setText] = useState(value != null ? fmtTime(value) : placeholder || '0:00');
    useEffect(() => {
      if (value != null) setText(fmtTime(value));
    }, [value]);
    return (
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parseTimeInput(text);
          if (parsed != null) {
            onChange(parsed);
            setText(fmtTime(parsed));
          } else {
            setText(value != null ? fmtTime(value) : placeholder || '0:00');
          }
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        placeholder={placeholder}
        className={`text-center tabular-nums bg-transparent outline-none border-b border-white/10 focus:border-neon hover:border-white/30 transition-colors ${className || ''}`}
      />
    );
  };

  // ====================== 渲染 ======================

  if (view === 'player' && activePack) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={clearActive}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2/70 text-gray-300 hover:text-white hover:bg-surface-3 transition-colors text-sm"
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate flex items-center gap-2">
              <Disc3 size={18} className="text-neon" /> {activePack.title}
            </h1>
            <p className="text-xs text-muted">{activePack.artist || '未知歌手'} · {activePack.lines.length} 句 · {activePack.language}</p>
          </div>
        </div>

        <GlassCard className="p-4 space-y-3">
          {audioUrl ? (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-neon to-neon-2 text-white shadow-glow-neon flex items-center justify-center hover:brightness-110 transition"
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={dur || 0}
                    step={0.05}
                    value={curTime}
                    onChange={seek}
                    className="w-full accent-neon"
                  />
                  <div className="flex justify-between text-xs text-muted mt-1">
                    <span>{fmtTime(curTime)}</span>
                    <span>{fmtTime(dur)}</span>
                  </div>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={(e) => setCurTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
              />
              {/* 逐句精听：每句独立片段 */}
              <audio ref={clipAudioRef} />
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted p-3 bg-surface-2/40 rounded-lg border border-line-strong">
              <AlertTriangle size={16} className="text-yellow-400" />
              这首歌没有上传音频。下方歌词可直接逐句练习；如想听歌跟打，请在「新建歌曲」时上传 mp3。
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => activePack && exportPack(activePack)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 hover:bg-surface-3 text-sm font-semibold transition"
              title="导出歌词（含修改过的时间轴/注音/译文），可再次导入复用"
            >
              <FileJson size={16} /> 导出歌词
            </button>
            <button
              onClick={practiceAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neon-2 text-white text-sm font-bold hover:bg-neon-2/80 shadow-glow-cyan"
            >
              <BookOpen size={16} /> 整首练习
            </button>
            <button
              onClick={startSession}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon"
            >
              <Headphones size={16} /> 逐句循环精听跟打
            </button>
          </div>
        </GlassCard>

        <div className="space-y-2">
          {activePack.lines.map((line, idx) => {
            const isCur = idx === currentLineIdx;
            return (
              <div
                key={line.id}
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                  isCur
                    ? 'border-neon/50 bg-neon/10 shadow-glow-sm'
                    : 'border-white/[0.06] bg-surface-2/50 hover:border-neon/30'
                }`}
              >
                <div className="shrink-0 w-20 flex flex-col items-center justify-center text-[11px] font-bold text-muted pt-0.5 leading-tight gap-0.5">
                  {line.start != null && line.end != null ? (
                    <>
                      <TimeInput value={line.start} onChange={(v) => updateActiveLine(line.id, { start: v })} className="w-14" />
                      <span className="text-faint">→</span>
                      <TimeInput value={line.end} onChange={(v) => updateActiveLine(line.id, { end: v })} className="w-14" />
                    </>
                  ) : line.time != null ? (
                    <TimeInput value={line.time} onChange={(v) => updateActiveLine(line.id, { time: v })} className="w-14" />
                  ) : (
                    <span className="text-faint">{idx + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-base font-semibold ${isCur ? 'text-white' : 'text-gray-200'}`}>{line.text}</div>
                  {line.romaji && <div className="text-xs text-neon-2 mt-0.5 font-mono">{line.romaji}</div>}
                  {line.translation && <div className="text-xs text-muted mt-0.5">{line.translation}</div>}
                </div>
                <button
                  onClick={() => practiceLine(line, idx)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-neon text-white text-xs font-bold hover:bg-neon/80 shadow-glow-neon opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                >
                  练习
                </button>
                {clipUrls[idx] && (
                  <button
                    onClick={() => playClip(idx)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-neon-2/20 text-neon-2 text-xs font-bold hover:bg-neon-2/30 transition flex items-center gap-1"
                    title="只听这一句"
                  >
                    <Headphones size={13} /> 精听
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ====================== 逐句循环精听跟打 会话视图 ======================
  if (view === 'session' && activePack) {
    const line = activePack.lines[sessionIdx];
    const total = activePack.lines.length;
    const isLast = sessionIdx + 1 >= total;
    const isFirst = sessionIdx === 0;
    const doneCount = sessionDone.size;
    const mr: { state: MatchState; diff: number } = line
      ? matchResult(sessionInput, line.text)
      : { state: 'empty', diff: 0 };
    const correctNow =
      !!line &&
      (mr.state === 'exact' || (sessionForgiving && mr.state === 'close')) &&
      sessionInput.trim().length > 0;
    const hasAudio = !!audioUrl || !!clipUrls[sessionIdx];

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loopRangeRef.current = null;
              clipAudioRef.current?.pause();
              audioRef.current?.pause();
              setView('player');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2/70 text-gray-300 hover:text-white hover:bg-surface-3 transition-colors text-sm"
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate flex items-center gap-2">
              <Headphones size={18} className="text-neon" /> 逐句循环精听跟打
            </h1>
            <p className="text-xs text-muted flex flex-wrap items-center gap-2">
              <span>{activePack.title} · 第 {sessionIdx + 1}/{total} 句 · 已通过 {doneCount}/{total}</span>
              {line && (
                <span className="inline-flex items-center gap-1 text-neon-2">
                  <span className="text-faint">·</span>
                  {line.start != null && line.end != null ? (
                    <>
                      <TimeInput value={line.start} onChange={(v) => updateActiveLine(line.id, { start: v })} className="w-16 text-sm px-1.5 py-0.5 rounded-lg bg-surface-3/60 border border-neon/30" />
                      <span className="text-faint">→</span>
                      <TimeInput value={line.end} onChange={(v) => updateActiveLine(line.id, { end: v })} className="w-16 text-sm px-1.5 py-0.5 rounded-lg bg-surface-3/60 border border-neon/30" />
                    </>
                  ) : line.time != null ? (
                    <TimeInput value={line.time} onChange={(v) => updateActiveLine(line.id, { time: v })} className="w-16 text-sm px-1.5 py-0.5 rounded-lg bg-surface-3/60 border border-neon/30" />
                  ) : null}
                </span>
              )}
            </p>
          </div>
        </div>

        {sessionFinished ? (
          <GlassCard className="p-8 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold text-white">全部跟打通过！</h2>
            <p className="text-muted">《{activePack.title}》共 {total} 句，已全部打对。</p>
            <button
              onClick={() => setView('player')}
              className="px-4 py-2.5 rounded-lg bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon"
            >
              返回播放器
            </button>
          </GlassCard>
        ) : (
          line && (
            <GlassCard className="p-6 space-y-5">
              {/* 进度条 */}
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon to-neon-2 transition-all duration-300"
                  style={{ width: `${(doneCount / total) * 100}%` }}
                />
              </div>

              {!hasAudio && (
                <div className="text-center text-xs text-yellow-300/80">
                  这一句没有音频片段，进入纯打字模式（可在「新建歌曲」上传 mp3 或用剪辑包导入片段）。
                </div>
              )}

              {/* 当前句 */}
              <div className="text-center min-h-[3.5rem] flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-white leading-relaxed tracking-wide">
                  {sessionRevealed ? line.text : '・・・・・・・・'}
                </div>
                {sessionRevealed && (
                  <input
                    value={line.romaji || ''}
                    onChange={(e) => updateActiveLine(line.id, { romaji: e.target.value })}
                    placeholder="罗马音"
                    className="text-neon-2 font-mono mt-1.5 text-sm text-center bg-transparent border-b border-white/15 hover:border-neon/40 focus:border-neon outline-none transition-colors w-full max-w-sm placeholder:text-faint"
                  />
                )}
                {sessionRevealed && (
                  <input
                    value={line.translation || ''}
                    onChange={(e) => updateActiveLine(line.id, { translation: e.target.value })}
                    placeholder="中文翻译"
                    className="text-muted text-sm mt-1 text-center bg-transparent border-b border-white/15 hover:border-neon/40 focus:border-neon outline-none transition-colors w-full max-w-sm placeholder:text-faint"
                  />
                )}
              </div>

              {sessionDone.has(sessionIdx) && (
                <div className="text-center text-green-300 flex items-center justify-center gap-1.5 text-sm font-semibold">
                  <CheckCircle2 size={18} />
                  {awaitingAdvance
                    ? '再按一次回车进入下一句 →'
                    : '这一句通过！按回车确认，再按一次回车进入下一句（或点「下一句」）'}
                </div>
              )}

              {/* 打字输入 */}
              <input
                key={sessionIdx}
                autoFocus
                value={sessionInput}
                onChange={(e) => onSessionInput(e.target.value)}
                onKeyDown={(e) => {
                  // 忽略输入法组合中的回车（选词确认），避免误触跳转
                  if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (awaitingAdvance) {
                      // 第二次回车：真正前进
                      setAwaitingAdvance(false);
                      if (isLast) {
                        if (sessionDone.has(sessionIdx)) setSessionFinished(true);
                      } else {
                        goToSentence(sessionIdx + 1);
                      }
                    } else if (sessionDone.has(sessionIdx)) {
                      // 第一次回车：确认这一句已打对，等待再按一次才前进
                      setAwaitingAdvance(true);
                    }
                  }
                }}
                placeholder="听着循环播放，打出这一句…（打完后按回车进下一句）"
                className={`w-full glass-panel border rounded-xl px-4 py-3 text-lg text-white outline-none transition-all ${
                  correctNow
                    ? 'border-green-500/60 shadow-glow-sm'
                    : mr.state === 'close'
                    ? 'border-amber-400/50'
                    : 'border-white/10 focus:border-neon'
                }`}
              />

              {sessionInput.trim().length > 0 && mr.state === 'wrong' && (
                <div className="text-center text-xs text-amber-300/80">
                  {mr.diff <= Math.max(2, Math.floor(normalizeForCompare(line.text).length * 0.4))
                    ? `差 ${mr.diff} 个字符，再核对一下～`
                    : '和原句差距较大，点「显示原文」对照一下'}
                </div>
              )}
              {sessionInput.trim().length > 0 && mr.state === 'close' && !correctNow && (
                <div className="text-center text-xs text-amber-300/80">很接近了，关闭「容错」则要求完全一致 ✦</div>
              )}

              {/* 控制 */}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => playSentenceLoop(sessionIdx)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 text-sm font-semibold transition"
                >
                  <Play size={14} /> 重听这句
                </button>
                <button
                  onClick={() => setSessionForgiving((g) => !g)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                    sessionForgiving
                      ? 'bg-neon/15 text-neon border-neon/40'
                      : 'bg-surface-3/70 text-gray-200 border-neon/25 hover:border-neon/60'
                  }`}
                  title="允许少量假名误差（长音省略、促音、浊音等）也算通过"
                >
                  ✦ 容错 {sessionForgiving ? '开' : '关'}
                </button>
                <button
                  onClick={() => setSessionRevealed((r) => !r)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 text-sm font-semibold transition"
                >
                  {sessionRevealed ? '👁 隐藏原文' : '👁 显示原文'}
                </button>
                <button
                  onClick={() => !isFirst && goToSentence(sessionIdx - 1)}
                  disabled={isFirst}
                  className="px-3 py-2 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 text-sm font-semibold transition disabled:opacity-40"
                >
                  ← 上一句
                </button>
                <button
                  onClick={() =>
                    isLast
                      ? sessionDone.has(sessionIdx) && setSessionFinished(true)
                      : goToSentence(sessionIdx + 1)
                  }
                  disabled={isLast && !sessionDone.has(sessionIdx)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    isLast && sessionDone.has(sessionIdx)
                      ? 'bg-neon text-white shadow-glow-neon hover:bg-neon/80'
                      : 'bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 disabled:opacity-40'
                  }`}
                >
                  {isLast ? (sessionDone.has(sessionIdx) ? '完成 🎉' : '下一句 →') : '下一句 →'}
                </button>
              </div>
            </GlassCard>
          )
        )}

        {/* 会话音频元素（与播放器复用同一 ref） */}
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onTimeUpdate={(e) => {
            const lr = loopRangeRef.current;
            if (lr && e.currentTarget.currentTime >= lr.end) e.currentTarget.currentTime = lr.start;
          }}
        />
        <audio ref={clipAudioRef} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Music size={22} className="text-neon" /> 歌曲跟打
        </h1>
        <p className="text-muted text-sm mt-1">
          把你喜欢的歌放进来：粘贴 <b className="text-white">LRC / SRT 字幕 / 纯文本歌词</b>、或上传 mp3，自动切割成逐句，生成 romaji 注音与译文，然后一句句打字练习。
          不想手敲时间戳？用本地脚本 <code className="text-neon-2">scripts/song_segmenter.py</code> 分析 mp3 自动生成 <b className="text-white">segments.json</b>，再用 <code className="text-neon-2">scripts/song_clipper.py</code> 按时间戳把歌切出每句片段；点「导入 segments.json」载入歌词，再点「附带每句音频」把片段一起导入，即可在播放时「精听」单句。
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('build')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
            tab === 'build' ? 'bg-gradient-to-r from-neon to-neon-2 text-white shadow-glow-neon' : 'bg-surface-2/70 text-muted hover:text-white'
          }`}
        >
          <Plus size={16} /> 新建歌曲
        </button>
        <button
          onClick={() => { setTab('library'); setPacks(getSongPacks()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
            tab === 'library' ? 'bg-gradient-to-r from-neon to-neon-2 text-white shadow-glow-neon' : 'bg-surface-2/70 text-muted hover:text-white'
          }`}
        >
          <ListMusic size={16} /> 我的歌曲库 ({packs.length})
        </button>
      </div>

      {status && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            status.type === 'ok'
              ? 'border-green-700/40 bg-green-900/10 text-green-300'
              : status.type === 'warn'
              ? 'border-yellow-700/40 bg-yellow-900/10 text-yellow-200'
              : 'border-line-strong bg-surface/60 text-gray-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {status.type === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            <span>{status.msg}</span>
          </div>
        </div>
      )}

      {tab === 'build' ? (
        <div className="space-y-4">
          {/* 基本信息 + 歌词输入 */}
          <GlassCard className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">歌名</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：Lemon"
                  className="w-full glass-panel border border-white/10 rounded-lg px-3 py-2.5 outline-none text-sm text-white placeholder:text-faint"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">歌手（可选）</label>
                <input
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="例如：米津玄師"
                  className="w-full glass-panel border border-white/10 rounded-lg px-3 py-2.5 outline-none text-sm text-white placeholder:text-faint"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">歌词（LRC / SRT 字幕 / 纯文本）</label>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={'[00:12.50]夢の続きを知りたいよ\n[00:16.00]壊れた世界の秒針を\n\n或粘贴 SRT 字幕（00:00:13,517 --> 00:00:18,784 后接歌词），自动提取歌词与时间轴'}
                className="w-full h-44 glass-panel border border-white/10 rounded-lg p-3 outline-none text-sm text-white placeholder:text-faint resize-none custom-scrollbar font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block flex items-center gap-1.5">
                <Upload size={13} /> 音频（可选，mp3 / m4a）
              </label>
              <input type="file" accept="audio/*" onChange={onPickAudio} className="block w-full text-sm text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-neon/15 file:text-neon file:font-semibold hover:file:bg-neon/25" />
              {audioPreviewUrl && (
                <audio src={audioPreviewUrl} controls className="mt-2 w-full h-10" />
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleParse}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon"
              >
                <Scissors size={16} /> 解析并预览
              </button>
              <button
                onClick={copyPrompt}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 text-sm font-semibold cursor-pointer transition"
                title="复制 Prompt，扔给任意 AI，让它问你要哪首歌后返回可导入的 JSON"
              >
                <Sparkles size={16} className={copiedPrompt ? 'text-neon' : ''} />
                {copiedPrompt ? '已复制 ✓' : '复制 AI 生成 Prompt'}
              </button>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 text-sm font-semibold cursor-pointer transition">
                <FileJson size={16} /> 导入 segments.json
                <input type="file" accept=".json,application/json" className="hidden" onChange={onImportJson} />
              </label>
              <button
                onClick={() => setPasteOpen((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition border ${
                  pasteOpen ? 'bg-neon/15 text-neon border-neon/40' : 'bg-surface-3/70 text-gray-200 border-neon/25 hover:border-neon/60'
                }`}
                title="把 AI 返回的歌词 JSON 直接粘贴进来载入"
              >
                <FileJson size={16} /> 粘贴 JSON 载入
              </button>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 text-sm font-semibold cursor-pointer transition">
                <Headphones size={16} /> 附带每句音频（多选）
                <input type="file" accept="audio/*" multiple className="hidden" onChange={onPickClips} />
              </label>
            </div>

            {pasteOpen && (
              <div className="space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder='把 AI 返回的歌词 JSON 贴在这里，例如：{"lines":[{"text":"夢の続きを知りたいよ","romaji":"yume no tsuzuki o shiritai yo","translation":"我想知道梦的后续","time":12.5}]}'
                  className="w-full h-36 glass-panel border border-white/10 rounded-lg p-3 outline-none text-xs text-white placeholder:text-faint resize-none custom-scrollbar font-mono"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      loadSongJson(pasteText);
                      setPasteText('');
                    }}
                    disabled={!pasteText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon disabled:opacity-50"
                  >
                    <FileJson size={14} /> 载入歌词
                  </button>
                </div>
              </div>
            )}
          </GlassCard>

          {/* 解析后的句子列表 */}
          {lines.length > 0 && (
            <GlassCard className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-neon" /> 已切割 {lines.length} 句
                  <span className="text-xs font-normal text-muted">（{source === 'lrc' ? '时间轴（LRC/SRT）' : '纯文本分句'}）</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={generateRomaji}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 hover:bg-surface-3 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Languages size={14} /> {busy ? '生成中…' : 'AI 生成注音'}
                  </button>
                  <button
                    onClick={generateTranslation}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-3/70 text-gray-200 border border-neon/25 hover:border-neon/60 hover:bg-surface-3 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Wand2 size={14} /> AI 翻译
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon text-white text-xs font-bold hover:bg-neon/80 shadow-glow-neon disabled:opacity-50"
                  >
                    <Save size={14} /> 保存歌曲包
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                {lines.map((line, idx) => (
                  <div key={line.id} className="p-3 rounded-xl border border-white/[0.06] bg-surface-2/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-16 flex flex-col items-center justify-center text-[11px] font-bold text-muted text-center gap-0.5">
                        {line.start != null && line.end != null ? (
                          <>
                            <TimeInput value={line.start} onChange={(v) => updateLine(line.id, { start: v })} className="w-12" />
                            <span className="text-faint">→</span>
                            <TimeInput value={line.end} onChange={(v) => updateLine(line.id, { end: v })} className="w-12" />
                          </>
                        ) : line.time != null ? (
                          <TimeInput value={line.time} onChange={(v) => updateLine(line.id, { time: v })} className="w-12" />
                        ) : (
                          <span className="text-faint">{idx + 1}</span>
                        )}
                      </div>
                      <input
                        value={line.text}
                        onChange={(e) => updateLine(line.id, { text: e.target.value })}
                        className="flex-1 bg-transparent outline-none text-sm font-semibold text-white placeholder:text-faint"
                      />
                      <button
                        onClick={() => removeLine(line.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                        title="删除此句"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                      <input
                        value={line.romaji || ''}
                        onChange={(e) => updateLine(line.id, { romaji: e.target.value })}
                        placeholder="romaji 注音"
                        className="bg-surface-3/40 border border-white/5 rounded-md px-2 py-1.5 outline-none text-xs text-neon-2 font-mono placeholder:text-faint"
                      />
                      <input
                        value={line.translation || ''}
                        onChange={(e) => updateLine(line.id, { translation: e.target.value })}
                        placeholder="中文翻译"
                        className="bg-surface-3/40 border border-white/5 rounded-md px-2 py-1.5 outline-none text-xs text-gray-300 placeholder:text-faint"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      ) : (
        // 歌曲库
        <div className="space-y-3">
          {packs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-line rounded-xl">
              <p className="text-muted mb-2">歌曲库还是空的。</p>
              <div className="text-sm text-faint">到「新建歌曲」粘贴歌词 + 上传音频，生成你的第一首跟打歌。</div>
            </div>
          ) : (
            packs.map((pack) => (
              <GlassCard key={pack.id} className="p-4 flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon/30 to-neon-2/20 border border-neon/25 flex items-center justify-center shadow-glow-sm">
                  <Disc3 size={22} className="text-neon" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white truncate">{pack.title}</h4>
                  <p className="text-xs text-muted truncate">
                    {pack.artist || '未知歌手'} · {pack.lines.length} 句 · {pack.language}
                    {pack.audioId ? ' · 🎵 含音频' : ''}{pack.hasClips ? ' · 🎧 逐句片段' : ''} · {pack.source === 'lrc' ? 'LRC' : '纯文本'}
                  </p>
                </div>
                <button
                  onClick={() => openPack(pack)}
                  className="px-3 py-2 rounded-lg bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon"
                >
                  打开 / 跟打
                </button>
                <button
                  onClick={() => exportPack(pack)}
                  className="p-2 rounded-lg text-muted hover:text-neon hover:bg-neon/10 transition"
                  title="导出歌词"
                >
                  <FileJson size={16} />
                </button>
                <button
                  onClick={() => handleDeletePack(pack.id)}
                  className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </GlassCard>
            ))
          )}
        </div>
      )}

      <div className="text-xs text-faint border-t border-line pt-3">
        隐私说明：歌词与音频仅保存在你本地浏览器（localStorage + IndexedDB），不上传服务器。AI 翻译仅在点击「AI 翻译」时调用，失败则留空可手动补。
      </div>
    </div>
  );
};

export default SongLabView;
