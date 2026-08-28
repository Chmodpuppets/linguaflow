import { Language, CEFRLevel, WritingRegister } from '../types';

// 句型填空模板：含 ___ 的句型，让学习者填空产出完整句
export interface GuidedTemplate {
  id: string;
  template: string;       // 含 ___ 的句型，如「私は ___ です。」
  hint: string;           // 母语提示填什么
  answerExample: string;  // 示例答案（仅供参考，校验由 AI 完成）
  register?: WritingRegister; // 语体/口气（可选，缺省按 CEFR 等级默认）
}

// 按语言 × 等级维护的句型模板库。结构通用可扩展，当前覆盖 11 种支持语言。
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
    [CEFRLevel.A2]: [
      { id: 'ja-a2-1', template: '昨日、___と一緒に___をしました。', hint: '前填人，后填做的事（如 友達 朋友 / 映画を見る 看电影）', answerExample: '友達' },
      { id: 'ja-a2-2', template: '一番好きな___は___です。理由は___からです。', hint: '类别 / 事物 / 原因（如 食べ物 食物 / ピザ 披萨 / おいしい 好吃）', answerExample: 'ピザ' },
      { id: 'ja-a2-3', template: '普段は朝___しますが、今日は___しました。', hint: '日常 / 今天不同（如 コーヒーを飲む 喝咖啡 / お茶を飲んだ 喝了茶）', answerExample: 'コーヒーを飲む' },
      { id: 'ja-a2-4', template: '時間があれば、___します。', hint: '填计划（如 祖母に会いに行く 去看奶奶）', answerExample: '祖母に会いに行く' },
      { id: 'ja-a2-5', template: '___は___だと思います。', hint: '事物 / 评价（如 この本 这本书 / 面白い 有趣）', answerExample: '面白い' },
    ],
    [CEFRLevel.B1]: [
      { id: 'ja-b1-1', template: '私の意見では、___べきです。なぜなら___からです。', hint: '观点 / 原因（如 毎日運動する 该每天运动 / 健康に良い 对健康好）', answerExample: '毎日運動する' },
      { id: 'ja-b1-2', template: '___たことがありませんが、いつか___てみたいです。', hint: '未做过的事（动词た形，如 パリに行った 去过巴黎）/ 想做的事（动词て形，如 行っ 去）', answerExample: 'パリに行った' },
      { id: 'ja-b1-3', template: '___でも、やはり___します。', hint: '让步 / 主句（如 雨が降った 下雨了 / 散歩に出かけ 去散步）', answerExample: '雨が降った' },
      { id: 'ja-b1-4', template: '___する一番良い方法は、___することです。', hint: '目标 / 方法（如 言語を覚える 学语言 / 毎日練習する 每天练习）', answerExample: '言語を覚える' },
    ],
    [CEFRLevel.B2]: [
      { id: 'ja-b2-1', template: '多くの人は___と思っていますが、私は___と主張したいです。', hint: '对立观点 / 你的论点（如 お金で幸せが買える 钱能买幸福 / そうではない 并非如此）', answerExample: 'お金で幸せが買える' },
      { id: 'ja-b2-2', template: '___の問題は、___について大きな議論を呼んでいます。', hint: '议题 / 争议点（如 AI / 仕事への影響 对就业的影响）', answerExample: 'AI' },
      { id: 'ja-b2-3', template: '___は、___するだけでなく、___もします。', hint: '事物 / 作用 / 附加影响（如 このアプリ 这个应用 / 時間を節約す 节省时间 / 集中力を高め 也提高专注力）', answerExample: 'このアプリ' },
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
  [Language.Spanish]: {
    [CEFRLevel.A1]: [
      { id: 'es-a1-1', template: 'Soy ___ .', hint: '填你的职业（如 un estudiante 学生 / un profesor 老师）', answerExample: 'un estudiante' },
      { id: 'es-a1-2', template: 'Me gusta ___ .', hint: '填你喜欢的事物（如 la música 音乐 / los perros 狗）', answerExample: 'la música' },
      { id: 'es-a1-3', template: 'Este es mi ___ .', hint: '填一件物品（如 libro 书 / teléfono 手机）', answerExample: 'libro' },
      { id: 'es-a1-4', template: 'Desayuno ___ .', hint: '填早餐食物（如 pan 面包 / huevos 鸡蛋）', answerExample: 'pan' },
      { id: 'es-a1-5', template: 'Me llamo ___ .', hint: '填你的名字', answerExample: 'Ana' },
      { id: 'es-a1-6', template: 'Soy de ___ .', hint: '填你的国家（如 China 中国 / España 西班牙）', answerExample: 'China' },
    ],
    [CEFRLevel.A2]: [
      { id: 'es-a2-1', template: 'Ayer ___ con ___ .', hint: '前填做的事（过去时），后填人（如 fui al cine 去了电影院 / mi amigo 我朋友）', answerExample: 'fui al cine' },
      { id: 'es-a2-2', template: 'Mi ___ favorito/a es ___ porque ___ .', hint: '类别 / 事物 / 原因（如 comida 食物 / la pizza / es deliciosa 好吃）', answerExample: 'comida' },
      { id: 'es-a2-3', template: 'Normalmente ___ por la mañana, pero hoy ___ .', hint: '日常 / 今天不同（如 desayuno a las ocho 八点吃早餐 / desayuné tarde 吃得晚）', answerExample: 'desayuno a las ocho' },
      { id: 'es-a2-4', template: 'Si tengo tiempo, ___ .', hint: '填计划（如 visitaré a mi abuela 会去看奶奶）', answerExample: 'visitaré a mi abuela' },
      { id: 'es-a2-5', template: 'Creo que ___ es ___ .', hint: '事物 / 评价（如 este libro 这本书 / interesante 有趣）', answerExample: 'este libro' },
    ],
  },
  [Language.French]: {
    [CEFRLevel.A1]: [
      { id: 'fr-a1-1', template: 'Je suis ___ .', hint: '填你的职业（如 un étudiant 学生 / un professeur 老师）', answerExample: 'un étudiant' },
      { id: 'fr-a1-2', template: "J'aime ___ .", hint: '填你喜欢的事物（如 la musique 音乐 / les chiens 狗）', answerExample: 'la musique' },
      { id: 'fr-a1-3', template: 'Ceci est mon ___ .', hint: '填一件物品（如 livre 书 / téléphone 手机）', answerExample: 'livre' },
      { id: 'fr-a1-4', template: 'Je mange ___ au petit-déjeuner.', hint: '填早餐食物（如 du pain 面包 / des œufs 鸡蛋）', answerExample: 'du pain' },
      { id: 'fr-a1-5', template: "Je m'appelle ___ .", hint: '填你的名字', answerExample: 'Marie' },
      { id: 'fr-a1-6', template: 'Je viens de ___ .', hint: '填你的国家（如 Chine 中国 / France 法国）', answerExample: 'Chine' },
    ],
    [CEFRLevel.A2]: [
      { id: 'fr-a2-1', template: "Hier, j'ai ___ avec ___ .", hint: '前填做的事（过去时），后填人（如 vu un film 看了电影 / mon ami 我朋友）', answerExample: 'vu un film' },
      { id: 'fr-a2-2', template: 'Mon/Ma ___ préféré(e) est ___ parce que ___ .', hint: "类别 / 事物 / 原因（如 nourriture 食物 / la pizza / c'est délicieux 好吃）", answerExample: 'nourriture' },
      { id: 'fr-a2-3', template: "D'habitude, je ___ le matin, mais aujourd'hui je ___ .", hint: '日常 / 今天不同（如 prends le petit-déjeuner à huit heures 八点吃早餐 / ai pris mon petit-déjeuner tard 吃得晚）', answerExample: 'prends le petit-déjeuner à huit heures' },
      { id: 'fr-a2-4', template: "Si j'ai le temps, je ___ .", hint: '填计划（如 rendrai visite à ma grand-mère 会去看奶奶）', answerExample: 'rendrai visite à ma grand-mère' },
      { id: 'fr-a2-5', template: 'Je pense que ___ est ___ .', hint: '事物 / 评价（如 ce livre 这本书 / intéressant 有趣）', answerExample: 'ce livre' },
    ],
  },
  [Language.German]: {
    [CEFRLevel.A1]: [
      { id: 'de-a1-1', template: 'Ich bin ___ .', hint: '填你的职业（如 ein Student 学生 / ein Lehrer 老师）', answerExample: 'ein Student' },
      { id: 'de-a1-2', template: 'Ich mag ___ .', hint: '填你喜欢的事物（如 Musik 音乐 / Hunde 狗）', answerExample: 'Musik' },
      { id: 'de-a1-3', template: 'Das ist mein/eine ___ .', hint: '填一件物品（如 Buch 书 / Handy 手机）', answerExample: 'Buch' },
      { id: 'de-a1-4', template: 'Zum Frühstück esse ich ___ .', hint: '填早餐食物（如 Brot 面包 / Eier 鸡蛋）', answerExample: 'Brot' },
      { id: 'de-a1-5', template: 'Ich heiße ___ .', hint: '填你的名字', answerExample: 'Anna' },
      { id: 'de-a1-6', template: 'Ich komme aus ___ .', hint: '填你的国家（如 China 中国 / Deutschland 德国）', answerExample: 'China' },
    ],
    [CEFRLevel.A2]: [
      { id: 'de-a2-1', template: 'Gestern habe ich ___ mit ___ .', hint: '前填做的事，后填人（如 einen Film gesehen 看了电影 / meinem Freund 我朋友）', answerExample: 'einen Film gesehen' },
      { id: 'de-a2-2', template: 'Mein/eine Lieblings-___ ist ___ , weil ___ .', hint: '类别 / 事物 / 原因（如 Speise 食物 / Pizza / sie lecker ist 好吃）', answerExample: 'Speise' },
      { id: 'de-a2-3', template: 'Normalerweise ___ ich am Morgen, aber heute ___ ich ___ .', hint: '日常 / 今天不同（如 frühstücke 吃早餐 / habe / spät gefrühstückt 吃得晚）', answerExample: 'frühstücke' },
      { id: 'de-a2-4', template: 'Wenn ich Zeit habe, werde ich ___ .', hint: '填计划（如 meine Großmutter besuchen 去看奶奶）', answerExample: 'meine Großmutter besuchen' },
      { id: 'de-a2-5', template: 'Ich finde, ___ ist ___ .', hint: '事物 / 评价（如 dieses Buch 这本书 / interessant 有趣）', answerExample: 'dieses Buch' },
    ],
  },
  [Language.Italian]: {
    [CEFRLevel.A1]: [
      { id: 'it-a1-1', template: 'Sono ___ .', hint: '填你的职业（如 uno studente 学生 / un insegnante 老师）', answerExample: 'uno studente' },
      { id: 'it-a1-2', template: 'Mi piace ___ .', hint: '填你喜欢的事物（如 la musica 音乐 / i cani 狗）', answerExample: 'la musica' },
      { id: 'it-a1-3', template: 'Questo è il mio ___ .', hint: '填一件物品（如 libro 书 / telefono 手机）', answerExample: 'libro' },
      { id: 'it-a1-4', template: 'A colazione mangio ___ .', hint: '填早餐食物（如 pane 面包 / uova 鸡蛋）', answerExample: 'pane' },
      { id: 'it-a1-5', template: 'Mi chiamo ___ .', hint: '填你的名字', answerExample: 'Marco' },
      { id: 'it-a1-6', template: 'Vengo da ___ .', hint: '填你的国家（如 Cina 中国 / Italia 意大利）', answerExample: 'Cina' },
    ],
    [CEFRLevel.A2]: [
      { id: 'it-a2-1', template: 'Ieri ___ con ___ .', hint: '前填做的事（过去时），后填人（如 sono andato al cinema 去了电影院 / il mio amico 我朋友）', answerExample: 'sono andato al cinema' },
      { id: 'it-a2-2', template: 'Il mio ___ preferito è ___ perché ___ .', hint: '类别 / 事物 / 原因（如 cibo 食物 / la pizza / è buona 好吃）', answerExample: 'cibo' },
      { id: 'it-a2-3', template: 'Di solito ___ la mattina, ma oggi ___ .', hint: '日常 / 今天不同（如 faccio colazione alle otto 八点吃早餐 / ho fatto colazione tardi 吃得晚）', answerExample: 'faccio colazione alle otto' },
      { id: 'it-a2-4', template: 'Se ho tempo, ___ .', hint: '填计划（如 andrò a trovare mia nonna 会去看奶奶）', answerExample: 'andrò a trovare mia nonna' },
      { id: 'it-a2-5', template: 'Penso che ___ sia ___ .', hint: '事物 / 评价（如 questo libro 这本书 / interessante 有趣）', answerExample: 'questo libro' },
    ],
  },
  [Language.Russian]: {
    [CEFRLevel.A1]: [
      { id: 'ru-a1-1', template: 'Я ___ .', hint: '填你的职业（如 студент 学生 / учитель 老师）', answerExample: 'студент' },
      { id: 'ru-a1-2', template: 'Мне нравится ___ .', hint: '填你喜欢的事物（如 музыка 音乐 / собаки 狗）', answerExample: 'музыка' },
      { id: 'ru-a1-3', template: 'Это мой/моя ___ .', hint: '填一件物品（如 книга 书 / телефон 手机）', answerExample: 'книга' },
      { id: 'ru-a1-4', template: 'На завтрак я ем ___ .', hint: '填早餐食物（如 хлеб 面包 / яйца 鸡蛋）', answerExample: 'хлеб' },
      { id: 'ru-a1-5', template: 'Меня зовут ___ .', hint: '填你的名字', answerExample: 'Анна' },
      { id: 'ru-a1-6', template: 'Я из ___ .', hint: '填你的国家（如 Китая 中国 / России 俄罗斯）', answerExample: 'Китая' },
    ],
    [CEFRLevel.A2]: [
      { id: 'ru-a2-1', template: 'Вчера я ___ с ___ .', hint: '前填做的事（过去时），后填人（如 смотрел кино 看了电影 / другом 朋友）', answerExample: 'смотрел кино' },
      { id: 'ru-a2-2', template: 'Мой/Моя любимый/любимая ___ — это ___, потому что ___ .', hint: '类别 / 事物 / 原因（如 еда 食物 / пицца / она вкусная 好吃）', answerExample: 'еда' },
      { id: 'ru-a2-3', template: 'Обычно утром я ___, но сегодня ___ .', hint: '日常 / 今天不同（如 завтракаю в восемь 八点吃早餐 / поздно позавтракал 吃得晚）', answerExample: 'завтракаю в восемь' },
      { id: 'ru-a2-4', template: 'Если у меня будет время, я ___ .', hint: '填计划（如 поеду к бабушке 会去看奶奶）', answerExample: 'поеду к бабушке' },
      { id: 'ru-a2-5', template: 'Я думаю, что ___ — это ___ .', hint: '事物 / 评价（如 эта книга 这本书 / интересная 有趣）', answerExample: 'эта книга' },
    ],
  },
  [Language.Greek]: {
    [CEFRLevel.A1]: [
      { id: 'el-a1-1', template: 'Είμαι ___ .', hint: '填你的职业（如 φοιτητής 学生 / δάσκαλος 老师）', answerExample: 'φοιτητής' },
      { id: 'el-a1-2', template: 'Μου αρέσει ___ .', hint: '填你喜欢的事物（如 η μουσική 音乐 / τα σκυλιά 狗）', answerExample: 'η μουσική' },
      { id: 'el-a1-3', template: 'Αυτό είναι το ___ μου .', hint: '填一件物品（如 βιβλίο 书 / τηλέφωνο 手机）', answerExample: 'βιβλίο' },
      { id: 'el-a1-4', template: 'Τρώω ___ για πρόγευμα.', hint: '填早餐食物（如 ψωμί 面包 / αυγά 鸡蛋）', answerExample: 'ψωμί' },
      { id: 'el-a1-5', template: 'Με λένε ___ .', hint: '填你的名字', answerExample: 'Μαρία' },
      { id: 'el-a1-6', template: 'Είμαι από ___ .', hint: '填你的国家（如 την Κίνα 中国 / την Ελλάδα 希腊）', answerExample: 'την Κίνα' },
    ],
    [CEFRLevel.A2]: [
      { id: 'el-a2-1', template: 'Χθες ___ με ___ .', hint: '前填做的事（过去时），后填人（如 πήγα σινεμά 去了电影院 / τον φίλο μου 我朋友）', answerExample: 'πήγα σινεμά' },
      { id: 'el-a2-2', template: 'Το αγαπημένο μου ___ είναι ___ γιατί ___ .', hint: '类别 / 事物 / 原因（如 φαγητό 食物 / η πίτσα / είναι νόστιμη 好吃）', answerExample: 'φαγητό' },
      { id: 'el-a2-3', template: 'Συνήθως ___ το πρωί, αλλά σήμερα ___ .', hint: '日常 / 今天不同（如 παίρνω πρωινό στις οκτώ 八点吃早餐 / πήρα πρωινό αργά 吃得晚）', answerExample: 'παίρνω πρωινό στις οκτώ' },
      { id: 'el-a2-4', template: 'Αν έχω χρόνο, θα ___ .', hint: '填计划（如 επισκεφτώ τη γιαγιά μου 会去看奶奶）', answerExample: 'επισκεφτώ τη γιαγιά μου' },
      { id: 'el-a2-5', template: 'Νομίζω ότι το ___ είναι ___ .', hint: '事物 / 评价（如 αυτό το βιβλίο 这本书 / ενδιαφέρον 有趣）', answerExample: 'αυτό το βιβλίο' },
    ],
  },
  [Language.Arabic]: {
    [CEFRLevel.A1]: [
      { id: 'ar-a1-1', template: 'أنا ___ .', hint: '填你的职业（如 طالب 学生 / معلم 老师）', answerExample: 'طالب' },
      { id: 'ar-a1-2', template: 'أحب ___ .', hint: '填你喜欢的事物（如 الموسيقى 音乐 / الكلاب 狗）', answerExample: 'الموسيقى' },
      { id: 'ar-a1-3', template: 'هذا ___ .', hint: '填一件物品（如 كتابي 我的书 / هاتفي 我的手机）', answerExample: 'كتابي' },
      { id: 'ar-a1-4', template: 'أتناول ___ على الفطور.', hint: '填早餐食物（如 الخبز 面包 / البيض 鸡蛋）', answerExample: 'الخبز' },
      { id: 'ar-a1-5', template: 'اسمي ___ .', hint: '填你的名字', answerExample: 'فاطمة' },
      { id: 'ar-a1-6', template: 'أنا من ___ .', hint: '填你的国家（如 الصين 中国 / مصر 埃及）', answerExample: 'الصين' },
    ],
    [CEFRLevel.A2]: [
      { id: 'ar-a2-1', template: 'أمس ___ مع ___ .', hint: '前填做的事（过去时），后填人（如 شاهدت فيلمًا 看了电影 / صديقي 我朋友）', answerExample: 'شاهدت فيلمًا' },
      { id: 'ar-a2-2', template: '___ المفضل لدي هو ___ لأن ___ .', hint: '类别 / 事物 / 原因（如 الطعام 食物 / البيتزا / إنه لذيذ 好吃）', answerExample: 'الطعام' },
      { id: 'ar-a2-3', template: 'عادةً ___ في الصباح، لكن اليوم ___ .', hint: '日常 / 今天不同（如 آخذ الفطور في الثامنة 八点吃早餐 / أخذت الفطور متأخرًا 吃得晚）', answerExample: 'آخذ الفطور في الثامنة' },
      { id: 'ar-a2-4', template: 'إذا كان لدي وقت، سأ___ .', hint: '填计划（如 أزور جدتي 会去看奶奶）', answerExample: 'أزور جدتي' },
      { id: 'ar-a2-5', template: 'أعتقد أن ___ ___ .', hint: '事物 / 评价（如 هذا الكتاب 这本书 / ممتع 有趣）', answerExample: 'هذا الكتاب' },
    ],
  },
  [Language.Chinese]: {
    [CEFRLevel.A1]: [
      { id: 'zh-a1-1', template: '我是___。', hint: '填你的职业（如 学生 / 老师）', answerExample: '学生' },
      { id: 'zh-a1-2', template: '我喜欢___。', hint: '填你喜欢的事物（如 音乐 / 小狗）', answerExample: '音乐' },
      { id: 'zh-a1-3', template: '这是我的___。', hint: '填一件物品（如 书 / 手机）', answerExample: '书' },
      { id: 'zh-a1-4', template: '我早餐吃___。', hint: '填早餐食物（如 面包 / 鸡蛋）', answerExample: '面包' },
      { id: 'zh-a1-5', template: '我叫___。', hint: '填你的名字', answerExample: '小明' },
      { id: 'zh-a1-6', template: '我来自___。', hint: '填你的国家（如 中国 / 美国）', answerExample: '中国' },
    ],
    [CEFRLevel.A2]: [
      { id: 'zh-a2-1', template: '昨天，我和___一起___。', hint: '前填人，后填做的事（如 朋友 / 看电影）', answerExample: '朋友' },
      { id: 'zh-a2-2', template: '我最喜欢的___是___，因为___。', hint: '类别 / 事物 / 原因（如 食物 / 披萨 / 好吃）', answerExample: '食物' },
      { id: 'zh-a2-3', template: '我通常早上___，但今天我___。', hint: '日常 / 今天不同（如 八点吃早餐 / 吃得晚）', answerExample: '八点吃早餐' },
      { id: 'zh-a2-4', template: '如果有时间，我会___。', hint: '填计划（如 去看奶奶）', answerExample: '去看奶奶' },
      { id: 'zh-a2-5', template: '我觉得___很___。', hint: '事物 / 评价（如 这本书 / 有趣）', answerExample: '这本书' },
    ],
  },
};

// 情境库：通用（不绑语言），按等级。给中文情境，让学习者用目标语言写 1-3 句。
export interface GuidedPrompt {
  text: string;
  register: WritingRegister;
}
export const GUIDED_PROMPTS: Partial<Record<CEFRLevel, GuidedPrompt[]>> = {
  [CEFRLevel.A1]: [
    { text: '用目标语言介绍你自己：叫什么、是哪国人。', register: 'casual' },
    { text: '用目标语言说一样你喜欢的食物。', register: 'casual' },
    { text: '用目标语言说说你今天早上做了什么。', register: 'casual' },
    { text: '用目标语言描述你房间里的一件东西在哪里。', register: 'casual' },
    { text: '用目标语言说说你的一个爱好。', register: 'casual' },
    { text: '用目标语言说现在几点、你正在做什么。', register: 'casual' },
    { text: '用目标语言介绍你的一位朋友：叫什么、是哪国人。', register: 'casual' },
  ],
  [CEFRLevel.A2]: [
    { text: '用目标语言描述你上个周末做了什么（用过去时）。', register: 'neutral' },
    { text: '用目标语言说说你明天的计划。', register: 'neutral' },
    { text: '用目标语言比较你喜欢的两种食物。', register: 'neutral' },
    { text: '用目标语言描述你的日常作息（至少三句）。', register: 'neutral' },
  ],
  [CEFRLevel.B1]: [
    { text: '用目标语言描述一次让你印象深刻的旅行经历（至少三句，用过去时）。', register: 'polite' },
    { text: '用目标语言说明你支持或反对某件事的理由（给出至少两个理由）。', register: 'polite' },
    { text: '用目标语言讲述你学会某件重要事情的过程（起因、经过、结果）。', register: 'polite' },
  ],
  [CEFRLevel.B2]: [
    { text: '用目标语言就一个社会话题阐述你的立场，正反两面都要涉及（至少四句）。', register: 'formal' },
    { text: '用目标语言写一封正式邮件，申请一个职位或项目，说明你的资历与动机。', register: 'business' },
    { text: '用目标语言评论最近的一部作品或事件，给出有深度的看法（至少四句）。', register: 'formal' },
  ],
};

// 引导练习按 CEFR 等级的默认语体（任务未显式指定 register 时使用）
export const GUIDED_DEFAULT_REGISTER: Record<CEFRLevel, WritingRegister> = {
  [CEFRLevel.A1]: 'casual',
  [CEFRLevel.A2]: 'neutral',
  [CEFRLevel.B1]: 'polite',
  [CEFRLevel.B2]: 'formal',
  [CEFRLevel.C1]: 'formal',
  [CEFRLevel.C2]: 'formal',
};

export function getGuidedTemplate(lang: Language, level: CEFRLevel): GuidedTemplate | null {
  const list = GUIDED_TEMPLATES[lang]?.[level];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function getGuidedPrompt(level: CEFRLevel): GuidedPrompt {
  const list = GUIDED_PROMPTS[level] ?? GUIDED_PROMPTS[CEFRLevel.A1] ?? [];
  if (list.length === 0) return { text: '用目标语言写一句话描述你现在的心情。', register: 'casual' };
  return list[Math.floor(Math.random() * list.length)];
}

export function hasGuidedTemplates(lang: Language, level: CEFRLevel): boolean {
  const list = GUIDED_TEMPLATES[lang]?.[level];
  return !!list && list.length > 0;
}
