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
| **大模型（备选 / 按任务路由）** | 阿里云百炼 **Qwen**（`qwen3.8-flash`）/ **OpenRouter** / **DeepSeek**（`deepseek-flash`＝V4.1 Flash） / 自定义 OpenAI 兼容端点 | 在「模型设置」可随时切换；DeepSeek 旧模型名 `deepseek-chat` / `deepseek-reasoner` 已于 2026-07-24 下线，读取配置时自动迁移为 `deepseek-flash` |
| **降级逻辑** | 当前 provider 命中 429/402/限流 / **5xx / 上游不可达** 时自动跳到下一个；所选 provider 缺 Key 时回落首个可用 provider | 硬错误（参数 / 鉴权）直接报错，不盲目重试 |
| **线上版 LLM 中转** | `POST {COMMUNITY_URL}/llm/chat` | 为绕过浏览器 CORS 而设：带账号 token、上游域名白名单防 SSRF、SSE 原样透传。**服务器不内置也不存储你的 Key**（Key 由请求体带上去转发给厂商）；对话内容按合规要求留痕 180 天 |
| **文字转语音 TTS** | **Azure Neural（Edge 免费端点）优先**：146 个音色、17 种语言，线上版由本站服务端合成；不可用（开源版 / 未联网 / 音色不支持）→ `qwen3-tts-flash`（你自己的 Key）→ 浏览器 Web Speech；英文单词走有道 `dictvoice` | 详见下方「语音 API 说明」 |
| **线上版免费音色接口** | `POST {COMMUNITY_URL}/tts/edge` | 服务端替用户合成 Azure Neural 音色（无需登录、无需 Key），按 IP 限流。**开源版无此端点** |
| **线上版 TTS 音频代理** | `GET/POST {COMMUNITY_URL}/tts/audio` | 解决 DashScope 音频 CDN 不给 CORS 的问题：同源转发音频字节，并落**该部署自己的**阿里云 OSS（内容寻址，跨设备复用一样只合成一次）。**开源版默认关闭**（`TTS_PROXY_ENABLED=0`），不启用时前端自动退回本地缓存 |
| **AI 调用授权** | 首次调用弹窗 + 模型设置常驻开关 | 统一拦在 AI 网络出口（`callProvider` / `callProviderStream` / `fetchQwenTtsUrl`），覆盖自动触发的调用；关闭后相关功能走本地兜底 |

> **模型切换**：默认走 GLM · `glm-4-flash`。选 OpenRouter 时模型取 `OPENROUTER_MODEL`。降级依次尝试当前 provider → 备选 provider。
>
> **按任务分配模型**：「模型设置」底部可按学习环节指定 `快模型` / `高推理` / `跟随全局`，缺省路由见 `services/storageService.ts` 的 `DEFAULT_TASK_ROUTES`。
>
> **阅读「意群 & 难词」单独选快模型**：这是「一页一次、短输出、要求快」的小活，按**模型名**（不是槽位名）挑快模型——优先 DeepSeek 官方槽位，其次任意槽位里匹配 `deepseek*flash` / `glm-4-flash` / `qwen*-(turbo|flash)` 的模型，并避开推理模型（`glm-4.5+` / `deepseek-reasoner` / `qwq`）。所以把 DashScope 托管的 `deepseek-v4.1-flash` 配在 **Qwen 槽位**也会被优先选中，不会回落 GLM 推理模型。这类调用会按厂商关掉思考（DeepSeek/GLM `thinking:disabled`、DashScope qwen3 `enable_thinking:false`）。只剩推理模型可用时，面板会如实提示「偏慢、可能返回空」。

---

## AI 调用授权

任何会真正发起 AI 请求的地方都受同一道闸门约束，包括**用户没点按钮就自动触发**的今日任务生成、TTS 朗读等：

- **阅读工作台「意群 & 难词」不在其列**（2026-11-10 起）：这一页不点「用 AI 提取本页意群与难词」就一个请求都不发，也不再预取下一页；只有用户点了按钮（或点「重新提取」）才调用一次。结果按页缓存在内存里，同一页重看不再消耗 token。
- 首次触发会弹出说明，写明：使用**你自己的 Key**、会发送哪些文本、线上版经本站服务器中转、对话留痕 180 天、可随时关闭。
- 点「允许使用 AI」后，**被拦住的那次调用自动继续**，无需重新操作；点「不使用 AI」则走本地兜底。
- 「我的资料 → 模型设置 → AI 调用授权」有常驻开关，状态只保存在本机，不会随云端备份同步到别的设备。
- 缓存命中（内存 / IndexedDB 里已有的音频）不产生新的 AI 调用，因此关闭授权后仍可重播本地音频。

---

## 语音 API 说明（TTS 朗读）

> **STT / 录音转写已移除**，本项目不再提供也不计划恢复。

### 音色从哪来（2026-11 起）

音色表整体换成 **Azure Neural**，和 Edge 浏览器「大声朗读」用的是同一批音色：`services/ttsVoices.ts`
由 `scripts/gen-tts-voices.mjs` 生成（对照 Trancy 的公开音色表 + Edge 端点音色清单合并），共 146 条、17 种语言，
每条标注 `edgeTts` 表示「免费端点能不能合成」。**71 条是 Azure 订阅专属音色**（`*MultilingualNeural`
等），UI 里置灰并标注「需 Azure 订阅」，选中也不会发请求。

「模型设置 → 朗读音色」按语言分组；留空 / 首次使用＝自动跟随**正在学习**的语言取默认音色
（学日语就是 `ja-JP-NanamiNeural`）。另外，实际朗读时若**文本语言**和所选音色语言不一致，
会自动换成该语言默认音色 —— Edge 端点在「英文音色读日文句子」这类输入上会返回空音频（实测）。

### 免费音色链路：`/tts/edge`

| 端点 | 方法 | 行为 |
| --- | --- | --- |
| `/tts/edge` | POST | body `{text, voice, rate?, pitch?}`（text ≤ 1200 字）→ `200 audio/mpeg`；命中全站缓存带 `X-Tts-Cache: hit`；音色不支持 → `400 VOICE_UNAVAILABLE`；超限 → `429`；上游失败 → `502` |
| `/tts/edge` | OPTIONS | CORS 预检（`Access-Control-Allow-Origin: *`），给纯静态的 LinguaFlow Reader 用 |

- 服务端实现在 `server/src/edgeTts.ts`（自研零依赖 WebSocket 客户端，只需 `ws` 包）：走微软朗读端点，
  自算 `Sec-MS-GEC` 令牌（**v2 算法**：`<CS64 校验和>-<SHA256(...)>`），带 `Origin` / `UA` 头，`audio-24khz-48kbitrate-mono-mp3` 输出。
- 缓存与 Qwen 共用 OSS 内容寻址，但 **namespace 分开**（`edge-v1` vs `v1`）：同一句、同一个音色名，
  两条链路合成出的字节完全不同，混用一个 key 会互相污染。
- **这不是官方 API**：地址和令牌算法随时可能变，所以链路上必须保留 Qwen / Web Speech 两级兜底；
  要长期稳定可以换 Azure 官方订阅（同一批 `*Neural` 音色，改 `EDGE_TTS=0` 后自行接 TTS 网关）。
- 关闭：`EDGE_TTS=0`；限流：`TTS_EDGE_RATE_LIMIT`（默认 900 次/10 分钟/IP）。

- **句子级朗读**（`generateSpeech`，用于作文 / 写作树 / 文字特训 / 复写播放器等）：统一走三级链路 ——
  ① **`/tts/edge`（免费 Azure 音色）**；② 失败且填了 Qwen（DashScope）Key、已授权 AI → `qwen3-tts-flash`；
  ③ 都不可用 → 浏览器 Web Speech，并按文本语种选对音色（`ko-KR` / `ja-JP` / `fr-FR` …）。
  三级都不产生「用户看不到声音」的情况；`rate` 只在用户显式调速时透传给 `/tts/edge`（服务端 clamp 0.5–2）。
- **单词级发音**（`playWord`）按语种选源：
  - 中文 → Qwen TTS → Web Speech 兜底
  - 英语 → **Word Atlas 真人录音优先**（与 Reader 同一批 CC BY 4.0 词库录音，7,298 词；
    `services/atlasPronounce.ts` 查 `public/atlas/index.json` 后直接播自有 OSS 音频，
    雅思默认英式、缺英式时用美式）→ 不在词库才回落**有道 `dictvoice`** → Web Speech 兜底。
    连续点多个词时，旧请求的回调会被丢弃，不会覆盖新发音。
  - 日语 → 先试**免费 Azure 音色 `ja-JP-NanamiNeural`**（`/tts/edge`）→ Web Speech 兜底；
    有道是英汉词典，对日语不可靠，不用
  - 韩语及其余语言 → 走 `generateSpeech`（Edge → Qwen → Web Speech）
- 实测：DashScope TTS 接口本身 CORS 放行正式域名，所以填了 Key 后云端 TTS 可用；但它返回的音频 CDN（`dashscope-result-bj.oss-cn-beijing.aliyuncs.com`）**返回 `ACAO: null`**，前端抓不到 Blob —— 这也是线上版一定要走 `/tts/audio` 中转的原因。

### TTS 缓存（同一个词只合成一次）

四层查找，命中即 0 次接口调用：

1. **内存 LRU**（`services/ttsCache.ts`，16 条，key = 音色 ‖ 文本）
2. **IndexedDB Blob**（`services/ttsBlobCache.ts`，200 条 / 20MB 上限）——存音频内容本身，**永不过期**
3. **IndexedDB URL + `expires_at`**——没有服务端中转时退存官方返回的音频 URL 与精确过期时间（留 10 分钟余量），`<audio>` 播放跨域媒体不需要 CORS；过期自动删条目并重新合成
4. **服务端共享缓存**（`GET /tts/audio`，仅线上版且已登录）——别的设备 / 别的用户合成过的同一句话，直接白捡；命中后存进本地 IndexedDB，连这个请求都省了
5. 以上都未命中才请求上游（Edge 或 Qwen），后台异步落盘（Edge 走服务端 OSS，Qwen 走 `POST /tts/audio`），不阻塞首次播放

配额满时按创建时间淘汰最旧；隐私模式 / IndexedDB 不可用时静默退回内存缓存，绝不阻断播放。
开源版（`COMMUNITY_URL` 为空）与未登录状态下，第 4、5 步自动跳过，行为与之前一致。

### 服务端音频代理（`/tts/audio`）

> **两个发行版在这里是分开的。**
> - **开源版**：服务端 `TTS_PROXY_ENABLED` 默认 `0`，`/tts/audio` 返回 503；前端 `COMMUNITY_URL` 为空，
>   根本不会去请求它。仓库里不含任何真实 OSS 凭证或 bucket 名。自建者想用就填**自己的** OSS 再置 1。
> - **线上版**：只有 `linguaflow.pathmora.cn` 那台服务器的 `.env` 里有凭证且置了 `TTS_PROXY_ENABLED=1`。
>   换句话说，**这套 OSS 只服务于线上版**，fork 本仓库不会碰到它。

| 端点 | 方法 | 行为 |
| --- | --- | --- |
| `/tts/audio?text=&voice=` | GET | 命中 → 音频字节（`Cache-Control: immutable`）；未命中 → `404 {error:'not cached'}`；未启用 → `503` |
| `/tts/audio` | POST | body `{text, voice, src}` 或 `{text, voice, data, contentType}` → 抓上游/解码 → 落 OSS → **回传音频字节**，响应头 `X-Tts-Stored: 1/0` |

- **对象 key 内容寻址**：`sha256("v1|<voice>|<text>")` → `tts/v1/<前2位>/<hash>`，所以任何设备算出的地址都一样，不需要先查库再决定要不要合成。
- **启用但没配 OSS**：只做转发不落盘，前端照样拿到 Blob 存本地，只是不跨设备共享。
- **防 SSRF**：`TTS_ALLOW_HOSTS` 默认只放行 `.aliyuncs.com`；内网地址、非白名单域名一律 400。
- **鉴权与限流**：需要 `Authorization: Bearer <token>`；单 IP 每小时 `TTS_RATE_LIMIT`（默认 1200）次。

> 一句话：**大模型用你自己的 GLM Key；朗读默认走免费的 Azure 音色（线上版 `/tts/edge` 服务端合成），失败再退 Qwen、最后退浏览器语音；所有 AI 调用都要先经过一次授权，音频会跨会话（线上版还跨设备）缓存，同一个词不会重复合成。**
