# AI 与语音能力

> LinguaFlow 的 AI / 语音引擎说明：模型路由、AI 调用授权、TTS 朗读与缓存。
>
> 返回 [README](../README.md)。

## AI 能力总览

所有 AI 能力由 `services/aiService.ts` 统一封装，调用方无需关心细节。
**生产构建不内置任何 API Key**——所有 provider 都由用户在「我的资料 → 模型设置」里填写自己的密钥。

| 能力 | 默认实现 | 说明 |
| --- | --- | --- |
| **大模型对话 / 生成（默认）** | **智谱 GLM · `glm-4-flash`** | 在应用内「模型设置」填入自己的 GLM Key（[open.bigmodel.cn](https://open.bigmodel.cn/) 注册即送免费额度）；本地开发也可写进 `.env` 的 `GLM_API_KEY`，但不会打进生产包 |
| **大模型（备选 / 按任务路由）** | 阿里云百炼 **Qwen**（`qwen3.8-flash`）/ **OpenRouter** / **DeepSeek**（`deepseek-chat`） / 自定义 OpenAI 兼容端点 | 在「模型设置」可随时切换 |
| **降级逻辑** | 当前 provider 命中 429/402/限流 / **5xx / 上游不可达** 时自动跳到下一个；所选 provider 缺 Key 时回落首个可用 provider | 硬错误（参数 / 鉴权）直接报错，不盲目重试 |
| **线上版 LLM 中转** | `POST {COMMUNITY_URL}/llm/chat` | 为绕过浏览器 CORS 而设：带账号 token、上游域名白名单防 SSRF、SSE 原样透传。**服务器不内置也不存储你的 Key**（Key 由请求体带上去转发给厂商）；对话内容按合规要求留痕 180 天 |
| **文字转语音 TTS** | `qwen3-tts-flash` 优先（多语种），失败 / 无 Key → 浏览器 Web Speech；英文单词走有道 `dictvoice`；日语单词固定 Web Speech | 详见下方「语音 API 说明」 |
| **AI 调用授权** | 首次调用弹窗 + 模型设置常驻开关 | 统一拦在 AI 网络出口（`callProvider` / `callProviderStream` / `fetchQwenTtsUrl`），覆盖自动触发的调用；关闭后相关功能走本地兜底 |

> **模型切换**：默认走 GLM · `glm-4-flash`。选 OpenRouter 时模型取 `OPENROUTER_MODEL`。降级依次尝试当前 provider → 备选 provider。
>
> **按任务分配模型**：「模型设置」底部可按学习环节指定 `快模型` / `高推理` / `跟随全局`，缺省路由见 `services/storageService.ts` 的 `DEFAULT_TASK_ROUTES`。

---

## AI 调用授权

任何会真正发起 AI 请求的地方都受同一道闸门约束，包括**用户没点按钮就自动触发**的今日任务生成、阅读意群预取、TTS 朗读等：

- 首次触发会弹出说明，写明：使用**你自己的 Key**、会发送哪些文本、线上版经本站服务器中转、对话留痕 180 天、可随时关闭。
- 点「允许使用 AI」后，**被拦住的那次调用自动继续**，无需重新操作；点「不使用 AI」则走本地兜底。
- 「我的资料 → 模型设置 → AI 调用授权」有常驻开关，状态只保存在本机，不会随云端备份同步到别的设备。
- 缓存命中（内存 / IndexedDB 里已有的音频）不产生新的 AI 调用，因此关闭授权后仍可重播本地音频。

---

## 语音 API 说明（TTS 朗读）

> **STT / 录音转写已移除**，本项目不再提供也不计划恢复。

- **句子级朗读**（`generateSpeech`，用于作文 / 写作树 / 文字特训 / 复写播放器等）：填了 Qwen（DashScope）Key 且已授权 AI → 调用 `qwen3-tts-flash`（一个模型覆盖中 / 英 / 日 / 韩 / 俄等多语种）；没有 Key、未授权或请求失败 → 回落到浏览器 Web Speech，并按文本语种选对音色（`ko-KR` / `ja-JP` / `fr-FR` …）。
- **单词级发音**（`playWord`）按语种选源：
  - 中文 → Qwen TTS → Web Speech 兜底
  - 英语 → **有道 `dictvoice`** 词典音（免 Key，雅思默认英式、可切美式）→ Web Speech 兜底
  - 日语 → 固定 **Web Speech `ja-JP`**（有道是英汉词典，对日语不可靠）
  - 韩语及其余语言 → 走 `generateSpeech`（Qwen → Web Speech）
- 实测：DashScope TTS 接口本身 CORS 放行正式域名，所以填了 Key 后云端 TTS 可用；但它返回的音频 CDN 不返回 CORS 头，因此前端**无法把该音频直接抓成 Blob**（见下方缓存策略的兜底）。

### TTS 缓存（同一个词只合成一次）

三层查找，命中即 0 次接口调用：

1. **内存 LRU**（`services/ttsCache.ts`，16 条，key = 音色 ‖ 文本）
2. **IndexedDB Blob**（`services/ttsBlobCache.ts`，200 条 / 20MB 上限）——音频能抓到时存内容本身，**永不过期**
3. **IndexedDB URL + `expires_at`**——CDN 不给 CORS 时退存官方返回的音频 URL 与精确过期时间（留 10 分钟余量），`<audio>` 播放跨域媒体不需要 CORS；过期自动删条目并重新合成
4. 以上都未命中才请求 Qwen，后台异步落盘，不阻塞首次播放

配额满时按创建时间淘汰最旧；隐私模式 / IndexedDB 不可用时静默退回内存缓存，绝不阻断播放。

> 一句话：**大模型用你自己的 GLM Key；TTS 优先 Qwen、无 Key 自动回落浏览器语音；所有 AI 调用都要先经过一次授权，音频会跨会话缓存，同一个词不会重复扣接口。**
