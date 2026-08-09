#!/usr/bin/env python3
"""song_clipper.py — 根据时间戳把一首歌切成逐句音频片段。

这是「歌曲跟打」流程里的【剪辑工程 / Project 1】（与 LinguaFlow 前端解耦的本地工具）。
输入一首歌的 mp3 + 每句的时间戳，输出：
  - 每句一个独立音频片段：01.mp3, 02.mp3, ...
  - 一份带 clip/start/end 的 segments.json（可直接在 LinguaFlow「歌曲跟打」里导入）
  - 可选 --package 打包成 zip，方便整体导入

时间戳的两种来源：
  A. --segments segments.json   复用 scripts/song_segmenter.py 的输出（自带 time/起止）
  B. --timestamps "0:12-0:16,0:16-0:20,0:20-0:24"  你自己手填的「哪句从几秒到几秒」
     配合 --lyrics lyrics.txt 给每句配原文（否则用「第 N 句」占位）

依赖：系统安装 ffmpeg（无需任何 Python 第三方库，全部走 subprocess 调用）。

示例：
  python song_clipper.py --audio song.mp3 --segments segments.json --out ./clips
  python song_clipper.py --audio song.mp3 --timestamps "0:12-0:16,0:16-0:20" --lyrics lyrics.txt --out ./clips
  python song_clipper.py --audio song.mp3 --segments segments.json --out ./clips --package my_song.zip
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile


# ------------------------- 时间解析 -------------------------
def ts_to_sec(s: str) -> float:
    """'1:23.5' / '1:23' / '83.5' -> 秒(float)。"""
    s = s.strip()
    if ':' in s:
        parts = s.split(':', 1)
        m = float(parts[0])
        sec = float(parts[1])
        return m * 60 + sec
    return float(s)


def parse_timestamps(text: str):
    """'0:12-0:16, 0:16-0:20' -> [(start, end), ...]"""
    out = []
    for seg in text.split(','):
        seg = seg.strip()
        if not seg or '-' not in seg:
            continue
        a, b = seg.split('-', 1)
        out.append((ts_to_sec(a), ts_to_sec(b)))
    return out


def parse_segments_json(path: str, duration: float):
    """读取 segmenter 产物，返回 [(start, end, text, romaji, translation)]。
    若某行只有 time（句首），则 end 取下一句 time，最后一句取到曲终。"""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    raw = data.get('lines', data) if isinstance(data, dict) else data
    rows = []
    for i, ln in enumerate(raw):
        start = ln.get('start')
        end = ln.get('end')
        if start is None and ln.get('time') is not None:
            start = float(ln['time'])
        if start is None:
            continue
        if end is None:
            nxt = None
            for j in range(i + 1, len(raw)):
                nt = raw[j].get('start') or raw[j].get('time')
                if nt is not None:
                    nxt = float(nt)
                    break
            end = nxt if nxt is not None else duration
        rows.append((float(start), float(end), ln.get('text', ''),
                     ln.get('romaji'), ln.get('translation')))
    return rows


# ------------------------- ffmpeg 封装 -------------------------
def ensure_ffmpeg():
    if shutil.which('ffmpeg') is None or shutil.which('ffprobe') is None:
        raise SystemExit('✗ 未找到 ffmpeg / ffprobe。请先安装：\n    macOS: brew install ffmpeg\n    Ubuntu: sudo apt install ffmpeg')


def get_duration(audio: str) -> float:
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=nw=1:nk=1', audio],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


def slice_audio(audio: str, start: float, end: float, out_path: str):
    """用 ffmpeg 流拷贝切出 [start, end]。失败则回退重编码。"""
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', audio, '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
             '-c', 'copy', out_path],
            capture_output=True, check=True,
        )
    except subprocess.CalledProcessError:
        subprocess.run(
            ['ffmpeg', '-y', '-i', audio, '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
             '-acodec', 'libmp3lame', '-b:a', '192k', out_path],
            capture_output=True, check=True,
        )


# ------------------------- 主流程 -------------------------
def main():
    ap = argparse.ArgumentParser(description='按时间戳把歌曲切成逐句音频片段')
    ap.add_argument('--audio', required=True, help='源音频文件（mp3/m4a/wav）')
    ap.add_argument('--segments', help='segments.json（来自 song_segmenter.py）')
    ap.add_argument('--timestamps', help='手填时间戳，如 "0:12-0:16,0:16-0:20"')
    ap.add_argument('--lyrics', help='与 --timestamps 配合的歌词文件（每行一句）')
    ap.add_argument('--title', help='歌曲标题（写进 segments.json）')
    ap.add_argument('--out', default='./clips', help='输出目录（片段 + segments.json）')
    ap.add_argument('--package', help='可选：把输出打包成此 zip 路径')
    args = ap.parse_args()

    ensure_ffmpeg()

    if not os.path.isfile(args.audio):
        raise SystemExit(f'✗ 找不到音频：{args.audio}')

    duration = get_duration(args.audio)
    print(f'· 音频时长：{duration:.1f}s')

    rows = None
    if args.segments:
        rows = parse_segments_json(args.segments, duration)
        print(f'· 从 segments.json 读取 {len(rows)} 句')
    elif args.timestamps:
        times = parse_timestamps(args.timestamps)
        texts = []
        if args.lyrics and os.path.isfile(args.lyrics):
            with open(args.lyrics, 'r', encoding='utf-8') as f:
                texts = [ln.rstrip('\n') for ln in f if ln.strip()]
        rows = [
            (s, e, texts[i] if i < len(texts) else f'第 {i + 1} 句', None, None)
            for i, (s, e) in enumerate(times)
        ]
        print(f'· 从手填时间戳读取 {len(rows)} 句')
    else:
        raise SystemExit('✗ 必须提供 --segments 或 --timestamps')

    if not rows:
        raise SystemExit('✗ 没有解析出任何片段，请检查输入。')

    os.makedirs(args.out, exist_ok=True)
    segments = []
    for i, (start, end, text, romaji, translation) in enumerate(rows):
        # 片段过短（<0.3s）或越界则跳过
        if end - start < 0.2:
            print(f'  ! 跳过第 {i + 1} 句（时长过短 {end - start:.2f}s）')
            continue
        if start < 0:
            start = 0.0
        if end > duration:
            end = duration
        clip_name = f'{i + 1:02d}.mp3'
        out_path = os.path.join(args.out, clip_name)
        slice_audio(args.audio, start, end, out_path)
        segments.append({
            'id': f'l{i}',
            'text': text.strip(),
            'time': round(start, 3),
            'start': round(start, 3),
            'end': round(end, 3),
            'clip': clip_name,
            'romaji': romaji,
            'translation': translation,
        })
        print(f'  ✓ {clip_name}  [{start:6.2f}s - {end:6.2f}s]  {text[:24]}')

    meta = {
        'title': args.title or os.path.splitext(os.path.basename(args.audio))[0],
        'source': 'clipper',
        'lines': segments,
    }
    json_path = os.path.join(args.out, 'segments.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f'\n✓ 已生成 {len(segments)} 个片段 + segments.json -> {os.path.abspath(args.out)}')

    if args.package:
        with zipfile.ZipFile(args.package, 'w', zipfile.ZIP_DEFLATED) as z:
            for fn in os.listdir(args.out):
                z.write(os.path.join(args.out, fn), arcname=fn)
        print(f'✓ 已打包 -> {os.path.abspath(args.package)}')


if __name__ == '__main__':
    main()
