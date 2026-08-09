# LinguaFlow 框架重设计：沉浸暗夜 × 霓虹光效

## 改了什么

| 文件 | 改动 |
| --- | --- |
| `styles.css` | 新增霓虹设计 token 与全部动效（极光氛围层、玻璃拟态、导航交互、XP 流光、页面过渡等） |
| `tailwind.config.js` | 新增 neon 色系与 glow-neon / glow-cyan 阴影 |
| `App.tsx` | 框架层 JSX 重写：氛围背景、玻璃侧栏、霓虹导航、页面切换过渡 |

**功能零变更**：renderContent、全部 handler、导航分组、状态逻辑原样保留。构建通过。

## 交互特效清单

- 氛围背景：三层极光光斑缓慢漂移 + 细网格渐隐
- 侧栏：玻璃拟态（模糊 + 半透明渐变）
- 导航项：hover 光晕晕开 + 图标发光放大 + 微位移；激活态渐变胶囊 + 呼吸光柱
- XP 进度条：紫→青渐变流光
- 页面切换：模糊渐入 + 上浮过渡（key={mode} 触发）
- Logo 光晕呼吸、连击火焰闪烁、错题角标脉冲、标题下划线流光
- 无障碍：prefers-reduced-motion 下全部动效自动关闭

## 预览

http://localhost:5174

## 后续可选

24 个子视图组件仍使用旧 token（surface/card 体系），如需全套霓虹深化可逐模块推进。

---

# Wave 0 + Wave 1 已交付（2026-08-05 晚）

## Wave 0：组件基座
新建 `components/ui/index.tsx`：**GlassCard / NeonButton / NeonBadge / SectionTitle / StatChip** 五个共享原语，后续模块迁移统一复用。

## Wave 1：演示三件套

| 模块 | 深化内容 |
| --- | --- |
| DailyView 今日 | Hero 极光玻璃卡、任务卡交错入场动画、进度条流光、NeonButton/NeonBadge 全面接入 |
| TypingView 打字闯关 | 头控面板玻璃化、关卡地图光路渐变 + 当前关霓虹光环、模式 Tab 渐变激活、打字卡 focus 光晕、通关结算绿色辉光 |
| RPGView 剧情对话 | 大厅与场景卡玻璃化、聊天气泡渐变 + 逐条入场、分支选项光晕、输入框 focus 光环、发送按钮渐变、胜利弹窗霓虹光 |

**验证**：`vite build` ✓、`tsc --noEmit` ✓，功能逻辑零改动。

## 下一步
Wave 2 写作矩阵（InkQuest → WritingView → WritingTree → CompositionStudio → ScriptTrainer），随时可开工。

---

# Wave 2 已交付（2026-08-05 晚 · 写作矩阵 6 模块）

| 模块 | 深化内容 |
| --- | --- |
| InkQuest 墨程 | 赛季横幅极光玻璃、卡片 chip 霓虹激活、双栏玻璃拟态、提交按钮渐变发光、评分格渐变点亮、对决条流光 |
| WritingView 写作工坊 | 模式切换渐变、题目卡玻璃化、输入框 focus 光环、考试评分面板玻璃化 + 维度条流光 |
| GuidedWriting 引导练习 | 题目卡玻璃、填空位霓虹发光、词卡 hover 浮起、答对横幅绿光 + 入场动画 |
| WritingTree 写作树 | 双面板玻璃、树节点激活霓虹胶囊 + hover 位移、完成按钮渐变 |
| CompositionStudio 作文流水线 | 筛选 chip 霓虹（体裁紫 / 状态青）、列表激活胶囊、双面板玻璃 |
| ScriptTrainer 文字特训 | 语言包 Tab 渐变、分组卡玻璃 hover、听音圈呼吸光晕、虚拟键 hover 发光浮起 |

**验证**：`vite build` ✓、`tsc --noEmit` ✓，逻辑零改动。

## 下一步
Wave 3 资源工具（记忆库 / 内容仓库 / 词汇 / 错题本 / 作品集 / 趋势 / 导入 / 测评）→ Wave 4 社区账户（学习搭子 / 我的资料 / 登录页 + 共享组件收尾）。

---

# Wave 3 已交付（2026-08-05 晚 · 资源工具 8 模块）

| 模块 | 深化内容 |
| --- | --- |
| LibraryView 记忆库 | 反射 Tab 霓虹激活、次级按钮青色玻璃、AI 分析渐变发光、输入 focus 霓虹 |
| VocabularyView 词汇 | 词卡玻璃化、Tab/添加/揭示按钮渐变发光、词 chip 青色、列表 hover 光晕 |
| ContentRepoView 内容仓库 | 工具栏渐变发光、修复无效 token `bg-surface-1`→`glass-panel`、网格玻璃、Toast 玻璃光晕 |
| ErrorBookView 错题本 | 视图模式 Tab 渐变、列表 hover 光晕、原因描边霓虹 |
| PortfolioView 作品集 | 卡片玻璃化、CEFR chip 玻璃、展开/朗读 hover 青色 |
| WritingProgressView 进度 | 统计卡玻璃、图表色统一霓虹紫/青 |
| ImportView 导入 | 标题/输入玻璃、存入记忆库青色发光、提取词汇紫色发光 |
| AssessmentView 测评 | 结果卡霓虹描边、等级圈光晕、维度条霓虹 |

**验证**：`vite build` ✓、`tsc --noEmit` ✓，逻辑零改动。

---

# Wave 4 已交付（2026-08-05 晚 · 社区账户 + 共享组件收尾 8 模块）

| 模块 | 深化内容 |
| --- | --- |
| SocialView 学习搭子 | 学习卡渐变玻璃、统计盒玻璃、分享/复制按钮发光 |
| LoginView 登录页 | 光斑霓虹、Logo 渐变光晕、输入 focus 光环、注册/导师/话题 neon 化 |
| WritingLanguageGate 语言门 | 双卡玻璃、切换按钮渐变发光 |
| HandwritePad 手写板 | 画布霓虹描边、清除按钮 hover 发光 |
| CompositionEditor 作文编辑器 | 体裁 pill/进度条霓虹、参考/结构评分发光 |
| TtsAudioPlayer 朗读器 | 容器玻璃、A-B 高亮霓虹、滑块/循环 accent 霓虹 |
| ProfileView 我的资料 | 头部渐变玻璃、头像霓虹描边、XP 条流光、语言/日历/趋势卡玻璃、设置卡全套 neon 收口（929 行最终模块） |

**验证**：`vite build` ✓、`tsc --noEmit` ✓，逻辑零改动。

## 框架重设计收官总览
- 全部 **24 个模块** 已统一暗夜霓虹视觉语言（沉浸暗底 + 紫/青/粉霓虹光效 + 玻璃拟态 + 流光动效）。
- 统一迁移映射：`bg-card`→`glass-panel`、`text-secondary`→`text-neon-2`、`bg-primary/secondary`→`bg-neon/neon-2`、`border-primary/secondary`→`border-neon/neon-2`、`focus:ring-secondary`→`focus:ring-neon`、`from-primary to-secondary`→`from-neon to-neon-2 shadow-glow-neon`。
- 功能/逻辑/状态零改动，`prefers-reduced-motion` 下动效自动降级。
- 预览：http://localhost:5174

## 歌曲跟打（Song Lab）迭代
- 新增「歌曲跟打」模块（LRC/纯文本 + mp3 → 自动切句 → 逐句打字练习），含本地 `kanaToRomaji` 注音、`translateText` AI 翻译、IndexedDB 存音频。
- 本地 Python 工具链（用户本地运行，独立工程）：`scripts/song_segmenter.py`（librosa 自动断句出 segments.json）、`scripts/song_clipper.py`（ffmpeg 按时间戳切出逐句 mp3 片段 + 带 clip/start/end 的 segments.json，可 --package 打包）。
- 前端接收剪辑包：SongLab「导入 segments.json」+「附带每句音频」→ 保存时写 IndexedDB 每句片段 → 播放器每句「精听」只播该片段 → 跳打字 flow。
- 验证：tsc --noEmit ✓、vite build ✓、预览 http://localhost:5174（200）。
