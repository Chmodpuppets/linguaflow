#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
song_segmenter.py — 本地歌曲自动断句工具（句级）

把你喜欢的歌变成可逐句打字练习的内容：分析 mp3 的"有声音/停顿"边界，
自动把歌词切成一句句，并估出每句大概在歌曲的第几秒开始。

────────────────────────────────────────────────────────
安装依赖（只需一次）：
    pip install librosa numpy

用法 1 · 纯文本歌词 + 音频（推荐，自动估时间）：
    python song_segmenter.py --audio song.mp3 --lyrics lyrics.txt --output segments.json

用法 2 · 已经有 LRC（自带时间戳）：
    python song_segmenter.py --lyrics song.lrc --output segments.json
    （此时不需要音频，直接采用 LRC 里的时间戳）

用法 3 · 只有歌词没有音频：
    python song_segmenter.py --lyrics lyrics.txt --output segments.json
    （会输出 time=0 的占位行，可在 LinguaFlow 里手动补时间，或之后补音频）

然后：在 LinguaFlow → 资源 → 歌曲跟打 → 新建歌曲 → 「导入 segments.json」加载。

输出格式（与 LinguaFlow 的 SongLine 对齐，time 单位秒）：
    {
      "title": "Lemon",
      "artist": "米津玄師",
      "language": "ja",
      "source": "python",
      "lines": [
        {"text": "夢の続きを知りたいよ", "time": 12.5},
        {"text": "壊れた世界の秒針を",   "time": 16.0}
      ]
    }
────────────────────────────────────────────────────────
设计说明：唱歌 ≠ 说话，Whisper 这类语音识别在带旋律的演唱上基本失效，
因此本脚本不做"语音转写"，而是用能量法检测乐句边界（句级足够打字练习用）。
"""
import argparse
import json
import re
import sys

LRC_TIME_RE = re.compile(r"\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]")


def parse_lrc(path):
    """解析 LRC。返回 [(time_sec, text)]；若文件不含任何时间戳则返回 None。"""
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = LRC_TIME_RE.search(line)
            if not m:
                continue
            mm, ss, frac = m.group(1), m.group(2), m.group(3)
            t = int(mm) * 60 + int(ss) + (int((frac or "0").ljust(3, "0")[:3]) / 1000)
            txt = LRC_TIME_RE.sub("", line).strip()
            if txt:
                rows.append((round(t, 3), txt))
    return rows if rows else None


def load_lyrics_plain(path):
    """纯文本：逐行读取，丢弃空行。"""
    out = []
    with open(path, encoding="utf-8") as f:
        for raw in f.read().splitlines():
            s = raw.strip()
            if s:
                out.append(s)
    return out


def detect_segments(y, sr, top_db=35, merge_gap=0.25, min_len=0.3):
    """用 librosa 能量法检测非静音区间（乐句）。返回 [(start_sec, end_sec)]。"""
    import librosa

    intervals = librosa.effects.split(y, top_db=top_db, frame_length=2048, hop_length=512)
    merged = []
    for s, e in intervals:
        s_s, e_s = s / sr, e / sr
        if merged and (s_s - merged[-1][1]) <= merge_gap:
            merged[-1] = (merged[-1][0], e_s)
        else:
            merged.append((s_s, e_s))
    return [(s, e) for (s, e) in merged if (e - s) >= min_len]


def assign_lines_to_segments(lines, segments):
    """把 N 行歌词按比例分配到 M 个乐句区间，返回每行起始秒。"""
    n = len(lines)
    m = len(segments)
    if m == 0:
        return [0.0] * n
    return [round(segments[min(m - 1, int(round(i * m / n)))][0], 3) for i in range(n)]


def main():
    ap = argparse.ArgumentParser(description="本地歌曲自动断句（句级）")
    ap.add_argument("--audio", help="音频文件 mp3/m4a/wav")
    ap.add_argument("--lyrics", required=True, help="歌词文件：纯文本 .txt 或 LRC .lrc")
    ap.add_argument("--output", default="segments.json", help="输出 json 路径（默认 segments.json）")
    ap.add_argument("--title", default="", help="歌名（可选）")
    ap.add_argument("--artist", default="", help="歌手（可选）")
    ap.add_argument("--language", default="ja", help="语言代码，默认 ja")
    ap.add_argument("--top-db", type=float, default=35, help="静音阈值(dB)，越大越激进（默认 35）")
    args = ap.parse_args()

    # 1) 读取歌词
    if args.lyrics.lower().endswith(".lrc"):
        lrc = parse_lrc(args.lyrics)
        if lrc is None:
            sys.exit("[song_segmenter] 该 .lrc 文件里没找到任何 [mm:ss] 时间戳，请确认格式。")
        lines = [t for _, t in lrc]
        times = [t for t, _ in lrc]
        print(f"[song_segmenter] 检测到 LRC 时间戳，直接使用 {len(lines)} 句。")
    else:
        lines = load_lyrics_plain(args.lyrics)
        if not lines:
            sys.exit("[song_segmenter] 歌词为空，请检查文件。")
        if not args.audio:
            print("[song_segmenter] 未提供 --audio，无法自动估时间；将输出 time=0 占位行（可在 UI 手动补）。")
            times = [0.0] * len(lines)
        else:
            try:
                import librosa
            except ImportError:
                sys.exit("[song_segmenter] 需要 librosa：先执行  pip install librosa numpy")
            try:
                y, sr = librosa.load(args.audio, sr=None, mono=True)
            except Exception as e:
                sys.exit(f"[song_segmenter] 音频加载失败：{e}")
            segs = detect_segments(y, sr, top_db=args.top_db)
            if not segs:
                sys.exit("[song_segmenter] 未检测到明显乐句，请调小 --top-db（如 30）或检查音频。")
            times = assign_lines_to_segments(lines, segs)
            print(f"[song_segmenter] 音频分析得到 {len(segs)} 个乐句，已分配到 {len(lines)} 句歌词。")

    out = {
        "title": args.title,
        "artist": args.artist,
        "language": args.language,
        "source": "python",
        "lines": [{"text": t, "time": tm} for t, tm in zip(lines, times)],
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[song_segmenter] 已写出 {len(lines)} 句 -> {args.output}")


if __name__ == "__main__":
    main()
