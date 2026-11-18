/**
 * `POST /tts/edge` —— 免费 Azure Neural TTS 的公开代理（无需登录、无需 API Key）。
 *
 * 和 `/tts/audio`（Qwen 那条）的关系：
 * - `/tts/audio` 是**用户自己的 Qwen Key** 合成后的落盘/回传通道，带鉴权；
 * - `/tts/edge` 是**服务端自己合成**，所以必须公开 —— 纯静态的 LinguaFlow Reader
 *   没有登录态，也要能拿到音频。代价是可能被刷，所以按 IP 限流 + 文本长度上限。
 *
 * 缓存和 Qwen 共用同一套 OSS 内容寻址（不同 namespace），所以一句常见例句
 * 全站只会被真正合成一次；这也是「免费」能撑住的主要原因。
 */
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { readTtsAudio, storeTtsAudio } from './tts';
import { EdgeTtsError, edgeTtsEnabled, synthesizeEdge } from './edgeTts';

/** 和 Qwen 的 `v1` 分开：同一句同一音色名，两条链路的音频字节完全不同 */
const NS = 'edge-v1';
/** 一句/一段的上限；再长就拆段在前端做（浏览器 SpeechSynthesis 也是这量级） */
const MAX_TEXT = 1200;
const MAX_VOICE = 80;

const CORS_HEADERS: Record<string, string> = {
  // Reader 跑在另一个域名（reader.pathmora.cn），要拿字节存 IndexedDB 就必须有 CORS 头
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Tts-Cache, X-Tts-Provider',
};

const withCors = (headers: Record<string, string> = {}): Record<string, string> => ({ ...CORS_HEADERS, ...headers });

export interface EdgeTtsRouteDeps {
  clientIp: (c: Context<any, any, any>) => string;
  /** true = 该 IP 超限 */
  rateLimited: (ip: string) => boolean;
}

export const registerEdgeTtsRoutes = (app: Hono<any>, deps: EdgeTtsRouteDeps): void => {
  // 预检：Reader 跨域 POST JSON
  app.options('/tts/edge', (c) => c.body(null, 204, withCors()));

  app.post('/tts/edge', async (c) => {
    if (!edgeTtsEnabled()) {
      return c.json({ error: '本部署未启用 Edge TTS（EDGE_TTS=0）', code: 'DISABLED' }, 503, withCors());
    }
    if (deps.rateLimited(deps.clientIp(c))) {
      return c.json({ error: 'too many requests', code: 'RATE_LIMITED' }, 429, withCors());
    }

    const body = await c.req.json().catch(() => null);
    const text = String(body?.text || '').trim().slice(0, MAX_TEXT);
    const voice = String(body?.voice || '').trim().slice(0, MAX_VOICE);
    if (!text) return c.json({ error: 'text required', code: 'BAD_REQUEST' }, 400, withCors());
    if (!voice) return c.json({ error: 'voice required', code: 'BAD_REQUEST' }, 400, withCors());

    const rateRaw = Number(body?.rate);
    const rate = Number.isFinite(rateRaw) && rateRaw > 0 ? Math.min(2, Math.max(0.5, rateRaw)) : undefined;
    const pitchRaw = Number(body?.pitch);
    const pitch = Number.isFinite(pitchRaw) ? Math.min(50, Math.max(-50, pitchRaw)) : undefined;

    // ① 全站缓存：别的用户合成过就直接回字节，0 次上游请求
    const hit = await readTtsAudio(text, voice, NS);
    if (hit) {
      return c.body(hit.buf as any, 200, withCors({
        'Content-Type': hit.contentType,
        'Content-Length': String(hit.buf.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Tts-Cache': 'hit',
        'X-Tts-Provider': 'edge',
      }));
    }

    // ② 真合成
    try {
      const result = await synthesizeEdge({ text, voice, rate, pitch });
      // 落盘失败不影响这次回传（只是下次还要再合成一次）
      void storeTtsAudio(text, voice, result.audio, result.contentType, NS);
      return c.body(result.audio as any, 200, withCors({
        'Content-Type': result.contentType,
        'Content-Length': String(result.audio.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Tts-Cache': 'miss',
        'X-Tts-Provider': 'edge',
      }));
    } catch (err) {
      const e = err instanceof EdgeTtsError ? err : null;
      if (e?.kind === 'bad-voice') {
        // 音色不在免费端点的清单里：这是配置/选型问题，不是临时故障，别让前端重试
        return c.json(
          { error: e.message, code: 'VOICE_UNAVAILABLE' },
          400,
          withCors({ 'Cache-Control': 'no-store' })
        );
      }
      console.warn('[tts/edge] synthesis failed:', err);
      return c.json(
        { error: e?.message || 'upstream synthesis failed', code: e?.kind === 'timeout' ? 'TIMEOUT' : 'UPSTREAM' },
        502,
        withCors({ 'Cache-Control': 'no-store' })
      );
    }
  });
};
