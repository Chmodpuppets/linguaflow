# 快速开始与配置

> 从零跑起 LinguaFlow 所需的全部环境、Key、目录与配置说明。
>
> 返回 [README](../README.md)。

## 环境要求
- Node.js 18+（推荐 22）
- **推荐**：一个智谱 GLM 的免费 API Key（[open.bigmodel.cn](https://open.bigmodel.cn/) 注册即送），用于大模型（对话 / 生成 / 批改）
- **若需要中文朗读或录音转写**：额外需要阿里云百炼（DashScope）Key 并开通 **Sambert（TTS）+ Paraformer（STT）** 服务——因为语音接口走的是 DashScope

## 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/Chmodpuppets/linguaflow.git
cd linguaflow

# 2. 安装依赖
npm install

# 3. 配置环境变量（关键步骤，见下）
cp .env.example .env
# 推荐：填入 VITE_GLM_API_KEY（智谱免费模型，首选大模型）
# 若要用中文朗读 / 录音转写：再填入 QWEN_API_KEY 并开通对应语音服务

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

### 首选（推荐）：智谱 GLM 免费模型
1. 注册 / 登录 [智谱开放平台 open.bigmodel.cn](https://open.bigmodel.cn/)。
2. 在「API Keys」创建 Key。智谱提供**免费模型额度**（如 `GLM-4.7-Flash` / `GLM-4-Flash`，以控制台显示为准），白嫖够用。
3. 填入 `.env` 的 `VITE_GLM_API_KEY`。
4. 在应用内「设置 → 模型设置」可随时切换模型；默认即为 OpenRouter（`stealth/ox-alpha`）。

### 备选：阿里云百炼（Qwen）
1. 注册 / 登录 [阿里云百炼控制台](https://dashscope.console.aliyun.com/)。
2. 开通 **模型服务**（文字生成类，如 Qwen-Turbo/Plus/Flash 系列）。
3. 在「API-KEY 管理」创建 Key，填入 `.env` 的 `QWEN_API_KEY`。

> 💡 若你需要**中文朗读（TTS）或录音转写（STT）**，Qwen Key 是必须的——因为语音接口走 DashScope。在百炼控制台额外开通 **语音合成（Sambert）** 与 **语音识别（Paraformer）** 服务即可。

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
├── public/favicon.png      # 站点图标（源自 assets/brand/linguaflow-icon.png）
├── assets/brand/           # 品牌 LOGO 资源（三张 PNG）
├── components/             # 各模块视图（20 个）+ 登录/档案
│   ├── LoginView.tsx          # 登录 / 语言与等级初始化
│   ├── DailyView.tsx          # 今日一站式入口
│   ├── RPGView.tsx            # 剧情对话 LinguaQuest
│   ├── TypingView.tsx         # 打字闯关 Typing Adventure
│   ├── BooksView.tsx          # 书架（EPUB/PDF 导入 + IndexedDB）
│   ├── WritingTreeView.tsx    # 写作树
│   ├── CompositionStudioView.tsx / CompositionEditor.tsx  # 作文流水线
│   ├── WritingView.tsx        # 写作工坊 Writing Lab
│   ├── GuidedWritingView.tsx  # 引导写作模板
│   ├── LibraryView.tsx        # 记忆库 Memory Bank
│   ├── VocabularyView.tsx     # 词汇
│   ├── ErrorBookView.tsx      # 错题本（SRS 间隔复习）
│   ├── PortfolioView.tsx      # 作品集
│   ├── WritingProgressView.tsx# 写作趋势
│   ├── ScriptTrainerView.tsx / HandwritePad.tsx  # 文字特训（手写）
│   ├── InkQuestView.tsx       # 墨程（写作模块：赛季/自由写/听写/故事线/对决/听力库）
│   ├── ContentRepoView.tsx    # 内容仓库（聚合 8 类内容 + 自建 + 导入导出）
│   ├── ImportView.tsx         # 导入
│   ├── SocialView.tsx         # 学习搭子
│   ├── AssessmentView.tsx     # AI 等级测评（嵌入 Profile）
│   ├── WritingLanguageGate.tsx# 写作语言门控（待开发语言提示）
│   └── ProfileView.tsx        # 我的资料
├── services/
│   ├── aiService.ts        # AI 能力封装（LLM / TTS / STT / playWord 语种门控）
│   ├── bookImport.ts       # EPUB/PDF 解析与封面提取
│   └── storageService.ts   # localStorage 读写（含 IndexedDB 书库）
└── ...
```

---

## 配置项说明

所有配置通过项目根目录的 `.env` 文件提供（**已被 `.gitignore` 忽略，不会进仓库**）。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_GLM_API_KEY` | 否* | 智谱 GLM Key，可选大模型；留空则不影响（默认大模型已切到 OpenRouter） |
| `VITE_GLM_BASE_URL` | 否 | GLM 接口地址，默认 `https://open.bigmodel.cn/api/paas/v4` |
| `VITE_GLM_MODEL` | 否 | GLM 模型名，默认 `GLM-4.7-Flash`（如 `GLM-4-Flash`） |
| `QWEN_API_KEY` | 否** | 阿里云百炼 Key，**仅当你需要中文朗读（TTS）/ 录音转写（STT）时才必填** |
| `QWEN_BASE_URL` | 否 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | 否 | Qwen 大模型名，默认 `qwen3.7-flash-2026-07-15`（如 `qwen-max`、`qwen-turbo`） |
| `QWEN_TTS_MODEL` | 否 | TTS 语音模型，默认 `qwen3-tts-flash`（Qwen3-TTS 多语种；如 `qwen-audio-3.0-tts-flash`、`cosyvoice-v1`） |
| `QWEN_STT_MODEL` | 否 | STT 语音识别模型，默认 `paraformer-v2`（如 `paraformer-realtime-v2`） |
| `OPENROUTER_API_KEY` | 否 | OpenRouter Key，**默认大模型 provider**；留空则不启用 OpenRouter |
| `OPENROUTER_MODEL` | 否 | OpenRouter 模型名，默认 `stealth/ox-alpha`（如 `google/gemini-2.5-flash`、`openai/gpt-4o-mini`） |

> \* 若只填了 GLM Key，大模型即走 GLM 免费模型，无需其他 Key。
> \** 若只用 GLM + 非中文朗读，可完全不填 `QWEN_API_KEY`（非中文朗读走浏览器原生语音，免 Key）；只有中文朗读 / 录音转写才需要它。
> 所有变量留空都会回退到上表中的默认值。改完 `.env` 需重启 `npm run dev` 才生效。
> `.env.example` 是模板，请勿把真实 Key 提交到 Git。

---

## 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 6
- **UI**：Tailwind CSS（暗夜霓虹主题，含极光氛围 / 玻璃拟态 / 流光动效 token）+ lucide-react 图标；`components/ui` 提供 GlassCard / NeonButton / NeonBadge / SectionTitle / StatChip 基座
- **状态 / 存储**：浏览器 localStorage（`services/storageService`）
- **手写板**：基于 Canvas 实现（`components/HandwritePad.tsx`，纯前端、无 OCR）
- **AI 接入**：Fetch 调用智谱 GLM / 阿里云 DashScope / OpenRouter 的 OpenAI 兼容接口（无后端依赖）

