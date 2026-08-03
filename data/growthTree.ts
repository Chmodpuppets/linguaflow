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
      { title: '名字与喜好', cefrLevel: CEFRLevel.A2, scaffold: '私の名前は ___ で、___ が好きです。', scaffoldHint: '前填名字，后填喜欢的事物' },
      { title: '年龄与居住地', cefrLevel: CEFRLevel.A2, scaffold: '___ 歳で、___ に住んでいます。', scaffoldHint: '前填年龄，后填居住地（如：東京）' },
      { title: '描述自己', cefrLevel: CEFRLevel.B1, scaffold: '私は ___ な人だと思います。なぜなら ___ からです。', scaffoldHint: '前填性格词（如：明るい 开朗），后填原因' },
      { title: '兴趣与习惯', cefrLevel: CEFRLevel.B1, scaffold: '___ について興味があり、よく ___ します。', scaffoldHint: '前填感兴趣的领域，后填常做的事' },
      { title: '目标与态度', cefrLevel: CEFRLevel.B2, scaffold: '私の目標は ___ であり、そのために ___ と考えています。', scaffoldHint: '前填目标，后填为此的做法/态度' },
      { title: '正式自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句' },
    ],
  },
  {
    id: 'theme-daily',
    title: '日常起居',
    tasks: [
      { title: '今天吃了什么', cefrLevel: CEFRLevel.A1, scaffold: '今日、___ を食べました。', scaffoldHint: '填你今天吃的东西（如：ご飯 / パン）' },
      { title: '我的早晨', cefrLevel: CEFRLevel.A1, scaffold: '朝 ___ 時に起きます。___ を食べます。', scaffoldHint: '前填几点起床，后填早餐' },
      { title: '日常顺序', cefrLevel: CEFRLevel.A2, scaffold: '毎日、___ する前に ___ します。', scaffoldHint: '前填先做的事，后填后做的事' },
      { title: '休息日', cefrLevel: CEFRLevel.A2, scaffold: '休みの日はよく ___ へ行って、___ します。', scaffoldHint: '前填地点，后填在那做的事' },
      { title: '昨天做了什么', cefrLevel: CEFRLevel.B1, scaffold: '昨日は ___ して、それから ___ しました。', scaffoldHint: '前填过去做的事，后填接着做的事' },
      { title: '习惯对比', cefrLevel: CEFRLevel.B1, scaffold: '普段は ___ ですが、週末は ___ こともあります。', scaffoldHint: '前填平时的习惯，后填周末偶尔做的事' },
      { title: '习惯的影响', cefrLevel: CEFRLevel.B2, scaffold: '___ という習慣が私の生活に与える影響は ___ だと言えます。', scaffoldHint: '前填某个习惯，后填它带来的影响' },
      { title: '难忘的一天', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段令你难忘的一天的经历：时间、事件、感受，至少四句' },
    ],
  },
  {
    id: 'theme-hobby',
    title: '兴趣爱好',
    tasks: [
      { title: '我喜欢的事物', cefrLevel: CEFRLevel.A1, scaffold: '私は ___ が好きです。', scaffoldHint: '填你喜欢的事物（如：音楽 / 犬 / 日本語）' },
      { title: '为什么喜欢', cefrLevel: CEFRLevel.A1, scaffold: '___ が好きです。___ からです。', scaffoldHint: '前填事物，后填喜欢的原因' },
      { title: '周末怎么过', cefrLevel: CEFRLevel.A2, scaffold: '休みにはよく ___ をして、___ と過ごします。', scaffoldHint: '前填活动，后填一起过的人' },
      { title: '两者比较', cefrLevel: CEFRLevel.A2, scaffold: '___ と ___ の両方が好きですが、特に ___ が一番です。', scaffoldHint: '前填两个事物，后填最爱的那个' },
      { title: '偏好比较', cefrLevel: CEFRLevel.B1, scaffold: '___ より ___ の方が好きです。なぜなら ___ からです。', scaffoldHint: '前填偏好A，中填偏好B，后填原因' },
      { title: '爱好的意义', cefrLevel: CEFRLevel.B1, scaffold: '私にとって ___ は、___ するための大切な時間です。', scaffoldHint: '前填爱好，后填它用来做什么' },
      { title: '收获与未来', cefrLevel: CEFRLevel.B2, scaffold: 'この趣味が私に与えてくれたものは ___ であり、今後も ___ したいと考えています。', scaffoldHint: '前填收获，后填今后想做的事' },
      { title: '为什么重要', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句' },
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
      { title: '名字与职业', cefrLevel: CEFRLevel.A2, scaffold: 'My name is ___ and I ___ for a living.', scaffoldHint: '前填名字，后填职业（如 work as a doctor）' },
      { title: '年龄与住址', cefrLevel: CEFRLevel.A2, scaffold: 'I am ___ years old and I live in ___.', scaffoldHint: '前填年龄，后填城市' },
      { title: '描述你自己', cefrLevel: CEFRLevel.B1, scaffold: 'I would describe myself as ___ because ___.', scaffoldHint: '前填性格词（如 outgoing），后填原因' },
      { title: '兴趣与习惯', cefrLevel: CEFRLevel.B1, scaffold: 'I am interested in ___ and I often ___.', scaffoldHint: '前填感兴趣的领域，后填常做的事' },
      { title: '目标与信念', cefrLevel: CEFRLevel.B2, scaffold: 'My goal is to ___ and I believe that ___.', scaffoldHint: '前填目标，后填为此的信念/做法' },
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
      { title: '休息日', cefrLevel: CEFRLevel.A2, scaffold: 'On my days off, I often go to ___ and ___.', scaffoldHint: '前填地点，后填在那做的事' },
      { title: '昨天做了什么', cefrLevel: CEFRLevel.B1, scaffold: 'Yesterday, I ___ and then I ___.', scaffoldHint: '前填过去做的事，后填接着做的事' },
      { title: '习惯对比', cefrLevel: CEFRLevel.B1, scaffold: 'Usually I ___, but on weekends I sometimes ___.', scaffoldHint: '前填平时习惯，后填周末偶尔做的事' },
      { title: '习惯的影响', cefrLevel: CEFRLevel.B2, scaffold: 'The impact of ___ on my life can be described as ___.', scaffoldHint: '前填某个习惯，后填它带来的影响' },
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
      { title: '两者比较', cefrLevel: CEFRLevel.A2, scaffold: 'I like both ___ and ___, but ___ is my favorite.', scaffoldHint: '前填两个事物，后填最爱的那个' },
      { title: '偏好比较', cefrLevel: CEFRLevel.B1, scaffold: 'I prefer ___ to ___ because ___.', scaffoldHint: '前填偏好 A，中填偏好 B，后填原因' },
      { title: '爱好的意义', cefrLevel: CEFRLevel.B1, scaffold: 'For me, ___ is important time to ___.', scaffoldHint: '前填爱好，后填它用来做什么' },
      { title: '收获与未来', cefrLevel: CEFRLevel.B2, scaffold: 'What this hobby has given me is ___ and I want to ___ in the future.', scaffoldHint: '前填收获，后填今后想做的事' },
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
      { title: '名字与喜好', cefrLevel: CEFRLevel.A2, scaffold: '제 이름은 ___이고, ___을/를 좋아해요.', scaffoldHint: '前填名字，后填喜欢的事物' },
      { title: '年龄与住址', cefrLevel: CEFRLevel.A2, scaffold: '___살이고, ___에 살아요.', scaffoldHint: '前填年龄，后填城市' },
      { title: '描述你自己', cefrLevel: CEFRLevel.B1, scaffold: '저는 ___한 사람이라고 생각해요. 왜냐하면 ___.', scaffoldHint: '前填性格词（如 활발한 开朗的），后填原因' },
      { title: '兴趣与习惯', cefrLevel: CEFRLevel.B1, scaffold: '___에 관심이 있고, 자주 ___해요.', scaffoldHint: '前填感兴趣的领域，后填常做的事' },
      { title: '目标与态度', cefrLevel: CEFRLevel.B2, scaffold: '제 목표는 ___이고, 그걸 위해서 ___라고 생각해요.', scaffoldHint: '前填目标，后填为此的做法/态度' },
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
      { title: '休息日', cefrLevel: CEFRLevel.A2, scaffold: '쉬는 날은 보통 ___에 가서 ___해요.', scaffoldHint: '前填地点，后填在那做的事' },
      { title: '昨天做了什么', cefrLevel: CEFRLevel.B1, scaffold: '어제 ___하고 ___했어요.', scaffoldHint: '前填过去做的事，后填接着做的事' },
      { title: '习惯对比', cefrLevel: CEFRLevel.B1, scaffold: '평소에는 ___하지만, 주말에는 ___할 때도 있어요.', scaffoldHint: '前填平时习惯，后填周末偶尔做的事' },
      { title: '习惯的影响', cefrLevel: CEFRLevel.B2, scaffold: '___이라는 습관이 제 삶에 미치는 영향은 ___라고 할 수 있어요.', scaffoldHint: '前填某个习惯，后填它带来的影响' },
      { title: '难忘的一天', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段令你难忘的一天的经历：时间、事件、感受，至少四句' },
    ],
  },
  {
    id: 'ko-hobby',
    title: '兴趣爱好',
    tasks: [
      { title: '你喜欢什么', cefrLevel: CEFRLevel.A1, scaffold: '___을/를 좋아해요.', scaffoldHint: '填你喜欢的事物（如 음악 音乐 / 강아지 小狗）' },
      { title: '为什么喜欢', cefrLevel: CEFRLevel.A1, scaffold: '___이/가 좋아요. ___ 때문이에요.', scaffoldHint: '前填事物，后填喜欢的原因' },
      { title: '周末怎么过', cefrLevel: CEFRLevel.A2, scaffold: '주말에는 보통 ___을/를 하고, ___과/와 함께 시간을 보내요.', scaffoldHint: '前填活动，后填一起过的人' },
      { title: '两者比较', cefrLevel: CEFRLevel.A2, scaffold: '___과/와 ___ 모두 좋아하지만, 특히 ___이/가 최고예요.', scaffoldHint: '前填两个事物，后填最爱的那个' },
      { title: '偏好比较', cefrLevel: CEFRLevel.B1, scaffold: '___보다 ___을/를 더 좋아해요. 왜냐하면 ___.', scaffoldHint: '前填偏好A，中填偏好B，后填原因' },
      { title: '爱好的意义', cefrLevel: CEFRLevel.B1, scaffold: '저한테 ___은/는 ___하기 위한 소중한 시간이에요.', scaffoldHint: '前填爱好，后填它用来做什么' },
      { title: '收获与未来', cefrLevel: CEFRLevel.B2, scaffold: '이 취미가 저에게 준 것은 ___이고, 앞으로도 ___하고 싶어요.', scaffoldHint: '前填收获，后填今后想做的事' },
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
