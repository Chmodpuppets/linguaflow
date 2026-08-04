/**
 * 共享 TTS URL 缓存（按文本键）。
 *
 * 多个视图（TypingView 的复读播放器、RPGView 的对话气泡朗读、未来的
 * 单词/字形/引导写作等）都通过这个缓存复用 Qwen 合成结果：
 * 同一段文本第二次点播放 → 0 API 调用，秒播。
 *
 * 设计要点：
 * - 键是 `text + "||" + voice`，不同音色视为不同条目（避免误用错声）。
 * - 简单 LRU：超过 16 条删最旧，足够日常使用、不爆内存。
 * - 缓存命中只反 URL；不持有 Audio 元素，调用方自己 new Audio() 控制播放。
 * - 不在 localStorage 持久化（URL 通常 24h 过期；持久化反而会拿到失效链接）。
 */
const MAX_ENTRIES = 16;

const cache = new Map<string, string>();

function keyOf(text: string, voice?: string): string {
  return `${voice || ""}||${text}`;
}

export function getCachedTtsUrl(text: string, voice?: string): string | null {
  const k = keyOf(text, voice);
  const v = cache.get(k);
  if (v) {
    // 命中后移到末尾（LRU refresh）
    cache.delete(k);
    cache.set(k, v);
  }
  return v ?? null;
}

export function setCachedTtsUrl(text: string, voice: string | undefined, url: string): void {
  const k = keyOf(text, voice);
  if (cache.has(k)) cache.delete(k);
  cache.set(k, url);
  // 简单 LRU：超长删最旧
  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

/** 命中即返 URL；未命中同步去拉 Qwen 并写入缓存。失败返回 null。 */
export async function getOrFetchTtsUrl(text: string, voice?: string): Promise<string | null> {
  const hit = getCachedTtsUrl(text, voice);
  if (hit) return hit;
  // 通过 fetchSpeechUrl（内部已经 try/catch + key 校验）
  const { fetchSpeechUrl } = await import("./aiService");
  const url = await fetchSpeechUrl(text, voice);
  if (url) setCachedTtsUrl(text, voice, url);
  return url;
}

/** 清空缓存（切换语言、登出等场景调用）。 */
export function clearTtsCache(): void {
  cache.clear();
}

/** 删除单条（URL 过期 / 加载失败时调用，让用户重试时重新合成）。 */
export function deleteCachedTtsUrl(text: string, voice?: string): void {
  cache.delete(keyOf(text, voice));
}
