import { WritingNode, Language, CEFRLevel, WritingRegister, TargetExam, CompositionSection, CompositionGenre, WritingPracticeType, WritingCycleStage } from '../types';
import { TOPICS_BY_LEVEL } from './writingPrompts';

// 复用写作工坊的分级开放命题（单源），供写作树高阶任务直接引用，避免两套题库割裂
const OPEN = TOPICS_BY_LEVEL;

// CEFR 难度排序：数值越大等级越高，用于「按用户等级解锁任务」
export const CEFR_RANK: Record<CEFRLevel, number> = {
  [CEFRLevel.A1]: 1,
  [CEFRLevel.A2]: 2,
  [CEFRLevel.B1]: 3,
  [CEFRLevel.B2]: 4,
  [CEFRLevel.C1]: 5,
  [CEFRLevel.C2]: 6,
};

// 按等级给任务的默认语体（口气）：低阶偏口语/中性，高阶偏礼貌/正式。
// 单个任务可在 TaskSeed 用 register 覆盖（如商务邮件＝business）。
export const REGISTER_BY_LEVEL: Record<CEFRLevel, WritingRegister> = {
  [CEFRLevel.A1]: 'casual',
  [CEFRLevel.A2]: 'neutral',
  [CEFRLevel.B1]: 'polite',
  [CEFRLevel.B2]: 'formal',
  [CEFRLevel.C1]: 'formal',
  [CEFRLevel.C2]: 'formal',
};

// 作文（长文）提纲骨架：按「体裁 genre + 等级 level + 语言 lang」生成不同的篇章结构。
// 每种体裁 4 段，标题按语言本地化（双语）。主体段目标词数随等级递增。
// 导出供作文编辑器在「切换体裁」时复用（重建骨架并尽量保留已写内容）。
// 作文（长文）提纲骨架：按「体裁 genre + 等级 level + 语言 lang」生成不同的篇章结构。
// 每种体裁 4 段，标题按语言本地化，并保留英语作为参考标签。主体段目标词数随等级递增。
// 导出供作文编辑器在「切换体裁」时复用（重建骨架并尽量保留已写内容）。

const COMPOSITION_SECTION_TITLES: Record<Language, Record<CompositionGenre, string[]>> = {
  [Language.English]: {
    argumentative: ['Introduction', 'Body 1', 'Body 2', 'Conclusion'],
    narrative: ['Opening', 'Development', 'Climax', 'Ending'],
    expository: ['Introduction', 'Feature 1', 'Feature 2', 'Summary'],
    letter: ['Salutation', 'Body', 'Closing', 'Signature'],
    story: ['Setting', 'Rising', 'Turn', 'Resolution'],
  },
  [Language.Spanish]: {
    argumentative: ['Introducción', 'Cuerpo 1', 'Cuerpo 2', 'Conclusión'],
    narrative: ['Inicio', 'Desarrollo', 'Clímax', 'Final'],
    expository: ['Introducción', 'Característica 1', 'Característica 2', 'Resumen'],
    letter: ['Saludo', 'Cuerpo', 'Despedida', 'Firma'],
    story: ['Ambientación', 'Desarrollo', 'Giro', 'Resolución'],
  },
  [Language.French]: {
    argumentative: ['Introduction', 'Partie 1', 'Partie 2', 'Conclusion'],
    narrative: ['Début', 'Développement', 'Apogée', 'Fin'],
    expository: ['Introduction', 'Aspect 1', 'Aspect 2', 'Résumé'],
    letter: ['Salutation', 'Corps', 'Formule de politesse', 'Signature'],
    story: ['Contexte', 'Montée', 'Tournant', 'Dénouement'],
  },
  [Language.German]: {
    argumentative: ['Einleitung', 'Hauptteil 1', 'Hauptteil 2', 'Schluss'],
    narrative: ['Anfang', 'Entwicklung', 'Höhepunkt', 'Ende'],
    expository: ['Einleitung', 'Merkmal 1', 'Merkmal 2', 'Zusammenfassung'],
    letter: ['Anrede', 'Hauptteil', 'Grußformel', 'Unterschrift'],
    story: ['Setting', 'Steigerung', 'Wendung', 'Auflösung'],
  },
  [Language.Italian]: {
    argumentative: ['Introduzione', 'Corpo 1', 'Corpo 2', 'Conclusione'],
    narrative: ['Inizio', 'Sviluppo', 'Climax', 'Finale'],
    expository: ['Introduzione', 'Caratteristica 1', 'Caratteristica 2', 'Riepilogo'],
    letter: ['Intestazione', 'Corpo', 'Chiusura', 'Firma'],
    story: ['Ambientazione', 'Sviluppo', 'Svolta', 'Risoluzione'],
  },
  [Language.Russian]: {
    argumentative: ['Введение', 'Основная часть 1', 'Основная часть 2', 'Заключение'],
    narrative: ['Вступление', 'Развитие', 'Кульминация', 'Концовка'],
    expository: ['Введение', 'Черта 1', 'Черта 2', 'Итог'],
    letter: ['Обращение', 'Основная часть', 'Заключительная фраза', 'Подпись'],
    story: ['Завязка', 'Развитие', 'Переполюх', 'Развязка'],
  },
  [Language.Greek]: {
    argumentative: ['Εισαγωγή', 'Σώμα 1', 'Σώμα 2', 'Συμπέρασμα'],
    narrative: ['Έναρξη', 'Εξέλιξη', 'Κλιμάκωση', 'Τέλος'],
    expository: ['Εισαγωγή', 'Χαρακτηριστικό 1', 'Χαρακτηριστικό 2', 'Περίληψη'],
    letter: ['Χαιρετισμός', 'Σώμα', 'Κλείσιμο', 'Υπογραφή'],
    story: ['Σκηνικό', 'Ένταση', 'Ανατροπή', 'Κατάληξη'],
  },
  [Language.Arabic]: {
    argumentative: ['مقدمة', 'فقرة 1', 'فقرة 2', 'خاتمة'],
    narrative: ['بداية', 'تطور', 'ذروة', 'نهاية'],
    expository: ['مقدمة', 'سمة 1', 'سمة 2', 'ملخص'],
    letter: ['تحية', 'متن', 'ختام', 'توقيع'],
    story: ['إطار', 'تصاعد', 'تحول', 'حل'],
  },
  [Language.Japanese]: {
    argumentative: ['導入', '本文1', '本文2', '結論'],
    narrative: ['導入', '展開', 'クライマックス', '結末'],
    expository: ['導入', '特徴1', '特徴2', 'まとめ'],
    letter: ['拝啓', '本文', '結びの挨拶', '署名'],
    story: ['設定', '導入', '転換', '結末'],
  },
  [Language.Korean]: {
    argumentative: ['서론', '본문1', '본문2', '결론'],
    narrative: ['시작', '전개', '절정', '결말'],
    expository: ['서론', '특징1', '특징2', '요약'],
    letter: ['머리말', '본문', '맺음인사', '서명'],
    story: ['배경', '전개', '전환', '결말'],
  },
  [Language.Chinese]: {
    argumentative: ['引言', '主体段1', '主体段2', '结论'],
    narrative: ['开头', '经过', '高潮', '结尾'],
    expository: ['引入', '特点1', '特点2', '总结'],
    letter: ['称呼', '正文', '结尾敬语', '署名'],
    story: ['背景', '起', '转', '合'],
  },
};

export function buildCompositionSections(
  level: CEFRLevel,
  genre: CompositionGenre = 'argumentative',
  lang: Language = Language.English
): CompositionSection[] {
  const body = level === CEFRLevel.B1 ? 30 : level === CEFRLevel.B2 ? 50 : 70;
  const locals = COMPOSITION_SECTION_TITLES[lang]?.[genre] ?? COMPOSITION_SECTION_TITLES[Language.English][genre];
  const enRefs = COMPOSITION_SECTION_TITLES[Language.English][genre];
  // 各段目标词数（书信首尾较短）
  const words: number[] =
    genre === 'letter' ? [8, Math.round(body * 1.4), 8, 4] : [30, body, body, 30];
  return locals.map((local, i) => ({
    id: `${genre}-s${i}`,
    title: `${local} ${enRefs[i]}`,
    targetWords: words[i],
    content: '',
  }));
}

// 默认写作成长树：每条主题路径含多个难度递进任务（A1 → A2 → B1 → B2）。
// 每条路径第一个任务解锁，完成后解锁下一个。
// scaffold 为目标语言句型模板（含 ___）；空串表示自由写（用 scaffoldHint 作情境提示）。
// 按语言分组维护，结构通用，新增语言只需往 TREE_THEMES 加条目。

interface TaskSeed {
  title: string;
  cefrLevel: CEFRLevel;
  scaffold: string;
  scaffoldHint: string;
  register?: WritingRegister; // 语体覆盖（默认按等级取 REGISTER_BY_LEVEL）
}

interface ThemeSeed {
  id: string;
  title: string;
  tasks: TaskSeed[];
  genre?: CompositionGenre; // 该主题下作文的默认体裁（议论文/记叙文/书信…）
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
  {
    id: 'theme-travel',
    title: '旅行经历',
    tasks: [
      { title: '我去了哪里', cefrLevel: CEFRLevel.A1, scaffold: '私は ___ に行きました。', scaffoldHint: '填地点（如 東京 / パリ）' },
      { title: '怎么去的', cefrLevel: CEFRLevel.A1, scaffold: '___ で行きました。', scaffoldHint: '填交通工具（如 電車 / 飛行機）' },
      { title: '旅行天气', cefrLevel: CEFRLevel.A2, scaffold: '天気は ___ で、___ をしました。', scaffoldHint: '前填天气（如 晴れ），后填做的事' },
      { title: '买了什么', cefrLevel: CEFRLevel.A2, scaffold: '___ をお土産に買いました。', scaffoldHint: '填纪念品（如 絵葉書）' },
      { title: '印象深刻的旅行', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '写一段印象深刻的旅行：去了哪里、和谁、感受如何，至少四句。' },
      { title: '旅行中的小意外', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '讲一次旅行中遇到的意外或困难，以及你是怎么解决的。' },
      { title: '跟团 vs 自由行', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么。' },
      { title: '旅行的意义', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文。' },
    ],
  },
  {
    id: 'theme-opinion',
    title: '观点与论述',
    tasks: [
      { title: '我喜欢/不喜欢', cefrLevel: CEFRLevel.A1, scaffold: '___ が ___ です。', scaffoldHint: '前填事物，后填形容词（如 好き 喜欢 / 面白い 有趣）' },
      { title: '我的看法', cefrLevel: CEFRLevel.A1, scaffold: '___ は ___ と思います。', scaffoldHint: '前填事物，后填看法' },
      { title: '同意还是不同意', cefrLevel: CEFRLevel.A2, scaffold: '___ に賛成／反対です。', scaffoldHint: '填一个观点（如 学校は楽しい）' },
      { title: '两个选择', cefrLevel: CEFRLevel.A2, scaffold: '___ と ___ のどちらかと言えば、___ が好きです。', scaffoldHint: '前填 A，中填 B，后填更爱的' },
      { title: '谈谈你的看法', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '就一个日常话题发表你的看法，正反都要提到。' },
      { title: '手机是帮手还是干扰', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到。' },
      { title: '社会话题论述', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子。' },
      { title: '童年回忆与影响', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '谈谈童年的一段回忆，以及它如何影响了现在的你。' },
    ],
  },
  {
    id: 'theme-letter',
    title: '书信与邮件',
    tasks: [
      { title: '写一句问候', cefrLevel: CEFRLevel.A1, scaffold: '___ へ', scaffoldHint: '填收信人（如 母 / 友達）' },
      { title: '说声谢谢', cefrLevel: CEFRLevel.A1, scaffold: '___ ありがとうございます。', scaffoldHint: '填感谢的事（如 プレゼント 礼物）' },
      { title: '邀请朋友', cefrLevel: CEFRLevel.A2, scaffold: '一緒に ___ に行きませんか（___）。', scaffoldHint: '前填活动，后填时间' },
      { title: '道歉', cefrLevel: CEFRLevel.A2, scaffold: '___ してごめんなさい。', scaffoldHint: '填道歉的事' },
      { title: '给朋友的一封信', cefrLevel: CEFRLevel.B1, scaffold: '', register: 'casual', scaffoldHint: '写一封给朋友的信：近况、一件开心的事、邀约。' },
      { title: '求助邮件', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '写一封邮件给房东或老师，说明一个问题并请求帮助。' },
      { title: '正式申请邮件', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'business', scaffoldHint: '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格。' },
      { title: '投诉信', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一封投诉信，就一次不满意的消费经历说明问题并要求解决。' },
    ],
  },
  {
    id: 'theme-work',
    title: '工作与职场',
    tasks: [
      { title: '我的职业', cefrLevel: CEFRLevel.A1, scaffold: '私は ___ として働いています。', scaffoldHint: '填职业（如 看護師 护士 / エンジニア 工程师）' },
      { title: '工作地点', cefrLevel: CEFRLevel.A1, scaffold: '___ で働いています。', scaffoldHint: '填地点（如 病院 / 東京）' },
      { title: '日常职责', cefrLevel: CEFRLevel.A2, scaffold: '毎日の仕事は ___ です。', scaffoldHint: '填职责（如 お客様の案内 引导顾客）' },
      { title: '我的同事', cefrLevel: CEFRLevel.A2, scaffold: '___ な人たちと働いています。', scaffoldHint: '填描述（如 親切な 亲切的）' },
      { title: '理想的工作', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述你理想的工作，以及为什么它适合你。' },
      { title: '团队合作', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '谈谈一次团队合作经历：你扮演了什么角色、结果如何。' },
      { title: '远程办公', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"远程办公的利弊"写一篇论述，并给出你的结论。' },
      { title: '求职自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'business', scaffoldHint: '写一段用于求职面试的自我介绍：背景、技能、职业目标。' },
    ],
  },
  {
    id: 'theme-food',
    title: '饮食与文化',
    tasks: [
      { title: '喜欢的食物', cefrLevel: CEFRLevel.A1, scaffold: '好きな食べ物は ___ です。', scaffoldHint: '填食物（如 寿司 / ラーメン）' },
      { title: '味道', cefrLevel: CEFRLevel.A1, scaffold: '___ の味がします。', scaffoldHint: '填味道（如 甘い 甜 / 辛い 辣）' },
      { title: '怎么做', cefrLevel: CEFRLevel.A2, scaffold: '作るには ___ と ___ が必要です。', scaffoldHint: '前填食材，后填食材' },
      { title: '餐厅点餐', cefrLevel: CEFRLevel.A2, scaffold: '___ と ___ を注文したいです。', scaffoldHint: '前填菜，后填饮料' },
      { title: '难忘的一餐', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘。' },
      { title: '家乡味道', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '介绍一道你家乡的菜，说说它对你有什么特别意义。' },
      { title: '传统菜谱', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '介绍一道传统菜的做法与背后的文化含义。' },
      { title: '饮食与文化', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明。' },
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
      { title: '描述你自己', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '用英语写一段自我介绍：你的性格、兴趣与一个近期小目标，至少四句。' },
      { title: '理想的一天', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述你理想中的一天，从早到晚怎么度过，至少四句。' },
      { title: '正式自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '用正式/学术语气写一段自我介绍：背景、专业、目标，至少四句。' },
      { title: '成长的我', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'neutral', scaffoldHint: '对比现在的你与五年前的你，有哪些成长与变化，至少四句。' },
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
      { title: '昨天做了什么', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '写写昨天发生的一件事：你做了什么、和谁一起、感觉如何，至少四句。' },
      { title: '习惯对比', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '对比你平时与周末的不同生活习惯，并说明原因。' },
      { title: '习惯的影响', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明。' },
      { title: '难忘的一天', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一段令你难忘的一天的经历：时间、事件、感受，至少四句。' },
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
      { title: '偏好比较', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '谈谈你最喜欢的一项爱好，以及它为什么对你重要。' },
      { title: '爱好的意义', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述这个爱好给你带来的收获，以及你今后想怎么发展它。' },
      { title: '收获与未来', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"爱好塑造性格"这一观点，结合你的经历写一篇短文。' },
      { title: '为什么重要', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'neutral', scaffoldHint: '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句。' },
    ],
  },
  {
    id: 'en-travel',
    title: '旅行经历',
    tasks: [
      { title: '我去了哪里', cefrLevel: CEFRLevel.A1, scaffold: 'I went to ___.', scaffoldHint: '填地点（如 Tokyo / Paris）' },
      { title: '怎么去的', cefrLevel: CEFRLevel.A1, scaffold: 'I went there by ___.', scaffoldHint: '填交通工具（如 train / plane）' },
      { title: '旅行天气', cefrLevel: CEFRLevel.A2, scaffold: 'The weather was ___ and I ___.', scaffoldHint: '前填天气（如 sunny），后填做的事' },
      { title: '买了什么', cefrLevel: CEFRLevel.A2, scaffold: 'I bought ___ as a souvenir.', scaffoldHint: '填纪念品（如 a postcard）' },
      { title: '印象深刻的旅行', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: OPEN[CEFRLevel.B1][0].text },
      { title: '旅行中的小意外', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '讲一次旅行中遇到的意外或困难，以及你是怎么解决的。' },
      { title: '跟团 vs 自由行', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么。' },
      { title: '旅行的意义', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文。' },
    ],
  },
  {
    id: 'en-opinion',
    title: '观点与论述',
    tasks: [
      { title: '我喜欢/不喜欢', cefrLevel: CEFRLevel.A1, scaffold: 'I (like / don’t like) ___ because ___.', scaffoldHint: '前填事物，后填原因' },
      { title: '我的看法', cefrLevel: CEFRLevel.A1, scaffold: 'I think ___ is ___.', scaffoldHint: '前填事物，后填形容词（如 interesting）' },
      { title: '同意还是不同意', cefrLevel: CEFRLevel.A2, scaffold: 'I agree / disagree that ___.', scaffoldHint: '填一个观点（如 school is fun）' },
      { title: '两个选择', cefrLevel: CEFRLevel.A2, scaffold: 'Between ___ and ___, I prefer ___.', scaffoldHint: '前填 A，中填 B，后填更爱的' },
      { title: '谈谈你的看法', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: OPEN[CEFRLevel.B1][1].text },
      { title: '手机是帮手还是干扰', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到。' },
      { title: '社会话题论述', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: OPEN[CEFRLevel.B2][3].text },
      { title: '童年回忆与影响', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: OPEN[CEFRLevel.B2][0].text },
    ],
  },
  {
    id: 'en-letter',
    title: '书信与邮件',
    tasks: [
      { title: '写一句问候', cefrLevel: CEFRLevel.A1, scaffold: 'Dear ___,', scaffoldHint: '填收信人（如 Mom / Tom）' },
      { title: '说声谢谢', cefrLevel: CEFRLevel.A1, scaffold: 'Thank you for ___.', scaffoldHint: '填感谢的事（如 the gift）' },
      { title: '邀请朋友', cefrLevel: CEFRLevel.A2, scaffold: 'Would you like to ___ with me on ___?', scaffoldHint: '前填活动，后填时间' },
      { title: '道歉', cefrLevel: CEFRLevel.A2, scaffold: 'I am sorry that ___.', scaffoldHint: '填道歉的事' },
      { title: '给朋友的一封信', cefrLevel: CEFRLevel.B1, scaffold: '', register: 'casual', scaffoldHint: OPEN[CEFRLevel.B1][3].text },
      { title: '求助邮件', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '写一封邮件给房东或老师，说明一个问题并请求帮助。' },
      { title: '正式申请邮件', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'business', scaffoldHint: OPEN[CEFRLevel.B2][4].text },
      { title: '投诉信', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一封投诉信，就一次不满意的消费经历说明问题并要求解决。' },
    ],
  },
  {
    id: 'en-work',
    title: '工作与职场',
    tasks: [
      { title: '我的职业', cefrLevel: CEFRLevel.A1, scaffold: 'I work as a ___.', scaffoldHint: '填职业（如 nurse / engineer）' },
      { title: '工作地点', cefrLevel: CEFRLevel.A1, scaffold: 'I work in / at ___.', scaffoldHint: '填地点（如 a hospital / Tokyo）' },
      { title: '日常职责', cefrLevel: CEFRLevel.A2, scaffold: 'My job is to ___ every day.', scaffoldHint: '填职责（如 help customers）' },
      { title: '我的同事', cefrLevel: CEFRLevel.A2, scaffold: 'I work with ___ people.', scaffoldHint: '填描述（如 friendly）' },
      { title: '理想的工作', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述你理想的工作，以及为什么它适合你。' },
      { title: '团队合作', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '谈谈一次团队合作经历：你扮演了什么角色、结果如何。' },
      { title: '远程办公', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"远程办公的利弊"写一篇论述，并给出你的结论。' },
      { title: '求职自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'business', scaffoldHint: '写一段用于求职面试的自我介绍：背景、技能、职业目标。' },
    ],
  },
  {
    id: 'en-food',
    title: '饮食与文化',
    tasks: [
      { title: '喜欢的食物', cefrLevel: CEFRLevel.A1, scaffold: 'My favorite food is ___.', scaffoldHint: '填食物（如 sushi / noodles）' },
      { title: '味道', cefrLevel: CEFRLevel.A1, scaffold: 'It tastes ___.', scaffoldHint: '填味道（如 sweet / spicy）' },
      { title: '怎么做', cefrLevel: CEFRLevel.A2, scaffold: 'To cook it, you need ___ and ___.', scaffoldHint: '前填食材，后填食材' },
      { title: '餐厅点餐', cefrLevel: CEFRLevel.A2, scaffold: 'I would like to order ___ and ___.', scaffoldHint: '前填菜，后填饮料' },
      { title: '难忘的一餐', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘。' },
      { title: '家乡味道', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '介绍一道你家乡的菜，说说它对你有什么特别意义。' },
      { title: '传统菜谱', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: OPEN[CEFRLevel.B2][2].text },
      { title: '饮食与文化', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明。' },
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
  {
    id: 'ko-travel',
    title: '旅行经历',
    tasks: [
      { title: '我去了哪里', cefrLevel: CEFRLevel.A1, scaffold: '___에 갔어요.', scaffoldHint: '填地点（如 도쿄 / 파리）' },
      { title: '怎么去的', cefrLevel: CEFRLevel.A1, scaffold: '___로 갔어요.', scaffoldHint: '填交通工具（如 기차 / 비행기）' },
      { title: '旅行天气', cefrLevel: CEFRLevel.A2, scaffold: '날씨가 ___했고, ___했어요.', scaffoldHint: '前填天气（如 화창했고 晴朗），后填做的事' },
      { title: '买了什么', cefrLevel: CEFRLevel.A2, scaffold: '___을/를 기념품으로 샀어요.', scaffoldHint: '填纪念品（如 엽서 明信片）' },
      { title: '印象深刻的旅行', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '写一段印象深刻的旅行：去了哪里、和谁、感受如何，至少四句。' },
      { title: '旅行中的小意外', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '讲一次旅行中遇到的意外或困难，以及你是怎么解决的。' },
      { title: '跟团 vs 自由行', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么。' },
      { title: '旅行的意义', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文。' },
    ],
  },
  {
    id: 'ko-opinion',
    title: '观点与论述',
    tasks: [
      { title: '我喜欢/不喜欢', cefrLevel: CEFRLevel.A1, scaffold: '___이/가 ___이/가요.', scaffoldHint: '前填事物，后填形容词（如 좋아요 喜欢 / 재미있어요 有趣）' },
      { title: '我的看法', cefrLevel: CEFRLevel.A1, scaffold: '___은/는 ___라고 생각해요.', scaffoldHint: '前填事物，后填看法' },
      { title: '同意还是不同意', cefrLevel: CEFRLevel.A2, scaffold: '___에 동의해요/반대해요.', scaffoldHint: '填一个观点（如 학교는 재미있어요）' },
      { title: '两个选择', cefrLevel: CEFRLevel.A2, scaffold: '___과/와 ___ 중에서 ___을/를 더 좋아해요.', scaffoldHint: '前填 A，中填 B，后填更爱的' },
      { title: '谈谈你的看法', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '就一个日常话题发表你的看法，正反都要提到。' },
      { title: '手机是帮手还是干扰', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到。' },
      { title: '社会话题论述', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子。' },
      { title: '童年回忆与影响', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '谈谈童年的一段回忆，以及它如何影响了现在的你。' },
    ],
  },
  {
    id: 'ko-letter',
    title: '书信与邮件',
    tasks: [
      { title: '写一句问候', cefrLevel: CEFRLevel.A1, scaffold: '___에게', scaffoldHint: '填收信人（如 엄마 / 친구）' },
      { title: '说声谢谢', cefrLevel: CEFRLevel.A1, scaffold: '___해서 고마워요.', scaffoldHint: '填感谢的事（如 선물 礼物）' },
      { title: '邀请朋友', cefrLevel: CEFRLevel.A2, scaffold: '___에 같이 ___하러 갈래요?', scaffoldHint: '前填活动，后填时间' },
      { title: '道歉', cefrLevel: CEFRLevel.A2, scaffold: '___해서 미안해요.', scaffoldHint: '填道歉的事' },
      { title: '给朋友的一封信', cefrLevel: CEFRLevel.B1, scaffold: '', register: 'casual', scaffoldHint: '写一封给朋友的信：近况、一件开心的事、邀约。' },
      { title: '求助邮件', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '写一封邮件给房东或老师，说明一个问题并请求帮助。' },
      { title: '正式申请邮件', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'business', scaffoldHint: '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格。' },
      { title: '投诉信', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '写一封投诉信，就一次不满意的消费经历说明问题并要求解决。' },
    ],
  },
  {
    id: 'ko-work',
    title: '工作与职场',
    tasks: [
      { title: '我的职业', cefrLevel: CEFRLevel.A1, scaffold: '저는 ___으로/로 일해요.', scaffoldHint: '填职业（如 간호사 护士 / 엔지니어 工程师）' },
      { title: '工作地点', cefrLevel: CEFRLevel.A1, scaffold: '___에서 일해요.', scaffoldHint: '填地点（如 병원 / 서울）' },
      { title: '日常职责', cefrLevel: CEFRLevel.A2, scaffold: '제 일은 매일 ___하는 거예요.', scaffoldHint: '填职责（如 손님 안내하기 引导顾客）' },
      { title: '我的同事', cefrLevel: CEFRLevel.A2, scaffold: '___한 사람들과 일해요.', scaffoldHint: '填描述（如 친절한 亲切的）' },
      { title: '理想的工作', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述你理想的工作，以及为什么它适合你。' },
      { title: '团队合作', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '谈谈一次团队合作经历：你扮演了什么角色、结果如何。' },
      { title: '远程办公', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '就"远程办公的利弊"写一篇论述，并给出你的结论。' },
      { title: '求职自我介绍', cefrLevel: CEFRLevel.B2, scaffold: '', register: 'business', scaffoldHint: '写一段用于求职面试的自我介绍：背景、技能、职业目标。' },
    ],
  },
  {
    id: 'ko-food',
    title: '饮食与文化',
    tasks: [
      { title: '喜欢的食物', cefrLevel: CEFRLevel.A1, scaffold: '좋아하는 음식은 ___이에요/예요.', scaffoldHint: '填食物（如 초밥 寿司 / 라면 拉面）' },
      { title: '味道', cefrLevel: CEFRLevel.A1, scaffold: '___ 맛이 나요.', scaffoldHint: '填味道（如 달다 甜 / 맵다 辣）' },
      { title: '怎么做', cefrLevel: CEFRLevel.A2, scaffold: '요리하려면 ___과/와 ___이/가 필요해요.', scaffoldHint: '前填食材，后填食材' },
      { title: '餐厅点餐', cefrLevel: CEFRLevel.A2, scaffold: '___과/와 ___을/를 주문하고 싶어요.', scaffoldHint: '前填菜，后填饮料' },
      { title: '难忘的一餐', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘。' },
      { title: '家乡味道', cefrLevel: CEFRLevel.B1, scaffold: '', scaffoldHint: '介绍一道你家乡的菜，说说它对你有什么特别意义。' },
      { title: '传统菜谱', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '介绍一道传统菜的做法与背后的文化含义。' },
      { title: '饮食与文化', cefrLevel: CEFRLevel.B2, scaffold: '', scaffoldHint: '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明。' },
    ],
  },
];

const TREE_THEMES: Partial<Record<Language, ThemeSeed[]>> = {
  [Language.Japanese]: JAPANESE_THEMES,
  [Language.English]: ENGLISH_THEMES,
  [Language.Korean]: KOREAN_THEMES,
};

// 主题 → 默认作文体裁（语言无关，按主题后缀匹配）。
// 叙事类（intro/daily/hobby/travel）用记叙文结构；观点/职场用议论文；
// 书信用书信体；食物用说明文。每个主题下作文节点据此生成提纲骨架。
const THEME_GENRE: Record<string, CompositionGenre> = {
  intro: 'narrative',
  daily: 'narrative',
  hobby: 'narrative',
  travel: 'narrative',
  opinion: 'argumentative',
  letter: 'letter',
  work: 'argumentative',
  food: 'expository',
};

// 真实考题库：每个主题 × 语言一份「任务正文」。
// 关键：考试评分（IELTS Task Response / TOEFL Development / TOPIK 내용 구성 / DELE adecuación）
// 评的就是「是否回应任务」，所以这里必须给 AI 一个 concrete task，而不是主题标签。
// 体裁由 THEME_GENRE 决定（narrative/argumentative/letter/expository），考题据此撰写。
const COMPOSITION_PROMPTS: Partial<Record<Language, Partial<Record<string, string>>>> = {
  [Language.English]: {
    intro: 'Describe a person who has influenced you the most. Explain who they are, how you know them, and why they matter to you.',
    daily: 'Describe a typical day in your life that feels meaningful to you. What do you do, and what makes this routine special?',
    hobby: 'Write about a hobby you enjoy. Describe what it is, how you got into it, and why it is important to you.',
    travel: 'Describe a memorable trip you have taken. Where did you go, what happened, and what did you learn from the experience?',
    opinion: 'Some people believe that tourism does more harm than good to local cultures. To what extent do you agree or disagree? Support your view with reasons and examples.',
    letter: 'You are writing to your landlord to request a repair for a leaking pipe in your apartment. Explain the problem, its impact on your daily life, and propose a convenient date for the fix.',
    work: 'Many companies now allow employees to work from home. Discuss the advantages and disadvantages of remote work, and give your own view.',
    food: 'Explain how to prepare a traditional dish from your culture, or explain why a particular food is important in your country.',
  },
  [Language.Japanese]: {
    intro: 'あなたに最も影響を与えた人について書いてください。その人が誰で、どのように知り合ったか、そしてなぜ大切なのかを説明しましょう。',
    daily: 'あなたにとって意味のある一日の過ごし方を書いてください。何をしていて、その日常がなぜ特別なのかを説明しましょう。',
    hobby: '好きな趣味について書いてください。どんな趣味で、どうやって始めたか、なぜ大切なのかを説明しましょう。',
    travel: '印象に残っている旅行について書いてください。どこへ行き、何が起きたか、そしてそこから何を学んだかを書きましょう。',
    opinion: '観光は地域の文化に悪影響を与えるという意見があります。あなたはどの程度賛成ですか、反対ですか。理由と例を挙げてください。',
    letter: 'あなたは大家さんに、アパートの漏水修理を頼む手紙を書いています。問題とその影響を説明し、修理を希望する日付を提案しましょう。',
    work: '多くの会社が在宅勤務を認めるようになりました。在宅勤務の利点と欠点について論じ、あなた自身の考えを述べてください。',
    food: 'あなたの国の伝統料理の作り方を説明するか、なぜある食べ物がその国で大切なのかを説明してください。',
  },
  [Language.Korean]: {
    intro: '당신에게 가장 큰 영향을 준 사람에 대해 쓰세요. 그 사람이 누구인지, 어떻게 알게 되었는지, 그리고 왜 중요한지 설명하세요.',
    daily: '당신에게 의미 있는 하루의 일과에 대해 쓰세요. 무엇을 하며, 그 일상이 왜 특별한지 설명하세요.',
    hobby: '좋아하는 취미에 대해 쓰세요. 어떤 취미인지, 어떻게 시작했는지, 왜 중요한지 설명하세요.',
    travel: '인상 깊었던 여행에 대해 쓰세요. 어디를 갔는지, 무슨 일이 있었는지, 그리고 거기서 무엇을 배웠는지 쓰세요.',
    opinion: '관광이 지역 문화에 악영향을 준다는 의견이 있습니다. 당신은 어느 정도 찬성하거나 반대하는지 이유와 예시와 함께 쓰세요.',
    letter: '당신은 집주인에게 아파트 누수 수리를 요청하는 편지를 쓰고 있습니다. 문제와 그 영향을 설명하고, 수리 희망 날짜를 제안하세요.',
    work: '많은 회사가 재택근무를 허용하게 되었습니다. 재택근무의 장점과 단점을 논하고, 자신의 생각을 말하세요.',
    food: '당신 나라의 전통 요리 만드는 법을 설명하거나, 왜 어떤 음식이 그 나라에서 중요한지 설명하세요.',
  },
};

// 取真实考题：主题 key（intro/daily/...）+ 语言。回退到英语，再回退到通用提示。
export const buildCompositionPrompt = (themeKey: string, lang: Language): string => {
  return (
    COMPOSITION_PROMPTS[lang]?.[themeKey] ??
    COMPOSITION_PROMPTS[Language.English][themeKey] ??
    'Write an essay responding to the given topic.'
  );
};

// ===================== 纵向写作者养成主线（Vertical Writer-Formation Spine）=====================
// 设计：观察积累→组织表达→修改打磨→完成发布 四枝交织；写作过程是循环（构思→起草→重读→重写→编辑→分享）。
// 与现有「横向内容主题树」（自我介绍/日常/兴趣…）正交：横向是题材，纵向是写作者成长阶段。
// 同一生活题材会在不同阶段重现（通过 leaf.theme 反向挂接到横向主题），实现"同题材长出更强写法"。
// 数据语言无关：scaffoldHint 为母语（中文）提示；enScaffold/jaScaffold/koScaffold 为各目标语言的句型支架，
// makeLeaf 按当前学习语言取对应支架，缺失则自由写（与横向主题树 TREE_THEMES 的多语言 scaffold 对齐）。
// 参考：Bird by Bird（低压力起草）/ Writing Tools（短小可练工具）/ On Writing Well（清晰简洁有声音）/ The Sense of Style（读者视角）。

interface SpineLeafSeed {
  title: string;
  cefr: CEFRLevel;
  hint: string;                       // 母语情境/提示（语言无关）
  enScaffold?: string;               // 英语句型支架（可选）
  jaScaffold?: string;               // 日语句型支架（可选）
  koScaffold?: string;               // 韩语句型支架（可选）
  practiceType: WritingPracticeType;
  cycleStage: WritingCycleStage;
  register?: WritingRegister;
  theme?: string;                     // 反向挂接横向主题 key（daily/intro/travel/letter/opinion…）→ tags: x:<key>
}

interface SpineBranchSeed {
  id: string;
  title: string;
  leaves: SpineLeafSeed[];
}

const SPINE_BRANCHES: SpineBranchSeed[] = [
  {
    id: 'b1',
    title: '01 写下我自己',
    leaves: [
      { title: '自我介绍', cefr: CEFRLevel.A1, hint: '用目标语言写 2–3 句介绍自己：名字、来自哪里、一句爱好。', enScaffold: 'My name is ___. I am from ___. I like ___.', jaScaffold: '私の名前は ___ です。___ から来ました。___ が好きです。', koScaffold: '제 이름은 ___이고, ___에서 왔어요. ___을/를 좋아해요.', practiceType: 'observe', cycleStage: 'plan', theme: 'intro' },
      { title: '我的房间 / 我的家', cefr: CEFRLevel.A1, hint: '描述你住的地方：有几间房、你最喜欢哪个角落、为什么。', practiceType: 'observe', cycleStage: 'plan' },
      { title: '我的早晨', cefr: CEFRLevel.A1, hint: '按时间顺序写你通常怎么开始一天：起床、洗漱、早餐。', enScaffold: 'I wake up at ___. Then I ___.', jaScaffold: '___ 時に起きます。それから ___ します。', koScaffold: '___시에 일어나요. 그리고 ___해요.', practiceType: 'narrate', cycleStage: 'draft', theme: 'daily' },
      { title: '我的一天', cefr: CEFRLevel.A2, hint: '用连接词（然后 / 之后 / 最后）把一天串成一段，不少于 5 句。', practiceType: 'organize', cycleStage: 'draft', theme: 'daily' },
      { title: '一张照片的故事', cefr: CEFRLevel.A2, hint: '选一张你喜欢的照片，写写它拍于何时何地、为什么对你特别。', practiceType: 'narrate', cycleStage: 'draft' },
      { title: '我的第一篇"关于我"的小文', cefr: CEFRLevel.B1, hint: '把上面的碎片整合成一篇 120–150 词的小文：我是谁、我的日常、我的小目标。', practiceType: 'organize', cycleStage: 'draft', theme: 'intro' },
    ],
  },
  {
    id: 'b2',
    title: '02 写下我的世界',
    leaves: [
      { title: '描述一个人', cefr: CEFRLevel.A1, hint: '写一位你熟悉的人：他/她是谁、长什么样、为什么重要。', practiceType: 'narrate', cycleStage: 'plan' },
      { title: '描述一个地方', cefr: CEFRLevel.A1, hint: '写一个你喜欢的地方：在哪里、有什么、气氛如何。', practiceType: 'narrate', cycleStage: 'plan', theme: 'travel' },
      { title: '描述一件物品', cefr: CEFRLevel.A1, hint: '写一件你常用的东西：它是什么、什么颜色/材质、你用它做什么。', practiceType: 'narrate', cycleStage: 'plan' },
      { title: '用五感写一个场景', cefr: CEFRLevel.A2, hint: '写一个场景，至少用到看/听/闻/触/尝中的三种感觉。', practiceType: 'narrate', cycleStage: 'draft' },
      { title: '观察日记：今天我注意到了什么', cefr: CEFRLevel.A2, hint: '记录今天一个被你注意到的小细节（一片云、一种气味、一句无心的话）。', practiceType: 'observe', cycleStage: 'draft' },
      { title: '把"很开心 / 很好看"写具体', cefr: CEFRLevel.B1, hint: '重写一句"今天很开心"或"那里很好看"，用具体动作/画面代替空泛形容词。', practiceType: 'style', cycleStage: 'edit' },
    ],
  },
  {
    id: 'b3',
    title: '03 写下发生的事',
    leaves: [
      { title: '昨天发生了什么', cefr: CEFRLevel.A1, hint: '用过去式写昨天做的一两件事。', enScaffold: 'Yesterday I ___ and then I ___.', jaScaffold: '昨日は ___ して、それから ___ しました。', koScaffold: '어제 ___하고 ___했어요.', practiceType: 'narrate', cycleStage: 'draft', theme: 'daily' },
      { title: '一次意外', cefr: CEFRLevel.A2, hint: '讲一件出乎意料的小事：发生了什么、你什么反应、结果如何。', practiceType: 'narrate', cycleStage: 'draft' },
      { title: '难忘的一天', cefr: CEFRLevel.A2, hint: '写一天里让你印象最深的时刻，说清前因后果。', practiceType: 'narrate', cycleStage: 'draft', theme: 'daily' },
      { title: '第一次……', cefr: CEFRLevel.A2, hint: '写你第一次做某件事的经历：第一次骑车 / 第一次做饭 / 第一次独自旅行。', practiceType: 'narrate', cycleStage: 'draft' },
      { title: '冲突与转折', cefr: CEFRLevel.B1, hint: '写一个有小冲突或转折的小故事：期待落空、计划打乱、意外转机。', practiceType: 'narrate', cycleStage: 'draft' },
      { title: '一件事的三种版本：短讯 / 日记 / 故事', cefr: CEFRLevel.B1, hint: '把同一件事分别写成：①一条给朋友的短讯 ②一段日记 ③一个有人物有画面的小故事。对比三者差异。', practiceType: 'rewrite', cycleStage: 'rewrite' },
    ],
  },
  {
    id: 'b4',
    title: '04 让文字连起来',
    leaves: [
      { title: '时间顺序', cefr: CEFRLevel.A1, hint: '用 first / then / after that / finally 把三个动作连成一段。', practiceType: 'organize', cycleStage: 'draft' },
      { title: '原因与结果', cefr: CEFRLevel.A2, hint: '写"因为___，所以___"的句式，给出一件事的起因和结果。', practiceType: 'organize', cycleStage: 'draft' },
      { title: '对比与选择', cefr: CEFRLevel.A2, hint: '用"比起 A，我更___ B"或"on one hand… on the other hand…"对比两件事物。', practiceType: 'organize', cycleStage: 'draft' },
      { title: '转折与意外', cefr: CEFRLevel.A2, hint: '用 but / however / 没想到 写一个出现转折的句子或短段。', practiceType: 'organize', cycleStage: 'draft' },
      { title: '一个段落只说一件事', cefr: CEFRLevel.B1, hint: '写两个段落，每段只围绕一个中心意思；检查有没有跑题的句子。', practiceType: 'organize', cycleStage: 'edit' },
      { title: '给故事写开头和结尾', cefr: CEFRLevel.B1, hint: '为一个已知的小故事各写：一个抓人的开头 + 一个留余味的结尾。', practiceType: 'organize', cycleStage: 'draft' },
    ],
  },
  {
    id: 'b5',
    title: '05 说出我的想法',
    leaves: [
      { title: '我喜欢 / 不喜欢……', cefr: CEFRLevel.A1, hint: '用"我喜欢___，因为___"表达一个偏好。', enScaffold: 'I like ___ because ___.', jaScaffold: '___ が好きです。なぜなら ___ からです。', koScaffold: '___을/를 좋아해요. 왜냐하면 ___이/가 때문이에요.', practiceType: 'opinion', cycleStage: 'plan' },
      { title: '给出一个理由', cefr: CEFRLevel.A1, hint: '为一个观点补上一个理由（不只是"我觉得"）。', practiceType: 'opinion', cycleStage: 'draft' },
      { title: '两个理由 + 一个例子', cefr: CEFRLevel.A2, hint: '就一个话题写出两个理由，并搭配一个具体例子。', practiceType: 'opinion', cycleStage: 'draft' },
      { title: '同意还是不同意', cefr: CEFRLevel.A2, hint: '对一个说法表态，并写一句支持你态度的依据。', practiceType: 'opinion', cycleStage: 'draft' },
      { title: '回应另一种看法', cefr: CEFRLevel.B1, hint: '先复述对方观点，再温和地提出你的不同意见。', practiceType: 'opinion', cycleStage: 'draft' },
      { title: '写一篇有立场的小短文', cefr: CEFRLevel.B1, hint: '就一个日常话题写一篇 120 词短文：明确立场 + 两个理由 + 一个例子。', practiceType: 'opinion', cycleStage: 'draft', theme: 'opinion' },
    ],
  },
  {
    id: 'b6',
    title: '06 学会为读者而写',
    leaves: [
      { title: '一条留言', cefr: CEFRLevel.A1, hint: '给同桌/同事留一条简短留言：你去哪了、何时回。', practiceType: 'reader', cycleStage: 'plan' },
      { title: '邀请与回复', cefr: CEFRLevel.A2, hint: '写一条邀请（时间+活动），再写一条接受或婉拒的回复。', practiceType: 'reader', cycleStage: 'draft' },
      { title: '感谢 / 道歉 / 请求', cefr: CEFRLevel.A2, hint: '任选一种，写一段话达到目的且不让人尴尬。', practiceType: 'reader', cycleStage: 'draft' },
      { title: '给朋友的邮件', cefr: CEFRLevel.A2, hint: '写一封给朋友的轻松邮件：近况 + 一件开心事 + 一个邀约。', register: 'casual', practiceType: 'reader', cycleStage: 'draft', theme: 'letter' },
      { title: '正式邮件', cefr: CEFRLevel.B1, hint: '把同一件事改写成正式邮件（给老师/上级）：更礼貌、结构更清楚。', register: 'formal', practiceType: 'reader', cycleStage: 'draft', theme: 'letter' },
      { title: '同一内容写给朋友与老师', cefr: CEFRLevel.B1, hint: '就"请假/请教"同一目的，分别写 casual 版与 formal 版，体会语体差异。', practiceType: 'rewrite', cycleStage: 'rewrite', theme: 'letter' },
    ],
  },
  {
    id: 'b7',
    title: '07 让文字更像"我"',
    leaves: [
      { title: '从范文偷一招', cefr: CEFRLevel.B1, hint: '读一段你喜欢的范文，挑一个你欣赏的写法（开头/比喻/节奏），模仿它写一句自己的。', practiceType: 'style', cycleStage: 'reread' },
      { title: '替换重复词', cefr: CEFRLevel.B1, hint: '找出你文中重复最多的词，用同义或具体说法替换其中几处。', practiceType: 'style', cycleStage: 'edit' },
      { title: '加入细节与画面', cefr: CEFRLevel.B1, hint: '给一段平淡的文字加 1–2 个具体细节，让它可感。', practiceType: 'style', cycleStage: 'edit' },
      { title: '写出情绪，但不直接说情绪', cefr: CEFRLevel.B2, hint: '写"我很紧张"不如写手心的汗。用动作/环境代替情绪词。', practiceType: 'style', cycleStage: 'edit' },
      { title: '句子节奏：短句与长句', cefr: CEFRLevel.B2, hint: '交替使用短句与长句，让一段文字有呼吸感。', practiceType: 'style', cycleStage: 'edit' },
      { title: '找到我常用、也最自然的表达', cefr: CEFRLevel.B2, hint: '回顾你近期写作，挑出 2–3 个你愿意反复使用的句式/词组，作为你的"声音"。', practiceType: 'style', cycleStage: 'rewrite' },
    ],
  },
  {
    id: 'b8',
    title: '08 重写一篇作品',
    leaves: [
      { title: '删掉不重要的句子', cefr: CEFRLevel.B1, hint: '拿一篇旧作，划掉 1–2 句对主旨无帮助的话，感受文字变紧。', practiceType: 'rewrite', cycleStage: 'edit' },
      { title: '补一个读者需要知道的细节', cefr: CEFRLevel.B1, hint: '找出读者会困惑的地方，补一句必要背景或例子。', practiceType: 'rewrite', cycleStage: 'rewrite' },
      { title: '调整段落顺序', cefr: CEFRLevel.B1, hint: '换一换段落顺序，看哪一种读起来更顺、更有推进感。', practiceType: 'rewrite', cycleStage: 'rewrite' },
      { title: '让开头更吸引人', cefr: CEFRLevel.B2, hint: '重写开头：用一个画面、一个问题或一句反常识的话抓住读者。', practiceType: 'rewrite', cycleStage: 'rewrite' },
      { title: '让结尾留下余味', cefr: CEFRLevel.B2, hint: '重写结尾：不总结，而是回扣开头、留一个开放念头。', practiceType: 'rewrite', cycleStage: 'rewrite' },
      { title: '初稿 → 二稿 → 定稿', cefr: CEFRLevel.B2, hint: '完整走一遍：先自由写初稿，再按"读者/结构"重写二稿，最后做语言精修定稿。', practiceType: 'rewrite', cycleStage: 'rewrite' },
    ],
  },
];

// ★ 我的作品小册：把各阶段"第一个作品"收进来，形成可回看的成长轨迹
const SPINE_PORTFOLIO: SpineLeafSeed[] = [
  { title: '我的第一篇日记', cefr: CEFRLevel.A1, hint: '写你作为语言学习者的第一篇日记：今天做了什么、心情如何。', practiceType: 'narrate', cycleStage: 'share', theme: 'daily' },
  { title: '我的第一封信', cefr: CEFRLevel.A2, hint: '写一封完整的信（给朋友或家人），用上称呼、正文、结尾敬语。', practiceType: 'reader', cycleStage: 'share', theme: 'letter' },
  { title: '我的第一个故事', cefr: CEFRLevel.B1, hint: '写一个有人物、有事件、有转折的小故事。', practiceType: 'narrate', cycleStage: 'share' },
  { title: '我的第一篇观点文', cefr: CEFRLevel.B1, hint: '写一篇有明确立场的短文，配理由与例子。', practiceType: 'opinion', cycleStage: 'share', theme: 'opinion' },
  { title: '季度主题作品集', cefr: CEFRLevel.B2, hint: '挑本季度你最满意的 3 篇作品，写一句它们共同说明了什么。', practiceType: 'organize', cycleStage: 'share' },
];

// 生成纵向养成主线的全部节点（语言无关，自动覆盖所有目标语言）
function buildSpineNodes(lang: Language, level: CEFRLevel, now: number): WritingNode[] {
  const levelRank = CEFR_RANK[level] ?? 1;
  const nodes: WritingNode[] = [];
  const spineRoot: WritingNode = {
    id: 'spine', parentId: 'root', type: 'theme', title: '★ 写作者养成主线',
    content: '', progress: 0, wordCount: 0, tags: ['spine'], isExpanded: false,
    createdAt: now, updatedAt: now, language: lang, spine: true,
  };
  nodes.push(spineRoot);

  const makeLeaf = (parentId: string, idx: number, lf: SpineLeafSeed): WritingNode => ({
    id: `${parentId}-${idx}`,
    parentId,
    type: 'task',
    title: lf.title,
    content: '',
    progress: 0,
    wordCount: 0,
    tags: lf.theme ? ['spine', `x:${lf.theme}`] : ['spine'],
    isExpanded: false,
    createdAt: now,
    updatedAt: now,
    cefrLevel: lf.cefr,
    register: lf.register ?? REGISTER_BY_LEVEL[lf.cefr] ?? 'neutral',
    unlocked: (CEFR_RANK[lf.cefr] ?? 1) <= levelRank,
    completed: false,
    scaffold:
      (lang === Language.English && lf.enScaffold) ||
      (lang === Language.Japanese && lf.jaScaffold) ||
      (lang === Language.Korean && lf.koScaffold) || '',
    scaffoldHint: lf.hint,
    order: idx,
    practiceType: lf.practiceType,
    cycleStage: lf.cycleStage,
    language: lang,
    spine: true,
  });

  for (const br of SPINE_BRANCHES) {
    const bid = `spine-${br.id}`;
    nodes.push({
      id: bid, parentId: 'spine', type: 'theme', title: br.title,
      content: '', progress: 0, wordCount: 0, tags: ['spine'], isExpanded: false,
      createdAt: now, updatedAt: now, language: lang, spine: true,
    });
    br.leaves.forEach((lf, i) => nodes.push(makeLeaf(bid, i, lf)));
  }

  // 作品小册
  const pid = 'spine-portfolio';
  nodes.push({
    id: pid, parentId: 'spine', type: 'theme', title: '★ 我的作品小册',
    content: '', progress: 0, wordCount: 0, tags: ['spine', 'portfolio'], isExpanded: false,
    createdAt: now, updatedAt: now, language: lang, spine: true,
  });
  SPINE_PORTFOLIO.forEach((lf, i) => nodes.push(makeLeaf(pid, i, lf)));

  return nodes;
}

export function createDefaultGrowthTree(lang: Language, level: CEFRLevel): WritingNode[] {
  // 写作树主题：已完整本地化的语言（日/英/韩）直接取用；其余语言先回退到英语主题树
  // （标题为中文、scaffold 为英语），保证所有支持语言都能进入流水线。
  const themes = TREE_THEMES[lang] ?? TREE_THEMES[Language.English]!;
  const now = Date.now();
  const levelRank = CEFR_RANK[level] ?? 1;
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

  // 纵向写作者养成主线（新增子树，与横向内容主题树正交；保留旧主题节点，迁移零风险）
  nodes.push(...buildSpineNodes(lang, level, now));

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
        register: t.register ?? REGISTER_BY_LEVEL[t.cefrLevel] ?? 'neutral',
        unlocked: (CEFR_RANK[t.cefrLevel] ?? 1) <= levelRank,
        completed: false,
        scaffold: t.scaffold,
        scaffoldHint: t.scaffoldHint,
        order: i,
        language: lang,
      });
    });

    // 作文节点（长文）：所有语言均挂作文（B1+ 解锁），按主题体裁生成提纲骨架。
    // 体裁来自 THEME_GENRE（按主题后缀匹配，语言无关）；默认考试按语言门控
    // （EN→IELTS / ES→DELE / JA→JLPT / KO→TOPIK），其余语言缺考回退 CEFR，
    // 与 analyzeWriting / EXAM_SCORECARD 的考试评分体系一致。
    const themeKey = th.id.split('-').slice(1).join('-'); // en-intro -> intro / theme-intro -> intro
    const genre = THEME_GENRE[themeKey] ?? 'argumentative';
    const defaultExam: TargetExam =
      lang === Language.English ? ('IELTS' as TargetExam)
      : lang === Language.Spanish ? ('DELE' as TargetExam)
      : lang === Language.Japanese ? ('JLPT' as TargetExam)
      : lang === Language.Korean ? ('TOPIK' as TargetExam)
      : ('none' as TargetExam);
    const compId = `${th.id}-comp`;
    const compSections = buildCompositionSections(level, genre, lang);
    const compPrompt = buildCompositionPrompt(themeKey, lang);
    nodes.push({
      id: compId,
      parentId: th.id,
      type: 'composition',
      title: `${th.title} · 主题作文`,
      content: '',
      progress: 0,
      wordCount: 0,
      tags: [],
      isExpanded: false,
      createdAt: now,
      updatedAt: now,
      cefrLevel: CEFRLevel.B1,
      register: 'formal',
      unlocked: CEFR_RANK[CEFRLevel.B1] <= levelRank,
      completed: false,
      defaultExam,
      genre,
      prompt: compPrompt,
      sections: compSections.map((s, i) => ({ ...s, id: `${compId}-s${i}`, content: '' })),
      language: lang,
    });
  }

  return nodes;
}
