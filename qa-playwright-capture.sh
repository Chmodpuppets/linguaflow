#!/usr/bin/env bash
# LinguaFlow — Playwright 截图回归脚手架
# 用法：
#   1) 先起 dev server：npm run dev   （默认 127.0.0.1:3011）
#   2) 另开终端运行：  bash qa-playwright-capture.sh
#   截图输出到 public/qa-screenshots/<view>.png
#
# 注意：macOS 上 localhost 常解析为 IPv6 ::1，而 vite 只监听 IPv4，
#       故默认用 127.0.0.1；如需其他地址用 BASE_URL 覆盖。

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3011}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

OUT_DIR="public/qa-screenshots"
mkdir -p "$OUT_DIR"

# 1) 确保 playwright 依赖可用（dev）
if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  echo "› 安装 playwright (dev) ..."
  npm install -D playwright
fi

# 2) 确保 chromium 浏览器已下载（失败则提示手动装）
if ! npx playwright install chromium >/dev/null 2>&1; then
  echo "⚠ chromium 浏览器未就绪，尝试 'npx playwright install chromium' 或检查网络后重试"
fi

# 3) 等待 dev server 就绪（--noproxy 避开本机 HTTP(S)_PROXY 对 127.0.0.1 的拦截）
echo "› 等待 $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -sS -o /dev/null --noproxy '*' "$BASE_URL" 2>/dev/null; then
    echo "✓ server up"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "✗ $BASE_URL 在 30s 内未就绪，请先 npm run dev"
    exit 1
  fi
  sleep 1
done

# 4) 运行截图脚本
BASE_URL="$BASE_URL" node qa/capture.mjs
echo "› 截图已写入 $OUT_DIR"
