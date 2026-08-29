# LinguaFlow — 项目规格 / 现状基线 (Site Setup)

> 本文件是 LinguaFlow 的**唯一事实来源 (single source of truth)**。
> 任何新需求先更新此处，再由 PM 拆成任务。未经写入本文件的"需求"视为未确认范围。
> 最后更新：2026-08-27（进度核对刷新；此前基线 2026-08-18）

## 1. 一句话定位
LinguaFlow 是一套以「输出驱动 (Mastery via Output)」为核心的多语言沉浸式学习 Web 应用——逼用户真的去说、写、用，而非背单词。当前已实现 **20 个导航模块 / 11 种语言**，覆盖「输入 → 输出 → 复习 → 社交 → 复盘」完整闭环。

## 2. 当前状态（事实基线，来自代码 + 文档交叉核对）
- 形态：**纯前端**，无后端依赖，所有学习数据存浏览器 localStorage。
- 技术栈：React 19 + TypeScript + Vite 6 + Tailwind CSS（深色霓虹主题）+ lucide-react。
- AI 接入：前端直连大模型 OpenAI 兼容接口，统一封装于 `services/aiService.ts`（services 现 7 文件：aiService / storageService / romajiKana / scriptTransliterate / textUtils / ttsCache / bookImport）。
  - 默认主用大模型：**OpenRouter `stealth/ox-alpha`**（免费推理模型，1M 上下文，可经 `.env` 的 `OPENROUTER_MODEL` 覆盖）。
  - 任务路由：fast 任务走 GLM（`GLM-4.7-Flash`）/ Qwen（`qwen3.7-flash-*`），reason 任务走 OpenRouter。**Gemini 已迁出**（无独立 geminiService，旧引用已清除）。
  - TTS：走 Qwen `qwen3-tts-flash`（单模型覆盖中/英/日/韩/俄等多语种）；失败时回退浏览器 Web Speech。英文单词另路由有道 dictvoice。
  - STT：DashScope Paraformer-v2（录音转写接 API 已回退，仅保留本地录音回放；公网 CORS 已知限制）
- 模块（20 个）：今日 / 剧情对话 / 打字闯关 / **歌曲跟打 SongLab** / 写作树 / 作文流水线 / 写作工坊 / 引导写作 / 墨程 / 文字特训 / 记忆库 / 词汇 / 错题本 / **错误模式引擎** / 写作趋势 / 作品集 / 内容仓库 / 导入 / 学习搭子 / 我的资料 / 登录页。
- 支持 **11 种语言**任意组合母语 / 目标语（含表意文字语言自动附罗马音 / 拼音 / 注音）。
- UI：暗夜霓虹重设计已完成（框架层 + 全组件 Wave 0–4，玻璃拟态 + 极光背景 + 流光动效，`prefers-reduced-motion` 自动降级）。
- 进度系统：XP（每 500 升一级，统一 `getLevelInfo(xp)` 计算，已修复原 `xp%100` 漂移 bug）、CEFR 等级、连续打卡 Streak、打字 14 关解锁。
- 引擎：个人**错误模式引擎** + 每日产出飞轮（弱项优先）。
- 开发：dev 端口 3011（`npm run dev`）；构建 `npm run build`。

## 3. 产品原则（约束性，不得违背）
1. 纯前端、无后端（Key 在前端，本地自用；公网部署需自加薄代理）。
2. 本地优先：用户数据不出浏览器（除调用大模型）。
3. 输出驱动：练习必须是"说 / 写 / 用"，不做传统单选填空。

## 4. 明确的范围边界
- ✅ 浏览器内可用；localStorage 持久化；内容仓库 JSON 导入导出（自建素材接入训练）。
- ❌ 不内置后端、不做跨设备同步（除非后续明确立项）。
- ⚠️ 公网部署下 STT 受 CORS 限制（已知限制，需用户自建代理）。
- ⚠️ 录音转写 API 路径已回退为本地回放（避免 CORS 失败影响核心体验）。

## 5. 目标用户
- 认真学一门外语的成人（N5 到 B2 均可）。
- 痛点：孤独、无反馈、易放弃。

## 6. 成功指标（来自产品本身）
- XP / 等级 / CEFR 进度；连续打卡 (Streak)；关卡解锁。
- 用户是否"真的输出了"（写作字数、录音次数、对话轮次）。

## 7. 待立项候选（⚠️ 提案，非已确认需求）
以下来自 README「已知限制」与明显缺口，**尚未批准为范围**。任何一项启动前须先补全本文件第 2/3 节并建任务。
- [x] 公网 STT 稳定性：可选 CORS 代理开关 — **已否决 · 不做**：录音转写 API 路径已回退为本地回放，根据产品决策**不恢复**，Task 3 关闭。（tasklist Task 3）
- [ ] 非中文 TTS 接入 Qwen CosyVoice / Qwen-Audio-TTS。（tasklist Task 4；注：`qwen3-tts-flash` 已单模型覆盖多语种，此需求已弱化，可评估是否仍需独立开关）
- My Profile 整体数据导出 / 导入（账户级一键备份）—— **已立项 · 已完成**：localStorage 全量键 + 书架（IndexedDB 书籍正文）已落地（storageService.exportAllData/importAllData），歌曲音频二进制为已知范围外（体积大、可重新导入源文件）。（tasklist Task 2）
- Playwright 截图回归脚手架 —— **已立项 · 已完成**：`qa/capture.mjs` + `qa-playwright-capture.sh`，点侧栏中文标签切换 7 个代表视图截图到 `public/qa-screenshots`（已实跑 7/7 验证通过）。（tasklist Task 5）
- 写作流水线（作文 + 引导写作）全语言支持 —— **已立项 · 已完成**：补齐 11 种语言的作文大纲标题本地化 + 引导写作 A1/A2 模板，开放给所有支持语言，取消 ja/en/ko 门控；考试语言门控保持 IELTS/TOEFL→EN、JLPT→JA、TOPIK→KO、DELE→ES、缺考回退 CEFR。落地于 commit `13373e8`，`tsc --noEmit` + `vite build` 通过，Playwright 回归 7/7 截图验证。（tasklist Task 7）
- 写作树自定义写作方向（用户私人枝干）—— **已立项 · 已完成（2026-08-29，vite build 待环境恢复后补跑）**：用户可添加专属写作方向（弹窗一句话/引导式描述 → AI 一次生成分级任务阶梯挂成自定义枝干，与内置枝干共用解锁/XP 机制）；支持重命名 / 重新生成 / 删除；无 AI key 时本地模板兜底。方向按目标语言隔离存储（`linguaflow_custom_directions`，纳入备份），上限 5 根；错误模式联动个性化出题放二期。回归脚本 `qa/custom-direction.mjs` 10/10。（tasklist Task 8）
- 写作树 11 语言内容补齐（P0）—— **已完成（2026-08-29）**：消除"名义 11 语言、实质英语"缺口——为 ES/FR/DE/IT/RU/EL/AR/ZH 补齐横向主题树 8 主题（`data/treeThemes.ts`，title/hint 复用中文、A1/A2 提供目标语句型支架）+ 8 语言作文真实考题（`EXTRA_COMPOSITION_PROMPTS`）+ spine 支架按语言扩展（`SpineLeafSeed.scaffolds: Partial<Record<Language,string>>` 取代原 en/ja/ko 三字段）。写作树 11 语言用户不再回退英语内容。
- 写作树交互增强（P2/P3）—— **已完成（2026-08-29）**：① 批改反馈面板新增「再写一版」按钮（保留任务、清空反馈回到作答态，补上 rewrite 类节点的重写闭环）；② 写作趋势页新增「写作者养成主线」8 分支进度可视化（读写作树 spine 数据）；③ 树导航新增搜索过滤（匹配 title/scaffoldHint + 祖先链）、「下一步」定位第一个未完成任务、全部展开/折叠；④ `renderTree` 由每节点全量 filter(O(n²)) 改为预构建 `childrenMap` 索引(O(n))。错题去重经查 `addErrorCards` 内部已实现（按 original+language 匹配则更新而非插入），无需另改。
- [ ] 跨设备同步（需重新评估"无后端"原则）。
- [ ] UI 自身国际化（当前 UI 文案以中文为主）。
- [ ] 更完整的 AI 等级测评（AssessmentView 扩展）。

> 已交付但超出原基线的特性（不在此候选列表，已落地）：SongLab 歌曲跟打、个人错误模式引擎、暗夜霓虹 UI 重设计、XP 进度条统一修复、Gemini 迁出（无独立 geminiService）、侧栏两层折叠、录音转写回退本地回放、**Books 阅读器（EPUB/PDF + IndexedDB）**、**TypeLit 打字训练（Literata 衬线）**、**许可证切换 CC BY-NC 4.0**、**README 拆分 docs/ + 社群扫码**、**release.sh 发版脚本**。

## 8. 技术栈速查（供任务拆解）
- 框架：React 19 + TS
- 构建：Vite 6（dev 端口 3011）
- 样式：Tailwind（深色霓虹主题）
- 图标：lucide-react
- 状态 / 存储：localStorage（`services/storageService.ts`）
- AI：`services/aiService.ts`（统一封装）
- 测试：Playwright 截图回归脚手架已落地（tasklist Task 5 已完成）
