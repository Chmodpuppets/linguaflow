/**
 * 免费 Azure Neural TTS（Edge 朗读端点）—— 服务端合成，零 API Key。
 *
 * 为什么自己写协议而不装 `msedge-tts`：
 * 它为了兼容浏览器把 axios / stream-browserify / buffer 全拖进来了（对一个 2C/1.7G
 * 的小机器不友好）；这里只依赖 `ws`，核心 200 行就够，且合成/重试/超时都要按自己的
 * 语义来（我们要求「失败就快速抛，让上层回退」，不要包一层永远不 reject 的流）。
 *
 * 协议要点（2026-11 仍然有效）：
 * 1. `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
 *    需要 `Sec-MS-GEC` 令牌：v2 = `<CS64 校验和>-<SHA256(版权声明 + ticks + token)>`，
 *    ticks 是 Windows FILETIME（Unix 秒 + 11644473600）向下取整到 300 秒 * 10^7。
 * 2. 握手必须带浏览器头（Origin / User-Agent），裸 WebSocket 会被 403 —— 所以在
 *    Node 侧用 `ws`（原生 global WebSocket 不能设 header）。
 * 3. 文本帧是「头部 + `\r\n\r\n` + 载荷」：先发 `Path:speech.config` 配输出格式，
 *    再发 `Path:ssml` 送 SSML；二进制帧前 2 字节是头部长度，头部含 `Path:audio`
 *    的载荷就是 mp3 片段，拼起来即完整音频；收到 `Path:turn.end` 视为完成。
 * 4. 音色不在这个端点的清单里时，服务端不报错、直接关流 —— 表现为「没有 turn.end」，
 *    所以这里显式维护音色白名单（启动时拉一次，缓存 24h），别让用户等到超时。
 *
 * 版权：Sec-MS-GEC v2 的 CS64 算法参考 msedge-tts（MIT，
 * https://github.com/Migushthe2nd/MsEdgeTTS），按其许可保留署名。
 */
import { createHash, randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const EDGE_COPYRIGHT = 'Copyright (C) Microsoft Corporation. All rights reserved.';
/** 和端点商定的版本号；微软改版只影响令牌算法，改这里没用，要改下面的 hashSecMsGec */
const SEC_MS_GEC_VERSION = '2-143.0.3650.96';

/** 24kHz/48kbps mono mp3：语音场景够用，体积是 16kHz 的一半左右 */
export const EDGE_TTS_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
export const EDGE_TTS_CONTENT_TYPE = 'audio/mpeg';

/** 单次合成的文本上限：SSML 过大端点会直接断流，500 字已远超一句/一段的合理长度 */
const MAX_TEXT = 2000;
const DEFAULT_TIMEOUT_MS = 15000;
const VOICE_CACHE_MS = 24 * 3600 * 1000;

export interface EdgeBoundary {
  /** 文本片段（词） */
  text: string;
  /** 相对音频起点的毫秒偏移 */
  offsetMs: number;
  durationMs: number;
}

export interface EdgeSynthesisResult {
  audio: Uint8Array;
  contentType: string;
  /** word boundary 时间戳，可用于逐词高亮；端点没给就是空数组 */
  boundaries: EdgeBoundary[];
}

export interface EdgeSynthesisOptions {
  text: string;
  /** Azure 音色名，如 en-US-JennyNeural */
  voice: string;
  /** 语速倍率：1 = 正常，0.5 = 慢一半，2 = 快一倍 */
  rate?: number;
  /** 音调，-50..50（百分比，0 = 原调） */
  pitch?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class EdgeTtsError extends Error {
  constructor(message: string, readonly kind: 'bad-voice' | 'network' | 'timeout' | 'protocol' | 'empty') {
    super(message);
    this.name = 'EdgeTtsError';
  }
}

// ==================== Sec-MS-GEC（v2） ====================

const SWAP_FIRST_WORD = { swappedWord: 0xef0569fb, swappedSum: 0x76f50f34, swappedProduct: 0xc3efea97 };
const SWAP_SECOND_WORD = { swappedWord: 0xc31713db, swappedSum: 0x1881ce3c, swappedProduct: 0x35bd1ec9 };
const MIX_FIRST_WORD = [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83];
const MIX_SECOND_WORD = [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69];

const swapHalves = (v: number) => ((v << 16) | (v >>> 16)) >>> 0;

const swapTerm = (word: number, key: number, m: { swappedWord: number; swappedSum: number; swappedProduct: number }) => {
  const sum = Math.imul(word, key) + Math.imul(swapHalves(word), m.swappedWord);
  const product = Math.imul(swapHalves(sum), m.swappedSum) >>> 0;
  return (Math.imul(swapHalves(product), m.swappedProduct) + product) >>> 0;
};

const swapAndMultiply = (value: number, multipliers: number[]) => {
  let v = value;
  for (const m of multipliers) v = Math.imul(swapHalves(v), m) >>> 0;
  return v;
};

const toUpperHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** MS 自定义的 64 位校验和：把消息按 8 字节一组做位混合，结果和时间戳的 SHA-256 拼起来 */
const cs64 = (message: Uint8Array, digest: Uint8Array): Uint8Array => {
  const digestView = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const firstKey = (digestView.getUint32(0, true) | 1) >>> 0;
  const secondKey = (digestView.getUint32(4, true) | 1) >>> 0;

  const padded = new Uint8Array(Math.ceil(message.length / 8) * 8);
  padded.set(message);
  const words = new DataView(padded.buffer);

  let swapSum = 0;
  let lastSwap = 0;
  let mix = 0;
  let mixSum = 0;
  for (let offset = 0; offset < padded.length; offset += 8) {
    const firstWord = words.getUint32(offset, true);
    const secondWord = words.getUint32(offset + 4, true);
    const firstSwap = swapTerm(firstWord, firstKey, SWAP_FIRST_WORD);
    lastSwap = swapTerm(secondWord, secondKey, SWAP_SECOND_WORD);
    swapSum = (swapSum + firstSwap + lastSwap) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + firstWord, firstKey), MIX_FIRST_WORD);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + secondWord, secondKey), MIX_SECOND_WORD);
    mixSum = (mixSum + mix) >>> 0;
  }

  const checksum = new Uint8Array(8);
  const view = new DataView(checksum.buffer);
  view.setUint32(0, lastSwap ^ mix, true);
  view.setUint32(4, swapSum ^ mixSum, true);
  return checksum;
};

/** 生成 `Sec-MS-GEC`（v2）。300 秒一档，所以同一档内的令牌可复用，但这里每次都现算。 */
export const hashSecMsGec = (now = Date.now()): string => {
  const ticks = Math.floor((now / 1000 + 11644473600) / 300) * 300 * 1e7;
  const message = new TextEncoder().encode(`${EDGE_COPYRIGHT}${ticks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = new Uint8Array(
    // node:crypto 的 hash 是同步的，但为了和 msedge-tts 的参考实现逐字节一致，统一走 WebCrypto
    // 也没必要；这里直接用 sha256，结果为同一串字节。
    createHash('sha256').update(message).digest()
  );
  return `${toUpperHex(cs64(message, digest))}-${toUpperHex(digest)}`;
};

// ==================== 音色白名单 ====================

let voiceCache: { names: Set<string>; at: number } | null = null;

/** 拉一次端点的音色清单并缓存 24h；失败不抛，返回 null（调用方降级为「只做格式校验」） */
const loadEdgeVoiceNames = async (): Promise<Set<string> | null> => {
  const now = Date.now();
  if (voiceCache && now - voiceCache.at < VOICE_CACHE_MS) return voiceCache.names;
  const res = await fetch(VOICES_URL, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return voiceCache?.names ?? null;
  const list = (await res.json().catch(() => null)) as Array<{ ShortName?: string }> | null;
  if (!Array.isArray(list)) return voiceCache?.names ?? null;
  const names = new Set(list.map((v) => String(v.ShortName || '')).filter(Boolean));
  if (names.size > 0) voiceCache = { names, at: now };
  return names.size > 0 ? names : null;
};

const VOICE_PATTERN = /^[a-z]{2,3}-[A-Z]{2}(-[A-Za-z]{2,})?-[A-Za-z]{3,}Neural$/;

/**
 * 音色是否可用于免费端点。
 * 清单拉不到时只做格式校验（宁可让请求发出去失败，也不要因为清单接口抽风就全站禁音）。
 */
export const isSupportedEdgeVoice = async (voice: string): Promise<boolean> => {
  if (!VOICE_PATTERN.test(voice)) return false;
  const names = await loadEdgeVoiceNames();
  return names ? names.has(voice) : true;
};

/** 预热音色清单（服务启动时调用，避免第一个请求多等一次 HTTP） */
export const warmEdgeVoices = async (): Promise<number | null> => {
  const names = await loadEdgeVoiceNames();
  return names ? names.size : null;
};

// ==================== SSML ====================

const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const buildSsml = (text: string, voice: string, rate?: number, pitch?: number): string => {
  const locale = voice.split('-').slice(0, 2).join('-');
  const ratePct = typeof rate === 'number' && Number.isFinite(rate)
    ? Math.round((clamp(rate, 0.5, 2) - 1) * 100)
    : 0;
  const pitchPct = typeof pitch === 'number' && Number.isFinite(pitch) ? Math.round(clamp(pitch, -50, 50)) : 0;
  const prosody = `rate="${ratePct >= 0 ? '+' : ''}${ratePct}%" pitch="${pitchPct >= 0 ? '+' : ''}${pitchPct}%"`;
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'>` +
    `<voice name='${voice}'><prosody ${prosody}>${escapeXml(text)}</prosody></voice></speak>`
  );
};

// ==================== 合成 ====================

const buildUrl = (): string =>
  `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
  `&Sec-MS-GEC=${hashSecMsGec()}` +
  `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
  `&ConnectionId=${randomUUID().replace(/-/g, '')}`;

const BROWSER_HEADERS = {
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface RawResult {
  audio: Uint8Array;
  boundaries: EdgeBoundary[];
}

/** 单次连接合成；不重试（重试交给 synthesizeEdge，令牌过期要换新 URL） */
const synthesizeOnce = (options: Required<Pick<EdgeSynthesisOptions, 'text' | 'voice'>> & {
  rate?: number;
  pitch?: number;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<RawResult> =>
  new Promise<RawResult>((resolve, reject) => {
    const { text, voice, rate, pitch, timeoutMs, signal } = options;
    const chunks: Buffer[] = [];
    const boundaries: EdgeBoundary[] = [];
    const ws = new WebSocket(buildUrl(), { headers: BROWSER_HEADERS });

    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (err: Error | null, value?: RawResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      try {
        ws.close();
      } catch {
        /* 已经关了，忽略 */
      }
      if (err) reject(err);
      else resolve(value!);
    };

    const onAbort = () => finish(new EdgeTtsError('client aborted', 'network'));
    signal?.addEventListener('abort', onAbort, { once: true });

    timer = setTimeout(
      () => finish(new EdgeTtsError(`synthesis timed out after ${timeoutMs}ms`, 'timeout')),
      timeoutMs
    );

    ws.on('unexpected-response', (_req, res) => {
      // 403 基本只有一种原因：Sec-MS-GEC 过期/时钟漂移，上层会用新令牌重试一次
      finish(new EdgeTtsError(`upstream HTTP ${res.statusCode}`, 'network'));
    });

    ws.on('open', () => {
      const timestamp = new Date().toString();
      ws.send(
        `X-Timestamp:${timestamp}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'true' },
                  outputFormat: EDGE_TTS_FORMAT,
                },
              },
            },
          })
      );
      ws.send(
        `X-RequestId:${randomUUID().replace(/-/g, '')}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${timestamp}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          buildSsml(text, voice, rate, pitch)
      );
    });

    ws.on('message', (data, isBinary) => {
      // 文本帧：turn.start / audio.metadata / turn.end
      if (!isBinary) {
        const line = data.toString('utf8');
        if (line.includes('Path:turn.end')) {
          const audio = Buffer.concat(chunks);
          if (audio.length === 0) {
            // 音色不在这条端点的清单里时就是这个表现：握手成功、流直接关掉
            finish(new EdgeTtsError('empty audio (voice not served by the free endpoint?)', 'bad-voice'));
          } else {
            finish(null, { audio: new Uint8Array(audio), boundaries });
          }
          return;
        }
        if (line.includes('Path:audio.metadata')) {
          const payload = line.slice(line.indexOf('{"'));
          try {
            const meta = JSON.parse(payload) as { Metadata?: Array<{ Type?: string; Data?: any }> };
            for (const item of meta.Metadata || []) {
              if (item?.Type !== 'WordBoundary' || !item.Data) continue;
              boundaries.push({
                text: String(item.Data.text || ''),
                offsetMs: Math.round(Number(item.Data.Offset || 0) / 10000),
                durationMs: Math.round(Number(item.Data.Duration || 0) / 10000),
              });
            }
          } catch {
            /* 元数据解析失败不影响音频 */
          }
        }
        return;
      }

      const buf = Buffer.from(data as Buffer);
      if (buf.length < 2) return;
      const headerLength = buf.readUInt16BE(0);
      if (buf.length < 2 + headerLength) return;
      const header = buf.subarray(2, 2 + headerLength).toString('utf8');
      if (!header.includes('Path:audio')) return;
      const payload = buf.subarray(2 + headerLength);
      if (payload.length > 0) chunks.push(payload);
    });

    ws.on('error', (err) => finish(new EdgeTtsError(`websocket error: ${(err as Error).message}`, 'network')));

    ws.on('close', () => {
      // 正常路径已经在 turn.end 里 resolve；走到这里说明流被提前关掉
      finish(new EdgeTtsError('stream closed before turn.end', 'protocol'));
    });
  });

/**
 * 合成一段语音。
 *
 * 失败语义：抛 `EdgeTtsError`，调用方据此决定回退（Qwen / Web Speech）还是报错。
 * 唯一一次内部重试针对 403（令牌档位跨越 / 时钟漂移），其余错误重试无意义。
 */
export const synthesizeEdge = async (options: EdgeSynthesisOptions): Promise<EdgeSynthesisResult> => {
  const text = (options.text || '').trim().slice(0, MAX_TEXT);
  const voice = (options.voice || '').trim();
  if (!text) throw new EdgeTtsError('text required', 'empty');
  if (!voice) throw new EdgeTtsError('voice required', 'bad-voice');
  if (!(await isSupportedEdgeVoice(voice))) {
    throw new EdgeTtsError(`voice not available on the free endpoint: ${voice}`, 'bad-voice');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempt = () =>
    synthesizeOnce({ text, voice, rate: options.rate, pitch: options.pitch, timeoutMs, signal: options.signal });

  let lastError: unknown;
  for (let i = 0; i < 2; i += 1) {
    try {
      const result = await attempt();
      return { audio: result.audio, contentType: EDGE_TTS_CONTENT_TYPE, boundaries: result.boundaries };
    } catch (err) {
      lastError = err;
      const kind = err instanceof EdgeTtsError ? err.kind : 'network';
      if (kind === 'bad-voice' || kind === 'empty' || options.signal?.aborted) throw err;
      // 只有网络/协议类才值得换令牌再试一次
      if (i === 1) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new EdgeTtsError('unknown error', 'network');
};

/** 是否启用（环境变量 EDGE_TTS=0 可整体关掉，回到纯 Qwen） */
export const edgeTtsEnabled = (): boolean => !/^(0|false|no|off)$/i.test((process.env.EDGE_TTS || '1').trim());
