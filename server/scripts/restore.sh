#!/usr/bin/env bash
# LinguaFlow 同步服务器 — 从备份恢复
# 用法：bash scripts/restore.sh <备份文件.db>
# 会先停服务、替换 DB、再重启；覆盖前会二次确认。
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法：bash scripts/restore.sh <备份文件.db>"
  exit 1
fi

SRC="$1"
DATA_DIR="${DATA_DIR:-/opt/linguaflow-server/data}"
DB="$DATA_DIR/linguaflow.db"
SERVICE="${SERVICE_NAME:-linguaflow-sync}"

if [ ! -f "$SRC" ]; then
  echo "备份文件不存在：$SRC"
  exit 1
fi

echo "将用 $SRC 覆盖当前数据库 $DB，并重启服务 $SERVICE"
read -r -p "确认继续？(y/N) " ans
if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
  echo "已取消"
  exit 0
fi

sudo systemctl stop "$SERVICE" || true
cp "$SRC" "$DB"
sudo systemctl start "$SERVICE"
echo "已恢复并重启服务"
