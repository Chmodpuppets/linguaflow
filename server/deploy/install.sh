#!/usr/bin/env bash
# LinguaFlow 同步服务器 — 一键部署（Debian/Ubuntu 优先，RHEL 系兼容）
#
# 前提：本脚本所在目录已含 service/ 代码（即 server/ 目录内容），
#       且已在目标机上（用 root 或 sudo 运行）。
#
# 用法：
#   sudo bash deploy/install.sh
#   sudo DOMAIN=sync.example.com bash deploy/install.sh   # 同时配 Caddy + HTTPS
#
# 可覆盖的环境变量：APP_DIR / APP_USER / PORT / DOMAIN
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/linguaflow-server}"
APP_USER="${APP_USER:-linguaflow}"
SERVICE="${SERVICE:-linguaflow-sync}"
PORT="${PORT:-8787}"
DOMAIN="${DOMAIN:-}"

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行：sudo bash deploy/install.sh"
  exit 1
fi

if   command -v apt-get >/dev/null 2>&1; then PKG=apt
elif command -v dnf     >/dev/null 2>&1; then PKG=dnf
elif command -v yum     >/dev/null 2>&1; then PKG=yum
else echo "暂不支持的系统（需要 apt / dnf / yum）"; exit 1; fi

log "系统包管理器：$PKG ｜ 部署目录：$APP_DIR ｜ 端口：$PORT ｜ 域名：${DOMAIN:-（未设，跳过 HTTPS）}"

if [ ! -f package.json ] || [ ! -f src/index.ts ]; then
  warn "当前目录不像 server/ 代码目录（缺 package.json 或 src/index.ts）"
  echo "请先 cd 到 server/ 代码所在目录再执行，例如："
  echo "  sudo bash $APP_DIR/deploy/install.sh"
  exit 1
fi

# ---------- 1. Node.js 22 ----------
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  MAJ="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$MAJ" -ge 20 ] 2>/dev/null; then NEED_NODE=0; fi
fi
if [ "$NEED_NODE" -eq 1 ]; then
  log "安装 Node.js 22（官方预编译包，免第三方 repo，跨发行版最稳）"
  case "$(uname -m)" in
    x86_64|amd64) NODE_ARCH=linux-x64 ;;
    aarch64|arm64) NODE_ARCH=linux-arm64 ;;
    *) echo "不支持的 CPU 架构：$(uname -m)"; exit 1 ;;
  esac
  NODE_VER="$(curl -fsSL https://nodejs.org/dist/index.json \
    | grep -oE '"version":"v22\.[0-9]+\.[0-9]+"' | head -1 | cut -d'"' -f4)"
  if [ -z "$NODE_VER" ]; then echo "无法获取 Node 22 版本号（检查网络/DNS）"; exit 1; fi
  log "下载 $NODE_VER（$NODE_ARCH）"
  curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${NODE_ARCH}.tar.gz" -o /tmp/node.tar.gz
  tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1
  rm -f /tmp/node.tar.gz
fi
log "Node: $(node -v) ／ npm: $(npm -v)"

# ---------- 2. Caddy（仅在有域名时安装） ----------
if [ -n "$DOMAIN" ]; then
  if ! command -v caddy >/dev/null 2>&1; then
    log "安装 Caddy"
    if [ "$PKG" = apt ]; then
      $PKG install -y debian-keyring debian-archive-keyring apt-transport-https curl
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        > /etc/apt/sources.list.d/caddy-stable.list
      $PKG update -y
      $PKG install -y caddy
    else
      $PKG install -y 'dnf-command(copr)' || true
      $PKG copr enable -y @caddy/caddy || warn "COPR 启用失败，可改用官方二进制：https://caddyserver.com/docs/install"
      $PKG install -y caddy
    fi
  fi
  log "Caddy: $(caddy version 2>/dev/null || echo '未安装')"
else
  log "未指定 DOMAIN，跳过 Caddy（后续加域名时再执行本脚本即可）"
fi

# ---------- 3. 运行用户 + 目录 ----------
log "准备运行用户与目录"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  NOLOGIN="$(command -v nologin || echo /usr/sbin/nologin)"
  useradd -r -s "$NOLOGIN" "$APP_USER"
fi
HERE="$(pwd)"
mkdir -p "$APP_DIR/data"

if [ "$HERE" != "$APP_DIR" ]; then
  log "同步代码：$HERE → $APP_DIR"
  for item in src deploy scripts package.json tsconfig.json .env.example Caddyfile Dockerfile README.md; do
    [ -e "$HERE/$item" ] && cp -R "$HERE/$item" "$APP_DIR/"
  done
fi

if [ ! -f "$APP_DIR/.env" ]; then
  log "生成 .env"
  ADMIN_KEY_VAL="$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 24)"
  cat > "$APP_DIR/.env" <<ENVEOF
PORT=$PORT
HOST=127.0.0.1
DATA_DIR=$APP_DIR/data
CORS_ORIGIN=*
MAX_BODY_BYTES=26214400
MAX_USERS=500
REGISTER_RATE_LIMIT=20
ADMIN_KEY=$ADMIN_KEY_VAL
LOG_RETENTION_DAYS=180
LOG_RATE_LIMIT=500
ENVEOF
  echo "已生成 .env（ADMIN_KEY 已随机生成，查询日志时用 X-Admin-Key 头携带）"
fi

# ---------- 4. 依赖 ----------
log "安装生产依赖（better-sqlite3 在 Linux 会拉预编译二进制）"
cd "$APP_DIR"
npm install --omit=dev

# ---------- 5. 权限 ----------
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 750 "$APP_DIR/data"

# ---------- 6. systemd ----------
log "配置 systemd 服务"
SRC_UNIT="$APP_DIR/deploy/linguaflow-sync.service"
if [ ! -f "$SRC_UNIT" ]; then warn "缺少 $SRC_UNIT，跳过 systemd 配置"; else
  NODE_BIN="$(command -v node)"
  sed -e "s#/opt/linguaflow-server#$APP_DIR#g" \
      -e "s#^User=.*#User=$APP_USER#" \
      -e "s#^Group=.*#Group=$APP_USER#" \
      -e "s#^ExecStart=.*#ExecStart=$NODE_BIN --import tsx $APP_DIR/src/index.ts#" \
      "$SRC_UNIT" > "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload
  systemctl enable --now "$SERVICE"
  sleep 2
  systemctl --no-pager --lines=6 status "$SERVICE" || true

  # 每日备份定时器（03:00，免 cron 依赖）
  if [ -f "$APP_DIR/deploy/linguaflow-backup.service" ] && [ -f "$APP_DIR/deploy/linguaflow-backup.timer" ]; then
    log "配置每日备份定时器（03:00）"
    sed -e "s#/opt/linguaflow-server#$APP_DIR#g" \
      "$APP_DIR/deploy/linguaflow-backup.service" > /etc/systemd/system/linguaflow-backup.service
    cp "$APP_DIR/deploy/linguaflow-backup.timer" /etc/systemd/system/linguaflow-backup.timer
    systemctl daemon-reload
    systemctl enable --now linguaflow-backup.timer
    systemctl list-timers linguaflow-backup.timer --no-pager || true
  fi
fi

# ---------- 7. 自检 ----------
log "本机自检"
for i in 1 2 3 4 5; do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "/health OK（http://127.0.0.1:$PORT）"
    break
  fi
  if [ "$i" = 5 ]; then warn "/health 未通过，请查：journalctl -u $SERVICE -n 50"; fi
  sleep 1
done

# ---------- 8. Caddy（可选，需域名） ----------
if [ -n "$DOMAIN" ]; then
  log "配置 Caddy 反向代理：$DOMAIN → 127.0.0.1:$PORT"
  cat > /etc/caddy/Caddyfile <<CADDYEOF
$DOMAIN {
    reverse_proxy 127.0.0.1:$PORT
    encode gzip
}
CADDYEOF
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
  log "Caddy 已配置，证书会自动申请（需域名已解析到本机公网 IP）"
fi

log "完成 ✅"
cat <<TIPEOF
服务状态：systemctl status $SERVICE
实时日志：journalctl -u $SERVICE -f
手动备份：bash $APP_DIR/scripts/backup.sh
前端联调：在前端「学习搭子」页把服务器地址填成
          ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://<本机公网IP>:$PORT}
TIPEOF
