# LinguaFlow — 项目规格 / 现状基线 (Site Setup)

> 本文件是 LinguaFlow 的**唯一事实来源 (single source of truth)**。
> 任何新需求先更新此处，再由 PM 拆成任务。未经写入本文件的"需求"视为未确认范围。
> 最后更新：2026-08-18（盘点刷新；此前基线为 2026-08-04）

## 1. 一句话定位
LinguaFlow 是一套以「输出驱动 (Mastery via Output)」为核心的多语言沉浸式学习 Web 应用——逼用户真的去说、写、用，而非背单词。当前已实现 **19 个导航模块 / 11 种语言**，覆盖「输入 → 输出 → 复习 → 社交 → 复盘」完整闭环。

## 2. 当前状态（事实基线，来自代码 + 文档交叉核对）
- 形态：**纯前端**，无后端依赖，所有学习数据存浏览器 localStorage。
- 技术栈：React 19 + TypeScript + Vite 6 + Tailwind CSS（深色霓虹主题）+ lucide-react。
- AI 接入：前端直连大模型 OpenAI 兼容接口，统一封装于 `services/aiService.ts`（services 现 6 文件：aiService / storageService / romajiKana / scriptTransliterate / textUtils / ttsCache）。
  - 默认大模型：智谱 GLM 免费模型（`GLM-4.7-Flash`）
  - 备选：阿里云百炼 Qwen；兜底 OpenRouter（Gemini）
  - TTS：中文走 DashScope Sambert；其他语言走浏览器 Web Speech（非中文不再接 API）
  - STT：DashScope Paraformer-v2（录音转写接 API 已回退，仅保留本地录音回放；公网 CORS 已知限制）
- 模块（19）：今日 / 剧情对话 / 打字闯关 / **歌曲跟打 SongLab** / 写作树 / 作文流水线 / 写作工坊 / 引导写作 / 墨程 / 文字特训 / 记忆库 / 词汇 / 错题本 / **错误模式引擎** / 写作趋势 / 作品集 / 内容仓库 / 导入 / 学习搭子 / 我的资料 / 登录页。
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
- [ ] 公网 STT 稳定性：可选 CORS 代理开关（env 切换）。（tasklist Task 3）
- [ ] 非中文 TTS 接入 Qwen CosyVoice / Qwen-Audio-TTS。（tasklist Task 4）
- [ ] My Profile 整体数据导出 / 导入（备份与迁移）—— 注意：内容仓库已有按类型 JSON 导入导出，本项特指账户级一键备份。（tasklist Task 2）
- [ ] 跨设备同步（需重新评估"无后端"原则）。
- [ ] UI 自身国际化（当前 UI 文案以中文为主）。
- [ ] 更完整的 AI 等级测评（AssessmentView 扩展）。

> 已交付但超出原基线的特性（不在此候选列表，已落地）：SongLab 歌曲跟打、个人错误模式引擎、暗夜霓虹 UI 重设计、XP 进度条统一修复、Gemini 迁出（无独立 geminiService）、侧栏两层折叠、录音转写回退本地回放。

## 8. 技术栈速查（供任务拆解）
- 框架：React 19 + TS
- 构建：Vite 6（dev 端口 3011）
- 样式：Tailwind（深色霓虹主题）
- 图标：lucide-react
- 状态 / 存储：localStorage（`services/storageService.ts`）
- AI：`services/aiService.ts`（统一封装）
- 测试：可选 Playwright 截图回归（tasklist Task 5，未做）
