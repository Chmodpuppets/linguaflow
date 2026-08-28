# LinguaFlow 开发任务清单

## Specification Summary
**原始需求（基线）**：见 `ai/memory-bank/site-setup.md` — 纯前端多语言「输出驱动」学习应用。
**技术栈**：React 19 + TS + Vite 6 + Tailwind + lucide-react + localStorage。
**目标节奏**：小步快跑，单任务 30–60 分钟可交付。

## 项目真实进度快照（2026-08-27 盘点）
- 实际已交付特性（超出原基线，已入档 site-setup 第 2/7 节）：SongLab 歌曲跟打、个人错误模式引擎 + 每日产出飞轮、暗夜霓虹 UI 重设计（Wave 0–4）、XP 进度条 `getLevelInfo` 统一修复、Gemini 迁出（无 geminiService）、侧栏两层折叠、录音转写回退本地回放、Books 阅读器（EPUB/PDF + IndexedDB）、TypeLit 打字训练（Literata 衬线）、许可证切换 CC BY-NC 4.0、README 拆分 docs/ + 社群扫码、release.sh 发版脚本。
- 代码实际模块数：**20 导航模块 / 11 语言**（`constants.tsx` NAV_ITEMS），与 `site-setup.md` 已同步。
- 版本状态：**v0.1.0**（2026-08-26，Books + TypeLit 功能里程碑）、**v0.1.1**（2026-08-26，LICENSE + README 拆分 + release 脚本）均已发布，工作树与 origin/main 同步（ahead/behind 0）。
- Task 2 已关闭（账户级备份：localStorage 全量 + 书架已在代码落地并通过 tsc/build 验证，歌曲音频为范围外）；Task 5 进行中（Playwright 截图回归脚手架已立项，脚本+README 落地中）；Task 3/4/6 仍为待立项候选（STT 代理需先重开 STT 调用、TTS 扩展因 qwen3 多语种已弱化、Task 6 为流程样例）。

## 开发任务

### [x] Task 1: PM 系统基建（本任务库本身）
**描述**：建立 site-setup.md / 本任务库 / 方法论，使需求显性化、可交接。
**验收标准**：
- 三个核心文件就位且互相引用；
- 新需求有可写入的入口（site-setup 第 7 节候选区）。
**文件**：ai/memory-bank/site-setup.md, tasks/linguaflow-tasklist.md, PM-METHODOLOGY.md
**参考**：PM-METHODOLOGY.md 核心循环

### [x] Task 1.1: v0.1.0 功能里程碑（Books + TypeLit）
**描述**：新增 Books 阅读器（EPUB/PDF 导入 + IndexedDB 存储 + 封面渲染）与 TypeLit 风格打字训练（Literata 衬线 + 平滑光标）。
**验收标准**：EPUB/PDF 可导入并持久化；打字体验无输入丢失；已发布 `v0.1.0`（2026-08-26）。
**文件**：components/BooksView.tsx, services/bookImport.ts 等
**参考**：CHANGELOG.md [0.1.0]

### [x] Task 1.2: v0.1.1 文档与许可
**描述**：新增 CC BY-NC 4.0 LICENSE（非商业 + 商用付费授权）；README 拆分为 `docs/`（features/setup/ai-voice/faq/contributing）+ 社群扫码；新增 `scripts/release.sh` 发版脚本。
**验收标准**：LICENSE 就位；README 枢纽 + docs 子文件可达；release.sh 可一键 bump+CHANGELOG+tag+Release；已发布 `v0.1.1`（2026-08-26）。
**文件**：LICENSE, README.md, docs/*.md, scripts/release.sh
**参考**：CHANGELOG.md [0.1.1]

### [x] Task 2: 账户级数据导出 / 导入（已完成）
**描述**：My Profile 增加「导出 JSON / 导入 JSON」按钮，整包备份 / 恢复学习数据。
**范围**：localStorage 全量键（`ALL_STORAGE_KEYS`）+ 书架（IndexedDB 书籍正文）。
**已知范围外**：歌曲音频 / 片段二进制（体积大、可由用户重新导入源文件），v1 不纳入备份。
**验收标准**：
- 导出生成含词汇 / 收藏 / 进度 / 写作 / 错题 / 书籍 等的 JSON 并触发下载（已实现：ProfileView 卡片 + storageService.exportAllData）；
- 导入可整包恢复（导入前二次确认覆盖）；导入失败有明确提示（已实现）；
- 合并 / 覆盖可选为后续增强（Task 2.1），当前为整包覆盖语义。
**文件**：components/ProfileView.tsx, services/storageService.ts（exportAllData / importAllData）
**参考**：site-setup.md 第 7 节

### [ ] Task 3: STT CORS 代理开关
**描述**：在 `.env` 增加可选 `DASHSCOPE_PROXY_URL`，aiService 在有值时走代理转发 STT 请求。
**验收标准**：
- 留空时行为不变（直连）；
- 填入时 STT 请求经代理且公网可用；
- README 补充代理说明。
**文件**：services/aiService.ts, .env.example, README.md
**参考**：site-setup.md 第 7 节候选[1]；README Q2

### [ ] Task 4: 非中文 TTS 扩展（CosyVoice 开关）
**描述**：在 aiService 增加可选 Qwen CosyVoice 音色，非中文也可走千问声音，env 开关。
**验收标准**：
- 开关关闭时回退 Web Speech；
- 开启时调用并播放；
- 不破坏现有中文 TTS。
**文件**：services/aiService.ts, .env.example
**参考**：site-setup.md 第 7 节候选[2]；README Q1

### [x] Task 5: Playwright 截图回归脚手架（已完成）
**描述**：加 `qa/capture.mjs` + `qa-playwright-capture.sh`，点侧栏中文标签切换 7 个代表视图截图到 public/qa-screenshots。
**验收标准**：
- 脚本可运行并产出 7 视图各 1 张截图（今日 / 剧情对话 / 写作树 / 作文流水线 / 错误模式 / 词汇 / 歌曲跟打）—— **已实跑验证 7/7 通过**；
- README 写明用法（含 localhost→IPv6 坑，默认用 127.0.0.1）。
**实现要点**：路由为状态机（无 URL 路径），故靠点击侧栏标签切换；未登录先驱动 LoginView 向导（填昵称→下一步×2→开始学习）；部分侧栏分组默认折叠，需先展开 `aria-expanded` 分组头再点内部视图；浏览器需 `--no-proxy-server` 直连本地 dev server（本环境 HTTP_PROXY 会拦截 127.0.0.1）。
**文件**：qa/capture.mjs, qa-playwright-capture.sh, README.md, .gitignore（忽略 public/qa-screenshots）
**参考**：PM-METHODOLOGY.md 质量门

### [ ] Task 6: 走一遍真实特性 spec→task 样例
**描述**：从 site-setup 第 7 节选一项，完整走一遍：补规格 → 拆 3–5 个子任务 → 写验收。
**验收标准**：
- 该特性规格清晰、任务可独立交付、验收可测。
**参考**：PM-METHODOLOGY.md 规格模板 + 拆解规则

## 质量要求
- [ ] 命令不挂后台（不追加 `&`），不启动服务器（假定 dev server 已跑）。
- [ ] 移动端响应式必做。
- [ ] 图片用 picsum.photos / Unsplash，禁用 Pexels（403）。
- [ ] 改动先更新 site-setup.md 再建任务（单一事实来源）。
- [ ] 每个任务含可测验收标准。

## 技术备注
- 当前为 React 前端；PM 角色通用模板里的 FluxUI / Laravel 不适用，已按实际栈调整。
- dev：`npm run dev`（端口 3011）；build：`npm run build`；发版：`npm run release`（scripts/release.sh）。
- 文档：`README.md` 为枢纽，详细内容拆至 `docs/`（features/setup/ai-voice/faq/contributing）。
- site-setup 第 2 节为唯一事实来源，代码事实以 `constants.tsx` NAV_ITEMS / `services/aiService.ts` 为准。
