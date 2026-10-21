#!/usr/bin/env bash
# LinguaFlow 同步服务器 — 数据备份（SQLite 单文件）
# 用法：bash scripts/backup.sh [备份目录]
# cron 每天 3 点跑：
#   0 3 * * * bash /opt/linguaflow-server/scripts/backup.sh >> /var/log/linguaflow-backup.log 2>&1
set -euo pipefail

DATA_DIR="${DATA_DIR:-/opt/linguaflow-server/data}"
DB="$DATA_DIR/linguaflow.db"
BACKUP_DIR="${1:-$DATA_DIR/backups}"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB" ]; then
  echo "找不到数据库文件：$DB"
  exit 1
fi

# 磁盘空间护栏：可用不足 2GB 时跳过，避免备份把磁盘撑爆、反而拖垮在跑的服务
AVAIL_KB="$(df -Pk "$BACKUP_DIR" | awk 'NR==2{print $4}')"
if [ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -lt 2097152 ]; then
  echo "磁盘可用空间不足 2GB，跳过本次备份（请及时清理）"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/linguaflow-$STAMP.db"

# 优先用 sqlite3 在线备份（WAL 模式安全，不复制半写状态），否则退化为 cp
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$DEST'"
else
  cp "$DB" "$DEST"
fi

echo "已备份 → $DEST ($(du -h "$DEST" | cut -f1))"

# 只保留最近 30 份，其余清理
ls -1t "$BACKUP_DIR"/linguaflow-*.db 2>/dev/null | tail -n +31 | xargs -r rm -f
