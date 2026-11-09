# LinguaFlow 学习搭子轻后端（无 AI、非实时）

LinguaFlow 的可选社交服务，承载多邻国式「一起连胜」。**它不接 AI、不算命、不匹配、不做实时推送**——只存最小社交数据（昵称 / 好友关系 / streak / 提醒），一切在用户「打开页面 / 手动同步」时拉取。

学习数据永远以浏览器本地为源；本服务只存你显式展示给好友的那点成就，以及可选的整包备份副本。

## 快速开始

```bash
cd server
npm install
cp .env.example .env   # 按需改 PORT / DATA_DIR / CORS_ORIGIN / MAX_BODY_BYTES
npm start              # 默认监听 http://localhost:8787
```

开发模式（热重载）：`npm run dev`

冒烟测试（先起服务，另开终端）：

```bash
node scripts/smoke.mjs            # 默认打 http://127.0.0.1:8787
```

> macOS 本地若 `npm install` 卡在 better-sqlite3（GitHub 预编译下载被墙回退源码编译），手动跑：
> `npm rebuild better-sqlite3 --build-from-source`（需 Xcode Command Line Tools）。

## 接口

| 端点 | 方法 | 说明 |
|---|---|---|
| `/health` | GET | 存活探针 |
| `/auth/register` | POST | 昵称 + 语言 → token + 6 位好友码（零密码） |
| `/me` | GET / PUT | 我的资料 / 同步 streak·语言·今日活跃 |
| `/friends` | GET / POST | 好友列表 / 按好友码加好友 |
| `/friends/:id` | DELETE | 移除好友 |
| `/friends/:id/nudge` | POST | 提醒好友别断签（非实时） |
| `/nudges` | GET / DELETE | 收到提醒 / 已读清空 |
| `/sync` | PUT / GET | 整包备份 / 恢复（可选） |
| `/tts/audio` | GET | TTS 音频代理：按 `text` + `voice` 读缓存（命中回音频字节，未命中 404） |
| `/tts/audio` | POST | 把刚合成的音频落 OSS 并回传字节（`src` = 上游地址，或 `data` = base64） |

### TTS 音频代理（**开源版默认关闭**）

> **这套能力绑定「某个部署自己的 OSS」，所以开源发行版默认不开**（`TTS_PROXY_ENABLED=0`，
> 此时 `/tts/audio` 直接 503）。不启用也完全不缺功能：前端会自动退回
> 「浏览器直连 Qwen + 本地 IndexedDB 缓存」，只是不跨设备共享音频。
>
> 想启用就用**你自己的** OSS 填 `OSS_*`，再把 `TTS_PROXY_ENABLED` 改成 `1`。
> **绝不要填别人的 bucket / AccessKey** —— 凭证只属于你这台服务器。
>
> 线上版（`linguaflow.pathmora.cn`）是另一套：它自己的 `.env` 里置 `TTS_PROXY_ENABLED=1`
> 并配自己的 bucket，仓库与开源源码里不含任何真实凭证或 bucket 名。

Qwen3-TTS 把音频放在 `dashscope-result-bj.oss-cn-beijing.aliyuncs.com`，
那个 CDN **不返回 `Access-Control-Allow-Origin`** —— `<audio src>` 能播，
但浏览器 `fetch()` 抓不到字节，也就存不进 IndexedDB，只能记住 24h 预签名 URL，过期重新合成。

同源中转解决两件事：① 前端能拿到 Blob（永不过期）；② 顺手把音频存进你自己的 OSS（跨设备、跨用户复用）。

对象 key 是**内容寻址**的：`sha256("v1|<voice>|<text>")`，所以同一个词在任何设备上算出来都是同一个地址，
不需要任何协商。

```bash
# 冒烟：写入一段 base64 音频（需要先注册拿 token）
curl -X POST https://<域名>/api/tts/audio \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"text":"hello","voice":"Cherry","data":"<base64>","contentType":"audio/mpeg"}' -o /tmp/a.mp3

# 再读回来（另起进程/设备也是同一份）
curl https://<域名>/api/tts/audio?text=hello\&voice=Cherry -H "Authorization: Bearer <token>" -o /tmp/b.mp3
cmp /tmp/a.mp3 /tmp/b.mp3 && echo 一致
```

## 部署到便宜 VPS（Ubuntu/Debian，systemd）

> **推荐系统：Debian 12 (bookworm) 64 位**（或 Ubuntu 22.04/24.04 LTS）。
> 理由：Caddy 在官方源里、系统占用最省、以下命令零改动可用。
> 若用 RHEL 系（Alibaba Cloud Linux / Anolis OS / AlmaLinux / CentOS Stream），需把 `apt` 换成 `dnf`、并按 Caddy 官方文档额外加 dnf 源。

假设部署目录 `/opt/linguaflow-server`、域名 `sync.example.com`：

**一键部署（推荐）**——把 `server/` 传到服务器后（`rsync -avz --exclude node_modules server/ root@<IP>:/opt/linguaflow-server/`），在服务器上执行：

```bash
cd /opt/linguaflow-server
sudo DOMAIN=sync.example.com bash deploy/install.sh   # 不带 DOMAIN 则只起 API，不配 HTTPS
```

脚本会：装 Node 22 + Caddy → 建运行用户 → `npm install` → 装 systemd 服务并开机自启 → `/health` 自检 → 有域名则写 Caddy 配置自动签证书。**可重复执行**（幂等）。

<details>
<summary>或者手动一步步来</summary>



```bash
# 1. 上传代码并安装依赖
sudo mkdir -p /opt/linguaflow-server && sudo chown $USER /opt/linguaflow-server
#   （把 server/ 目录 rsync/scp 到 /opt/linguaflow-server）
cd /opt/linguaflow-server
npm install                          # Linux 上 better-sqlite3 秒装（预编译二进制）
cp .env.example .env                 # 改 CORS_ORIGIN 为你的前端域名

# 2. 建运行用户
sudo useradd -r -s /usr/sbin/nologin linguaflow || true
sudo mkdir -p /opt/linguaflow-server/data
sudo chown -R linguaflow:linguaflow /opt/linguaflow-server

# 3. systemd 守护
sudo cp deploy/linguaflow-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now linguaflow-sync
sudo systemctl status linguaflow-sync   # 确认 active (running)

# 4. HTTPS（Caddy 自动签证书）
sudo apt install -y caddy
sudo cp Caddyfile /etc/caddy/Caddyfile  # 先把 sync.example.com 换成你的域名
sudo systemctl reload caddy
```

</details>

冒烟验证（任意一台能访问该域名的机器）：

```bash
node scripts/smoke.mjs https://sync.example.com
```

### 备份 / 恢复

数据是单文件 `data/linguaflow.db`。配 cron 每天自动备份：

```bash
sudo crontab -e
# 加一行：
0 3 * * * bash /opt/linguaflow-server/scripts/backup.sh >> /var/log/linguaflow-backup.log 2>&1
```

恢复：`bash scripts/restore.sh <备份文件.db>`

### 合规提示

- 国内服务器 + 域名 = 需 ICP 备案；不想备案选**香港轻量**或纯 IP 访问。
- Docker 可选：见 `Dockerfile`。

## 备案通过后：切到域名 + HTTPS 生产

备案通过、域名就绪后，把临时 IP 直连换成正式 HTTPS。三步：

```bash
# 1. 前端：写线上版 API 地址为你的域名，重新构建
echo "COMMUNITY_URL=https://api.example.com" > .env.online
npm run build:online
bash scripts/deploy-online.sh          # 传 dist-online → 服务器 /opt/linguaflow-web

# 2. 服务器：写生产 Caddyfile（前端 + api 分站，自动签 HTTPS）
#    先替换域名，再下发
sed 's/example.com/你的域名/g' server/deploy/Caddyfile.production \
  | ssh root@<IP> 'cat > /etc/caddy/Caddyfile'
systemctl reload caddy   # 在服务器上执行

# 3. 服务器：API 收口回环 + 收紧 CORS
#    /opt/linguaflow-server/.env 改：
#      HOST=127.0.0.1
#      CORS_ORIGIN=https://你的域名
systemctl restart linguaflow-sync
```

**DNS**：`@` 和 `api` 两条 A 记录都指向服务器公网 IP。Caddy 会自动申请并续签 HTTPS 证书。

## 前端接入

线上版（`npm run build:online`）内置社区地址，用户**注册/登录（用户名+密码）**后自动同步学习数据到服务器（登录自动拉取、学习后自动推送）；开源版（`npm run build`）无账号、纯本地，「学习搭子」页可自配服务器地址自托管。

## 安全说明

- 账号 = 用户名 + 密码，密码用 `node:crypto` scrypt 哈希（零依赖）；token 由登录/注册签发，支持**跨设备登录**（自动拉取云数据）。
- 登录限流 10 次/小时/IP 防爆破；注册限流 + 总量上限防滥用。
- 合规对话日志（用户提问 + AI 返回）留存 ≥180 天，`X-Admin-Key` 鉴权可回溯查询。
- 生产建议 `HOST=127.0.0.1`（只走 Caddy 反代），`CORS_ORIGIN` 收紧为前端域名。
