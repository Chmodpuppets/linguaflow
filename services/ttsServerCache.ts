/**
 * TTS 音频的服务端缓存层（同源 `/tts/audio`）。
 *
 * 为什么存在：Qwen3-TTS 把音频放在 `dashscope-result-bj.oss-cn-beijing.aliyuncs.com`，
 * 该 CDN **不返回 CORS 头**，浏览器 `fetch()` 拿不到字节 —— `<audio src>` 能播，
 * 但无法存进 IndexedDB，于是只能存 24h 预签名 URL，过期就得重新合成（重新花额度）。
 *
 * 走同源中转后：
 * - `GET  /tts/audio?text&voice` 命中就回音频字节（设备间共享，0 次 AI 调用）；
 * - `POST /tts/audio` 把刚合成的音频推给服务端落 OSS，并把字节回给我们存本地。
 *
 * 服务端对象 key 是内容寻址的（sha256("v1|voice|text")），所以 GET 不需要任何
 * 协商 —— 同一个词在任何设备上算出来都是同一个地址。
 *
 * 全函数都不抛异常：失败一律返回 null，调用方退回「浏览器直连 Qwen」的原路径。
 */
import { isServerReady, serverApi, authHeaders } from './serverBridge';

/** 单条音频上限，与服务端 TTS_MAX_BYTES 对齐 */
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/** 服务端音频缓存是否可用（开源版 / 未登录 = false，全部降级为纯本地） */
export const isTtsServerEnabled = (): boolean => isServerReady();

/** 同源永久音频地址；未命中返回 404，调用方据此去合成 */
export const serverTtsUrl = (text: string, voice: string): string =>
  `${serverApi('/tts/audio')}?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;

const toAudioBlob = async (res: Response): Promise<Blob | null> => {
  if (!res.ok) return null;
  const blob = await res.blob().catch(() => null);
  return blob && blob.size > 0 && blob.size <= MAX_AUDIO_BYTES ? blob : null;
};

/** 读服务端缓存（别的设备 / 别的用户合成过的词）。未命中返回 null。 */
export const fetchTtsFromServer = async (text: string, voice: string): Promise<Blob | null> => {
  if (!isTtsServerEnabled() || !text) return null;
  try {
    const res = await fetch(serverTtsUrl(text, voice), { headers: authHeaders() });
    return await toAudioBlob(res);
  } catch {
    return null;
  }
};

/**
 * 把刚合成的音频推给服务端（落 OSS），并把音频字节带回来供本地 IndexedDB 存。
 * `src` 优先（DashScope 预签名 URL）；没有 URL 时用 `data`（base64）。
 */
export const pushTtsToServer = async (
  text: string,
  voice: string,
  payload: { src?: string; data?: string; contentType?: string }
): Promise<Blob | null> => {
  if (!isTtsServerEnabled() || !text) return null;
  if (!payload.src && !payload.data) return null;
  try {
    const res = await fetch(serverApi('/tts/audio'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, voice, ...payload }),
    });
    return await toAudioBlob(res);
  } catch {
    return null;
  }
};
