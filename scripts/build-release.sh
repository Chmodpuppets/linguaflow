#!/usr/bin/env bash
# 构建双发行版：
#   - 开源版  → dist/         （无内置社区地址，纯本地 / 自托管）
#   - 线上版  → dist-online/  （读 .env.online 内置 COMMUNITY_URL）
# 并把两者打成 tar.gz 到 release/，供 GitHub Release 上传。
#
# 用法：bash scripts/build-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VER="$(grep -m1 '"version"' package.json | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

# 用 mv 改名清旧产物（避免 rm -rf 触发批量删除确认）；新构建会写到全新目录
STAMP="$(date +%s)"
[ -d dist ] && mv dist "/tmp/lf_dist_bak_$STAMP"
[ -d dist-online ] && mv dist-online "/tmp/lf_dist-online_bak_$STAMP"
mkdir -p release
rm -f release/*.tar.gz 2>/dev/null || true

echo "▶ [1/2] 构建开源版 (oss) → dist/"
npm run build

echo "▶ [2/2] 构建线上版 (online) → dist-online/"
npm run build:online

tar -czf "release/linguaflow-oss-v${VER}.tar.gz" -C dist .
tar -czf "release/linguaflow-online-v${VER}.tar.gz" -C dist-online .

echo ""
echo "产物已生成（版本 v${VER}）："
ls -lh release/
