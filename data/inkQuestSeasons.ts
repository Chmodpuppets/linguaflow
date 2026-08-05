// 墨程 InkQuest —— 赛季微写作卡（语言无关，主题用中文给出，11 种语言通用）
// 每个赛季一个情境基调；后续可像 scriptPacks 那样继续追加赛季包。

export interface InkQuestCardDef {
  id: string;
  theme: string;          // 主题（中文）
  prompts: string[];      // 3 个引导角度（中文，降低"写不出"焦虑）
  minSentences: number;
  maxSentences: number;
}

export interface InkQuestSeason {
  id: string;
  title: string;
  blurb: string;
  cards: InkQuestCardDef[];
}

export const INK_QUEST_SEASONS: InkQuestSeason[] = [
  {
    id: 'daily_life_s1',
    title: '日常微写作 · 第一季',
    blurb: '每天一小段，把生活写进目标语言。不需要完美，先写出来。',
    cards: [
      { id: 'd1', theme: '描述你今天的早餐', prompts: ['在什么地方吃的？', '味道怎么样？', '你最喜欢哪一口？'], minSentences: 2, maxSentences: 4 },
      { id: 'd2', theme: '用三句话介绍你的通勤 / 上学路', prompts: ['路上看到了什么？', '心情如何？', '有没有小插曲？'], minSentences: 3, maxSentences: 5 },
      { id: 'd3', theme: '写一条你绝对会二刷的餐厅推荐', prompts: ['店名或类型？', '为什么推荐？', '推荐哪道菜？'], minSentences: 2, maxSentences: 4 },
      { id: 'd4', theme: '描述你现在所在的房间', prompts: ['有什么家具？', '光线如何？', '让你舒服的一点是什么？'], minSentences: 2, maxSentences: 4 },
      { id: 'd5', theme: '用目标语言写一段给朋友的周末邀约', prompts: ['约什么活动？', '时间和地点？', '为什么想一起去？'], minSentences: 3, maxSentences: 5 },
      { id: 'd6', theme: '复述昨天发生的一件小事', prompts: ['发生了什么？', '你做了什么？', '结果如何？'], minSentences: 2, maxSentences: 4 },
      { id: 'd7', theme: '写一句你今天最想说的话（关于任何事）', prompts: ['是关于心情？', '还是关于计划？', '或者只是一句感叹？'], minSentences: 1, maxSentences: 3 },
    ],
  },
  {
    id: 'imagination_s1',
    title: '想象与创意 · 第二季',
    blurb: '抛开"对不对"，先让脑洞跑起来。越奇怪越好写。',
    cards: [
      { id: 'i1', theme: '描述你昨晚做的一个梦', prompts: ['梦里在哪里？', '出现了谁/什么？', '结局如何？'], minSentences: 3, maxSentences: 5 },
      { id: 'i2', theme: '发明一种只属于你的小动物，描述它', prompts: ['它长什么样？', '它吃什么？', '它有什么超能力？'], minSentences: 3, maxSentences: 5 },
      { id: 'i3', theme: '写一首关于"周一"的三行小诗', prompts: ['周一像什么？', '你希望它怎样？', '用一句感叹收尾'], minSentences: 2, maxSentences: 3 },
      { id: 'i4', theme: '如果你能去任何地方旅行一天', prompts: ['去哪里？', '为什么？', '最想做什么？'], minSentences: 3, maxSentences: 5 },
      { id: 'i5', theme: '给十年后的自己写一句话', prompts: ['想提醒什么？', '想夸夸什么？', '还是一句玩笑？'], minSentences: 1, maxSentences: 3 },
    ],
  },
  {
    id: 'opinion_s1',
    title: '观点与表达 · 第三季',
    blurb: '练习"我认为是……因为……"。说出口，才算你的观点。',
    cards: [
      { id: 'o1', theme: '猫和狗，你站哪边？给一个理由', prompts: ['你的选择？', '为什么？', '对方会怎么反驳？'], minSentences: 3, maxSentences: 5 },
      { id: 'o2', theme: '用目标语言劝朋友去看一部电影', prompts: ['哪部？', '最打动你的点？', '一句话安利'], minSentences: 3, maxSentences: 5 },
      { id: 'o3', theme: '你同意"早睡比早起更重要"吗？', prompts: ['同意/不同意？', '你的理由？', '有没有例外？'], minSentences: 3, maxSentences: 5 },
      { id: 'o4', theme: '描述一个你很想改掉的小习惯', prompts: ['是什么？', '为什么想改？', '打算怎么做？'], minSentences: 3, maxSentences: 5 },
      { id: 'o5', theme: '如果可以立一条"家庭规则"，你会立什么', prompts: ['什么规则？', '为了什么？', '谁会反对？'], minSentences: 3, maxSentences: 5 },
    ],
  },
  {
    id: 'situation_s1',
    title: '情境与应对 · 第四季',
    blurb: '把语言用在"真要开口"的瞬间，练最实用的那几句。',
    cards: [
      { id: 's1', theme: '在异国街头迷路了，写一句求助', prompts: ['你想问什么？', '你在哪里？', '你需要怎样的帮助？'], minSentences: 2, maxSentences: 4 },
      { id: 's2', theme: '餐厅点餐时你有忌口，写一句提醒服务员', prompts: ['忌什么？', '语气礼貌', '要不要换道菜？'], minSentences: 2, maxSentences: 3 },
      { id: 's3', theme: '上班/上学迟到了，写一条致歉消息', prompts: ['为什么迟到？', '什么时候到？', '怎么补救？'], minSentences: 2, maxSentences: 4 },
      { id: 's4', theme: '朋友难过，写一句安慰 ta 的话', prompts: ['你感受到了什么？', '你想让 ta 知道什么？', '邀请 ta 聊聊？'], minSentences: 2, maxSentences: 3 },
      { id: 's5', theme: '写一句得体的"拒绝邀请"', prompts: ['你为什么不能去？', '表达遗憾', '给个替代方案'], minSentences: 2, maxSentences: 4 },
    ],
  },
];

export const INK_QUEST_SEASON_COUNT = INK_QUEST_SEASONS.length;

export const getInkQuestSeason = (index = 0): InkQuestSeason =>
  INK_QUEST_SEASONS[((index % INK_QUEST_SEASONS.length) + INK_QUEST_SEASONS.length) % INK_QUEST_SEASONS.length];
