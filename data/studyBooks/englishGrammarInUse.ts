import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：English Grammar in Use（AI 生成等价版）
// - 中级英语语法（B1），按语法单元组织，与 Raymond Murphy
//   《English Grammar in Use》的「单元 + 规则 + 例句」理念同构。
// - grammar 类型 item：prompt = 语法规则名，answer = 中文解释，
//   pattern = 句型，variations = 形式变化，examples = 例句。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 10 单元 × 5 语法点 = 50 个语法点。
// ============================================================

export const GRAMMAR_BUILTIN_ID = 'builtin-english-grammar-in-use';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Unit 1 · 一般现在时与现在进行时',
    items: [
      { type: 'grammar', prompt: 'Present Simple — habits & routines', answer: '一般现在时表习惯、常规动作（常与 always / usually / every day 连用）。', pattern: 'Subject + base verb（第三人称单数加 -s）', variations: ['I work', 'He works', 'They work'], examples: ['She works in a bank every day.', 'I usually get up at seven.'] },
      { type: 'grammar', prompt: 'Present Simple — facts & truths', answer: '一般现在时表客观事实、普遍真理、不随时间改变的规律。', pattern: 'Subject + base verb', variations: ['Water boils', 'The sun rises', 'Birds fly'], examples: ['Water boils at 100 degrees Celsius.', 'The earth goes around the sun.'] },
      { type: 'grammar', prompt: 'Present Continuous — happening now', answer: '现在进行时表说话这一刻正在进行的动作。', pattern: 'Subject + am/is/are + verb-ing', variations: ['I am working', 'She is working', 'They are working'], examples: ['Please be quiet — I am working now.', "Look! It's raining."] },
      { type: 'grammar', prompt: 'Present Continuous — temporary & changing', answer: '现在进行时也表临时的情况或正在变化/发展中的状态。', pattern: 'Subject + am/is/are + verb-ing', variations: ['I am living', 'She is learning', 'Prices are rising'], examples: ['I am living with my parents this month.', 'The weather is getting colder.'] },
      { type: 'grammar', prompt: 'Stative verbs (no -ing)', answer: '状态动词（know / like / believe / want…）表状态而非动作，通常不用进行时。', pattern: 'Subject + stative verb', variations: ['I know', 'She likes', 'He believes'], examples: ['I know the answer.（不说 I am knowing）', 'She likes this song very much.'] },
    ],
  },
  {
    title: 'Unit 2 · 一般过去时与过去进行时',
    items: [
      { type: 'grammar', prompt: 'Past Simple — regular verbs', answer: '一般过去时表过去已完成的动作；规则动词加 -ed。', pattern: 'Subject + verb-ed', variations: ['I worked', 'She played', 'They visited'], examples: ['I worked late last night.', 'She visited her grandmother yesterday.'] },
      { type: 'grammar', prompt: 'Past Simple — irregular verbs', answer: '不规则动词的过去式需单独记忆（go→went, see→saw）。', pattern: 'Subject + past form', variations: ['go → went', 'see → saw', 'eat → ate', 'have → had'], examples: ['We went to the beach last weekend.', 'I saw a great film last night.'] },
      { type: 'grammar', prompt: 'Past Continuous — background action', answer: '过去进行时表过去某时刻正在进行的动作，常作背景/铺垫。', pattern: 'Subject + was/were + verb-ing', variations: ['I was working', 'They were playing'], examples: ['At eight last night, I was watching TV.', 'They were playing football when it started to rain.'] },
      { type: 'grammar', prompt: 'Past Simple vs Past Continuous', answer: '一个动作打断另一个：进行时表被打断的长动作，一般过去时表突发的短动作。', pattern: 'was/were + -ing … when + past simple', variations: ['was reading when …', 'were sleeping when …'], examples: ['I was reading when the phone rang.', 'We were sleeping when the alarm went off.'] },
      { type: 'grammar', prompt: 'used to — past habits', answer: 'used to 表过去的习惯或状态（现在已不如此）。', pattern: 'Subject + used to + base verb', variations: ['I used to smoke', 'She used to live', 'They used to play'], examples: ['I used to smoke, but I gave up last year.', 'She used to live in London.'] },
    ],
  },
  {
    title: 'Unit 3 · 现在完成时',
    items: [
      { type: 'grammar', prompt: 'Present Perfect — experiences (ever / never)', answer: '现在完成时表「经历」，强调过去发生但对现在有影响；常与 ever / never 连用。', pattern: 'Subject + have/has + past participle', variations: ['I have seen', 'She has been', 'They have tried'], examples: ['Have you ever been to Japan?', 'I have never seen this film.'] },
      { type: 'grammar', prompt: 'Present Perfect — just / already / yet', answer: 'just（刚刚）/ already（已经）用于肯定句，yet（还没）用于否定和疑问句。', pattern: 'have/has + just/already + past participle；yet 置句末', variations: ['I have just finished', 'She has already left', 'Have you finished yet?'], examples: ["I have just finished my homework.", "He hasn't arrived yet."] },
      { type: 'grammar', prompt: 'Present Perfect — since / for', answer: 'since + 时间点（起点），for + 时间段（长度）表动作从过去持续到现在。', pattern: 'have/has + past participle + since/for', variations: ['since 2020', 'since Monday', 'for two years', 'for a long time'], examples: ['I have lived here since 2015.', 'She has worked here for five years.'] },
      { type: 'grammar', prompt: 'Present Perfect — unfinished time', answer: '尚未结束的时间段（today / this week / this year）用现在完成时。', pattern: 'have/has + past participle + this week/today…', variations: ['I have seen him today', 'She has called twice this week'], examples: ['I have drunk three cups of coffee today.', 'Have you seen him this week?'] },
      { type: 'grammar', prompt: 'Present Perfect vs Past Simple', answer: '有时间状语（yesterday / last year / ago）用一般过去时；无具体时间用完成时。', pattern: 'past simple + 明确时间；present perfect + 未明确时间', variations: ['I saw him yesterday', 'I have seen him'], examples: ['I saw him yesterday.（过去时间点）', 'I have seen him.（不知何时，强调经历）'] },
    ],
  },
  {
    title: 'Unit 4 · 完成进行时与过去完成时',
    items: [
      { type: 'grammar', prompt: 'Present Perfect Continuous — duration', answer: '现在完成进行时表动作从过去持续到现在，强调「一直在做」的持续感。', pattern: 'Subject + have/has been + verb-ing', variations: ['I have been working', 'She has been studying', 'It has been raining'], examples: ['I have been working all morning.', 'It has been raining for two hours.'] },
      { type: 'grammar', prompt: 'Present Perfect Continuous vs Simple', answer: '进行时强调「持续/未完成」的过程，完成时强调「结果/完成」。', pattern: 'have been -ing（过程） vs have + done（结果）', variations: ['I have been reading（还在读）', 'I have read it（读完了）'], examples: ['I have been reading this book（还没读完）。', 'I have read this book（已经读完）。'] },
      { type: 'grammar', prompt: 'Past Perfect — earlier action', answer: '过去完成时表「过去的过去」：在另一过去动作之前已完成的动作。', pattern: 'Subject + had + past participle', variations: ['I had finished', 'She had left', 'They had gone'], examples: ['When I arrived, the film had already started.', 'She had left before I called.'] },
      { type: 'grammar', prompt: 'Past Perfect — already / just', answer: '过去完成时常与 already / just 连用，强调动作在某一过去时刻前刚/已完成。', pattern: 'had + already/just + past participle', variations: ['had already left', 'had just finished'], examples: ['He had already left when we got there.', 'I had just finished dinner when she called.'] },
      { type: 'grammar', prompt: 'Past Perfect vs Past Simple', answer: '两个过去的动作：先发生的用过去完成时，后发生的用一般过去时。', pattern: 'past perfect（先） … past simple（后）', variations: ['had gone → went', 'had eaten → ate'], examples: ['After he had gone, we felt relieved.', 'I had eaten before I went out.'] },
    ],
  },
  {
    title: 'Unit 5 · 将来时',
    items: [
      { type: 'grammar', prompt: 'will — predictions & decisions', answer: 'will 表预测、以及说话当下做出的决定（不加计划）。', pattern: 'Subject + will + base verb', variations: ["I'll help", 'She will come', 'They will win'], examples: ["I think it'll rain tomorrow.", "I'll help you with that."] },
      { type: 'grammar', prompt: 'going to — plans & intentions', answer: 'be going to 表已计划好的打算，或根据现有迹象做出的预测。', pattern: 'Subject + am/is/are going to + base verb', variations: ['I am going to travel', 'She is going to study'], examples: ['I am going to travel to Japan next year.', 'Look at those clouds — it is going to rain.'] },
      { type: 'grammar', prompt: 'Present Continuous — arrangements', answer: '现在进行时可表已安排好的、确定要发生的将来安排（常带时间）。', pattern: 'Subject + am/is/are + verb-ing（+ 时间）', variations: ['I am meeting', 'She is flying', 'They are arriving'], examples: ['I am meeting my friend tomorrow.', 'She is flying to London next Monday.'] },
      { type: 'grammar', prompt: 'will vs going to', answer: 'will 表临场决定/预测；going to 表事先计划/有依据的预测。', pattern: 'will + 决定；going to + 计划', variations: ["I'll call her（当场决定）", 'I am going to call her（早有打算）'], examples: ["The phone is ringing — I'll answer it.", 'I am going to call her tonight.'] },
      { type: 'grammar', prompt: 'Future time clauses (when / if / after)', answer: 'when / if / after / as soon as 引导的时间/条件从句中，用一般现在时表将来。', pattern: 'when/if + present simple, … will …', variations: ['When I arrive', 'If it rains', 'As soon as I finish'], examples: ['When I arrive, I will call you.', 'If it rains, we will stay home.'] },
    ],
  },
  {
    title: 'Unit 6 · 情态动词',
    items: [
      { type: 'grammar', prompt: 'can / could — ability', answer: 'can 表现在的能力；could 表过去的能力或更礼貌的请求。', pattern: 'Subject + can/could + base verb', variations: ['I can swim', 'She could swim', 'Could you help?'], examples: ['I can speak three languages.', 'Could you open the window, please?'] },
      { type: 'grammar', prompt: 'must / have to — obligation', answer: 'must 表说话人主观认定必须；have to 表外部规定/客观需要。', pattern: 'Subject + must / have to + base verb', variations: ['I must go', 'You have to pay', 'She has to work'], examples: ['You must wear a seatbelt.', 'I have to get up early for work.'] },
      { type: 'grammar', prompt: 'should — advice', answer: 'should 表建议、劝告（语气比 must 委婉）。', pattern: 'Subject + should + base verb', variations: ['You should rest', 'You should see a doctor'], examples: ['You should get more sleep.', 'You should see a doctor about that cough.'] },
      { type: 'grammar', prompt: 'may / might — possibility', answer: 'may / might 表「也许、可能」的推测；might 语气更不确定。', pattern: 'Subject + may/might + base verb', variations: ['It may rain', 'She might come', 'They may be late'], examples: ['It may rain later, so take an umbrella.', 'She might come to the party.'] },
      { type: 'grammar', prompt: 'mustn\'t vs don\'t have to', answer: 'mustn\'t 表「禁止」（不准做）；don\'t have to 表「不必」（可做可不做）。', pattern: 'mustn\'t + 动词（禁止） vs don\'t have to + 动词（不必）', variations: ['You mustn\'t smoke', 'You don\'t have to come'], examples: ["You mustn't smoke here.（禁止）", "You don't have to come if you're busy.（不必）"] },
    ],
  },
  {
    title: 'Unit 7 · 被动语态',
    items: [
      { type: 'grammar', prompt: 'Passive — form (be + past participle)', answer: '被动语态由 be + 过去分词构成；动作的承受者作主语，施动者可选。', pattern: 'Subject + be + past participle (+ by …)', variations: ['is made', 'was built', 'will be done'], examples: ['This bridge was built in 1990.', 'The letter was written by my father.'] },
      { type: 'grammar', prompt: 'Passive — present simple', answer: '一般现在时被动：am/is/are + 过去分词，强调动作/对象而非施动者。', pattern: 'am/is/are + past participle', variations: ['is made', 'are sold', 'is spoken'], examples: ['English is spoken all over the world.', 'These cars are made in Japan.'] },
      { type: 'grammar', prompt: 'Passive — past simple', answer: '一般过去时被动：was/were + 过去分词。', pattern: 'was/were + past participle', variations: ['was built', 'were taken', 'was stolen'], examples: ['My car was stolen last night.', 'The photos were taken in Paris.'] },
      { type: 'grammar', prompt: 'Passive — with "by"', answer: '需要点明施动者时用 by + 施动者；不必要时省略。', pattern: 'be + past participle + by + 施动者', variations: ['was written by', 'was discovered by'], examples: ['The novel was written by a famous author.', 'Penicillin was discovered by Fleming.'] },
      { type: 'grammar', prompt: 'Active vs passive', answer: '主动强调「谁做」，被动强调「被做/结果」；不确定或无需提施动者时用被动。', pattern: '主动：S + V + O ↔ 被动：O + be + done (+ by S)', variations: ['They built it（主动）', 'It was built（被动）'], examples: ['They built the house in 2000.（主动）', 'The house was built in 2000.（被动）'] },
    ],
  },
  {
    title: 'Unit 8 · 条件句',
    items: [
      { type: 'grammar', prompt: 'Zero conditional — general truths', answer: '零条件句表普遍规律：if + 一般现在时，主句用一般现在时。', pattern: 'If + present simple, … present simple', variations: ['If you heat ice, it melts'], examples: ['If you heat ice, it melts.', 'If it rains, the grass gets wet.'] },
      { type: 'grammar', prompt: 'First conditional — real future', answer: '第一条件句表将来可能发生：if + 一般现在时，主句用 will。', pattern: 'If + present simple, … will + base verb', variations: ['If it rains, I will stay'], examples: ['If it rains, we will stay at home.', 'If you study hard, you will pass the exam.'] },
      { type: 'grammar', prompt: 'Second conditional — unreal present', answer: '第二条件句表现在/将来的假设（不太可能）：if + 过去式，主句用 would。', pattern: 'If + past simple, … would + base verb', variations: ['If I were rich, I would travel'], examples: ['If I were rich, I would travel the world.', 'If I had more time, I would learn Chinese.'] },
      { type: 'grammar', prompt: 'Third conditional — unreal past', answer: '第三条件句表对过去的假设（无法改变）：if + 过去完成，主句用 would have done。', pattern: 'If + had + past participle, … would have + past participle', variations: ['If I had known, I would have come'], examples: ['If I had known, I would have come.', 'If she had studied, she would have passed.'] },
      { type: 'grammar', prompt: 'unless / if … not', answer: 'unless = if … not，表「除非、如果不」。', pattern: 'unless + present simple（= if … not）', variations: ['unless it rains', 'if it does not rain'], examples: ['I will go unless it rains.', 'You will fail unless you study.（= if you do not study）'] },
    ],
  },
  {
    title: 'Unit 9 · 定语从句',
    items: [
      { type: 'grammar', prompt: 'Relative clause — who (people)', answer: 'who 引导定语从句修饰人，作主语或宾语。', pattern: '先行词（人） + who + 从句', variations: ['the man who lives here', 'the woman who called'], examples: ['The man who lives next door is a doctor.', 'She is the woman who called you.'] },
      { type: 'grammar', prompt: 'Relative clause — which (things)', answer: 'which 引导定语从句修饰事物。', pattern: '先行词（物） + which + 从句', variations: ['the book which I bought', 'the car which is parked'], examples: ['The book which I bought is very interesting.', 'This is the car which was repaired.'] },
      { type: 'grammar', prompt: 'Relative clause — that (defining)', answer: 'that 可代替 who/which 引导限定性定语从句（不可省略处作主语）。', pattern: '先行词 + that + 从句', variations: ['the man that called', 'the film that I saw'], examples: ['The film that I saw last night was great.', 'I like people that are honest.'] },
      { type: 'grammar', prompt: 'Relative clause — whose (possession)', answer: 'whose 表「所属关系」，修饰人（也可修饰物）的名词。', pattern: '先行词 + whose + 名词 + 从句', variations: ['the girl whose brother', 'the house whose roof'], examples: ['The girl whose brother is my friend is here.', 'That is the house whose roof is red.'] },
      { type: 'grammar', prompt: 'Defining vs non-defining clauses', answer: '限定性从句不可省、无逗号；非限定性从句有逗号、补充说明，可省略。', pattern: '限定（无逗号） vs 非限定（有逗号）', variations: ['the car that is red（限定）', 'my car, which is red（非限定）'], examples: ['The car that is red is mine.（限定）', 'My car, which is red, is very old.（非限定）'] },
    ],
  },
  {
    title: 'Unit 10 · 间接引语',
    items: [
      { type: 'grammar', prompt: 'Reported speech — say vs tell', answer: 'say 后不直接接人（say + that）；tell 必须接人（tell + 某人 + that）。', pattern: 'say (that) … / tell + 某人 + (that) …', variations: ['He said that …', 'He told me that …'], examples: ['He said that he was tired.', 'He told me that he was tired.'] },
      { type: 'grammar', prompt: 'Reported statements — tense shift', answer: '转述时谓语一般向后移一个时态：一般现在→一般过去，现在完成→过去完成。', pattern: '直接：present → 转述：past', variations: ['am → was', 'have seen → had seen', 'will → would'], examples: ['She said, "I am tired." → She said she was tired.', 'He said, "I have seen it." → He said he had seen it.'] },
      { type: 'grammar', prompt: 'Reported questions — word order', answer: '转述疑问句用陈述语序，不用倒装；用 if/whether 或疑问词引导。', pattern: 'asked + if / 疑问词 + 陈述语序', variations: ['asked if I was', 'asked where I lived'], examples: ['He asked if I was OK.', 'She asked where I lived.'] },
      { type: 'grammar', prompt: 'Reported commands — tell / ask + to', answer: '转述祈使句：tell / ask + 某人 + to do（否定 not to do）。', pattern: 'told/asked + 某人 + (not) to + 动词', variations: ['told me to wait', 'asked him to open', 'told me not to go'], examples: ['He told me to wait outside.', 'She asked him not to be late.'] },
      { type: 'grammar', prompt: 'Reported speech — time & place changes', answer: '转述时时间/地点词随之改变：today→that day, here→there, tomorrow→the next day。', pattern: 'today → that day；here → there；tomorrow → the next day', variations: ['now → then', 'today → that day', 'here → there'], examples: ['She said, "I will come tomorrow." → She said she would come the next day.', 'He said, "I am here." → He said he was there.'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（语法点数变化 = 内容更新）
export const GRAMMAR_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildEnglishGrammarInUseBook(language: Language): StudyBook {
  const chapters: StudyChapter[] = RAW_CHAPTERS.map((c) => ({
    id: uuid(),
    title: c.title,
    items: c.items.map(
      (it): StudyItem => ({
        ...it,
        id: uuid(),
        box: 1,
        dueDate: Date.now(),
        reviews: 0,
        lapses: 0,
      })
    ),
  }));

  let total = 0;
  for (const ch of chapters) total += ch.items.length;

  return {
    id: GRAMMAR_BUILTIN_ID,
    title: 'English Grammar in Use',
    author: 'AI 生成 · B1 中级语法精选',
    language,
    glossLanguage: Language.Chinese,
    type: 'grammar',
    level: CEFRLevel.B1,
    source: 'built-in',
    chapters,
    totalItems: total,
    completedItems: 0,
    masteredItems: 0,
    createdAt: Date.now(),
  };
}
