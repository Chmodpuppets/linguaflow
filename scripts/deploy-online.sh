#!/usr/bin/env bash
# 部署「线上版」前端到服务器（方案 B 同源托管：前端 + API 同一台机器）。
#
# 前置：先 `npm run build:online` 产出 dist-online/。
# 本脚本只负责把静态文件传到服务器；真正对外服务需在服务器装 Caddy 并配
# 「根路径托管 dist-online 的静态文件 + 反代 /api 类路径到 127.0.0.1:8787」。
#
# 用法：
#   bash scripts/deploy-online.sh                          # 用默认服务器
#   DEPLOY_HOST=root@1.2.3.4 WEB_DIR=/opt/linguaflow-web bash scripts/deploy-online.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${DEPLOY_HOST:-root@47.107.187.5}"
WEB_DIR="${WEB_DIR:-/opt/linguaflow-web}"

[ -d dist-online ] || { echo "错误：dist-online 不存在，先运行 npm run build:online" >&2; exit 1; }

tar czf - -C dist-online . | ssh "$HOST" "mkdir -p $WEB_DIR && tar xzf - -C $WEB_DIR"
echo "已部署到 $HOST:$WEB_DIR"
echo "下一步：在服务器上装 Caddy 并配同源托管 + 反代（见 server/README.md 或等我出 Caddyfile）"
