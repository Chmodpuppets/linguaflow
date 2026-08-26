<p align="center">
  <img src="assets/brand/linguaflow-app-icon.png" width="220" alt="LinguaFlow">
</p>

# LinguaFlow

> **Mastery via Output** — 一套以「输出驱动」为核心的多语言沉浸式学习系统。

LinguaFlow 是一个**纯前端**的语言学习应用：用 AI 生成练习内容、陪你对话、纠正你的写作、把文字读给你听、还能听懂你的发音。它不追求「背多少单词」，而是逼你**真的去说、去写、去用**——因为语言只有在输出时才真正长在自己身上。

---

## 目录

- [这个项目能做什么](#这个项目能做什么)
- [支持的语言](#支持的语言)
- [核心功能（20 个模块）](./docs/features.md)
- [AI 与语音能力](./docs/ai-voice.md)
- [快速开始与配置](./docs/setup.md)
- [常见问题与限制](./docs/faq.md)
- [加入学习搭子社群（扫码进群）](./docs/contributing.md#想找一起学语言的搭子扫码进群)
- [许可、贡献与社区](./docs/contributing.md)
- [版本与更新日志](./CHANGELOG.md)

---

## 这个项目能做什么

围绕一个理念：**你学得最好的语言，是你用得最多的语言。** 应用把练习做成 **20 个「上手就能玩」的模块**（覆盖输入、输出、复习、社交、复盘完整闭环）：

| 你想练什么 | 用哪个模块 |
| --- | --- |
| 一站式入口、打卡与推荐 | 今日（Daily） |
| 沉浸式剧情对话、练口语思维 | 剧情对话（LinguaQuest） |
| 边读边听、练打字节奏 | 打字闯关（Typing Adventure） |
| 导入 EPUB/PDF、离线读书 | 书架（Books） |
| 长文写作、建自己的知识树 | 写作树（Writing Tree） |
| 系统化成文、从灵感到定稿 | 作文流水线（Composition Studio） |
| 自由写作、求批改 | 写作工坊（Writing Lab） |
| 攒例句、建个人语料 | 记忆库（Memory Bank） |
| 系统化背词 | 词汇（Vocabulary） |
| 沉淀错误、间隔复习 | 错题本（Error Book · SRS） |
| ……其余 10 个模块 | [核心功能详解 →](./docs/features.md) |

> 所有进度、词汇、收藏都存在**你浏览器本地的 localStorage**，不上传任何服务器（调用大模型除外）。完整模块说明与考试评分体系见 [核心功能（20 个模块）](./docs/features.md)。

---

## 支持的语言

内置 **11 种**语言，可任意组合「母语 / 目标语言」：

🇬🇧 English · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇪🇸 Español · 🇫🇷 Français · 🇩🇪 Deutsch · 🇨🇳 中文 · 🇮🇹 Italiano · 🇷🇺 Русский · 🇬🇷 Ελληνικά · 🇸🇦 العربية

> 中文 / 日文 / 韩文等含表意文字的语言，AI 会自动附带**罗马音 / 拼音 / 注音**等发音指引。

---

## 快速开始

```bash
git clone https://github.com/Chmodpuppets/linguaflow.git
cd linguaflow
npm install
cp .env.example .env      # 按需填入 API Key
npm run dev               # 打开 http://localhost:3011
```

默认大模型已切到 OpenRouter（免费推理模型），**开箱即用**；中文朗读 / 录音转写需额外配置。完整的环境要求、API Key 获取、项目结构与配置项见 [快速开始与配置](./docs/setup.md)。

---

## 💬 加入学习搭子社群

> 一个人学语言，最大的敌人是 **孤独**。

我建了个**不卖课、不割韭菜**的外语学习群，就做三件事：**每日打卡 · 互相纠音纠错 · 素材共享**。不管你是日语 N5 还是法语 B2，只要认真在学一门语言，就欢迎你。

<p align="center">
  <img src="https://pathmora.oss-cn-beijing.aliyuncs.com/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20260803040144_265_77.png" width="220" alt="扫码加 Mike 进群">
</p>

扫码加我微信，备注「LinguaFlow」或你想学的语言，我拉你进群。进群后昵称改成「名字 + 在学的语言 + 水平」（如 `Mike · 日语 A1`）。

> 群规与更多说明见 [许可、贡献与社区 →](./docs/contributing.md#想找一起学语言的搭子扫码进群)。

---

## 许可与社区

本项目以 **CC BY-NC 4.0** 发布：**非商业免费 + 署名；商业使用须向作者购买授权**。完整条款、贡献约定与学习搭子社群见 [许可、贡献与社区](./docs/contributing.md)。

当前版本 **`v0.1.1`**，更新日志见 [CHANGELOG.md](./CHANGELOG.md)。

如果你觉得 LinguaFlow 有用，点个 Star ⭐ 就是最大的支持。

---

*LinguaFlow — Mastery via Output.*
