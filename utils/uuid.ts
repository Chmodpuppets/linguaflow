/**
 * 统一 UUID 生成（RFC 4122 v4 格式）。
 *
 * 为什么不用 `crypto.randomUUID()`：
 * 该 API **只在 secure context 可用**（HTTPS，或 http://localhost）。
 * 线上以 `http://<公网 IP>` 访问时 `isSecureContext === false`，
 * 直接调用会抛 `crypto.randomUUID is not a function`，
 * 导致注册流程在写 localStorage 前中断（用户表现为「卡在欢迎页」）。
 *
 * 降级策略：
 * 1. 优先用原生 `crypto.randomUUID()`（secure context 下最简洁）；
 * 2. 否则用 `crypto.getRandomValues()`（非 secure context **仍可用**）拼装 v4 UUID；
 * 3. 最后用 `Math.random()` 兜底（极端降级环境，仍保证唯一性足够）。
 *
 * 统一走本函数，项目内不再直接调用 `crypto.randomUUID`。
 */

const HEX = '0123456789abcdef';

const randomBytes = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  const g = globalThis.crypto;
  if (g && typeof g.getRandomValues === 'function') {
    g.getRandomValues(buf);
    return buf;
  }
  // 最终兜底：Math.random（不用于安全场景，仅保证 id 唯一）
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
};

/** 生成 v4 格式 UUID（8-4-4-4-12），带 RFC 4122 版本号与 variant 位。 */
export const uuid = (): string => {
  const g = globalThis.crypto;
  if (g && typeof g.randomUUID === 'function') {
    try {
      return g.randomUUID();
    } catch {
      /* 落到下面的手写实现 */
    }
  }

  const b = randomBytes(16);
  // version = 4
  b[6] = (b[6] & 0x0f) | 0x40;
  // variant = 10xx
  b[8] = (b[8] & 0x3f) | 0x80;

  let s = '';
  for (let i = 0; i < 16; i++) {
    s += HEX[b[i]];
    if (i === 3 || i === 5 || i === 7 || i === 9) s += '-';
  }
  return s;
};

export default uuid;
