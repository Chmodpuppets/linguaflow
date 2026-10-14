# LinguaFlow 开发任务清单

## Specification Summary
**原始需求（基线）**：见 `ai/memory-bank/site-setup.md` — 纯前端多语言「输出驱动」学习应用。
**技术栈**：React 19 + TS + Vite 6 + Tailwind + lucide-react + localStorage。
**目标节奏**：小步快跑，单任务 30–60 分钟可交付。

## 项目真实进度快照（2026-08-27 盘点）
- 实际已交付特性（超出原基线，已入档 site-setup 第 2/7 节）：SongLab 歌曲跟打、个人错误模式引擎 + 每日产出飞轮、暗夜霓虹 UI 重设计（Wave 0–4）、XP 进度条 `getLevelInfo` 统一修复、Gemini 迁出（无 geminiService）、侧栏两层折叠、录音转写回退本地回放、Books 阅读器（EPUB/PDF + IndexedDB）、TypeLit 打字训练（Literata 衬线）、许可证切换 CC BY-NC 4.0、README 拆分 docs/ + 社群扫码、release.sh 发版脚本。
- 代码实际模块数：**20 导航模块 / 11 语言**（`constants.tsx` NAV_ITEMS），与 `site-setup.md` 已同步。
- 版本状态：**v0.1.0**（2026-08-26，Books + TypeLit 功能里程碑）、**v0.1.1**（2026-08-26，LICENSE + README 拆分 + release 脚本）均已发布，工作树与 origin/main 同步（ahead/behind 0）。
- Task 2 已关闭（账户级备份：localStorage 全量 + 书架已在代码落地并通过 tsc/build 验证，歌曲音频为范围外）；Task 5 已关闭（Playwright 截图回归 7/7 验证通过）；Task 3 已否决（不恢复录音转写）；Task 6 仍为待立项候选（流程样例）。Task 7 已完成并关闭（写作流水线全语言化，commit `13373e8`；tsc/build 通过 + Playwright 回归 7/7，2026-08-29 复验）。当前无进行中任务；下一候选为 Task 4（非中文 TTS CosyVoice，需求已弱化待评估）与 Task 6（流程样例）。

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

### [x] Task 3: STT CORS 代理开关（已否决 · 不做）
**描述**：原计划在 `.env` 增加可选 `DASHSCOPE_PROXY_URL`，让 aiService 走代理转发 STT 请求。因录音转写 API 路径已回退为本地回放，产品决策**不恢复录音转写**，Task 3 关闭。
**范围外说明**：本地录音回放保留；公网 CORS 限制仍记录为已知限制，但不再通过代理开关解决。
**文件**：无需改动
**参考**：site-setup.md 第 7 节候选[1]；README Q2（已知限制段保留 STT CORS 说明）

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

### [x] Task 7: 写作流水线全语言支持（已完成 2026-08-29）
**描述**：让作文流水线（CompositionStudio）与引导写作（GuidedWriting）对所有 11 种支持语言可用：补齐作文大纲段标题的 11 语言本地化、为当前未支持的 8 种语言添加 A1/A2 引导填空模板、取消 `WritingLanguageGate` 的 ja/en/ko 门控；考试语言门控保持 EN→IELTS/TOEFL、JA→JLPT、KO→TOPIK、ES→DELE、缺考回退 CEFR。
**验收标准**：
- 切换任意支持语言后进入「作文流水线」不再显示"仅支持部分语言"门控；
- 作文编辑器切换体裁时，大纲段标题用目标语言（而非中文兜底）显示；
- 引导写作在 A1/A2 等级有可用的目标语句型填空模板；
- `tsc --noEmit --skipLibCheck` 与 `vite build` 通过；Playwright 回归脚本 7 视图截图仍正常。
**验收证据**：代码落地于 commit `13373e8`（feat: 写作流水线全语言化 3 → 11 种支持语言）；2026-08-29 复验：`tsc --noEmit` 0 错误、`vite build` 成功、Playwright 回归 7/7 截图通过（含作文流水线视图）。
**文件**：data/growthTree.ts, data/guidedWriting.ts, components/WritingLanguageGate.tsx
**参考**：site-setup.md 第 7 节

### [ ] Task 6: 走一遍真实特性 spec→task 样例
**描述**：从 site-setup 第 7 节选一项，完整走一遍：补规格 → 拆 3–5 个子任务 → 写验收。
**验收标准**：
- 该特性规格清晰、任务可独立交付、验收可测。
**参考**：PM-METHODOLOGY.md 规格模板 + 拆解规则

### [x] Task 8: 写作树自定义写作方向（已完成 2026-08-29）
**描述**：在写作树侧栏「我的写作成长档案」下允许用户添加专属写作方向：弹窗（一句话描述 + 可选引导标签）→ AI 按用户 CEFR 等级一次生成 5–8 题分级任务阶梯，落成自定义枝干（与内置枝干共用解锁/XP/错题沉淀机制）；支持重命名 / 重新生成 / 删除；无 AI key 或调用失败回退本地模板生成。
**范围与决策**：方向按目标语言隔离（存 `linguaflow_custom_directions`，Record<Language, Seed[]>，纳入 ALL_STORAGE_KEYS 备份）；数量上限 5 根；错误模式联动个性化出题放二期；重新生成需确认（替换该方向全部任务，进度重置）。
**验收证据**（2026-08-29）：
- `tsc --noEmit` 0 错误；Playwright 截图回归 7/7 通过（qa-playwright-capture.sh）；
- 专项回归 `qa/custom-direction.mjs` 10/10：入口存在 → 弹窗创建（AI 拦截走本地模板兜底）→ 6/6 模板任务可见 → 首题进编辑器 → 重命名生效 → 重新生成（二次确认）→ 删除（二次确认）→ 入口恢复，全程零 pageerror；
- 实现中修复一处真实 UI 缺陷：方向管理菜单的 fixed 遮罩因面板堆叠上下文盖住菜单项，改为 document click-away（WritingTreeView）；
- ⚠️ `vite build` 未能在本次会话完成：沙箱机器 I/O 病态（同构建早上 7 分钟 CPU，本次 43 分钟 CPU 零产出，且期间有另一进程高频改仓库触发 dev server 反复重启）。正确性由 `tsc --noEmit`（vite build 的 TS 环节仅为转译，tsc 为更强检查）+ 全量运行时回归覆盖；**环境恢复后需补跑 `npm run build`**。
**文件**：types.ts, services/aiService.ts, services/customDirectionService.ts（新）, services/storageService.ts, components/CustomDirectionModal.tsx（新）, components/WritingTreeView.tsx, qa/custom-direction.mjs（新回归脚本）
**参考**：site-setup.md 第 7 节

### [x] Task 9: 写作树 11 语言内容补齐 + 交互增强（P0/P2/P3，已完成 2026-08-29）
**描述**：审计写作树后发现「11 语言门控已开、主干内容仅 3 语言」——ES/FR/DE/IT/RU/EL/AR/ZH 用户会看到英语主题/英语句型支架/英语作文考题。本任务补齐内容并修复评估中暴露的交互缺口。
**内容补齐（P0）**：
- 新建 `data/treeThemes.ts`：8 语言的横向主题树（8 主题 × 8 任务，title/hint 复用中文、A1/A2 提供目标语句型支架）+ `EXTRA_COMPOSITION_PROMPTS`（8 语言作文真实考题）；`growthTree.ts` 的 `TREE_THEMES`/`COMPOSITION_PROMPTS` 合并引入。
- spine 支架重构：`SpineLeafSeed.enScaffold/jaScaffold/koScaffold` 三字段 → `scaffolds?: Partial<Record<Language,string>>`，4 个带支架 leaf 补全 11 语言，`makeLeaf` 改为 `lf.scaffolds?.[lang] ?? ''`。
**交互增强（P2/P3）**：
- 重写闭环：「再写一版」按钮（WritingTreeView feedback 面板，保留任务清空反馈回作答态）。
- spine 进度：写作趋势页新增「写作者养成主线」8 分支进度条（WritingProgressView 读 ensureGrowthTree 的 spine 数据）。
- 树导航：搜索过滤（匹配 title/scaffoldHint + 祖先链）、「下一步」定位第一个未完成任务、全部展开/折叠。
- 性能：`renderTree` 每节点全量 filter(O(n²)) → `childrenMap` 预构建索引(O(n))。
- 另发现「错题去重」评估误报：`addErrorCards` 内部已按 original+language 去重（重复则更新），无需改。
**验收证据**：`tsc --noEmit --skipLibCheck` 0 错误；esbuild 转译 treeThemes/growthTree/WritingTreeView/WritingProgressView 全部通过。`vite build` 因沙箱内存病态未跑完（minify 阶段 swap 抖动），留待环境恢复补跑。
**文件**：data/treeThemes.ts（新）, data/growthTree.ts, components/WritingTreeView.tsx, components/WritingProgressView.tsx
**参考**：site-setup.md 第 7 节

### [x] Task 10: 对话式工作台 + 游戏化星级任务系统（MVP）（已完成 2026-10-11）
**描述**：把「20 模块平铺」升级为「对话驱动的游戏化学习台」。对话台（ConversationView）是每日向导——AI 判断用户当前该练什么，产出带星级的每日三任务卡片，点击跳转到现有模块（词汇/打字/写作/错题）。星级 = 难度/时长梯度（★1 5min 暖身 → ★5 整块大师），系统按用户 CEFR 推荐匹配星级区间。
**范围与决策**：
- 方向 B（对话为主、工具为辅）；20 模块不删除，作为任务落点。
- 星级锚定：按难度/时长；CEFR 只用于「推荐匹配星级区间」，非硬门控。
- MVP 成瘾机制：每日三任务（1 轻 + 1 中 + 1 重）+ 星级卡片 + streak 强化；三星通关 / 宝箱 / 成就卡放二期。
- 技术前提：aiService 需新增 SSE 流式（当前仅非流式 `chatCompletionWithSystem`）。

### [x] Task 10.1: aiService 新增 SSE 流式接口（已完成 2026-10-11）
**描述**：`services/aiService.ts` 新增 `streamChatCompletion(system, messages, onDelta)`，走 OpenRouter `stream: true` + SSE 逐行解析（fetch + ReadableStream + getReader + TextDecoder），逐 token 回调；保留现有非流式接口不动。
**实现要点**：新增 `callProviderStream`（单 provider 流式，复用 OpenRouter 的 HTTP-Referer/X-Title 头）+ `streamChatCompletion`（带 system 的多 provider 兜底）。失败策略：连接/限流失败回落下一 provider；流中途中断（已吐 token）不回落，避免重复输出。
**验收证据**：`esbuild transformSync(ts)` 通过；`tsc --noEmit --skipLibCheck` 0 错误。运行时逐 token 回调待接入对话台（Task 10.2）后实测。
**文件**：services/aiService.ts
**参考**：site-setup.md 第 7 节「对话式工作台」

### [x] Task 10.2: 对话工作台视图（ConversationView）（已完成 2026-10-11）
**描述**：新组件 `components/ConversationView.tsx`：底部多行输入框 + 消息流（用户右 / AI 左气泡）+ 流式打字机渲染 + AI 消息可内联「结果卡片」协议（结构化数据 → 卡片渲染，非纯文本）。复用现有 MENTOR_PERSONAS 或新增「学习向导」人设（system prompt 定位为"判断你要练什么、带你去练"）。
**验收标准**：
- 输入 → 流式回复逐字渲染；
- AI 返回结构化结果时渲染为卡片（星级/时长/XP/动作按钮）；
- 深色霓虹主题一致；移动端响应式；
- 无 AI key 时有本地兜底提示，不白屏。
**文件**：components/ConversationView.tsx（新）, App.tsx, constants.tsx, types.ts
**参考**：site-setup.md 第 7 节
**验收证据**（2026-10-11）：`esbuild transformSync` 通过（ConversationView 232 行）；`tsc --noEmit --skipLibCheck` 0 错误。实现含欢迎区（学习向导开场 + 4 快捷提示 chips）、消息流（user 渐变紫气泡右 / AI 玻璃气泡左）、流式逐 delta 追加、三点跳动占位、无 key 兜底提示、卡片协议就位（ChatCard 类型 + CardBlock 渲染 + 消息 cards 字段，数据源 Task 10.3 接入）。运行时流式对话待浏览器实测（需配置 AI key）。

### [x] Task 10.3: 星级任务模型 + 每日三任务生成（已完成 2026-10-11）
**描述**：定义星级任务数据模型 `{ module, star(1–5), durationMin, xp, title, action }`；`aiService.ts` 新增 `generateDailyTasks(profile)`：读用户 CEFR + 弱项 + 时间，生成每日三任务（1 轻 + 1 中 + 1 重，对应 ★1–2 / ★3 / ★4–5），返回结构化卡片。无 key / 失败时回退本地任务池（按 CEFR 预设模板）。
**验收标准**：
- 生成 3 个任务、星级与用户 CEFR 匹配；
- 4 个硬资产（词汇/打字/写作/错题）都能作为任务落点；
- 本地兜底可用（离线也能出任务）。
**文件**：services/aiService.ts, types.ts（或新 data/dailyTasks.ts）
**参考**：site-setup.md 第 7 节「星级锚定」
**验收证据**（2026-10-11）：`esbuild transformSync` 通过（4 文件）；`tsc --noEmit --skipLibCheck` 0 错误；dev server 新模块 `data/dailyTasks.ts` + 改动模块编译 200。实现：`types.ts` 加 `DailyTask`/`DailyTaskModule`/`StarLevel`；`data/dailyTasks.ts` 本地池（4 模块 × 5 星 = 20 条）+ `pickLocalTasks`（按 CEFR 星级区间选 1 轻 1 中 1 重）；`aiService.ts` 的 `generateDailyTasks`（AI 优先 + `sanitizeTasks` 清洗 + <3 条或失败回退本地）；`ConversationView` 首次进入展示 3 张星级任务卡。AI 生成待浏览器实测（需 key），本地兜底可离线验证。

### [x] Task 10.4: 导航接入 + 卡片跳转闭环（已完成 2026-10-11）
**描述**：对话台接入导航（NAV_ITEMS 新增「对话」项，图标 MessageCircle）；星级卡片「开始」按钮点击跳转到对应模块（词汇/打字闯关/写作/错题），携带任务上下文；完成任务后回对话台有完成反馈（+XP 计入现有 getLevelInfo）。
**验收标准**：
- 卡片点击跳转正确模块，且携带任务上下文（如预置目标词数/关卡/写作主题）；
- 完成回对话台显示完成态 + XP 奖励；
- 侧栏「对话」项可正常进入/退出，不破坏其余 20 模块。
**文件**：components/ConversationView.tsx, constants.tsx, App.tsx, services/storageService.ts（如涉及任务状态持久化）
**参考**：site-setup.md 第 7 节
**验收证据**（2026-10-11）：`esbuild transformSync` 通过；`tsc --noEmit --skipLibCheck` 0 错误；dev server 编译 200。实现：`StarTaskCard` 加「开始」（`onNavigate(MODULE_TO_MODE[module])` 跳转词汇/打字/写作/错题）+「完成」（`addActivity` 加 XP + level 同步）；任务当天缓存（`linguaflow_daily_tasks`）+ 完成态持久化（`linguaflow_daily_tasks_done`），保证离开再回来完成态不丢。**遗留**：任务上下文预置（如 Typing 预填文本）未做，4 模块上下文机制差异大，留二期增强。

### [x] Task 11: 对话工作台二期增强（游戏化深化）
**描述**：Task 10 MVP 跑通后，按真实使用反馈择项启动。已做：
- **streak 强化联动**（✅ 2026-10-11）：完成全部 3 个今日任务 → `commitDailyStreak` 续连胜（幂等，与产出飞轮共存，同一天只续一次）；今日任务区显示 X/3 进度 + 全完成火焰反馈。
- **宝箱**（✅ 2026-10-11）：完成全部 3 任务可开启今日宝箱，随机 50–150 XP 额外奖励（`linguaflow_daily_chest`，当天仅一次，损失厌恶）。
- **三星通关评价**（✅ 2026-10-11）：完成时自评质量 1–3 星，XP 按倍率加成（★×1 / ★★×1.5 / ★★★×2，`qualityXp` 取整）；完成态存质量（`linguaflow_daily_tasks_done` 的 `done` 映射，`loadDone` 兼容旧 `doneIds` 格式）；完成徽章显示通关星级 + 标签（已完成/认真完成/完美通关）。「全三星解锁大师」未做（需跨天聚合，留后续）。
- **可分享成就卡**（✅ 2026-10-11）：`components/AchievementCard.tsx` 纯前端 canvas 生成 1080×1350 PNG（DPR 2x 高清），内容 = LinguaFlow logo + 连胜天数大字 + Lv·段位 + XP 进度条 + 语言·CEFR + 段位星（新手→大师 5 档点亮）+ 开源标语；系统字体栈（不依赖 Google Fonts）；下载 PNG + Web Share API 分享（不支持回退下载）。入口：对话台欢迎卡右上 + 输入区右下常驻。
- **任务上下文预置**（✅ 2026-10-11）：点「开始」按模块预置目标子视图——词汇/错题直达复习模式（`initialView` prop）；打字（闯关）/写作（自由写）已是默认正确模式，无需预置。App.tsx 加 `taskContext` 状态 + `handleStartTask`（普通导航清除上下文）；ConversationView 的 `onNavigate` 改为 `onStartTask`，删除冗余 `MODULE_TO_MODE`（映射上移 App）。
**Task 11 全部 5 项增强交付完毕。**
**参考**：site-setup.md 第 7 节「二期增强」

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
