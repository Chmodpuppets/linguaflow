import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：JLPT N5/N4 核心语法（AI 生成等价版）
// - 日语初级语法点（N5/N4，约 CEFR A1），按功能单元组织。
// - 中文解释（glossLanguage = Chinese），pattern = 句型，variations = 活用/形式。
// - 例句「日语 + 中文翻译」。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 10 单元 × 5 语法点 = 50 个语法点。
// ============================================================

export const JLPT_GRAMMAR_BUILTIN_ID = 'builtin-jlpt-n5n4-grammar';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Unit 1 · 基本句式',
    items: [
      { type: 'grammar', prompt: '〜です／〜ます', answer: '礼貌体：です 接名词／形容词，ます 接动词，用于礼貌场合。', pattern: '名词 + です／动词ます形', variations: ['学生です', '行きます'], examples: ['私は学生です。（我是学生。）', '毎日学校へ行きます。（每天去学校。）'] },
      { type: 'grammar', prompt: '〜は（主题）', answer: '主题助词，提示话题（句子的主题）。', pattern: 'N + は + 谓语', variations: ['私は', '今日は'], examples: ['私は日本人です。（我是日本人。）'] },
      { type: 'grammar', prompt: '〜が（主语）', answer: '主语助词，提示主语（新信息／存在／好恶的对象）。', pattern: 'N + が', variations: ['桜が', '猫が'], examples: ['桜がきれいです。（樱花很美。）', '猫が好きです。（喜欢猫。）'] },
      { type: 'grammar', prompt: '〜を（宾语）', answer: '宾语助词，表动作的对象。', pattern: 'N + を + 动词', variations: ['本を', '水を'], examples: ['本を読みます。（读书。）'] },
      { type: 'grammar', prompt: '〜に（时间/场所）', answer: '表时间点、存在场所、方向等。', pattern: 'N + に', variations: ['七時に', '部屋に'], examples: ['七時に起きます。（七点起床。）', '部屋に机があります。（房间里有桌子。）'] },
    ],
  },
  {
    title: 'Unit 2 · 助词',
    items: [
      { type: 'grammar', prompt: '〜で（场所/手段）', answer: '表动作发生地、手段、工具。', pattern: 'N + で + 动词', variations: ['図書館で', '電車で'], examples: ['図書館で勉強します。（在图书馆学习。）', '電車で行きます。（坐电车去。）'] },
      { type: 'grammar', prompt: '〜へ（方向）', answer: '方向助词，表移动的方向。', pattern: 'N + へ + 移动动词', variations: ['学校へ', '日本へ'], examples: ['学校へ行きます。（去学校。）'] },
      { type: 'grammar', prompt: '〜と（和）', answer: '并列助词，表「和、跟」；也用于引用。', pattern: 'N + と + N', variations: ['友達と', '母と'], examples: ['友達と遊びます。（和朋友玩。）'] },
      { type: 'grammar', prompt: '〜から（起点）', answer: '表起点（时间/地点）「从」；也表原因。', pattern: 'N + から', variations: ['九時から', '駅から'], examples: ['九時から仕事です。（九点开始工作。）'] },
      { type: 'grammar', prompt: '〜まで（终点）', answer: '表终点「到」，常与 から 呼应。', pattern: 'N + まで', variations: ['五時まで', '駅まで'], examples: ['五時まで働きます。（工作到五点。）'] },
    ],
  },
  {
    title: 'Unit 3 · て形',
    items: [
      { type: 'grammar', prompt: '〜てください', answer: '请（做某事），礼貌的请求。', pattern: '动词て形 + ください', variations: ['話してください', '待ってください'], examples: ['ゆっくり話してください。（请慢慢说。）'] },
      { type: 'grammar', prompt: '〜ています', answer: '表正在进行的动作或状态的持续。', pattern: '动词て形 + います', variations: ['見ています', '住んでいます'], examples: ['今、テレビを見ています。（现在正在看电视。）', '東京に住んでいます。（住在东京。）'] },
      { type: 'grammar', prompt: '〜てから', answer: '做完…之后（动作先后顺序）。', pattern: '动词て形 + から', variations: ['食べてから', '帰ってから'], examples: ['食べてから出かけます。（吃完后出门。）'] },
      { type: 'grammar', prompt: '〜てもいいです', answer: '可以（做），表许可。', pattern: '动词て形 + もいいです', variations: ['撮ってもいい', '入ってもいい'], examples: ['ここで写真を撮ってもいいです。（可以在这里拍照。）'] },
      { type: 'grammar', prompt: '〜てはいけません', answer: '不可以（做），表禁止。', pattern: '动词て形 + はいけません', variations: ['吸ってはいけません', '入ってはいけません'], examples: ['ここでタバコを吸ってはいけません。（不可以在这里吸烟。）'] },
    ],
  },
  {
    title: 'Unit 4 · 过去',
    items: [
      { type: 'grammar', prompt: '〜ました', answer: '动词过去礼貌体（ます → ました）。', pattern: '动词ます形（过去）', variations: ['見ました', '食べました'], examples: ['昨日、映画を見ました。（昨天看了电影。）'] },
      { type: 'grammar', prompt: '〜た形', answer: '动词过去/完成形（普通体），也用于作定语、接续。', pattern: '动词た形', variations: ['食べた', '行った'], examples: ['もう食べた。（已经吃过了。）'] },
      { type: 'grammar', prompt: '〜たことがあります', answer: '曾经做过…（经验）。', pattern: '动词た形 + ことがあります', variations: ['行ったことがあります', '食べたことがあります'], examples: ['日本へ行ったことがあります。（去过日本。）'] },
      { type: 'grammar', prompt: '〜かったです', answer: 'い形容词过去（去い + かった）。', pattern: 'い形容词（去い）+ かったです', variations: ['暑かった', '楽しかった'], examples: ['昨日は暑かったです。（昨天很热。）'] },
      { type: 'grammar', prompt: '〜でした', answer: '名词／な形容词的过去礼貌体。', pattern: '名词／な形容词 + でした', variations: ['休みでした', '静かでした'], examples: ['昨日は休みでした。（昨天休息。）'] },
    ],
  },
  {
    title: 'Unit 5 · 愿望·意志',
    items: [
      { type: 'grammar', prompt: '〜たいです', answer: '想（做），表第一人称愿望。', pattern: '动词ます形（去ます）+ たいです', variations: ['行きたいです', '食べたいです'], examples: ['日本へ行きたいです。（想去日本。）'] },
      { type: 'grammar', prompt: '〜ましょう', answer: '一起…吧，表劝诱／邀请。', pattern: '动词ます形（去ます）+ ましょう', variations: ['食べましょう', '行きましょう'], examples: ['一緒に食べましょう。（一起吃吧。）'] },
      { type: 'grammar', prompt: '〜つもりです', answer: '打算（做），表计划／意图。', pattern: '动词辞书形 + つもりです', variations: ['行くつもりです', '買うつもりです'], examples: ['来年、日本へ行くつもりです。（打算明年去日本。）'] },
      { type: 'grammar', prompt: '〜がほしいです', answer: '想要（东西），表对物品的愿望。', pattern: '名词 + がほしいです', variations: ['携帯がほしい', '車がほしい'], examples: ['新しい携帯がほしいです。（想要新手机。）'] },
      { type: 'grammar', prompt: '〜てほしいです', answer: '希望（别人）做，表对他人的愿望。', pattern: '动词て形 + ほしいです', variations: ['手伝ってほしい', '来てほしい'], examples: ['手伝ってほしいです。（希望你能帮忙。）'] },
    ],
  },
  {
    title: 'Unit 6 · 原因·理由',
    items: [
      { type: 'grammar', prompt: '〜から', answer: '因为（主观理由），语气直接。', pattern: '句子 + から', variations: ['寒いから', '忙しいから'], examples: ['寒いから、コートを着ます。（因为冷，所以穿外套。）'] },
      { type: 'grammar', prompt: '〜ので', answer: '因为（客观/礼貌理由），语气更委婉。', pattern: '句子（普通体）+ ので', variations: ['雨なので', '用事があるので'], examples: ['雨なので、行きません。（因为下雨，所以不去。）'] },
      { type: 'grammar', prompt: '〜ため（に）', answer: '为了（目的）；也表原因。', pattern: '名词の／动词辞书形 + ため', variations: ['健康のために', '行くために'], examples: ['健康のために運動します。（为了健康而运动。）'] },
      { type: 'grammar', prompt: '〜だから', answer: '所以（承接前句的理由）。', pattern: 'だから + 结论', variations: ['だから、休みです', 'だから、行きません'], examples: ['今日は日曜日です。だから、学校は休みです。（今天是周日，所以学校放假。）'] },
      { type: 'grammar', prompt: '〜のに', answer: '明明…却（逆接，含意外/不满）。', pattern: '句子（普通体）+ のに', variations: ['安いのに', '勉強したのに'], examples: ['安いのに、買いません。（虽然便宜却不买。）'] },
    ],
  },
  {
    title: 'Unit 7 · 能力·可能',
    items: [
      { type: 'grammar', prompt: '〜ことができます', answer: '能够（做），表能力／可能性。', pattern: '动词辞书形 + ことができます', variations: ['話すことができます', '泳ぐことができます'], examples: ['日本語を話すことができます。（会说日语。）'] },
      { type: 'grammar', prompt: '〜ができます', answer: '会（名词 + できます），表技能。', pattern: '名词 + ができます', variations: ['料理ができます', '運転ができます'], examples: ['料理ができます。（会做饭。）'] },
      { type: 'grammar', prompt: '可能形', answer: '动词可能形（〜える／〜れる），表能力。', pattern: '动词可能形', variations: ['読めます', '食べられます'], examples: ['漢字が読めます。（会读汉字。）'] },
      { type: 'grammar', prompt: '〜ながら', answer: '一边…一边（同时进行两个动作）。', pattern: '动词ます形（去ます）+ ながら', variations: ['聞きながら', '歩きながら'], examples: ['音楽を聞きながら歩きます。（一边听音乐一边走。）'] },
      { type: 'grammar', prompt: '〜てみます', answer: '试着（做），表尝试。', pattern: '动词て形 + みます', variations: ['着てみます', '食べてみます'], examples: ['この服を着てみます。（试穿这件衣服。）'] },
    ],
  },
  {
    title: 'Unit 8 · 时间关系',
    items: [
      { type: 'grammar', prompt: '〜前に', answer: '在…之前。', pattern: '动词辞书形 + 前に', variations: ['寝る前に', '食べる前に'], examples: ['寝る前に本を読みます。（睡前读书。）'] },
      { type: 'grammar', prompt: '〜後で', answer: '在…之后。', pattern: '动词た形 + 後で', variations: ['食べた後で', '帰った後で'], examples: ['食べた後で、掃除します。（吃完后打扫。）'] },
      { type: 'grammar', prompt: '〜とき', answer: '当…的时候。', pattern: '动词普通形 + とき', variations: ['行ったとき', '食べるとき'], examples: ['日本へ行ったとき、写真を撮りました。（去日本时拍了照。）'] },
      { type: 'grammar', prompt: '〜までに', answer: '在…之前（期限内完成）。', pattern: '时间 + までに', variations: ['五時までに', '来週までに'], examples: ['五時までに帰ります。（五点前回来。）'] },
      { type: 'grammar', prompt: '〜あいだ', answer: '在…期间（整个时间段内）。', pattern: '动词て形 + いるあいだ', variations: ['いないあいだ', '寝ているあいだ'], examples: ['母がいないあいだ、ゲームをします。（妈妈不在期间玩游戏。）'] },
    ],
  },
  {
    title: 'Unit 9 · 列举',
    items: [
      { type: 'grammar', prompt: '〜たり〜たり', answer: '列举动作（又…又…，举例）。', pattern: '动词た形 + り + 动词た形 + り + します', variations: ['読んだり、買い物したり', '歌ったり、踊ったり'], examples: ['休みの日は、本を読んだり、買い物をしたりします。（休息日读读书、买买东西。）'] },
      { type: 'grammar', prompt: '〜し〜し', answer: '列举理由（又…又…，多个理由）。', pattern: '普通形 + し + 普通形 + し', variations: ['安いし、おいしいし', '近いし、静かだし'], examples: ['この店は安いし、おいしいし、人気があります。（这家店又便宜又好吃，很受欢迎。）'] },
      { type: 'grammar', prompt: '〜や〜など', answer: '列举（…和…等等，举例未尽）。', pattern: '名词 + や + 名词 + など', variations: ['果物や野菜など', '本や雑誌など'], examples: ['果物や野菜などを買いました。（买了水果和蔬菜等。）'] },
      { type: 'grammar', prompt: '〜か〜か', answer: '选择（…还是…）。', pattern: 'A か B か', variations: ['コーヒーか紅茶か', '行くか行かないか'], examples: ['コーヒーか紅茶か、どちらにしますか。（咖啡还是红茶，选哪个？）'] },
      { type: 'grammar', prompt: '〜とか', answer: '列举（…啦…啦，口语）。', pattern: '名词 + とか + 名词', variations: ['本を読むとか', '寝るとか'], examples: ['休みは、本を読むとか、寝るとかします。（休息就是看书啦、睡觉啦。）'] },
    ],
  },
  {
    title: 'Unit 10 · 推测·传闻',
    items: [
      { type: 'grammar', prompt: '〜でしょう', answer: '推测「大概…吧」（语气较肯定）。', pattern: '普通形 + でしょう', variations: ['雨でしょう', '来るでしょう'], examples: ['明日は雨でしょう。（明天大概会下雨吧。）'] },
      { type: 'grammar', prompt: '〜かもしれません', answer: '也许（不确定的推测）。', pattern: '普通形 + かもしれません', variations: ['来ないかもしれません', 'あるかもしれません'], examples: ['彼は来ないかもしれません。（他也许不来。）'] },
      { type: 'grammar', prompt: '〜そうです（传闻）', answer: '听说…（传闻）。', pattern: '普通形 + そうです', variations: ['降るそうです', '行ったそうです'], examples: ['明日は雨が降るそうです。（听说明天会下雨。）'] },
      { type: 'grammar', prompt: '〜ようです', answer: '好像（根据感觉/依据判断）。', pattern: '普通形 + ようです', variations: ['来たようです', '好きなようです'], examples: ['誰か来たようです。（好像有人来了。）'] },
      { type: 'grammar', prompt: '〜らしいです', answer: '似乎…（传闻/推断）。', pattern: '普通形 + らしいです', variations: ['学生らしいです', '雨らしいです'], examples: ['彼は学生らしいです。（他似乎是学生。）'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（语法点数变化 = 内容更新）
export const JLPT_GRAMMAR_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildJlptGrammarBook(language: Language): StudyBook {
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
    id: JLPT_GRAMMAR_BUILTIN_ID,
    title: 'JLPT N5/N4 核心语法',
    author: 'AI 生成 · 日语初级语法精选',
    language,
    glossLanguage: Language.Chinese,
    type: 'grammar',
    level: CEFRLevel.A1,
    source: 'built-in',
    chapters,
    totalItems: total,
    completedItems: 0,
    masteredItems: 0,
    createdAt: Date.now(),
  };
}
