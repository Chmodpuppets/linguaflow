import { WritingNode, Language, CEFRLevel } from '../types';

// 默认写作成长树：3 条主题路径 × 3 个难度递进任务（A1 → A1+ → A2）
// 每条路径第一个任务解锁，完成后解锁下一个。
// scaffold 为目标语言句型模板（含 ___）；空串表示自由写（用 scaffoldHint 作情境提示）。
// 当前 scaffold 以日语 A1 为基准（用户画像），结构通用，其他语言可替换 scaffold 内容。

interface TaskSeed {
  title: string;
  cefrLevel: CEFRLevel;
  scaffold: string;
  scaffoldHint: string;
}

const THEMES: Array<{ id: string; title: string; tasks: TaskSeed[] }> = [
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

export function createDefaultGrowthTree(_lang: Language, _level: CEFRLevel): WritingNode[] {
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
  });

  for (const th of THEMES) {
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
      });
    });
  }

  return nodes;
}
