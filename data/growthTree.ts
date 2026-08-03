import { WritingNode, Language, CEFRLevel } from '../types';

// 默认写作成长树：每条主题路径含多个难度递进任务（A1 → A2 → B1 → B2）。
// 每条路径第一个任务解锁，完成后解锁下一个。
// scaffold 为目标语言句型模板（含 ___）；空串表示自由写（用 scaffoldHint 作情境提示）。
// 按语言分组维护，结构通用，新增语言只需往 TREE_THEMES 加条目。

interface TaskSeed {
  title: string;
  cefrLevel: CEFRLevel;
  scaffold: string;
  scaffoldHint: string;
}

interface ThemeSeed {
  id: string;
  title: string;
  tasks: TaskSeed[];
}

const JAPANESE_THEMES: ThemeSeed[] = [
  {
    id: 'theme-intro',
    title: '自我介绍',
    tasks: [
      { title: '一句话介绍自己', cefrLevel: CEFRLevel.A1, scaffold: '私は ___ です。', scaffoldHint: '填你的职业（如：学生 / 会社員）' },
      { title: '加职业与国籍', cefrLevel: CEFRLevel.A1, scaffold: '私は ___ です。___ から来ました。', scaffoldHint: '前填职业，后填你的国家（如：中国）' },
      { title: '三句自我介绍', cefrLevel: CEFRLevel.A2, scaffold: '', scaffoldHint: '自由写三句：名字、职业、一个爱好' },
    ],
  },
  {
    id: 'theme-daily',
    title: '日常起居',
    tasks: [
      { title: '今天吃了什么', cefrLevel: CEFRLevel.A1, scaffold: '今日、___ を食べました。', scaffoldHint: '填你今天吃的东西（如：ご飯 / パン）' },
      { title: '我的早晨', cefrLevel: CEFRLevel.A1, scaffold: '朝 ___ 時に起きます。___ を食べます。', scaffoldHint: '前填几点起床，后填早餐' },
      { title: '我的一天', cefrLevel: CEFRLevel.A2, scaffold: '', scaffoldHint: '自由写一段你的一天（早中晚，至少三句）' },
    ],
  },
  {
    id: 'theme-hobby',
    title: '兴趣爱好',
    tasks: [
      { title: '我喜欢的事物', cefrLevel: CEFRLevel.A1, scaffold: '私は ___ が好きです。', scaffoldHint: '填你喜欢的事物（如：音楽 / 犬 / 日本語）' },
      { title: '为什么喜欢', cefrLevel: CEFRLevel.A1, scaffold: '___ が好きです。___ からです。', scaffoldHint: '前填事物，后填喜欢的原因' },
      { title: '介绍一个爱好', cefrLevel: CEFRLevel.A2, scaffold: '', scaffoldHint: '自由写一段介绍你的爱好（为什么喜欢、多久做一次）' },
    ],
  },
];

const ENGLISH_THEMES: ThemeSeed[] = [
  {
    id: 'en-intro',
    title: '自我介绍',
    tasks: [
      { title: '一句话介绍自己', cefrLevel: CEFRLevel.A1, scaffold: 'I am a ___.', scaffoldHint: '填你的职业（如 a student / a teacher）' },
      { title: '你来自哪里', cefrLevel: CEFRLevel.A1, scaffold: 'I am from ___.', scaffoldHint: '填你的国家（如 China / Japan）' },
      { title: '两句连起来', cefrLevel: CEFRLevel.A2, scaffold: 'My name is ___ and I ___ for a living.', scaffoldHint: '前填名字，后填职业（如 work as a doctor）' },
      { title: '描述你自己', cefrLevel: CEFRLevel.B1, scaffold: 'I would describe myself as ___ because ___.', scaffoldHint: '前填性格词（如 outgoing），后填原因' },
      { title: '正式自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '用正式/学术语气写一段自我介绍：背景、专业、目标，至少四句' },
    ],
  },
  {
    id: 'en-daily',
    title: '日常生活',
    tasks: [
      { title: '你的早晨', cefrLevel: CEFRLevel.A1, scaffold: 'I ___ at 7 o’clock.', scaffoldHint: '填你早上做的事（如 wake up / eat breakfast）' },
      { title: '早餐吃什么', cefrLevel: CEFRLevel.A1, scaffold: 'I eat ___ for breakfast.', scaffoldHint: '填早餐食物（如 bread / eggs）' },
      { title: '日常顺序', cefrLevel: CEFRLevel.A2, scaffold: 'Every day, I ___ before I ___.', scaffoldHint: '前填先做的事，后填后做的事' },
      { title: '昨天做了什么', cefrLevel: CEFRLevel.B1, scaffold: 'Yesterday, I ___ and then I ___.', scaffoldHint: '前填过去做的事，后填接着做的事' },
      { title: '难忘的一天', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段令你难忘的一天的经历：时间、事件、感受，至少四句' },
    ],
  },
  {
    id: 'en-hobby',
    title: '兴趣爱好',
    tasks: [
      { title: '你喜欢什么', cefrLevel: CEFRLevel.A1, scaffold: 'I like ___.', scaffoldHint: '填你喜欢的事物（如 music / dogs）' },
      { title: '最爱的事物', cefrLevel: CEFRLevel.A1, scaffold: 'My favorite ___ is ___.', scaffoldHint: '前填类别（如 food），后填具体事物' },
      { title: '周末活动', cefrLevel: CEFRLevel.A2, scaffold: 'On weekends, I usually ___ with ___.', scaffoldHint: '前填活动，后填一起的人' },
      { title: '偏好比较', cefrLevel: CEFRLevel.B1, scaffold: 'I prefer ___ to ___ because ___.', scaffoldHint: '前填偏好 A，中填偏好 B，后填原因' },
      { title: '为什么重要', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句' },
    ],
  },
];

const KOREAN_THEMES: ThemeSeed[] = [
  {
    id: 'ko-intro',
    title: '自我介绍',
    tasks: [
      { title: '一句话介绍自己', cefrLevel: CEFRLevel.A1, scaffold: '저는 ___입니다.', scaffoldHint: '填你的职业（如 학생 / 회사원）' },
      { title: '你来自哪里', cefrLevel: CEFRLevel.A1, scaffold: '저는 ___에서 왔어요.', scaffoldHint: '填你的国家（如 중국 / 미국）' },
      { title: '两句连起来', cefrLevel: CEFRLevel.A2, scaffold: '제 이름은 ___이고, ___을/를 좋아해요.', scaffoldHint: '前填名字，后填喜欢的事物' },
      { title: '描述你自己', cefrLevel: CEFRLevel.B1, scaffold: '저는 ___한 사람이라고 생각해요. 왜냐하면 ___.', scaffoldHint: '前填性格词（如 활발한 开朗的），后填原因' },
      { title: '正式自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句' },
    ],
  },
  {
    id: 'ko-daily',
    title: '日常生活',
    tasks: [
      { title: '你的早餐', cefrLevel: CEFRLevel.A1, scaffold: '아침에 ___을/를 먹어요.', scaffoldHint: '填早餐食物（如 밥 饭 / 빵 面包）' },
      { title: '几点起床', cefrLevel: CEFRLevel.A1, scaffold: '___시에 일어나요.', scaffoldHint: '填你几点起床（如 일곱 七 / 7）' },
      { title: '日常顺序', cefrLevel: CEFRLevel.A2, scaffold: '매일 ___하기 전에 ___해요.', scaffoldHint: '前填先做的事，后填后做的事' },
      { title: '昨天做了什么', cefrLevel: CEFRLevel.B1, scaffold: '어제 ___하고 ___했어요.', scaffoldHint: '前填过去做的事，后填接着做的事' },
      { title: '难忘的一天', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段令你难忘的一天的经历：时间、事件、感受，至少四句' },
    ],
  },
  {
    id: 'ko-hobby',
    title: '兴趣爱好',
    tasks: [
      { title: '你喜欢什么', cefrLevel: CEFRLevel.A1, scaffold: '___을/를 좋아해요.', scaffoldHint: '填你喜欢的事物（如 음악 音乐 / 강아지 小狗）' },
      { title: '最爱的事物', cefrLevel: CEFRLevel.A1, scaffold: '제일 좋아하는 ___은/는 ___이에요.', scaffoldHint: '前填类别（如 음식 食物），后填具体事物' },
      { title: '周末活动', cefrLevel: CEFRLevel.A2, scaffold: '주말에는 보통 ___과/와 함께 ___해요.', scaffoldHint: '前填活动，后填一起的人' },
      { title: '偏好比较', cefrLevel: CEFRLevel.B1, scaffold: '___보다 ___을/를 더 좋아해요. 왜냐하면 ___.', scaffoldHint: '前填偏好A，中填偏好B，后填原因' },
      { title: '为什么重要', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句' },
    ],
  },
];

const TREE_THEMES: Partial<Record<Language, ThemeSeed[]>> = {
  [Language.Japanese]: JAPANESE_THEMES,
  [Language.English]: ENGLISH_THEMES,
  [Language.Korean]: KOREAN_THEMES,
};

export function createDefaultGrowthTree(lang: Language, _level: CEFRLevel): WritingNode[] {
  const themes = TREE_THEMES[lang] ?? TREE_THEMES[Language.Japanese]!;
  const now = Date.now();
  const nodes: WritingNode[] = [];

  nodes.push({
    id: 'root',
    parentId: null,
    type: 'root',
    title: '我的写作成长档案',
    content: '',
    progress: 0,
    wordCount: 0,
    tags: [],
    isExpanded: true,
    createdAt: now,
    updatedAt: now,
    language: lang,
  });

  for (const th of themes) {
    nodes.push({
      id: th.id,
      parentId: 'root',
      type: 'theme',
      title: th.title,
      content: '',
      progress: 0,
      wordCount: 0,
      tags: [],
      isExpanded: true,
      createdAt: now,
      updatedAt: now,
      language: lang,
    });
    th.tasks.forEach((t, i) => {
      nodes.push({
        id: `${th.id}-task-${i}`,
        parentId: th.id,
        type: 'task',
        title: t.title,
        content: '',
        progress: 0,
        wordCount: 0,
        tags: [],
        isExpanded: false,
        createdAt: now,
        updatedAt: now,
        cefrLevel: t.cefrLevel,
        unlocked: i === 0,
        completed: false,
        scaffold: t.scaffold,
        scaffoldHint: t.scaffoldHint,
        order: i,
        language: lang,
      });
    });
  }

  return nodes;
}
