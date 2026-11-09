/**
 * TTS 音频代理 + 阿里云 OSS 永久落盘。
 *
 * 为什么需要它：
 * Qwen3-TTS 返回的音频在 `dashscope-result-bj.oss-cn-beijing.aliyuncs.com` 上，
 * 该 CDN **不返回 Access-Control-Allow-Origin**，浏览器 `fetch()` 抓不到 Blob
 * （`<audio src>` 能播，但要存进 IndexedDB 必须拿到字节）。于是只存了 24h 预签名
 * URL，过期就得重新调接口、重新花额度。
 *
 * 同源 `/api/tts/audio` 中转后有两个收益：
 * 1. 浏览器能拿到 Blob → 本地 IndexedDB 永久缓存，刷新/换网络都 0 请求；
 * 2. 服务端顺手把音频 PUT 到 OSS → 跨设备、跨用户复用，事实上永不重合成。
 *
 * 对象定位是**内容寻址**的：key = sha256("v1|<voice>|<text>")。所以同一个词
 * 在任何设备上算出的 key 都一样，直接 GET 就能命中，不需要先查库。
 *
 * 依赖为零：阿里云 OSS 的 V1 签名就是 HMAC-SHA1，手写 20 行比拉 10MB 的
 * ali-oss SDK 划算（线上是 2C/1.7G 的小机器）。
 */
import { createHash, createHmac } from 'node:crypto';
import type { Context, Hono, MiddlewareHandler } from 'hono';

const BUCKET = (process.env.OSS_BUCKET || '').trim();
const ENDPOINT = (process.env.OSS_ENDPOINT || 'oss-cn-beijing.aliyuncs.com')
  .trim()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');
const AK = (process.env.OSS_ACCESS_KEY_ID || '').trim();
const SK = (process.env.OSS_ACCESS_KEY_SECRET || '').trim();
/** 对象前缀；改前缀等于换一代缓存（旧对象留在 bucket 里，可手动清） */
const PREFIX = (process.env.OSS_TTS_PREFIX || 'tts/v1/').trim().replace(/^\/+/, '');
/** 单条音频上限：Qwen TTS 一句话 ~20-60KB，5MB 已极宽松 */
const MAX_AUDIO = Number(process.env.TTS_MAX_BYTES || 5 * 1024 * 1024);
/** 允许中转抓取的域名后缀（防 SSRF：不配就只放行阿里云 OSS/CDN） */
const ALLOW_HOSTS = (process.env.TTS_ALLOW_HOSTS || '.aliyuncs.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const ossEnabled = (): boolean => !!(BUCKET && AK && SK);

/** OSS V1 签名（无 sub-resource、无 x-oss-* 头，StringToSign 简化为 5 行） */
const authHeaders = (method: string, key: string, contentType = ''): Record<string, string> => {
  const date = new Date().toUTCString();
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${BUCKET}/${key}`;
  const signature = createHmac('sha1', SK).update(stringToSign, 'utf8').digest('base64');
  const headers: Record<string, string> = {
    Date: date,
    Authorization: `OSS ${AK}:${signature}`,
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
};

const objectUrl = (key: string): string =>
  `https://${BUCKET}.${ENDPOINT}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** 内容寻址 key：同一 (text, voice) 在任何设备上算出来都一样 */
export const ttsObjectKey = (text: string, voice: string): string => {
  const hash = createHash('sha256').update(`v1|${voice}|${text}`, 'utf8').digest('hex').slice(0, 32);
  return `${PREFIX}${hash.slice(0, 2)}/${hash}`;
};

export interface TtsAudio {
  buf: Uint8Array;
  contentType: string;
}

/** 只认音频 MIME，防止把 HTML/JSON 当音频存进去 */
const normalizeContentType = (raw: string | null): string => {
  const ct = (raw || '').split(';')[0].trim().toLowerCase();
  if (ct.startsWith('audio/')) return ct;
  return 'audio/mpeg';
};

// —— 内存热缓存（最近播放过的词，省掉 OSS 往返）——
const MEM_MAX_ENTRIES = Number(process.env.TTS_MEM_ENTRIES || 120);
const MEM_MAX_BYTES = Number(process.env.TTS_MEM_BYTES || 12 * 1024 * 1024);
const mem = new Map<string, TtsAudio & { at: number }>();
let memBytes = 0;

const memGet = (key: string): TtsAudio | null => {
  const hit = mem.get(key);
  if (!hit) return null;
  mem.delete(key);
  mem.set(key, hit); // LRU：命中即刷新位置
  return { buf: hit.buf, contentType: hit.contentType };
};

const memSet = (key: string, buf: Uint8Array, contentType: string): void => {
  const prev = mem.get(key);
  if (prev) {
    memBytes -= prev.buf.byteLength;
    mem.delete(key);
  }
  mem.set(key, { buf, contentType, at: Date.now() });
  memBytes += buf.byteLength;
  // 超限时从最旧开始淘汰
  while ((mem.size > MEM_MAX_ENTRIES || memBytes > MEM_MAX_BYTES) && mem.size > 1) {
    const oldest = mem.keys().next().value as string | undefined;
    if (!oldest) break;
    const rec = mem.get(oldest);
    if (rec) memBytes -= rec.buf.byteLength;
    mem.delete(oldest);
  }
};

const ossGet = async (key: string): Promise<TtsAudio | null> => {
  if (!ossEnabled()) return null;
  const res = await fetch(objectUrl(key), { headers: authHeaders('GET', key) }).catch(() => null);
  if (!res || !res.ok) return null;
  const ab = await res.arrayBuffer().catch(() => null);
  if (!ab || ab.byteLength === 0 || ab.byteLength > MAX_AUDIO) return null;
  return { buf: new Uint8Array(ab), contentType: normalizeContentType(res.headers.get('content-type')) };
};

const ossPut = async (key: string, buf: Uint8Array, contentType: string): Promise<boolean> => {
  if (!ossEnabled()) return false;
  const res = await fetch(objectUrl(key), {
    method: 'PUT',
    headers: authHeaders('PUT', key, contentType),
    body: buf,
  }).catch(() => null);
  return !!res?.ok;
};

/** 读缓存：内存 → OSS。未命中返回 null（调用方据此回 404，由前端去合成）。 */
export const readTtsAudio = async (text: string, voice: string): Promise<TtsAudio | null> => {
  const key = ttsObjectKey(text, voice);
  const hot = memGet(key);
  if (hot) return hot;
  const cold = await ossGet(key);
  if (cold) memSet(key, cold.buf, cold.contentType);
  return cold;
};

/**
 * 把音频同时写进内存和 OSS。
 * OSS 失败不算错误：POST 仍然把字节回给前端，只是这次没落盘（下次再来一次）。
 */
export const storeTtsAudio = async (
  text: string,
  voice: string,
  buf: Uint8Array,
  contentType: string
): Promise<{ key: string; stored: boolean }> => {
  const key = ttsObjectKey(text, voice);
  memSet(key, buf, contentType);
  const stored = await ossPut(key, buf, contentType);
  return { key, stored };
};

/** 从上游（DashScope CDN）抓音频；域名白名单 + 体积上限，防被当成开放代理 */
export const pullUpstream = async (src: string): Promise<TtsAudio | null> => {
  let host = '';
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  const allowed = ALLOW_HOSTS.some((suffix) =>
    suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix
  );
  if (!allowed) return null;

  const res = await fetch(src, { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!res || !res.ok) return null;
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_AUDIO) return null;
  const ab = await res.arrayBuffer().catch(() => null);
  if (!ab || ab.byteLength === 0 || ab.byteLength > MAX_AUDIO) return null;
  return { buf: new Uint8Array(ab), contentType: normalizeContentType(res.headers.get('content-type')) };
};

/** Qwen 直接返回 base64（部分模式）时的路径：解码后同样落盘 */
export const decodeBase64Audio = (data: string, contentType?: string): TtsAudio | null => {
  try {
    const clean = data.replace(/^data:[^,]*,/, '');
    const buf = Buffer.from(clean, 'base64');
    if (buf.byteLength === 0 || buf.byteLength > MAX_AUDIO) return null;
    return { buf: new Uint8Array(buf), contentType: normalizeContentType(contentType || 'audio/mpeg') };
  } catch {
    return null;
  }
};

// ==================== 路由 ====================

// Hono 的 Data 类型只写了 string | ArrayBuffer | ReadableStream，
// 但 Response 本身接受 Uint8Array —— 这里直接给字节，不必多包一层。
const audioResponse = <C extends Context<any, any, any>>(c: C, audio: TtsAudio) =>
  c.body(audio.buf as any, 200, {
    'Content-Type': audio.contentType,
    'Content-Length': String(audio.buf.byteLength),
    // 内容是内容寻址的，永不改变 → 浏览器可长缓存；也免了 Range 请求的复杂度
    'Cache-Control': 'public, max-age=31536000, immutable',
  });

export interface TtsRouteDeps {
  /** 鉴权中间件（复用主应用的 Bearer token 校验） */
  auth: MiddlewareHandler<any>;
  /** 取客户端 IP（复用主应用的 x-forwarded-for 解析） */
  clientIp: (c: Context<any, any, any>) => string;
  /** 限流：true = 超限（复用主应用的计数器，按 IP 每小时） */
  rateLimited: (ip: string) => boolean;
}

/**
 * 挂载 `/tts/audio`（GET 读缓存 / POST 落 OSS 并回流字节）。
 * 拆成独立注册函数是为了能在无数据库的环境里单独测。
 */
export const registerTtsRoutes = (app: Hono<any>, deps: TtsRouteDeps): void => {
  app.get('/tts/audio', deps.auth, async (c) => {
    if (deps.rateLimited(deps.clientIp(c))) return c.json({ error: 'too many requests' }, 429);
    const text = String(c.req.query('text') || '').slice(0, 500);
    const voice = String(c.req.query('voice') || '').slice(0, 32);
    if (!text) return c.json({ error: 'text required' }, 400);
    const hit = await readTtsAudio(text, voice);
    // 404 是设计内结果：表示「还没人合成过」，前端据此去调 Qwen
    if (!hit) return c.json({ error: 'not cached', oss: ossEnabled() }, 404);
    return audioResponse(c, hit);
  });

  app.post('/tts/audio', deps.auth, async (c) => {
    if (deps.rateLimited(deps.clientIp(c))) return c.json({ error: 'too many requests' }, 429);
    const body = await c.req.json().catch(() => null);
    const text = String(body?.text || '').slice(0, 500);
    const voice = String(body?.voice || '').slice(0, 32);
    if (!text) return c.json({ error: 'text required' }, 400);

    const src = String(body?.src || '').slice(0, 2048);
    const b64 = String(body?.data || '').slice(0, 8 * 1024 * 1024);
    const audio = src ? await pullUpstream(src) : b64 ? decodeBase64Audio(b64, body?.contentType) : null;
    if (!audio) return c.json({ error: '无法获取音频（仅允许阿里云 OSS/CDN 地址）' }, 400);

    const { stored } = await storeTtsAudio(text, voice, audio.buf, audio.contentType);
    // 落盘失败也把字节回给前端：代理本身仍然解决了 CORS，只是这次没存进 OSS
    c.header('X-Tts-Stored', stored ? '1' : '0');
    return audioResponse(c, audio);
  });
};

