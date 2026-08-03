import { Language, CEFRLevel } from '../types';

// 句型填空模板：含 ___ 的句型，让学习者填空产出完整句
export interface GuidedTemplate {
  id: string;
  template: string;       // 含 ___ 的句型，如「私は ___ です。」
  hint: string;           // 母语提示填什么
  answerExample: string;  // 示例答案（仅供参考，校验由 AI 完成）
}

// 按语言 × 等级维护的句型模板库。结构通用可扩展，新增语言只需往此处加条目。
export const GUIDED_TEMPLATES: Partial<Record<Language, Partial<Record<CEFRLevel, GuidedTemplate[]>>>> = {
  [Language.Japanese]: {
    [CEFRLevel.A1]: [
      // 肯定・判断
      { id: 'ja-a1-1', template: '私は ___ です。', hint: '填你的职业（如：学生 / 会社員）', answerExample: '学生' },
      { id: 'ja-a1-2', template: 'これは ___ です。', hint: '填一件物品（如：本 / ペン / 電話）', answerExample: '本' },
      { id: 'ja-a1-5', template: '私の名前は ___ です。', hint: '填你的名字', answerExample: '田中' },
      { id: 'ja-a1-18', template: 'この ___ は ___ です。', hint: '「这个某物是某样」前填物品、后填特征（如：本 / 面白い）', answerExample: '本' },
      // 否定・过去
      { id: 'ja-a1-9', template: '私は ___ じゃないです。', hint: '否定：填你不是什么（如：学生 / 先生）', answerExample: '学生' },
      { id: 'ja-a1-21', template: '___ は ___ じゃないです。', hint: '否定：前填物品、后填它不是的特征', answerExample: 'これ' },
      { id: 'ja-a1-10', template: '昨日は ___ でした。', hint: '过去：填昨天是什么（如：月曜日 / 休み）', answerExample: '休み' },
      // 疑问
      { id: 'ja-a1-11', template: '___ はどこですか。', hint: '疑问：问某物在哪里（如：トイレ / 駅）', answerExample: 'トイレ' },
      { id: 'ja-a1-12', template: '___ はいくらですか。', hint: '疑问：问价格（如：これ / この本）', answerExample: 'これ' },
      // 好恶・欲望・能力
      { id: 'ja-a1-3', template: '___ が好きです。', hint: '填你喜欢的事物（如：犬 / 音楽 / 日本語）', answerExample: '犬' },
      { id: 'ja-a1-13', template: '___ が欲しいです。', hint: '想要：填你想要的东西（如：水 / コーヒー）', answerExample: '水' },
      { id: 'ja-a1-20', template: '私は ___ が上手です。', hint: '填你擅长的（如：日本語 / 料理 / サッカー）', answerExample: '料理' },
      { id: 'ja-a1-15', template: '___ は楽しいです。', hint: '填你觉得有趣的事（如：日本語 / 音楽 / 旅行）', answerExample: '旅行' },
      // 动作
      { id: 'ja-a1-7', template: '___ を食べます。', hint: '填你吃的东西（如：ご飯 / パン / 肉）', answerExample: 'ご飯' },
      { id: 'ja-a1-14', template: '___ を飲みます。', hint: '填你喝的东西（如：水 / お茶 / コーヒー）', answerExample: 'お茶' },
      { id: 'ja-a1-8', template: '___ へ行きます。', hint: '填你去的地方（如：学校 / 仕事 / 家）', answerExample: '学校' },
      { id: 'ja-a1-19', template: '___ を買います。', hint: '填你买的东西（如：本 / みかん / 靴）', answerExample: '本' },
      { id: 'ja-a1-22', template: '___ と ___ を食べます。', hint: '并列：填两样你吃的东西', answerExample: 'ご飯' },
      // 时间・位置
      { id: 'ja-a1-4', template: '今日は ___ です。', hint: '填今天星期几（如：月曜日 / 火曜日）', answerExample: '月曜日' },
      { id: 'ja-a1-16', template: '___ 時に起きます。', hint: '填你几点起床（如：六 / 7）', answerExample: '七' },
      { id: 'ja-a1-6', template: '___ にいます。', hint: '填你在哪里（如：学校 / 家 / 会社）', answerExample: '学校' },
      { id: 'ja-a1-17', template: '___ は ___ にあります。', hint: '某物在某处：前填物品、后填地点（如：本 / つくえ）', answerExample: '本' },
    ],
  },
  [Language.English]: {
    [CEFRLevel.A1]: [
      { id: 'en-a1-1', template: 'I am ___ .', hint: '填你的职业（如 a student / a teacher）', answerExample: 'a student' },
      { id: 'en-a1-2', template: 'I like ___ .', hint: '填你喜欢的事物（如 music / dogs）', answerExample: 'music' },
      { id: 'en-a1-3', template: 'This is my ___ .', hint: '填一件物品（如 book / phone）', answerExample: 'book' },
      { id: 'en-a1-4', template: 'I eat ___ for breakfast.', hint: '填早餐食物（如 bread / eggs）', answerExample: 'eggs' },
      { id: 'en-a1-5', template: 'My name is ___ .', hint: '填你的名字', answerExample: 'Tom' },
      { id: 'en-a1-6', template: 'I am from ___ .', hint: '填你的国家（如 China / Japan）', answerExample: 'China' },
      { id: 'en-a1-7', template: 'I can ___ .', hint: '填你会的事（如 swim / speak English）', answerExample: 'swim' },
      { id: 'en-a1-8', template: 'I go to ___ every day.', hint: '填地点（如 school / work）', answerExample: 'school' },
    ],
    [CEFRLevel.A2]: [
      { id: 'en-a2-1', template: 'Yesterday, I ___ with ___ .', hint: '前填做的事，后填人（如 went to a movie / my friend）', answerExample: 'went to a movie' },
      { id: 'en-a2-2', template: 'My favorite ___ is ___ because ___ .', hint: '类别 / 事物 / 原因（如 food / pizza / it is delicious）', answerExample: 'pizza' },
      { id: 'en-a2-3', template: 'I usually ___ in the morning, but today I ___ .', hint: '日常 / 今天不同（如 drink coffee / drank tea）', answerExample: 'drink coffee' },
      { id: 'en-a2-4', template: 'If I have time, I will ___ .', hint: '填计划（如 visit my grandma）', answerExample: 'visit my grandma' },
      { id: 'en-a2-5', template: 'I think ___ is ___ .', hint: '事物 / 评价（如 this book / interesting）', answerExample: 'interesting' },
    ],
    [CEFRLevel.B1]: [
      { id: 'en-b1-1', template: 'In my opinion, ___ because ___ .', hint: '观点 / 原因（如 we should exercise / it keeps us healthy）', answerExample: 'we should exercise' },
      { id: 'en-b1-2', template: 'I have never ___ , but I would like to ___ .', hint: '未做过的事 / 想做的事（如 been to Paris / go there）', answerExample: 'been to Paris' },
      { id: 'en-b1-3', template: 'Although ___ , I still ___ .', hint: '让步 / 主句（如 it was raining / went for a walk）', answerExample: 'it was raining' },
      { id: 'en-b1-4', template: 'The best way to ___ is to ___ .', hint: '目标 / 方法（如 learn a language / practice daily）', answerExample: 'learn a language' },
    ],
    [CEFRLevel.B2]: [
      { id: 'en-b2-1', template: 'While some people believe ___ , I would argue that ___ .', hint: '对立观点 / 你的论点（如 money buys happiness / it does not）', answerExample: 'money buys happiness' },
      { id: 'en-b2-2', template: 'The issue of ___ has sparked considerable debate regarding ___ .', hint: '议题 / 争议点（如 AI / its impact on jobs）', answerExample: 'AI' },
      { id: 'en-b2-3', template: 'Not only does ___ , but it also ___ .', hint: '事物 / 附加影响（如 this app save time / improve focus）', answerExample: 'this app save time' },
    ],
  },
  [Language.Korean]: {
    [CEFRLevel.A1]: [
      { id: 'ko-a1-1', template: '저는 ___입니다.', hint: '填你的职业（如 학생 学生 / 회사원 公司职员）', answerExample: '학생' },
      { id: 'ko-a1-2', template: '___을/를 좋아해요.', hint: '填你喜欢的事物（如 음악 音乐 / 강아지 小狗）', answerExample: '음악' },
      { id: 'ko-a1-3', template: '이것은 제 ___입니다.', hint: '填一件物品（如 책 书 / 핸드폰 手机）', answerExample: '책' },
      { id: 'ko-a1-4', template: '아침에는 ___을/를 먹어요.', hint: '填早餐食物（如 밥 饭 / 빵 面包）', answerExample: '빵' },
      { id: 'ko-a1-5', template: '제 이름은 ___입니다.', hint: '填你的名字', answerExample: '민수' },
      { id: 'ko-a1-6', template: '저는 ___에서 왔어요.', hint: '填你的国家（如 중국 中国 / 미국 美国）', answerExample: '중국' },
      { id: 'ko-a1-7', template: '___을/를 할 수 있어요.', hint: '填你会的事（如 수영 游泳 / 한국어 韩语）', answerExample: '수영' },
      { id: 'ko-a1-8', template: '매일 ___에 가요.', hint: '填地点（如 학교 学校 / 회사 公司）', answerExample: '학교' },
    ],
    [CEFRLevel.A2]: [
      { id: 'ko-a2-1', template: '어제 ___와/과 함께 ___했어요.', hint: '前填人，后填做的事（如 친구 朋友 / 영화를 봤어요 看了电影）', answerExample: '친구' },
      { id: 'ko-a2-2', template: '제일 좋아하는 ___은/는 ___이에요. 왜냐하면 ___.', hint: '类别 / 事物 / 原因（如 음식 食物 / 피자 披萨 / 맛있어요 好吃）', answerExample: '피자' },
      { id: 'ko-a2-3', template: '보통 아침에는 ___하는데, 오늘은 ___했어요.', hint: '日常 / 今天不同（如 커피를 마셔요 喝咖啡 / 차를 마셨어요 喝了茶）', answerExample: '커피를 마셔요' },
      { id: 'ko-a2-4', template: '시간이 있으면 ___할 거예요.', hint: '填计划（如 할머니를 뵈러 갈 거예요 去看奶奶）', answerExample: '할머니를 뵈러 갈 거예요' },
      { id: 'ko-a2-5', template: '___은/는 ___이라고 생각해요.', hint: '事物 / 评价（如 이 책 这本书 / 재미있어요 有趣）', answerExample: '재미있어요' },
    ],
    [CEFRLevel.B1]: [
      { id: 'ko-b1-1', template: '제 생각에는 ___이/가 ___이라고 생각해요. 왜냐하면 ___.', hint: '观点 / 原因（如 운동을 해야 돼요 该运动 / 건강에 좋아요 对健康好）', answerExample: '운동을 해야 돼요' },
      { id: 'ko-b1-2', template: '___을/를 해본 적이 없지만, ___해보고 싶어요.', hint: '未做过的事 / 想做的事（如 파리에 가본 去过巴黎 / 거기에 가고 去那里）', answerExample: '파리에 가본' },
      { id: 'ko-b1-3', template: '___지만, 그래도 ___해요.', hint: '让步 / 主句（如 비가 왔어요 下雨了 / 산책했어요 散步了）', answerExample: '비가 왔어요' },
      { id: 'ko-b1-4', template: '___하는 가장 좋은 방법은 ___하는 거예요.', hint: '目标 / 方法（如 언어를 배우는 学语言 / 매일 연습하는 每天练习）', answerExample: '언어를 배우는' },
    ],
    [CEFRLevel.B2]: [
      { id: 'ko-b2-1', template: '어떤 사람들은 ___라고 생각하지만, 저는 ___라고 주장하고 싶어요.', hint: '对立观点 / 你的论点（如 돈이 행복을 산다 钱能买幸福 / 그렇지 않다 并非如此）', answerExample: '돈이 행복을 산다' },
      { id: 'ko-b2-2', template: '___에 대한 문제는 ___에 대해 상당한 논쟁을 불러일으켰어요.', hint: '议题 / 争议点（如 AI / 일자리에 미치는 영향 对就业的影响）', answerExample: 'AI' },
      { id: 'ko-b2-3', template: '___은/는 ___할 뿐만 아니라, ___도 해요.', hint: '事物 / 附加影响（如 이 앱 这个应用 / 시간을 절약해요 节省时间 / 집중력도 높여요 也提高专注力）', answerExample: '이 앱' },
    ],
  },
};

// 情境库：通用（不绑语言），按等级。给中文情境，让学习者用目标语言写 1-3 句。
export const GUIDED_PROMPTS: Partial<Record<CEFRLevel, string[]>> = {
  [CEFRLevel.A1]: [
    '用目标语言介绍你自己：叫什么、是哪国人。',
    '用目标语言说一样你喜欢的食物。',
    '用目标语言说说你今天早上做了什么。',
    '用目标语言描述你房间里的一件东西在哪里。',
    '用目标语言说说你的一个爱好。',
    '用目标语言说现在几点、你正在做什么。',
    '用目标语言介绍你的一位朋友：叫什么、是哪国人。',
  ],
  [CEFRLevel.A2]: [
    '用目标语言描述你上个周末做了什么（用过去时）。',
    '用目标语言说说你明天的计划。',
    '用目标语言比较你喜欢的两种食物。',
    '用目标语言描述你的日常作息（至少三句）。',
  ],
  [CEFRLevel.B1]: [
    '用目标语言描述一次让你印象深刻的旅行经历（至少三句，用过去时）。',
    '用目标语言说明你支持或反对某件事的理由（给出至少两个理由）。',
    '用目标语言讲述你学会某件重要事情的过程（起因、经过、结果）。',
  ],
  [CEFRLevel.B2]: [
    '用目标语言就一个社会话题阐述你的立场，正反两面都要涉及（至少四句）。',
    '用目标语言写一封正式邮件，申请一个职位或项目，说明你的资历与动机。',
    '用目标语言评论最近的一部作品或事件，给出有深度的看法（至少四句）。',
  ],
};

export function getGuidedTemplate(lang: Language, level: CEFRLevel): GuidedTemplate | null {
  const list = GUIDED_TEMPLATES[lang]?.[level];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function getGuidedPrompt(level: CEFRLevel): string {
  const list = GUIDED_PROMPTS[level] ?? GUIDED_PROMPTS[CEFRLevel.A1] ?? [];
  if (list.length === 0) return '用目标语言写一句话描述你现在的心情。';
  return list[Math.floor(Math.random() * list.length)];
}

export function hasGuidedTemplates(lang: Language, level: CEFRLevel): boolean {
  const list = GUIDED_TEMPLATES[lang]?.[level];
  return !!list && list.length > 0;
}
