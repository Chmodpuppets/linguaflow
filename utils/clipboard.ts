/**
 * 剪贴板写入（带非 secure context 降级）。
 *
 * `navigator.clipboard` 只在 secure context（HTTPS / localhost）可用。
 * 线上以 `http://<公网 IP>` 访问时 `navigator.clipboard` 为 undefined，
 * 直接 `await navigator.clipboard.writeText()` 会抛 TypeError。
 *
 * 降级策略：
 * 1. 优先 `navigator.clipboard.writeText`（现代浏览器，异步权限 API）；
 * 2. 失败或不可用 → `document.execCommand('copy')`（选中文本 + execCommand，全环境可用）；
 * 3. 都失败 → 抛错，由调用方兜底提示用户手动复制。
 */

/** 复制文本到剪贴板，返回是否成功。 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // 1. 现代 API
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 权限被拒或非 secure context → 落到 execCommand */
  }

  // 2. 传统 execCommand
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    // 放到视口外但仍可聚焦，否则 iOS Safari 不弹复制菜单
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export default copyToClipboard;
