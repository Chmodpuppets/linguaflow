# AI 与语音能力

> LinguaFlow 的 AI / 语音引擎说明：模型路由、TTS 朗读、STT 录音。
>
> 返回 [README](../README.md)。

## AI 能力总览

所有 AI 能力由 `services/aiService.ts` 统一封装，调用方无需关心细节。

| 能力 | 默认实现 | 说明 |
| --- | --- | --- |
| **大模型对话 / 生成（默认）** | **OpenRouter · `stealth/ox-alpha`**（免费推理模型，1M 上下文，2026-08-20 上线） | 默认即用；Key 填 `.env` 的 `OPENROUTER_API_KEY`（[openrouter.ai/keys](https://openrouter.ai/keys) 创建） |
| **大模型（备选）** | 阿里云百炼 **Qwen**（`qwen3.7-flash-2026-07-15`） / 智谱 **GLM 免费模型**（`GLM-4.7-Flash`） | 在「设置 → 模型设置」可随时切换为 Qwen / GLM / 自定义 |
| **降级逻辑** | 当前 provider 触发 429/402/限流时自动跳到下一个；所选 provider 缺 Key 时自动回落首个可用 provider | 过程无感 |
| **文字转语音 TTS** | 中文：`qwen3-tts-flash`（Qwen3-TTS，多语种）；英文单词：有道 `dictvoice`；其他语言：浏览器 Web Speech | **中文朗读依赖 Qwen/DashScope Key**，英文单词走有道免 Key，详见下方「语音 API 说明」 |
| **语音转文字 STT（录音）** | 阿里云 **paraformer-v2** | **依赖 Qwen/DashScope Key + 开通 Paraformer**，详见下方「语音 API 说明」 |

> **模型切换**：大模型默认走 **OpenRouter · `stealth/ox-alpha`**（免费推理模型）。在「设置 → 模型设置」可随时切换为 GLM / Qwen / OpenRouter / 自定义——选 OpenRouter 时模型固定为 `.env` 的 `OPENROUTER_MODEL`（当前 `stealth/ox-alpha`）。降级逻辑：请求依次尝试当前 provider → 备选 provider；只有命中「配额/限流/网络错误」才跳下一个，硬错误（参数错）直接报错。

> **按任务分配模型**：「设置 → 模型设置」底部可按学习环节单独指定模型层级——`快模型`（GLM/Qwen，用于打字辅助、批量取词、翻译、注音、RPG 对话等高频小活）或 `高推理`（OpenRouter/ox-alpha，用于写作深度批改、错误模式诊断、自适应计划、考试评分、文章导学、跨文字特训、对话复盘、SRS 排程、定目标、Agentic 闭环等深推理活），亦可 `跟随全局`。缺省路由见 `services/storageService.ts` 的 `DEFAULT_TASK_ROUTES`。

---

## 语音 API 说明（TTS 与录音 / STT）

LinguaFlow 的「声音」能力分两类，依赖不同接口与 Key，**请勿混淆**：

### 文字转语音（TTS，朗读）
- **中文朗读**：调用阿里云百炼（DashScope）**Qwen3-TTS** 接口（默认模型 `qwen3-tts-flash`，一个模型覆盖中 / 英 / 日 / 韩 / 俄等多语种）。**需要 `QWEN_API_KEY` 且开通语音合成服务。**
- **英文单词发音**：走**有道 `dictvoice`** 词典音（真人词典发音，免费、无需 Key），雅思默认英式、可在词汇复习模式切美式。
- **其他语言 / 兜底**：回退到**浏览器原生 Web Speech API**（`window.speechSynthesis`，系统自带语音），**无需任何 Key**。
- 单词级播放（`playWord`）按语种自动选源：英文→有道、中文→千问 TTS、日语→Web Speech；句子级「朗读」仍走千问 TTS + Web Speech 兜底。
- 即：只练英 / 日 / 韩等非中文，朗读免 Key 可用；想让中文也有声，配 `QWEN_API_KEY`。

### 语音转文字（STT，录音转写）
- 调用阿里云百炼 **paraformer-v2**（异步文件转写）。
- 完整流程（前端实现于 `services/aiService.ts` 的 `transcribeAudio`）：
  1. `MediaRecorder` 录音 → 转码为 16kHz WAV；
  2. `POST {QWEN_HOST}/api/v1/uploads` 申请 DashScope 临时 OSS 上传地址；
  3. `PUT` 上传音频到该 OSS 地址；
  4. `POST {QWEN_HOST}/api/v1/services/audio/asr/transcription` 提交转写任务；
  5. 轮询 `POST {QWEN_HOST}/api/v1/tasks/{task_id}` 取结果。
- **需要 `QWEN_API_KEY` 且开通 Paraformer 语音识别服务。**
- ⚠️ **跨域（CORS）限制**：以上请求从浏览器直连 `dashscope.aliyuncs.com`，**可能受 CORS 限制导致录音功能失败**（本地 `npm run dev` 通常可用，公网部署较易触发）。这是纯前端直连的已知限制——本项目约定不内置后端代理；如需公网稳定使用，请自行加一层极薄的反向代理转发 DashScope 请求（Key 放代理侧也更安全）。

> 一句话：**大模型用 GLM 免费模型（免费用、够强）；英文单词发音走有道（免 Key），中文朗读 + 录音走 DashScope（需 Qwen Key）。两套 Key 相互独立。**
