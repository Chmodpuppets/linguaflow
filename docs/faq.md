# 已知限制与常见问题

> 踩坑前先看这里。
>
> 返回 [README](../README.md)。

**Q1：为什么英文单词的发音是有道的声音、而中文句子是千问的声音？**
这是有意的**语种门控**：英文单词走有道 `dictvoice` 真人词典音（免费、无需 Key、最贴近词典发音）；中文走千问 `qwen3-tts-flash`；日语与兜底走浏览器原生 Web Speech。句子级「朗读」仍默认走千问 TTS + Web Speech 兜底。若希望非中文句子也用千问声音，可接入百炼的 CosyVoice / Qwen-Audio-TTS 并扩展 `aiService.ts`。详见 [AI 与语音能力](./ai-voice.md)。

**Q2：录音识别（STT）没反应 / 报错？**
录音走 DashScope `paraformer-v2`，完整链路见 [AI 与语音能力](./ai-voice.md)。常见原因：
- 没填 `QWEN_API_KEY`，或没在百炼开通 **Paraformer** 语音识别服务；
- 浏览器直连 `dashscope.aliyuncs.com` **受跨域（CORS）限制**（本地 dev 通常可用，公网部署易触发）。
- 解决：确认 Key 与服务已开通；公网环境请加一层薄代理转发 DashScope 请求（本项目约定不内置后端）。

**Q3：我的数据安全吗？**
学习进度、词汇、收藏**只存在你本地浏览器的 localStorage**，不经由任何服务器。唯一的对外请求是调用大模型（携带你的 API Key 从前端发出）。注意：**前端直连意味着 Key 在浏览器端可见**，本地自用无妨，若部署到公网请务必把 Key 移到后端代理。

**Q4：能换模型吗？**
可以。改 `services/aiService.ts` 顶部的 `QWEN_LLM_MODEL` / `OPENROUTER_LLM_MODEL` 即可切换模型；如需换 TTS / STT 模型，改对应函数即可。
