import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：TOPIK I 初级核心语法（AI 生成等价版）
// - 韩语初级语法点（TOPIK I，约 CEFR A1），按功能单元组织。
// - 中文解释（glossLanguage = Chinese），pattern = 句型，variations = 活用/形式。
// - 例句「韩语 + 中文翻译」（요 体礼貌语）。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 10 单元 × 5 语法点 = 50 个语法点。
// ============================================================

export const TOPIK_GRAMMAR_BUILTIN_ID = 'builtin-topik-basic-grammar';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Unit 1 · 기본 문형（基本句式）',
    items: [
      { type: 'grammar', prompt: '-입니다 / -습니다', answer: '敬语体终结词尾：입니다 接名词，습니다/ㅂ니다 接动词形容词。', pattern: '名词 + 입니다／动词·形容词 + 습니다/ㅂ니다', variations: ['학생입니다', '갑니다', '먹습니다'], examples: ['저는 학생입니다.（我是学生。）', '학교에 갑니다.（去学校。）'] },
      { type: 'grammar', prompt: '-은/는（主题）', answer: '主题助词：有收音用 은，无收音用 는，提示话题。', pattern: 'N + 은/는 + 谓语', variations: ['저는', '오늘은'], examples: ['저는 한국 사람이에요.（我是韩国人。）'] },
      { type: 'grammar', prompt: '-이/가（主语）', answer: '主语助词：有收音用 이，无收音用 가。', pattern: 'N + 이/가', variations: ['날씨가', '책이'], examples: ['날씨가 좋아요.（天气好。）'] },
      { type: 'grammar', prompt: '-을/를（宾语）', answer: '宾语助词：有收音用 을，无收音用 를。', pattern: 'N + 을/를 + 动词', variations: ['책을', '물을'], examples: ['책을 읽어요.（读书。）'] },
      { type: 'grammar', prompt: '-에（时间/地点）', answer: '表时间点、存在场所、方向。', pattern: 'N + 에', variations: ['일곱 시에', '집에'], examples: ['일곱 시에 일어나요.（七点起床。）', '집에 있어요.（在家。）'] },
    ],
  },
  {
    title: 'Unit 2 · 조사（助词）',
    items: [
      { type: 'grammar', prompt: '-에서（场所）', answer: '表动作发生地「在」。', pattern: 'N + 에서 + 动词', variations: ['도서관에서', '회사에서'], examples: ['도서관에서 공부해요.（在图书馆学习。）'] },
      { type: 'grammar', prompt: '-로/으로（方向/工具）', answer: '表方向、工具「用/朝」：有收音（除ㄹ）用 으로，无收音或ㄹ 收音用 로。', pattern: 'N + 로/으로', variations: ['지하철로', '연필로'], examples: ['지하철로 가요.（坐地铁去。）'] },
      { type: 'grammar', prompt: '-와/과（和）', answer: '并列助词「和」：无收音用 와，有收音用 과。', pattern: 'N + 와/과 + N', variations: ['친구와', '책과'], examples: ['친구와 놀아요.（和朋友玩。）'] },
      { type: 'grammar', prompt: '-부터（起点）', answer: '表起点「从」。', pattern: 'N + 부터', variations: ['아홉 시부터', '집부터'], examples: ['아홉 시부터 일해요.（九点开始工作。）'] },
      { type: 'grammar', prompt: '-까지（终点）', answer: '表终点「到」，常与 부터 呼应。', pattern: 'N + 까지', variations: ['다섯 시까지', '역까지'], examples: ['다섯 시까지 일해요.（工作到五点。）'] },
    ],
  },
  {
    title: 'Unit 3 · 과거（过去）',
    items: [
      { type: 'grammar', prompt: '-았/었습니다', answer: '过去敬语体：词干末元音 ㅏ/ㅗ 用 았，其它用 었。', pattern: '动词·形容词 + 았/었습니다', variations: ['봤습니다', '먹었습니다'], examples: ['어제 영화를 봤습니다.（昨天看了电影。）'] },
      { type: 'grammar', prompt: '-았/었어요', answer: '过去 요 体（口语）。', pattern: '动词·形容词 + 았/었어요', variations: ['봤어요', '먹었어요'], examples: ['벌써 먹었어요.（已经吃过了。）'] },
      { type: 'grammar', prompt: '-고 있다', answer: '表正在进行的动作（进行体）。', pattern: '动词 + 고 있다', variations: ['보고 있어요', '공부하고 있어요'], examples: ['지금 텔레비전을 보고 있어요.（现在正在看电视。）'] },
      { type: 'grammar', prompt: '-은/는 적이 있다', answer: '曾经做过…（经验）。', pattern: '动词过去定语 + 적이 있다', variations: ['간 적이 있어요', '먹은 적이 있어요'], examples: ['한국에 간 적이 있어요.（去过韩国。）'] },
      { type: 'grammar', prompt: '-았/었을 때', answer: '过去时定语 + 时（过去发生的时候）。', pattern: '动词 + 았/었을 때', variations: ['갔을 때', '먹었을 때'], examples: ['한국에 갔을 때 사진을 찍었어요.（去韩国时拍了照。）'] },
    ],
  },
  {
    title: 'Unit 4 · 미래·의지（未来·意志）',
    items: [
      { type: 'grammar', prompt: '-겠습니다', answer: '将来/意志敬语体「要、打算」。', pattern: '动词 + 겠습니다', variations: ['가겠습니다', '하겠습니다'], examples: ['내일 가겠습니다.（明天去。）'] },
      { type: 'grammar', prompt: '-을/ㄹ 거예요', answer: '将来 요 体「将、会」。', pattern: '动词 + 을/ㄹ 거예요', variations: ['올 거예요', '갈 거예요'], examples: ['비가 올 거예요.（要下雨了。）'] },
      { type: 'grammar', prompt: '-고 싶다', answer: '想（做），表愿望。', pattern: '动词 + 고 싶다', variations: ['가고 싶어요', '먹고 싶어요'], examples: ['한국에 가고 싶어요.（想去韩国。）'] },
      { type: 'grammar', prompt: '-을/ㄹ까요?', answer: '提议/询问「…吗？」（共动或征求同意）。', pattern: '动词 + 을/ㄹ까요?', variations: ['먹을까요?', '갈까요?'], examples: ['같이 먹을까요?（一起吃吗？）'] },
      { type: 'grammar', prompt: '-을/ㄹ게요', answer: '承诺/打算「我会…」（说话人意志）。', pattern: '动词 + 을/ㄹ게요', variations: ['할게요', '갈게요'], examples: ['제가 할게요.（我来做。）'] },
    ],
  },
  {
    title: 'Unit 5 · 원인·이유（原因·理由）',
    items: [
      { type: 'grammar', prompt: '-아서/어서', answer: '因为…所以（连接原因，不能用命令/劝诱句）。', pattern: '动词·形容词 + 아서/어서', variations: ['추워서', '먹어서'], examples: ['추워서 코트를 입어요.（因为冷，穿外套。）'] },
      { type: 'grammar', prompt: '-니까', answer: '因为（口语，可用于命令/劝诱）。', pattern: '动词·形容词 + 니까', variations: ['오니까', '비싸니까'], examples: ['비가 오니까 가지 마세요.（因为下雨，别去了。）'] },
      { type: 'grammar', prompt: '-때문에', answer: '因为（接名词，名词后）。', pattern: 'N + 때문에', variations: ['건강 때문에', '비 때문에'], examples: ['건강 때문에 운동해요.（因为健康而运动。）'] },
      { type: 'grammar', prompt: '-그래서', answer: '所以（承接前句理由）。', pattern: '그래서 + 结论', variations: ['그래서 안 가요', '그래서 좋아요'], examples: ['오늘은 일요일이에요. 그래서 학교에 안 가요.（今天是周日，所以不去学校。）'] },
      { type: 'grammar', prompt: '-는데', answer: '转折/背景「…但是、…而」。', pattern: '动词·形容词 + 는데', variations: ['싼데', '먹는데'], examples: ['싼데 안 사요.（虽然便宜却不买。）'] },
    ],
  },
  {
    title: 'Unit 6 · 능력·가능（能力·可能）',
    items: [
      { type: 'grammar', prompt: '-을/ㄹ 수 있다', answer: '能够（做），表能力/可能性。', pattern: '动词 + 을/ㄹ 수 있다', variations: ['말할 수 있어요', '먹을 수 있어요'], examples: ['한국어를 말할 수 있어요.（会说韩语。）'] },
      { type: 'grammar', prompt: '-을/ㄹ 수 없다', answer: '不能（做）。', pattern: '动词 + 을/ㄹ 수 없다', variations: ['마실 수 없어요', '갈 수 없어요'], examples: ['술을 마실 수 없어요.（不能喝酒。）'] },
      { type: 'grammar', prompt: '-을/ㄹ 줄 알다', answer: '会（某项技能）。', pattern: '动词 + 을/ㄹ 줄 알다', variations: ['할 줄 알아요', '탈 줄 알아요'], examples: ['요리를 할 줄 알아요.（会做饭。）'] },
      { type: 'grammar', prompt: '-아/어 보다', answer: '试着（做），表尝试。', pattern: '动词 + 아/어 보다', variations: ['입어 봐요', '먹어 봐요'], examples: ['이 옷을 입어 봐요.（试穿这件衣服。）'] },
      { type: 'grammar', prompt: '-고 싶어 하다', answer: '想（做），表第三人称愿望。', pattern: '动词 + 고 싶어 하다', variations: ['하고 싶어 해요', '먹고 싶어 해요'], examples: ['동생은 게임을 하고 싶어 해요.（弟弟想玩游戏。）'] },
    ],
  },
  {
    title: 'Unit 7 · 시간 관계（时间关系）',
    items: [
      { type: 'grammar', prompt: '-기 전에', answer: '在…之前。', pattern: '动词 + 기 전에', variations: ['자기 전에', '먹기 전에'], examples: ['자기 전에 책을 읽어요.（睡前读书。）'] },
      { type: 'grammar', prompt: '-은/ㄴ 후에', answer: '在…之后。', pattern: '动词过去定语 + 후에', variations: ['먹은 후에', '본 후에'], examples: ['먹은 후에 청소해요.（吃完后打扫。）'] },
      { type: 'grammar', prompt: '-면서', answer: '一边…一边（同时进行）。', pattern: '动词 + 면서', variations: ['들으면서', '보면서'], examples: ['음악을 들으면서 걸어요.（一边听音乐一边走。）'] },
      { type: 'grammar', prompt: '-을/ㄹ 때', answer: '当…的时候。', pattern: '动词 + 을/ㄹ 때', variations: ['먹을 때', '공부할 때'], examples: ['밥을 먹을 때 말하지 마세요.（吃饭时别说话。）'] },
      { type: 'grammar', prompt: '-는 동안', answer: '在…期间（整个时间段）。', pattern: '动词 + 는 동안', variations: ['없는 동안', '자는 동안'], examples: ['엄마가 없는 동안 게임을 해요.（妈妈不在期间玩游戏。）'] },
    ],
  },
  {
    title: 'Unit 8 · 나열（列举）',
    items: [
      { type: 'grammar', prompt: '-고', answer: '连接助词「和、并且」（动作先后/并列）。', pattern: '动词·形容词 + 고', variations: ['먹고', '좋고'], examples: ['밥을 먹고 차를 마셔요.（吃饭然后喝茶。）'] },
      { type: 'grammar', prompt: '-거나', answer: '「或」（列举可选项）。', pattern: '动词·形容词 + 거나', variations: ['읽거나', '보거나'], examples: ['주말에는 책을 읽거나 쇼핑을 해요.（周末读书或购物。）'] },
      { type: 'grammar', prompt: '-도', answer: '「也」（追加相同项）。', pattern: 'N + 도', variations: ['저도', '한국어도'], examples: ['저도 학생이에요.（我也是学生。）'] },
      { type: 'grammar', prompt: '-하고', answer: '「和」（口语并列）。', pattern: 'N + 하고 + N', variations: ['친구하고', '밥하고'], examples: ['친구하고 놀아요.（和朋友玩。）'] },
      { type: 'grammar', prompt: '-는/은 물론', answer: '「不用说…连…也」（递进列举）。', pattern: 'N + 은/는 물론', variations: ['한국어는 물론', '책은 물론'], examples: ['한국어는 물론 영어도 해요.（韩语不用说，英语也会。）'] },
    ],
  },
  {
    title: 'Unit 9 · 대조·전환（对照·转折）',
    items: [
      { type: 'grammar', prompt: '-지만', answer: '「但是」（转折）。', pattern: '动词·形容词 + 지만', variations: ['싸지만', '좋지만'], examples: ['싸지만 좋아요.（便宜但好。）'] },
      { type: 'grammar', prompt: '-는데', answer: '「但是/而」（转折或提供背景）。', pattern: '动词 + 는데／形容词 + ㄴ데/은데', variations: ['맛있는데', '비싼데'], examples: ['맛있는데 너무 비싸요.（好吃但太贵了。）'] },
      { type: 'grammar', prompt: '-아/어도', answer: '「即使…也」（让步）。', pattern: '动词·形容词 + 아/어도', variations: ['비싸도', '먹어도'], examples: ['비싸도 사고 싶어요.（即使贵也想买。）'] },
      { type: 'grammar', prompt: '-으면서', answer: '「一方面…一方面」（同时存在两件事）。', pattern: '动词 + 으면서', variations: ['일하면서', '공부하면서'], examples: ['일하면서 공부해요.（一边工作一边学习。）'] },
      { type: 'grammar', prompt: '-기보다는', answer: '「与其…不如」。', pattern: '动词 + 기보다는', variations: ['쇼핑하기보다는', '먹기보다는'], examples: ['쇼핑하기보다는 집에서 쉬고 싶어요.（与其购物，不如在家休息。）'] },
    ],
  },
  {
    title: 'Unit 10 · 추측·전언（推测·传闻）',
    items: [
      { type: 'grammar', prompt: '-을/ㄹ 것 같다', answer: '「好像、大概」（推测）。', pattern: '动词 + 을/ㄹ 것 같다', variations: ['올 것 같아요', '할 것 같아요'], examples: ['비가 올 것 같아요.（好像要下雨。）'] },
      { type: 'grammar', prompt: '-나 보다', answer: '「看来」（根据所见推测）。', pattern: '动词·形容词 + 나 보다', variations: ['오나 봐요', '좋아하나 봐요'], examples: ['비가 오나 봐요.（看来下雨了。）'] },
      { type: 'grammar', prompt: '-다고 하다', answer: '「听说」（传闻转述）。', pattern: '动词·形容词 + 다고 하다', variations: ['온다고 해요', '좋다고 해요'], examples: ['내일 비가 온다고 해요.（听说明天下雨。）'] },
      { type: 'grammar', prompt: '-은/는 것 같다', answer: '「好像」（现在/过去的推测）。', pattern: '动词 + 는 것 같다／过去 + 은 것 같다', variations: ['온 것 같아요', '하는 것 같아요'], examples: ['누가 온 것 같아요.（好像有人来了。）'] },
      { type: 'grammar', prompt: '-지요?', answer: '「…吧？」（确认/反问，期待对方同意）。', pattern: '动词·形容词 + 지요?', variations: ['좋지요?', '가지요?'], examples: ['날씨가 좋지요?（天气很好吧？）'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（语法点数变化 = 内容更新）
export const TOPIK_GRAMMAR_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildTopikGrammarBook(language: Language): StudyBook {
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
    id: TOPIK_GRAMMAR_BUILTIN_ID,
    title: 'TOPIK I 初级核心语法',
    author: 'AI 生成 · 韩语初级语法精选',
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
