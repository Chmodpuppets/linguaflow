# LinguaFlow 开发任务清单

## Specification Summary
**原始需求（基线）**：见 `ai/memory-bank/site-setup.md` — 纯前端多语言「输出驱动」学习应用。
**技术栈**：React 19 + TS + Vite 6 + Tailwind + lucide-react + localStorage。
**目标节奏**：小步快跑，单任务 30–60 分钟可交付。

## 项目真实进度快照（2026-08-18 盘点）
- 实际已交付特性（超出原基线，尚未全部入档）：SongLab 歌曲跟打、个人错误模式引擎 + 每日产出飞轮、暗夜霓虹 UI 重设计（Wave 0–4）、XP 进度条 `getLevelInfo` 统一修复、Gemini 迁出（无 geminiService）、侧栏两层折叠、录音转写回退本地回放。
- 代码实际模块数：**19 导航模块 / 11 语言**，README 写 17 模块、本 tasklist 基线为 7 模式——文档已不同步，本次盘点已同步 `site-setup.md`。
- Task 2–6 仍为待立项候选（My Profile 整体备份未做、STT 代理未做、TTS 扩展未做、Playwright 未做、Task 6 未做）。

## 开发任务

### [x] Task 1: PM 系统基建（本任务库本身）
**描述**：建立 site-setup.md / 本任务库 / 方法论，使需求显性化、可交接。
**验收标准**：
- 三个核心文件就位且互相引用；
- 新需求有可写入的入口（site-setup 第 7 节候选区）。
**文件**：ai/memory-bank/site-setup.md, tasks/linguaflow-tasklist.md, PM-METHODOLOGY.md
**参考**：PM-METHODOLOGY.md 核心循环

### [ ] Task 2: localStorage 数据导出 / 导入
**描述**：在 My Profile 增加「导出 JSON / 导入 JSON」按钮，备份学习数据。
**验收标准**：
- 导出生成含词汇 / 收藏 / 进度的 JSON 并触发下载；
- 导入可恢复且不与现有数据冲突（合并或覆盖可选）；
- 导入失败有明确提示。
**文件**：components/ProfileView.tsx, services/storageService.ts
**参考**：site-setup.md 第 7 节候选[3]

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

### [ ] Task 5: Playwright 截图回归脚手架
**描述**：加 `qa-playwright-capture.sh`，对 http://localhost:3011 跑关键页面截图到 public/qa-screenshots。
**验收标准**：
- 脚本可运行并产出 7 模式各 1 张截图；
- README 写明用法。
**文件**：qa-playwright-capture.sh, README.md（用法段）
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
- dev：`npm run dev`（端口 3011）；build：`npm run build`。
