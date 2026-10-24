# LinguaFlow — 项目规格 / 现状基线 (Site Setup)

> 本文件是 LinguaFlow 的**唯一事实来源 (single source of truth)**。
> 任何新需求先更新此处，再由 PM 拆成任务。未经写入本文件的"需求"视为未确认范围。
> 最后更新：2026-10-15（「学习搭子」立项：打破「无后端」约束，方向定为**多邻国式「一起连胜」异步社交**，无 AI、非实时）

## 1. 一句话定位
LinguaFlow 是一套以「输出驱动 (Mastery via Output)」为核心的多语言沉浸式学习 Web 应用——逼用户真的去说、写、用，而非背单词。当前已实现 **20 个导航模块 / 11 种语言**，覆盖「输入 → 输出 → 复习 → 社交 → 复盘」完整闭环。

## 2. 当前状态（事实基线，来自代码 + 文档交叉核对）
- 形态：**纯前端为主**，所有学习数据存浏览器本地（localStorage + IndexedDB）。自 2026-10-15 起新增**可选轻后端社交**（`server/`，Hono + SQLite，无 AI、非实时）：`server/` 只存最小社交数据（昵称 / 好友关系 / streak），支撑「学习搭子一起连胜」；另保留可选整包备份（手动触发）。不配置服务器 = 现有纯本地模式，功能不降级。
- 技术栈：React 19 + TypeScript + Vite 6 + Tailwind CSS（深色霓虹主题）+ lucide-react。
- AI 接入：前端直连大模型 OpenAI 兼容接口，统一封装于 `services/aiService.ts`（services 现 9 文件：aiService / storageService / romajiKana / scriptTransliterate / textUtils / ttsCache / bookImport / chatLogService / errorReporter / moderationService）。
  - **密钥模型（2026-10-23 起，重要）**：**生产构建不内置任何 API Key**（`vite.config.ts` 在 `production`/`online` 模式把 QWEN/OPENROUTER/GLM/MODERATION 的 Key 全部清空）；`.env` 仅对 `npm run dev` 生效。**四家 provider（GLM / Qwen / OpenRouter / 自定义）都支持用户在「模型设置」里自填 baseUrl + 模型名 + Key**；无 Key 时 AI 调用抛明确引导，对话台欢迎区会展示免费额度申请引导（GLM / 阿里云百炼 / OpenRouter）。
  - 默认 provider：**智谱 GLM（`GLM-4.7-Flash`）**。原 OpenRouter `stealth/ox-alpha` 已于 2026-10 测试期结束（404），正式名 `z-ai/glm-5.3-flash`，仅在用户自填 OpenRouter Key 时使用。
  - 任务路由：fast 任务走 GLM / Qwen，reason 任务走 OpenRouter（有 Key 时）。**Gemini 已迁出**（无独立 geminiService，旧引用已清除）。
  - **合规（代码层已落地）**：① AI 生成内容显式标识 `AIBadge`（GB 45438—2025，铺在对话台 / 剧情对话 / 墨程 / 写作树 / 写作工坊）；② 内容安全 `moderationService`（本地拦截词可配 + 可选远端审核，AI 输入输出双向；默认放行、远端失败不阻断）；③ 账号注销 + 对话日志留存 180 天 + 隐私政策/用户协议（`docs/privacy.md` / `docs/terms.md`）。
  - TTS：走 Qwen `qwen3-tts-flash`（单模型覆盖中/英/日/韩/俄等多语种）；失败时回退浏览器 Web Speech。英文单词另路由有道 dictvoice。
  - STT：DashScope Paraformer-v2（录音转写接 API 已回退，仅保留本地录音回放；公网 CORS 已知限制）
- 模块（22 个，与 `constants.tsx` 的 `NAV_ITEMS` 逐项一致）：**对话** / 今日 / 剧情对话 / 打字闯关 / **书架 Books** / **学习书库** / 写作树 / 作文流水线 / 写作工坊 / 记忆库 / 词汇 / 错题本 / **错误模式引擎** / 作品集 / 写作趋势 / 文字特训 / 墨程 / 内容仓库 / 导入 / **歌曲跟打 SongLab** / 学习搭子 / 我的资料。
  - 非导航项，勿计入模块数：`引导写作`（`GuidedWritingView`，「写作工坊」的子标签）、`登录页`（`LoginView`，未登录时全屏占位）、`水平测试`（`AppMode.Assessment`，首次引导流程）。
- 支持 **11 种语言**任意组合母语 / 目标语（含表意文字语言自动附罗马音 / 拼音 / 注音）。
- UI：暗夜霓虹重设计已完成（框架层 + 全组件 Wave 0–4，玻璃拟态 + 极光背景 + 流光动效，`prefers-reduced-motion` 自动降级）。
- 进度系统：XP（每 500 升一级，统一 `getLevelInfo(xp)` 计算，已修复原 `xp%100` 漂移 bug）、CEFR 等级、连续打卡 Streak、打字 14 关解锁。
- 引擎：个人**错误模式引擎** + 每日产出飞轮（弱项优先）。
- 开发：dev 端口 3011（`npm run dev`）；构建 `npm run build`。

## 3. 产品原则（约束性，不得违背）
1. 本地优先（数据主权）：学习数据以浏览器本地为源，永不自发出网（除调用大模型）。
2. 可选轻后端（无 AI、非实时）：社区走一个极简云服务（`server/`，Hono + SQLite），只存最小社交数据（昵称 / 好友关系 / streak），支撑「一起连胜」；无 AI、无 WebSocket/推送，一切在「打开页面 / 手动同步」时拉取。整包备份为可选子功能。未配置服务器 = 纯本地模式，功能不降级。
3. 输出驱动：练习必须是"说 / 写 / 用"，不做传统单选填空。

## 4. 明确的范围边界
- ✅ 浏览器内可用；localStorage 持久化；内容仓库 JSON 导入导出（自建素材接入训练）。
- ✅ 可选轻后端社交（学习搭子「一起连胜」：昵称 + 好友码 + 多好友 + 共同连胜天数 + 提醒；非实时）；可选整包备份（手动触发）；核心学习功能仍本地、离线可用。
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
- [x] 学习搭子「一起连胜」（可选轻后端社交）—— **已立项 · 进行中（2026-10-15）**：见 `ai/memory-bank/tasks/community-streak-tasklist.md`。方向定为**多邻国式异步社交**：`server/`（Hono + SQLite）只存昵称 / 好友码 / 多好友关系 / streak / 提醒，无 AI、非实时；「共同连胜天数」= 双方今天都活跃取二者较小值。整包备份降级为可选子功能（`cloud-sync-tasklist.md` 已并入）。前端 `communityService.ts` 走 feature flag（未配服务器 = 纯本地）。
- [ ] UI 自身国际化（当前 UI 文案以中文为主）。
- [ ] 更完整的 AI 等级测评（AssessmentView 扩展）。
- 对话式工作台 + 游戏化星级任务系统 —— **已交付 MVP（2026-10-11）**：把「20 模块平铺」升级为「对话驱动的游戏化学习台」。
  - 定位：对话台 = 每日向导（AI 判断"今天该练什么"），星级任务 = 关卡（★1 暖身 5min → ★5 大师整块），20 模块保留为任务落点，不删除。
  - 方向决策：对话为主、工具为辅（方向 B），roadmap 终点是「对话即首页」（方向 A）；否决「第 21 个模块」（纯聊天框 = 白做）。
  - 星级锚定：按难度/时长（★1 5min / ★2 10min / ★3 15–20min / ★4 30min / ★5 整块）；系统按用户 CEFR 推荐匹配星级区间（A1 推 ★1–2，B1 推 ★2–4）。
  - MVP 成瘾机制：每日三任务（1 轻 + 1 中 + 1 重）+ 星级卡片 + streak 强化；三星通关 / 宝箱 / 可分享成就卡放二期。
  - 4 个硬资产落点：词汇 SRS、打字闯关、写作三件套（写作树/写作工坊/作文流水线）、错题本。
  - 开源推广：游戏化分级本身是卖点；可分享成就卡（星级/streak/等级图片）为获客钩子。
  - 已交付（Task 10）：① aiService 新增 SSE 流式 `streamChatCompletion`；② `ConversationView` 对话台（欢迎区 + 流式对话 + 无 key 兜底）；③ 星级任务生成 `generateDailyTasks`（AI 优先 + 本地 20 条任务池兜底，`data/dailyTasks.ts`）；④ 卡片跳转闭环（「开始」跳模块 + 「完成」`addActivity` +XP + 当天缓存/完成态持久化）。
  - 二期增强（**全部已做，2026-10-11**）：streak 强化联动 + 宝箱（完成全部 3 任务可开启，随机 50–150 XP）+ 三星通关评价（自评 1–3 星，XP 倍率 ★×1/★★×1.5/★★★×2）+ 可分享成就卡（canvas 生成 PNG，下载/系统分享）+ 任务上下文预置（点「开始」按模块预置子视图，词汇/错题直达复习）。（tasklist Task 11）
- 学习书库（Study Library）—— **已交付（2026-10-14）**：把词汇书/语法书/短语书（如 Key Words for Fluency、English Grammar in Use、English Phrasal Verbs in Use）结构化装进 linguaflow，用一套框架学习任意「学习型书籍」。
  - 定位：与「书架 Books」（阅读打字）并列的第 **22 个导航模块**；`AppMode.StudyLibrary` + `NAV_ITEMS` 一项。
  - 数据模型（**独立于**现有 `Book` / `VocabularyItem`，不共享）：
    - `StudyBook { id, title, author?, cover?, language: Language（目标语言）, glossLanguage?: Language（释义语言/母语）, type: 'vocabulary'|'grammar'|'phrases'|'mixed', level?: CEFR, source: 'built-in'|'user-import'|'ai-generated'|'pasted-text', chapters[], currentChapterId?, totalItems, completedItems, masteredItems, createdAt, lastStudiedAt? }`
    - `StudyChapter { id, title, description?, items[], currentItemIndex?, completed? }`
    - `StudyItem { id, type: 'word'|'grammar'|'phrase'|'collocation', prompt, answer, examples[], notes?, tags?, partOfSpeech?, pronunciation?, pattern?, variations?, collocations?, box:1-5, dueDate, reviews, lapses, quality?: 'good'|'ok'|'poor', difficulty?: 1-5 }`（SRS 字段与 VocabularyItem 对齐）
  - 存储：**IndexedDB**（`openStudyBooksDB`），非 localStorage（5MB 上限会撞）。
  - 练习：5 模式 Flashcard / Recognition / Recall / Cloze / Production；**grammar 类型隐藏 Recall/Cloze**（语法点无法按词形反写/挖空，flashcard 额外显示 pattern/variations）；Production 为「每章 1 次造句挑战」（非每词，控 AI 成本），3 档评分 good/ok/poor + 反作弊（长度/抄例句/AI 兜底）。
  - SRS：StudyItem 独立 3 档 SRS（`reviewStudyItem`，good→box++/ok→box 不动/poor→box=1）+ promote 到 VocabularyItem（2 档，仅 word/phrase，flashcard 翻牌后 UI 触发，携带 box/dueDate，复用 `saveVocabularyItem` 的 word+language dedup）。
  - 游戏化：复习 +XP（good=2 / ok=1 / poor=0，走 `addActivity` 的 'vocabulary' 类型）。
  - 内置书（**7 本**，静态数据、零等待、无 AI key 可用；seed 按 `targetLanguage`（内容语言）分组 + `totalItems` 版本检查自动重建，学哪门语言只见哪门书的书）：
    - 英语（`glossLanguage = Chinese`）：
      - `keyWordsForFluency.ts`（vocabulary，21 主题 × 10 词 = 210）
      - `englishGrammarInUse.ts`（grammar，10 单元 × 5 语法点 = 50）
      - `englishPhrasalVerbs.ts`（phrases，10 单元 × 5 短语动词 = 50）
    - 日语（`glossLanguage = Chinese`，假名注音放 pronunciation，例句「日语+中文翻译」）：
      - `jlptVocabulary.ts`（vocabulary，10 主题 × 5 词 = 50）
      - `jlptGrammar.ts`（grammar，10 单元 × 5 语法点 = 50）
    - 韩语（`glossLanguage = Chinese`，谚文自带读音无注音，例句「韩语+中文翻译」）：
      - `topikVocabulary.ts`（vocabulary，10 主题 × 5 词 = 50）
      - `topikGrammar.ts`（grammar，10 单元 × 5 语法点 = 50）
  - 用户导入书：运行时分批 AI 结构化（`importTextToStudyBook`，每段一次调用，`extractStudyItemsFromChunk` 按文本产出 word/grammar/phrase/collocation）。
  - 铁律：练习必须「说/写/用」，对齐第 3 节「输出驱动」。（tasklist Task 12）

> 已交付但超出原基线的特性（不在此候选列表，已落地）：SongLab 歌曲跟打、个人错误模式引擎、暗夜霓虹 UI 重设计、XP 进度条统一修复、Gemini 迁出（无独立 geminiService）、侧栏两层折叠、录音转写回退本地回放、**Books 阅读器（EPUB/PDF + IndexedDB）**、**TypeLit 打字训练（Literata 衬线）**、**许可证切换 CC BY-NC 4.0**、**README 拆分 docs/ + 社群扫码**、**release.sh 发版脚本**。

## 8. 技术栈速查（供任务拆解）
- 框架：React 19 + TS
- 构建：Vite 6（dev 端口 3011）
- 样式：Tailwind（深色霓虹主题）
- 图标：lucide-react
- 状态 / 存储：localStorage（`services/storageService.ts`）
- AI：`services/aiService.ts`（统一封装）
- 测试：Playwright 截图回归脚手架已落地（tasklist Task 5 已完成）
