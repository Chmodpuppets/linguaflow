// 8 种新支持语言的写作树主题数据（ES/FR/DE/IT/RU/EL/AR/ZH）。
// 设计：title / scaffoldHint 复用与 EN/JA/KO 一致的中文结构（语言无关），
// 仅 scaffold（目标语句型）按语言提供；A1/A2 有句型支架，B1/B2 留空自由写（靠 scaffoldHint 引导）。
// 数据与 growthTree.ts 的 ThemeSeed/TaskSeed 结构对齐，由 growthTree.ts 的 TREE_THEMES 合并引入。
import { CEFRLevel, Language, WritingRegister, CompositionGenre } from '../types';

export interface TreeTaskSeed {
  title: string;
  cefrLevel: CEFRLevel;
  scaffold: string;
  scaffoldHint: string;
  register?: WritingRegister;
}

export interface TreeThemeSeed {
  id: string;
  title: string;
  tasks: TreeTaskSeed[];
  genre?: CompositionGenre;
}

const S = (title: string, cefr: CEFRLevel, hint: string, scaffold = '', register?: WritingRegister): TreeTaskSeed => ({
  title, cefrLevel: cefr, scaffold, scaffoldHint: hint, register,
});

// ============================ 西班牙语 (Spanish) ============================
const SPANISH_THEMES: TreeThemeSeed[] = [
  {
    id: 'es-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'Soy ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'Soy de ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', 'Me llamo ___ y me gusta ___.'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', 'Tengo ___ años y vivo en ___.'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'es-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'Por la mañana, ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'Desayuno ___.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'Todos los días, ___ antes de ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'En mi día libre, voy a ___ y ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'es-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', 'Me gusta ___.'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', 'Mi ___ favorito es ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'Los fines de semana, ___ con ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', 'Me gustan ___ y ___, pero ___ es mi favorito.'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'es-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'Fui a ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', 'Fui en ___.'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', 'Hacía ___ y ___.'),
      S('买了什么', CEFRLevel.A2, '填纪念品', 'Compré ___ como recuerdo.'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'es-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', 'Me gusta / no me gusta ___ porque ___.'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'Creo que ___ es ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', 'Estoy de acuerdo / en desacuerdo con ___.'),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'Entre ___ y ___, prefiero ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'es-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'Querido/a ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'Gracias por ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', '¿Te gustaría ___ conmigo el ___?'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'Perdón por ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'es-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'Trabajo como ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'Trabajo en ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'Mi trabajo es ___ cada día.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'Trabajo con personas ___.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'es-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'Mi comida favorita es ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', 'Sabe ___.'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'Para cocinarlo, necesitas ___ y ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'Quiero pedir ___ y ___.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 法语 (French) ============================
const FRENCH_THEMES: TreeThemeSeed[] = [
  {
    id: 'fr-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'Je suis ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'Je viens de ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', "Je m'appelle ___ et j'aime ___."),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', "J'ai ___ ans et j'habite à ___."),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'fr-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'Le matin, je ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'Je prends ___ au petit-déjeuner.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'Tous les jours, je ___ avant de ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'Pendant mes jours de repos, je vais à ___ et ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'fr-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', "J'aime ___."),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', 'Mon/Ma ___ préféré(e) est ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'Le week-end, je ___ avec ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', "J'aime ___ et ___, mais ___ est mon préféré."),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'fr-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'Je suis allé(e) à ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', "J'y suis allé(e) en ___."),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', "Il faisait ___ et j'ai ___."),
      S('买了什么', CEFRLevel.A2, '填纪念品', "J'ai acheté ___ comme souvenir."),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'fr-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', "J'aime / je n'aime pas ___ parce que ___."),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'Je pense que ___ est ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', "Je suis d'accord / pas d'accord avec ___."),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'Entre ___ et ___, je préfère ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'fr-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'Cher/Chère ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'Merci pour ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', 'Voudrais-tu ___ avec moi le ___ ?'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'Je suis désolé(e) pour ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'fr-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'Je travaille comme ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'Je travaille à ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'Mon travail est de ___ chaque jour.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'Je travaille avec des gens ___.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'fr-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'Mon plat préféré est ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', "Ça a un goût ___."),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'Pour le cuisiner, il faut ___ et ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'Je voudrais commander ___ et ___.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 德语 (German) ============================
const GERMAN_THEMES: TreeThemeSeed[] = [
  {
    id: 'de-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'Ich bin ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'Ich komme aus ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', 'Ich heiße ___ und ich mag ___.'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', 'Ich bin ___ Jahre alt und wohne in ___.'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'de-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'Am Morgen ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'Ich esse ___ zum Frühstück.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'Jeden Tag ___ ich, bevor ich ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'An meinem freien Tag gehe ich zu ___ und ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'de-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', 'Ich mag ___.'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', 'Mein liebstes ___ ist ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'Am Wochenende ___ ich mit ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', 'Ich mag ___ und ___, aber ___ ist mein Favorit.'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'de-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'Ich war in ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', 'Ich bin mit ___ gefahren.'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', 'Das Wetter war ___ und ich ___.'),
      S('买了什么', CEFRLevel.A2, '填纪念品', 'Ich habe ___ als Souvenir gekauft.'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'de-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', 'Ich mag / mag nicht ___, weil ___.'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'Ich denke, ___ ist ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', 'Ich stimme ___ zu / nicht zu.'),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'Zwischen ___ und ___ bevorzuge ich ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'de-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'Liebe/r ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'Danke für ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', 'Möchtest du am ___ mit mir ___?'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'Es tut mir leid, dass ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'de-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'Ich arbeite als ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'Ich arbeite in ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'Meine Arbeit ist es, jeden Tag ___ zu ___.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'Ich arbeite mit ___ Leuten.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'de-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'Mein Lieblingsessen ist ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', 'Es schmeckt ___.'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'Zum Kochen braucht man ___ und ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'Ich möchte ___ und ___ bestellen.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 意大利语 (Italian) ============================
const ITALIAN_THEMES: TreeThemeSeed[] = [
  {
    id: 'it-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'Sono ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'Vengo da ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', 'Mi chiamo ___ e mi piace ___.'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', 'Ho ___ anni e vivo a ___.'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'it-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'La mattina, ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'A colazione mangio ___.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'Ogni giorno, ___ prima di ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'Nel mio giorno libero, vado a ___ e ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'it-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', 'Mi piace ___.'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', 'Il mio ___ preferito è ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'Nel fine settimana, ___ con ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', 'Mi piacciono ___ e ___, ma ___ è il mio preferito.'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'it-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'Sono andato/a a ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', 'Ci sono andato/a in ___.'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', 'Il tempo era ___ e ___.'),
      S('买了什么', CEFRLevel.A2, '填纪念品', 'Ho comprato ___ come ricordo.'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'it-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', 'Mi piace / non mi piace ___ perché ___.'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'Penso che ___ sia ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', "Sono d'accordo / in disaccordo con ___."),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'Tra ___ e ___, preferisco ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'it-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'Caro/a ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'Grazie per ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', 'Ti piacerebbe ___ con me il ___?'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'Scusa per ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'it-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'Lavoro come ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'Lavoro a ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'Il mio lavoro è ___ ogni giorno.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'Lavoro con persone ___.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'it-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'Il mio cibo preferito è ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', 'Ha un sapore ___.'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'Per cucinarlo, servono ___ e ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'Vorrei ordinare ___ e ___.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 俄语 (Russian) ============================
const RUSSIAN_THEMES: TreeThemeSeed[] = [
  {
    id: 'ru-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'Я ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'Я из ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', 'Меня зовут ___, и мне нравится ___.'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', 'Мне ___ лет, и я живу в ___.'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'ru-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'Утром я ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'На завтрак я ем ___.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'Каждый день я ___ перед тем, как ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'В выходной я иду в ___ и ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'ru-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', 'Мне нравится ___.'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', 'Моё любимое ___ — это ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'По выходным я ___ с ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', 'Мне нравятся ___ и ___, но ___ — моё любимое.'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'ru-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'Я был(а) в ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', 'Я поехал(а) на ___.'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', 'Погода была ___, и я ___.'),
      S('买了什么', CEFRLevel.A2, '填纪念品', 'Я купил(а) ___ как сувенир.'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'ru-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', 'Мне нравится / не нравится ___, потому что ___.'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'Я думаю, что ___ — ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', 'Я согласен/согласна / не согласен/согласна с ___.'),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'Между ___ и ___ я предпочитаю ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'ru-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'Дорогой/Дорогая ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'Спасибо за ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', 'Не хочешь ___ со мной ___?'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'Прости за ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'ru-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'Я работаю ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'Я работаю в ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'Моя работа — ___ каждый день.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'Я работаю с ___ людьми.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'ru-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'Моя любимая еда — ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', 'Это ___ на вкус.'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'Чтобы приготовить, нужны ___ и ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'Я хочу заказать ___ и ___.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 希腊语 (Greek) ============================
const GREEK_THEMES: TreeThemeSeed[] = [
  {
    id: 'el-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'Είμαι ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'Είμαι από ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', 'Με λένε ___ και μου αρέσει ___.'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', 'Είμαι ___ χρονών και μένω σε ___.'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'el-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'Το πρωί, ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'Για πρωινό τρώω ___.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'Κάθε μέρα, ___ πριν ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'Στην ημέρα ανάπαυσής μου, πηγαίνω σε ___ και ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'el-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', 'Μου αρέσει ___.'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', 'Το αγαπημένο μου ___ είναι ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'Το Σαββατοκύριακο, ___ με ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', 'Μου αρέσουν ___ και ___, αλλά ___ είναι το αγαπημένο μου.'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'el-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'Πήγα σε ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', 'Πήγα με ___.'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', 'Ο καιρός ήταν ___ και ___.'),
      S('买了什么', CEFRLevel.A2, '填纪念品', 'Αγόρασα ___ ως αναμνηστικό.'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'el-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', 'Μου αρέσει / δεν μου αρέσει ___ γιατί ___.'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'Νομίζω ότι ___ είναι ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', 'Συμφωνώ / διαφωνώ με ___.'),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'Μεταξύ ___ και ___, προτιμώ ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'el-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'Αγαπητέ/Αγαπητή ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'Ευχαριστώ για ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', 'Θα ήθελες ___ μαζί μου ___?'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'Συγγνώμη για ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'el-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'Δουλεύω ως ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'Δουλεύω σε ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'Η δουλειά μου είναι να ___ κάθε μέρα.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'Δουλεύω με ___ ανθρώπους.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'el-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'Το αγαπημένο μου φαγητό είναι ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', 'Έχει ___ γεύση.'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'Για να το μαγειρέψεις, χρειάζεσαι ___ και ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'Θα ήθελα να παραγγείλω ___ και ___.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 阿拉伯语 (Arabic) ============================
const ARABIC_THEMES: TreeThemeSeed[] = [
  {
    id: 'ar-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', 'أنا ___.'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', 'أنا من ___.'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', 'اسمي ___ وأنا أحب ___.'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', 'عمري ___ سنة وأسكن في ___.'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'ar-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', 'في الصباح، ___.'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', 'على الفطور آكل ___.'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', 'كل يوم، ___ قبل أن ___.'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', 'في يوم عطلتي، أذهب إلى ___ و ___.'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'ar-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', 'أحب ___.'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', '___ المفضل لدي هو ___.'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', 'في عطلة نهاية الأسبوع، ___ مع ___.'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', 'أحب ___ و ___, لكن ___ هو المفضل لدي.'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'ar-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', 'ذهبت إلى ___.'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', 'ذهبت بـ ___.'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', 'كان الطقس ___ و ___.'),
      S('买了什么', CEFRLevel.A2, '填纪念品', 'اشتريت ___ كتذكار.'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'ar-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', 'أحب / لا أحب ___ لأن ___.'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', 'أعتقد أن ___ ___.'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', 'أوافق / لا أوافق على ___.'),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', 'بين ___ و ___, أفضل ___.'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'ar-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', 'عزيزي / عزيزتي ___,'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', 'شكراً على ___.'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', 'هل ترغب في ___ معي يوم ___؟'),
      S('道歉', CEFRLevel.A2, '填道歉的事', 'آسف على ___.'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'ar-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', 'أعمل كـ ___.'),
      S('工作地点', CEFRLevel.A1, '填地点', 'أعمل في ___.'),
      S('日常职责', CEFRLevel.A2, '填职责', 'عملي هو ___ كل يوم.'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', 'أعمل مع أشخاص ___.'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'ar-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', 'طعامي المفضل هو ___.'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', 'طعمه ___.'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', 'لطهيه، تحتاج إلى ___ و ___.'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', 'أريد أن أطلب ___ و ___.'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

// ============================ 中文 (Chinese，作为目标语言) ============================
const CHINESE_THEMES: TreeThemeSeed[] = [
  {
    id: 'zh-intro', title: '自我介绍',
    tasks: [
      S('一句话介绍自己', CEFRLevel.A1, '填你的职业（如：学生 / 老师）', '我是 ___。'),
      S('你来自哪里', CEFRLevel.A1, '填你的国家或城市', '我来自 ___。'),
      S('名字与喜好', CEFRLevel.A2, '前填名字，后填喜欢的事物', '我叫 ___，我喜欢 ___。'),
      S('年龄与住址', CEFRLevel.A2, '前填年龄，后填居住地', '我 ___ 岁，住在 ___。'),
      S('描述你自己', CEFRLevel.B1, '写一段自我介绍：性格、兴趣与一个近期小目标，至少四句'),
      S('兴趣与习惯', CEFRLevel.B1, '写写你的兴趣与日常习惯，各举一例'),
      S('目标与态度', CEFRLevel.B2, '谈谈你的目标，以及你为它付出的态度与行动'),
      S('正式自我介绍', CEFRLevel.B2, '用正式/书面语气写一段自我介绍：背景、专业、目标，至少四句', '', 'business'),
    ],
  },
  {
    id: 'zh-daily', title: '日常生活',
    tasks: [
      S('你的早晨', CEFRLevel.A1, '填你早上做的事（如：起床 / 吃早餐）', '早上，我 ___。'),
      S('早餐吃什么', CEFRLevel.A1, '填早餐食物', '早餐我吃 ___。'),
      S('日常顺序', CEFRLevel.A2, '前填先做的事，后填后做的事', '每天，我先 ___，然后 ___。'),
      S('休息日', CEFRLevel.A2, '前填地点，后填在那里做的事', '休息日，我去 ___ 并且 ___。'),
      S('昨天做了什么', CEFRLevel.B1, '写写昨天的一件事：你做了什么、和谁、感觉如何，至少四句'),
      S('习惯对比', CEFRLevel.B1, '对比平时与周末的不同生活习惯，并说明原因'),
      S('习惯的影响', CEFRLevel.B2, '谈谈某个长期习惯对你生活的影响，是正面还是负面，举例说明'),
      S('难忘的一天', CEFRLevel.B2, '写一段令你难忘的一天的经历：时间、事件、感受，至少四句'),
    ],
  },
  {
    id: 'zh-hobby', title: '兴趣爱好',
    tasks: [
      S('你喜欢什么', CEFRLevel.A1, '填你喜欢的事物', '我喜欢 ___。'),
      S('最爱的事物', CEFRLevel.A1, '前填类别，后填具体事物', '我最喜欢的 ___ 是 ___。'),
      S('周末活动', CEFRLevel.A2, '前填活动，后填一起的人', '周末，我和 ___ 一起 ___。'),
      S('两者比较', CEFRLevel.A2, '前填两个事物，后填最爱的那个', '我喜欢 ___ 和 ___，但 ___ 是我的最爱。'),
      S('偏好比较', CEFRLevel.B1, '谈谈你最喜欢的一项爱好，以及它为什么重要'),
      S('爱好的意义', CEFRLevel.B1, '描述这个爱好带给你的收获，以及今后想怎么发展它'),
      S('收获与未来', CEFRLevel.B2, '就"爱好塑造性格"这一观点，结合你的经历写一篇短文'),
      S('为什么重要', CEFRLevel.B2, '写一段为什么这个爱好对你重要：起源、意义、收获，至少四句', '', 'neutral'),
    ],
  },
  {
    id: 'zh-travel', title: '旅行经历',
    tasks: [
      S('我去了哪里', CEFRLevel.A1, '填地点', '我去了 ___。'),
      S('怎么去的', CEFRLevel.A1, '填交通工具', '我坐 ___ 去的。'),
      S('旅行天气', CEFRLevel.A2, '前填天气，后填做的事', '天气 ___，我 ___。'),
      S('买了什么', CEFRLevel.A2, '填纪念品', '我买了 ___ 作为纪念品。'),
      S('印象深刻的旅行', CEFRLevel.B1, '写一段印象深刻的旅行：去哪里、和谁、感受如何，至少四句'),
      S('旅行中的小意外', CEFRLevel.B1, '讲一次旅行中遇到的意外或困难，以及你是怎么解决的'),
      S('跟团 vs 自由行', CEFRLevel.B2, '对比跟团游与自由行的利弊，并说明你更偏好哪种、为什么'),
      S('旅行的意义', CEFRLevel.B2, '就"旅行让人开阔眼界"这一观点，结合你的经历写一篇短文'),
    ],
  },
  {
    id: 'zh-opinion', title: '观点与论述',
    tasks: [
      S('我喜欢/不喜欢', CEFRLevel.A1, '前填事物，后填原因', '我喜欢 / 不喜欢 ___，因为 ___。'),
      S('我的看法', CEFRLevel.A1, '前填事物，后填形容词', '我觉得 ___ 很 ___。'),
      S('同意还是不同意', CEFRLevel.A2, '填一个观点', '我同意 / 不同意 ___。'),
      S('两个选择', CEFRLevel.A2, '前填 A，中填 B，后填更爱的', '在 ___ 和 ___ 之间，我更喜欢 ___。'),
      S('谈谈你的看法', CEFRLevel.B1, '就一个日常话题发表你的看法，正反都要提到'),
      S('手机是帮手还是干扰', CEFRLevel.B1, '就"手机让生活更方便还是更分心"发表你的观点，正反都要提到'),
      S('社会话题论述', CEFRLevel.B2, '就一个社会话题（如环境、教育）发表你的论述，给出理由与例子'),
      S('童年回忆与影响', CEFRLevel.B2, '谈谈童年的一段回忆，以及它如何影响了现在的你'),
    ],
  },
  {
    id: 'zh-letter', title: '书信与邮件',
    tasks: [
      S('写一句问候', CEFRLevel.A1, '填收信人', '亲爱的 ___：'),
      S('说声谢谢', CEFRLevel.A1, '填感谢的事', '谢谢你的 ___。'),
      S('邀请朋友', CEFRLevel.A2, '前填活动，后填时间', '你想 ___ 和我一起 ___ 吗？'),
      S('道歉', CEFRLevel.A2, '填道歉的事', '对不起，___。'),
      S('给朋友的一封信', CEFRLevel.B1, '写一封给朋友的信：近况、一件开心的事、邀约', '', 'casual'),
      S('求助邮件', CEFRLevel.B1, '写一封邮件给房东或老师，说明一个问题并请求帮助'),
      S('正式申请邮件', CEFRLevel.B2, '写一封正式申请邮件（如志愿活动、交换项目），说明动机与资格', '', 'business'),
      S('投诉信', CEFRLevel.B2, '写一封投诉信，就一次不满意的消费经历说明问题并要求解决'),
    ],
  },
  {
    id: 'zh-work', title: '工作与职场',
    tasks: [
      S('我的职业', CEFRLevel.A1, '填职业', '我的工作是 ___。'),
      S('工作地点', CEFRLevel.A1, '填地点', '我在 ___ 工作。'),
      S('日常职责', CEFRLevel.A2, '填职责', '我每天的工作是 ___。'),
      S('我的同事', CEFRLevel.A2, '填描述（如：亲切的）', '我和 ___ 的人一起工作。'),
      S('理想的工作', CEFRLevel.B1, '描述你理想的工作，以及为什么它适合你'),
      S('团队合作', CEFRLevel.B1, '谈谈一次团队合作经历：你扮演了什么角色、结果如何'),
      S('远程办公', CEFRLevel.B2, '就"远程办公的利弊"写一篇论述，并给出你的结论'),
      S('求职自我介绍', CEFRLevel.B2, '写一段用于求职面试的自我介绍：背景、技能、职业目标', '', 'business'),
    ],
  },
  {
    id: 'zh-food', title: '饮食与文化',
    tasks: [
      S('喜欢的食物', CEFRLevel.A1, '填食物', '我最喜欢的食物是 ___。'),
      S('味道', CEFRLevel.A1, '填味道（如：甜 / 辣）', '味道很 ___。'),
      S('怎么做', CEFRLevel.A2, '前填食材，后填食材', '要做的话，需要 ___ 和 ___。'),
      S('餐厅点餐', CEFRLevel.A2, '前填菜，后填饮料', '我想点 ___ 和 ___。'),
      S('难忘的一餐', CEFRLevel.B1, '描述一顿令你难忘的饭：和谁、吃了什么、为什么难忘'),
      S('家乡味道', CEFRLevel.B1, '介绍一道你家乡的菜，说说它对你有什么特别意义'),
      S('传统菜谱', CEFRLevel.B2, '介绍一道传统菜的做法与背后的文化含义'),
      S('饮食与文化', CEFRLevel.B2, '谈谈"饮食文化反映一个国家的性格"这一观点，并举例说明'),
    ],
  },
];

export const EXTRA_THEMES: Partial<Record<Language, TreeThemeSeed[]>> = {
  [Language.Spanish]: SPANISH_THEMES,
  [Language.French]: FRENCH_THEMES,
  [Language.German]: GERMAN_THEMES,
  [Language.Italian]: ITALIAN_THEMES,
  [Language.Russian]: RUSSIAN_THEMES,
  [Language.Greek]: GREEK_THEMES,
  [Language.Arabic]: ARABIC_THEMES,
  [Language.Chinese]: CHINESE_THEMES,
};

// 8 语言作文真实考题（与 growthTree.ts 的 COMPOSITION_PROMPTS 同构，按主题 key 索引）。
// 考试评分评的是「是否回应任务」，故给出具体任务而非主题标签。
export const EXTRA_COMPOSITION_PROMPTS: Partial<Record<Language, Partial<Record<string, string>>>> = {
  [Language.Spanish]: {
    intro: 'Describe a una persona que te ha influido mucho. Explica quién es, cómo la conoces y por qué es importante para ti.',
    daily: 'Describe un día típico de tu vida que sea significativo para ti. ¿Qué haces y por qué esta rutina es especial?',
    hobby: 'Escribe sobre un pasatiempo que disfrutas. Describe qué es, cómo empezaste y por qué es importante para ti.',
    travel: 'Describe un viaje memorable que hayas hecho. ¿A dónde fuiste, qué pasó y qué aprendiste?',
    opinion: 'Algunas personas creen que el turismo hace más daño que bien a las culturas locales. ¿Hasta qué punto estás de acuerdo o en desacuerdo? Apoya tu opinión con razones y ejemplos.',
    letter: 'Le escribes a tu casero para pedir que arregle una tubería que gotea en tu apartamento. Explica el problema, su impacto y propón una fecha conveniente para la reparación.',
    work: 'Muchas empresas ahora permiten trabajar desde casa. Discute las ventajas y desventajas del teletrabajo y da tu opinión.',
    food: 'Explica cómo preparar un plato tradicional de tu cultura, o por qué un alimento es importante en tu país.',
  },
  [Language.French]: {
    intro: "Décris une personne qui t'a beaucoup influencé. Explique qui elle est, comment tu la connais et pourquoi elle compte pour toi.",
    daily: "Décris une journée typique de ta vie qui a du sens pour toi. Que fais-tu et pourquoi cette routine est-elle spéciale ?",
    hobby: "Écris sur un loisir que tu aimes. Décris ce que c'est, comment tu as commencé et pourquoi c'est important pour toi.",
    travel: "Décris un voyage mémorable que tu as fait. Où es-tu allé, que s'est-il passé et qu'as-tu appris ?",
    opinion: "Certaines personnes pensent que le tourisme fait plus de mal que de bien aux cultures locales. Dans quelle mesure es-tu d'accord ou pas d'accord ? Justifie avec des raisons et des exemples.",
    letter: "Tu écris à ton propriétaire pour demander la réparation d'un tuyau qui fuit dans ton appartement. Explique le problème, son impact et propose une date pour la réparation.",
    work: "Beaucoup d'entreprises permettent maintenant de travailler depuis chez soi. Discute des avantages et des inconvénients du télétravail et donne ton avis.",
    food: "Explique comment préparer un plat traditionnel de ta culture, ou pourquoi un aliment est important dans ton pays.",
  },
  [Language.German]: {
    intro: 'Beschreibe eine Person, die dich am meisten beeinflusst hat. Erkläre, wer sie ist, wie du sie kennst und warum sie dir wichtig ist.',
    daily: 'Beschreibe einen typischen Tag in deinem Leben, der für dich bedeutsam ist. Was tust du und warum ist diese Routine besonders?',
    hobby: 'Schreibe über ein Hobby, das dir Spaß macht. Beschreibe, was es ist, wie du dazu gekommen bist und warum es dir wichtig ist.',
    travel: 'Beschreibe eine denkwürdige Reise, die du gemacht hast. Wohin bist du gefahren, was ist passiert und was hast du gelernt?',
    opinion: 'Manche Menschen glauben, dass Tourismus den lokalen Kulturen mehr schadet als nützt. Inwieweit stimmst du zu oder nicht? Begründe mit Gründen und Beispielen.',
    letter: 'Du schreibst deinem Vermieter, um die Reparatur eines tropfenden Rohrs in deiner Wohnung zu beantragen. Erkläre das Problem, seine Auswirkungen und schlage einen Termin vor.',
    work: 'Viele Unternehmen erlauben jetzt das Arbeiten von zu Hause. Diskutiere die Vor- und Nachteile von Homeoffice und gib deine Meinung.',
    food: 'Erkläre, wie man ein traditionelles Gericht aus deiner Kultur zubereitet, oder warum ein bestimmtes Essen in deinem Land wichtig ist.',
  },
  [Language.Italian]: {
    intro: 'Descrivi una persona che ti ha influenzato molto. Spiega chi è, come la conosci e perché è importante per te.',
    daily: 'Descrivi una giornata tipica della tua vita che è significativa per te. Cosa fai e perché questa routine è speciale?',
    hobby: "Scrivi di un hobby che ti piace. Descrivi cos'è, come hai iniziato e perché è importante per te.",
    travel: 'Descrivi un viaggio memorabile che hai fatto. Dove sei andato, cosa è successo e cosa hai imparato?',
    opinion: "Alcune persone credono che il turismo faccia più male che bene alle culture locali. In che misura sei d'accordo o in disaccordo? Motiva con ragioni ed esempi.",
    letter: 'Scrivi al tuo padrone di casa per chiedere la riparazione di un tubo che perde nel tuo appartamento. Spiega il problema, il suo impatto e proponi una data per la riparazione.',
    work: 'Molte aziende ora permettono di lavorare da casa. Discuti i vantaggi e gli svantaggi del lavoro da remoto e dai la tua opinione.',
    food: 'Spiega come preparare un piatto tradizionale della tua cultura, o perché un alimento è importante nel tuo paese.',
  },
  [Language.Russian]: {
    intro: 'Опиши человека, который повлиял на тебя больше всего. Объясни, кто он, как вы познакомились и почему он важен для тебя.',
    daily: 'Опиши обычный день своей жизни, который для тебя значим. Что ты делаешь и почему этот распорядок особенный?',
    hobby: 'Напиши о хобби, которое тебе нравится. Опиши, что это, как ты им увлёкся и почему оно важно для тебя.',
    travel: 'Опиши запоминающееся путешествие, которое ты совершил(а). Куда ты ездил(а), что произошло и чему ты научился(лась)?',
    opinion: 'Некоторые считают, что туризм приносит местным культурам больше вреда, чем пользы. В какой мере ты согласен/согласна? Обоснуй причинами и примерами.',
    letter: 'Ты пишешь арендодателю с просьбой починить протекающую трубу в твоей квартире. Объясни проблему, её последствия и предложи удобную дату ремонта.',
    work: 'Многие компании теперь разрешают работать из дома. Обсуди преимущества и недостатки удалённой работы и выскажи своё мнение.',
    food: 'Объясни, как приготовить традиционное блюдо твоей культуры, или почему какой-то продукт важен в твоей стране.',
  },
  [Language.Greek]: {
    intro: 'Περίγραψε ένα άτομο που σε επηρέασε περισσότερο. Εξήγησε ποιος είναι, πώς τον/την γνωρίζεις και γιατί είναι σημαντικός/ή για σένα.',
    daily: 'Περίγραψε μια τυπική μέρα της ζωής σου που έχει νόημα για σένα. Τι κάνεις και γιατί αυτή η ρουτίνα είναι ξεχωριστή;',
    hobby: 'Γράψε για ένα χόμπι που απολαμβάνεις. Περίγραψε τι είναι, πώς ξεκίνησες και γιατί είναι σημαντικό για σένα.',
    travel: 'Περίγραψε ένα αξέχαστο ταξίδι που έκανες. Πού πήγες, τι έγινε και τι έμαθες;',
    opinion: 'Μερικοί πιστεύουν ότι ο τουρισμός κάνει περισσότερο κακό παρά καλό στους τοπικούς πολιτισμούς. Σε ποιο βαθμό συμφωνείς ή διαφωνείς; Στήριξε με λόγους και παραδείγματα.',
    letter: 'Γράφεις στον ιδιοκτήτη σου για να ζητήσεις επισκευή ενός σωλήνα που στάζει στο διαμέρισμά σου. Εξήγησε το πρόβλημα, τις επιπτώσεις του και πρότεινε μια ημερομηνία.',
    work: 'Πολλές εταιρείες επιτρέπουν πλέον την εργασία από το σπίτι. Συζήτησε τα πλεονεκτήματα και τα μειονεκτήματα της τηλεργασίας και δώσε τη γνώμη σου.',
    food: 'Εξήγησε πώς να ετοιμάσεις ένα παραδοσιακό πιάτο της κουλτούρας σου, ή γιατί ένα φαγητό είναι σημαντικό στη χώρα σου.',
  },
  [Language.Arabic]: {
    intro: 'صِف شخصاً أثّر فيك كثيراً. اشرح من هو وكيف تعرّفت عليه ولماذا هو مهم بالنسبة لك.',
    daily: 'صِف يوماً عادياً في حياتك له معنى بالنسبة لك. ماذا تفعل ولماذا هذا الروتين مميز؟',
    hobby: 'اكتب عن هواية تستمتع بها. صِف ما هي وكيف بدأت ولماذا هي مهمة بالنسبة لك.',
    travel: 'صِف رحلة لا تُنسى قمت بها. أين ذهبت وماذا حدث وماذا تعلّمت؟',
    opinion: 'يعتقد بعض الناس أن السياحة تضر بالثقافات المحلية أكثر مما تنفعها. إلى أي مدى توافق أو لا توافق؟ ادعم رأيك بأسباب وأمثلة.',
    letter: 'أنت تكتب إلى مالك الشقة لطلب إصلاح أنبوب يتسرب في شقتك. اشرح المشكلة وتأثيرها واقترح موعداً مناسباً للإصلاح.',
    work: 'تسمح العديد من الشركات الآن بالعمل من المنزل. ناقش مزايا وعيوب العمل عن بُعد وأعطِ رأيك.',
    food: 'اشرح كيفية تحضير طبق تقليدي من ثقافتك، أو لماذا يعتبر طعام معين مهماً في بلدك.',
  },
  [Language.Chinese]: {
    intro: '写一位对你影响最深的人：他是谁、你怎么认识他的、为什么他很重要。',
    daily: '描述你生活中一个有意义的一天：你做了什么、为什么这个日常是特别的。',
    hobby: '写一个你喜欢的爱好：它是什么、你怎么开始的、为什么它重要。',
    travel: '描述一次难忘的旅行：你去了哪里、发生了什么、你学到了什么。',
    opinion: '有人认为旅游对当地文化的弊大于利。你在多大程度上同意或不同意？请用理由和例子支撑你的观点。',
    letter: '你正在给房东写信，请求修理公寓里漏水的水管。说明问题、它的影响，并提出一个方便的修理日期。',
    work: '许多公司现在允许员工在家办公。讨论远程办公的优缺点，并给出你的看法。',
    food: '说明如何做一道你文化里的传统菜，或解释为什么某种食物在你的国家很重要。',
  },
};
