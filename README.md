# LinguaFlow

> **Mastery via Output** — 一套以「输出驱动」为核心的多语言沉浸式学习系统。

LinguaFlow 是一个**纯前端**的语言学习应用：用 AI 生成练习内容、陪你对话、纠正你的写作、把文字读给你听、还能听懂你的发音。它不追求「背多少单词」，而是逼你**真的去说、去写、去用**——因为语言只有在输出时才真正长在自己身上。

---

## 目录

- [这个项目能做什么](#这个项目能做什么)
- [支持的语言](#支持的语言)
- [核心功能（七大模式）](#核心功能七大模式)
- [AI 能力说明](#ai-能力说明)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [如何获取 API Key](#如何获取-api-key)
- [项目结构](#项目结构)
- [配置项说明](#配置项说明)
- [已知限制与常见问题](#已知限制与常见问题)
- [开源与贡献](#开源与贡献)

---

## 这个项目能做什么

LinguaFlow 围绕一个理念设计：**你学得最好的语言，是你用得最多的语言。** 所以应用里没有传统课本式的单选填空，而是把练习做成了 7 种「上手就能玩」的模式：

| 你想练什么 | 用哪个模式 | 体验 |
| --- | --- | --- |
| 边读边听、练打字节奏 | **Typing Adventure（打字冒险）** | 像闯关游戏一样逐关解锁，AI 生成短文 + 朗读 + 母语翻译 |
| 沉浸式对话、练口语思维 | **LinguaQuest（角色扮演）** | AI 扮演咖啡师、房东、面试官……给你真实场景练自然表达 |
| 长文写作、建自己的知识树 | **Writing Tree（写作树）** | 像思维导图一样组织你的文章，AI 帮你分类灵感、润色段落 |
| 自由写作、求批改 | **Writing Lab（写作工坊）** | 写一段，AI 逐句纠错 + 给 CEFR 等级评估 |
| 攒例句、建个人语料 | **Memory Bank（记忆银行）** | 收藏好句子、做阅读反思，随时调出来再练 |
| 系统化背词 | **Vocabulary（词汇本）** | 自动建档 + AI 释义 + 例句，配合闯关进度 |
| 看成长、换语言 | **My Profile（我的档案）** | 等级、XP、连续打卡、CEFR 进度一目了然 |

所有进度、词汇、收藏都存在**你浏览器本地的 localStorage**，不上传任何服务器（调用大模型除外，详见下文）。

---

## 支持的语言

内置 8 种语言，可任意组合「母语 / 目标语言」：

🇬🇧 English · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇪🇸 Español · 🇫🇷 Français · 🇩🇪 Deutsch · 🇨🇳 中文 · 🇮🇹 Italiano

> 中文 / 日文 / 韩文等含表意文字的语言，AI 会自动附带**罗马音 / 拼音 / 注音**等发音指引，降低上手门槛。

---

## 核心功能（七大模式）

### 1. Typing Adventure（打字冒险）
- AI 按你的 CEFR 等级生成 50–80 词的短文，附带母语翻译和核心词汇表。
- 点击喇叭按钮可**朗读**（中文走千问 TTS，其他语言走浏览器原生语音）。
- 录音后点「识别发音」可用 AI 转写你的口语，和原文对照纠音。
- 内置 14 个关卡（World 1「基础」→ World 4「大师」），按 WPM / 准确率逐关解锁，含 Boss 关。

### 2. LinguaQuest（角色扮演对话）
- 选一个主题（点咖啡、租房、面试……），AI 生成完整剧本：场景、你的角色、对方角色、开场白、建议回复。
- 每一轮 AI 都返回：**自然回复 + 母语翻译 + 发音指引 + 建议下一句 + 本句重点词汇 + 目标完成度**。
- 完成所有目标即可通关，过程中实时记录你打过卡的词汇。

### 3. Writing Tree（写作树）
- 用树状结构组织你的写作项目（书 / 论文 / 博客）。
- 「灵感盒」：丢一段杂乱想法进去，AI 帮你判断该放进哪个章节、提炼标题、润色内容。
- 选中节点可让 AI「写作教练」给结构点评与扩写建议。

### 4. Writing Lab（写作工坊）
- 自由输入一段目标语言写作，AI 返回：修正后的全文、逐条修改建议（附母语解释）、总体评语、CEFR 等级估算。

### 5. Memory Bank（记忆银行）
- 收藏任意好句 / 短文，附笔记。
- 可让 AI 做「阅读反思」（主题、最打动你的点、例子、一句话总结），加深理解。
- 一键把收藏内容送回 Typing Adventure 当作练习文本。

### 6. Vocabulary（词汇本）
- 练习中遇到的生词自动建档，支持 AI 一键补全释义、词性、例句。
- 与个人闯关进度联动。

### 7. My Profile（我的档案）
- 查看用户名下各语言的 XP、等级、CEFR 等级、连续打卡天数（Streak）。
- 切换正在学习的语言、登出账号。

---

## AI 能力说明

所有 AI 能力由 `services/aiService.ts` 统一封装，调用方无需关心细节。

| 能力 | 实现 | 说明 |
| --- | --- | --- |
| **大模型对话 / 生成** | 阿里云百炼 **Qwen**（`qwen3.7-flash-2026-07-15`） | 主语料生成、对话、批改、润色 |
| **额度耗尽自动降级** | **OpenRouter**（Gemini 兜底） | Qwen 触发 429/402/限流时自动切换到 OpenRouter，过程无感 |
| **文字转语音（TTS）** | 中文：`sambert-zhide-v1`；其他语言：浏览器 Web Speech | 见下方「已知限制」 |
| **语音转文字（STT）** | 阿里云 **paraformer-v2** | 录音 → 转写，用于 Typing 的发音对照 |

> **降级逻辑**：请求依次尝试 `LLM_PROVIDERS = [qwen, openrouter]`。只有命中「配额/限流/网络错误」才跳到下一个；若是请求参数错误等硬错误，则直接报错不再重试。

---

## 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 6
- **UI**：Tailwind CSS（深色主题）+ lucide-react 图标
- **状态 / 存储**：浏览器 localStorage（`services/storageService`）
- **AI 接入**：Fetch 调用 DashScope / OpenRouter 的 OpenAI 兼容接口（无后端依赖）

---

## 快速开始

### 环境要求
- Node.js 18+（推荐 22）
- 一个阿里云百炼（DashScope）的 API Key（用于 Qwen 大模型；可选 OpenRouter Key 作兜底）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/Chmodpuppets/linguaflow.git
cd linguaflow

# 2. 安装依赖
npm install

# 3. 配置环境变量（关键步骤，见下）
cp .env.example .env
# 然后编辑 .env，填入你的 QWEN_API_KEY

# 4. 启动开发服务器
npm run dev
# 打开 http://localhost:3011

# 5.（可选）构建生产版本
npm run build
npm run preview
```

启动后首次进入会让你填昵称、选母语 / 目标语言 / 当前等级，完成后即可进入主界面。

---

## 如何获取 API Key

### 主用：阿里云百炼（Qwen）
1. 注册 / 登录 [阿里云百炼控制台](https://dashscope.console.aliyun.com/)。
2. 开通 **模型服务**（文字生成类模型，如 Qwen-Turbo/Plus/Flash 系列）。
3. 在「API-KEY 管理」创建 Key，复制下来。
4. 填入 `.env` 的 `QWEN_API_KEY`。

> 若你想用 TTS（中文朗读）和 STT（录音转写），还需在百炼控制台开通对应的**语音合成（Sambert）**与**语音识别（Paraformer）**服务。

### 兜底：OpenRouter
1. 注册 [OpenRouter](https://openrouter.ai/keys) 并创建 Key。
2. 填入 `.env` 的 `OPENROUTER_API_KEY`（留空则不启用兜底）。

---

## 项目结构

```
linguaflow/
├── index.html              # 入口 HTML
├── index.tsx               # React 挂载入口
├── App.tsx                 # 主框架：侧边栏导航 + 模式路由
├── vite.config.ts          # Vite 配置（注入 .env 变量）
├── types.ts                # 全局类型（语言、等级、各模式数据结构）
├── constants.tsx           # 语言清单、导航项、关卡地图
├── .env.example            # 环境变量模板（复制为 .env 后填写）
├── components/             # 七大模式视图 + 登录/档案
│   ├── LoginView.tsx
│   ├── TypingView.tsx
│   ├── RPGView.tsx          # LinguaQuest
│   ├── WritingTreeView.tsx
│   ├── WritingView.tsx      # Writing Lab
│   ├── LibraryView.tsx      # Memory Bank
│   ├── VocabularyView.tsx
│   ├── AssessmentView.tsx   # AI 等级测评（嵌入 Profile）
│   └── ProfileView.tsx
├── services/
│   ├── aiService.ts        # AI 能力封装（LLM / TTS / STT）
│   └── storageService.ts   # localStorage 读写
└── ...
```

---

## 配置项说明

所有配置通过项目根目录的 `.env` 文件提供（**已被 `.gitignore` 忽略，不会进仓库**）。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `QWEN_API_KEY` | ✅ 是 | 阿里云百炼 API Key，大模型主用 |
| `QWEN_BASE_URL` | 否 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | 否 | 主用大模型名，默认 `qwen3.7-flash-2026-07-15`（如 `qwen-max`、`qwen-turbo`） |
| `QWEN_TTS_MODEL` | 否 | TTS 语音模型，默认 `sambert-zhide-v1`（如 `sambert-eva-v1`、`cosyvoice-v1`、`qwen-audio-3.0-tts-flash`） |
| `QWEN_STT_MODEL` | 否 | STT 语音识别模型，默认 `paraformer-v2`（如 `paraformer-realtime-v2`） |
| `OPENROUTER_API_KEY` | 否 | OpenRouter Key，Qwen 限流时自动兜底；留空则不启用 |
| `OPENROUTER_MODEL` | 否 | 兜底大模型名，默认 `google/gemini-2.5-flash` |

> 所有变量留空都会回退到上表中的默认值。改完 `.env` 需重启 `npm run dev` 才生效。
> `.env.example` 是模板，请勿把真实 Key 提交到 Git。

---

## 已知限制与常见问题

**Q1：为什么非中文的朗读听起来不是「千问」的声音？**
`sambert-zhide-v1` 是千问的中文音色。为保证各语言都能出声，非中文内容回退到**浏览器自带的 Web Speech API**（系统语音）。如果你希望非中文也用千问声音，可接入百炼的 CosyVoice / Qwen-Audio-TTS 等模型，并改用对应的 TTS 接口（需自行扩展 `aiService.ts`）。

**Q2：录音识别（STT）没反应 / 报错？**
paraformer-v2 是异步文件转写服务，前端需要把录音上传到 DashScope 的临时 OSS 再轮询结果。浏览器直连 `dashscope.aliyuncs.com` **可能受跨域（CORS）限制**，会导致识别失败。若遇此情况：
- 确认已在百炼开通 Paraformer 服务；
- 正式环境建议加一个极薄的代理 / Serverless 函数转发相关请求（Key 放后端也更安全）。

**Q3：我的数据安全吗？**
学习进度、词汇、收藏**只存在你本地浏览器的 localStorage**，不经由任何服务器。唯一的对外请求是调用大模型（携带你的 API Key 从前端发出）。注意：**前端直连意味着 Key 在浏览器端可见**，本地自用无妨，若部署到公网请务必把 Key 移到后端代理。

**Q4：能换模型吗？**
可以。改 `services/aiService.ts` 顶部的 `QWEN_LLM_MODEL` / `OPENROUTER_LLM_MODEL` 即可切换模型；如需换 TTS / STT 模型，改对应函数即可。

---

## 开源与贡献

本项目以 MIT 许可证开源，欢迎 Issue 与 PR。

使用约定：
- 提交前请确认 `.env` 不会被纳入版本库（已默认忽略）。
- 新增 AI 能力请统一收敛到 `services/aiService.ts`，保持对外函数签名稳定。
- 模式视图保持纯前端、无后端依赖的设计原则。

如果你觉得 LinguaFlow 有用，点个 Star ⭐ 就是最大的支持。

---

*LinguaFlow — Mastery via Output.*
