/**
 * 词库真人录音（Word Atlas · 词光，CC BY 4.0）——与 LinguaFlow Reader 共用同一份 OSS 录音，
 * 让 reader / LinguaFlow / Pathmora 的「单词发音」统一到同一批真人录音。
 *
 * 索引随构建镜像到本机 `public/atlas/index.json`（同源、无 CORS、离线可查）；
 * 录音从自有 OSS 按需播放（`<audio>` 直接播放不强制 CORS）。
 * 不在词库（7298 词）里的词返回 null，调用方回退各自原有的 TTS（有道 / Edge / 浏览器）。
 *
 * 索引 words 元组：[id, word, 释义, 音标, cefrIdx, topicIdx, media]；
 * media 位：IMG=1, UK=2, US=4, EX=8, EX2=16（与 reader src/lib/wordAtlas.ts 一致）。
 */
const ATLAS_AUDIO_BASE = "https://pathmora.oss-cn-beijing.aliyuncs.com/atlas/v1/audio";
const MEDIA_UK = 2;
const MEDIA_US = 4;

interface AtlasIndexEntry {
  id: string;
  media: number;
}

let indexPromise: Promise<Map<string, AtlasIndexEntry>> | null = null;

function normalizeKey(word: string): string {
  return word.toLowerCase().trim().replace(/\s+/g, " ");
}

function loadIndex(): Promise<Map<string, AtlasIndexEntry>> {
  if (!indexPromise) {
    const base = (import.meta.env?.BASE_URL || "/").replace(/\/+$/, "/");
    indexPromise = fetch(`${base}atlas/index.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { words?: unknown[][] } | null) => {
        const map = new Map<string, AtlasIndexEntry>();
        for (const row of j?.words ?? []) {
          if (!Array.isArray(row)) continue;
          const id = String(row[0] ?? "");
          const media = Number(row[6]) || 0;
          if (!id) continue;
          const entry = { id, media };
          map.set(normalizeKey(String(row[1] ?? id)), entry);
          if (row[0] !== row[1]) map.set(normalizeKey(id), entry);
        }
        return map;
      })
      .catch(() => new Map<string, AtlasIndexEntry>());
  }
  return indexPromise;
}

/**
 * 返回该词在词库里的真人录音 URL（按 accent 优先，另外一腔兜底）；无录音返回 null。
 * 仅单个英文词有录音；短语 / 含空格 / 非英文词直接 null。
 */
export async function atlasWordRecording(
  word: string,
  accent: "uk" | "us" = "us"
): Promise<string | null> {
  const w = normalizeKey(word);
  if (!/^[a-z][a-z'-]*$/.test(w)) return null;
  const entry = (await loadIndex()).get(w);
  if (!entry) return null;
  const order: ("uk" | "us")[] = accent === "uk" ? ["uk", "us"] : ["us", "uk"];
  for (const a of order) {
    const bit = a === "uk" ? MEDIA_UK : MEDIA_US;
    if (entry.media & bit) return `${ATLAS_AUDIO_BASE}/${a}/${entry.id}.mp3`;
  }
  return null;
}
