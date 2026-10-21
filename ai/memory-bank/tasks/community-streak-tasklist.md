# LinguaFlow 学习搭子「一起连胜」— 任务清单

## Specification Summary
**需求来源**：把「学习搭子」社区功能做起来 → 收敛为**多邻国式「一起连胜」异步社交**。
**方向决策（2026-10-15 与 Mike 确认）**：
- 服务器**不接 AI**、不做匹配、不算命；
- **数据非实时**——无 WebSocket / 推送，一切在「打开页面 / 手动同步」时拉取；
- 好友关系 = **多好友列表**；
- 「共同连胜天数」= 双方今天都活跃时取二者 streak 较小值（任一方断签即清零）。

## 技术栈
`server/`（Hono + better-sqlite3，同仓独立目录，部署独立）；前端 `services/communityService.ts` feature flag。

## 关键范围决策
| 项 | 决策 |
|---|---|
| 是否另立项目 | **否**，同仓 `server/` 目录 |
| 服务器是否接 AI | **否** |
| 实时性 | **非实时**（打开页面拉一次 / 手动同步） |
| 好友模型 | **多好友列表** |
| 共同连胜 | 双方今天都活跃 → `min(streak_a, streak_b)`；否则 0 |
| 身份 | 昵称 + 6 位好友码（零密码，token 即身份） |
| 学习数据 | 永远本地；整包备份为**可选子功能**（复用 exportAllData/importAllData，AI key 排除） |
| 冲突策略（备份） | last-write-wins |
| 加密 | 二期（端到端加密） |

## 数据模型（SQLite，`server/src/db.ts`）
- `users(id, username, friend_code UNIQUE, language, streak, last_active_day, token UNIQUE, created_at)`
- `friendships(id, user_a, user_b, created_at, UNIQUE(user_a,user_b))` —— 双向好友，一条记录一对
- `nudges(id, from_user, to_user, created_at)` —— 提醒（非实时，对方下次拉取可见）
- `sync_data(user_id PK, blob, updated_at)` —— 整包备份（可选）

## API（`server/src/index.ts`）
| 端点 | 方法 | 作用 |
|---|---|---|
| `/health` | GET | 存活探针 |
| `/auth/register` | POST | 昵称 + 语言 → token + 好友码 |
| `/me` | GET | 我的资料 |
| `/me` | PUT | 同步 streak / 语言 / 今日活跃 |
| `/friends` | GET / POST | 好友列表 / 按好友码加好友 |
| `/friends/:id` | DELETE | 移除好友 |
| `/friends/:id/nudge` | POST | 提醒好友别断签 |
| `/nudges` | GET / DELETE | 收到提醒 / 已读清空 |
| `/sync` | PUT / GET | 整包备份 / 恢复（可选） |

## 验收标准
- [ ] 不配服务器：学习搭子页显示配置引导，无报错、无白屏。
- [ ] 配服务器 + 注册：领到好友码，页面显示我的 streak。
- [ ] 双方互加好友后，打开页面能看到对方 streak 与「共同连胜天数」（今天都活跃才 >0）。
- [ ] 好友断签（last_active_day 非今天）→ 共同连胜显示 0；可点「提醒」，对方下次打开看到提醒条。
- [ ] 整包备份 / 恢复可往返（导入前二次确认）。
- [ ] 前端 `tsc --noEmit --skipLibCheck` 0 错误。

## 文件
- `server/`（package.json / src/index.ts / src/db.ts / .env.example / .gitignore / README.md / Dockerfile / tsconfig.json）
- `services/communityService.ts`（前端 SDK + feature flag + computeCommonStreak）
- `components/SocialView.tsx`（学习搭子页：注册 / 好友码 / 好友列表 / 一起连胜 / 提醒 / 云备份）

## 部署备注
- 便宜 VPS：`cd server && npm install && npm start`（默认 8787，`PORT`/`DATA_DIR`/`CORS_ORIGIN`/`MAX_BODY_BYTES` 走 `.env`）。
- HTTPS：Caddy 自动签；备份：`data/linguaflow.db` 单文件 cron `rsync`。
- 国内服务器 + 域名需 ICP 备案；不想备案选香港轻量或纯 IP。

## 部署状态：已上线（2026-10-15）

| 项 | 值 |
|---|---|
| 服务器 | 阿里云 `ecs.e-c1m1.large`（**深圳·华南1**），公网 IP `47.107.187.5` |
| 系统 | Debian 13 (trixie) x86_64，2 vCPU / 1.7GB |
| 部署路径 | `/opt/linguaflow-server` |
| 服务 | systemd `linguaflow-sync`：**active + enabled**（开机自启） |
| Node | v22.23.3（官方预编译包 → `/usr/local/bin/node`） |
| 常驻内存 | ~50MB |
| 监听 | `127.0.0.1:8787`（**仅回环，公网不可直连**；由后续 Caddy 反代） |
| 备份 | systemd timer `linguaflow-backup.timer`（每日 03:00，保留 30 份） |
| 冒烟 | **12/12 通过**（加固后复跑；测试数据已清理） |

**部署踩坑记录**：
1. `ExecStart=/usr/bin/node` 报 `status=203/EXEC`——官方预编译包把 node 装在 `/usr/local/bin/node`。已改为 install.sh 自动探测 `command -v node` 并写入单元。
2. **8787 曾被公网直接访问到**（安全组误放行）——已把服务改为默认只绑回环 + `.env` 加 `HOST=127.0.0.1`，根治。
3. Debian 13 太新，弃用 NodeSource（可能无 trixie 仓库），改用 nodejs.org 官方预编译 tarball。

**待办**：① 域名 + ICP 备案 → 装 Caddy 配 HTTPS + 同源托管前端（方案 B）；② 建议排查安全组为何放行了 8787。

## 二期候选（不纳入本任务）
- 端到端加密（服务器只存密文）
- token 升级账号（用户名 + 密码，跨设备找回）
- 打卡榜 / 成就卡互赞（无需 AI，仅聚合）
