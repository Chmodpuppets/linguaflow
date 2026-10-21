import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：TOPIK I 初级核心词汇（AI 生成等价版）
// - 韩语初级高频词（TOPIK I，约 CEFR A1），按主题组织。
// - 中文释义（glossLanguage = Chinese）；韩语谚文自带读音，无需额外注音。
// - 例句「韩语 + 中文翻译」（요 体礼貌语）。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 10 主题 × 5 词 = 50 词。
// ============================================================

export const TOPIK_VOCAB_BUILTIN_ID = 'builtin-topik-basic-vocabulary';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Unit 1 · 시간（时间）',
    items: [
      { type: 'word', prompt: '오늘', answer: '今天', partOfSpeech: '名词', examples: ['오늘은 날씨가 좋아요.（今天天气很好。）'] },
      { type: 'word', prompt: '내일', answer: '明天', partOfSpeech: '名词', examples: ['내일은 쉬어요.（明天休息。）'] },
      { type: 'word', prompt: '어제', answer: '昨天', partOfSpeech: '名词', examples: ['어제 영화를 봤어요.（昨天看了电影。）'] },
      { type: 'word', prompt: '지금', answer: '现在', partOfSpeech: '名词／副词', examples: ['지금 뭐 해요?（现在做什么？）'] },
      { type: 'word', prompt: '오전', answer: '上午', partOfSpeech: '名词', examples: ['오전에 수업이 있어요.（上午有课。）'] },
    ],
  },
  {
    title: 'Unit 2 · 가족（家人）',
    items: [
      { type: 'word', prompt: '가족', answer: '家人；家庭', partOfSpeech: '名词', examples: ['우리 가족은 네 명이에요.（我们家有四口人。）'] },
      { type: 'word', prompt: '엄마', answer: '妈妈', partOfSpeech: '名词', examples: ['엄마는 요리를 잘해요.（妈妈做菜很好。）'] },
      { type: 'word', prompt: '아빠', answer: '爸爸', partOfSpeech: '名词', examples: ['아빠는 회사원이에요.（爸爸是公司职员。）'] },
      { type: 'word', prompt: '오빠', answer: '哥哥（女性称）', partOfSpeech: '名词', examples: ['오빠는 대학생이에요.（哥哥是大学生。）'] },
      { type: 'word', prompt: '동생', answer: '弟弟／妹妹', partOfSpeech: '名词', examples: ['동생은 아직 초등학생이에요.（弟弟／妹妹还是小学生。）'] },
    ],
  },
  {
    title: 'Unit 3 · 학교（学校）',
    items: [
      { type: 'word', prompt: '학교', answer: '学校', partOfSpeech: '名词', examples: ['학교는 역 근처에 있어요.（学校在车站附近。）'] },
      { type: 'word', prompt: '선생님', answer: '老师', partOfSpeech: '名词', examples: ['선생님은 한국어를 가르쳐요.（老师教韩语。）'] },
      { type: 'word', prompt: '학생', answer: '学生', partOfSpeech: '名词', examples: ['저는 한국어 학생이에요.（我是韩语学生。）'] },
      { type: 'word', prompt: '공부', answer: '学习', partOfSpeech: '名词／动词', examples: ['매일 한국어를 공부해요.（每天学韩语。）'] },
      { type: 'word', prompt: '숙제', answer: '作业', partOfSpeech: '名词', examples: ['오늘 숙제가 많아요.（今天作业很多。）'] },
    ],
  },
  {
    title: 'Unit 4 · 음식（食物）',
    items: [
      { type: 'word', prompt: '음식', answer: '食物', partOfSpeech: '名词', examples: ['좋아하는 음식이 뭐예요?（喜欢的食物是什么？）'] },
      { type: 'word', prompt: '물', answer: '水', partOfSpeech: '名词', examples: ['물 한 잔 주세요.（请给我一杯水。）'] },
      { type: 'word', prompt: '밥', answer: '米饭；饭', partOfSpeech: '名词', examples: ['아침밥을 먹었어요.（吃了早饭。）'] },
      { type: 'word', prompt: '고기', answer: '肉', partOfSpeech: '名词', examples: ['이 집 고기는 맛있어요.（这家店的肉很好吃。）'] },
      { type: 'word', prompt: '야채', answer: '蔬菜', partOfSpeech: '名词', examples: ['야채를 많이 먹어요.（吃很多蔬菜。）'] },
    ],
  },
  {
    title: 'Unit 5 · 동사①（动作）',
    items: [
      { type: 'word', prompt: '먹다', answer: '吃', partOfSpeech: '动词', examples: ['매일 아침 빵을 먹어요.（每天早上吃面包。）'] },
      { type: 'word', prompt: '마시다', answer: '喝', partOfSpeech: '动词', examples: ['커피를 마셔요.（喝咖啡。）'] },
      { type: 'word', prompt: '가다', answer: '去', partOfSpeech: '动词', examples: ['학교에 가요.（去学校。）'] },
      { type: 'word', prompt: '오다', answer: '来', partOfSpeech: '动词', examples: ['친구가 집에 와요.（朋友来家里。）'] },
      { type: 'word', prompt: '보다', answer: '看', partOfSpeech: '动词', examples: ['텔레비전을 봐요.（看电视。）'] },
    ],
  },
  {
    title: 'Unit 6 · 동사②（交流）',
    items: [
      { type: 'word', prompt: '듣다', answer: '听', partOfSpeech: '动词', examples: ['음악을 들어요.（听音乐。）'] },
      { type: 'word', prompt: '말하다', answer: '说', partOfSpeech: '动词', examples: ['한국어로 말해요.（用韩语说。）'] },
      { type: 'word', prompt: '읽다', answer: '读', partOfSpeech: '动词', examples: ['책을 읽어요.（读书。）'] },
      { type: 'word', prompt: '쓰다', answer: '写', partOfSpeech: '动词', examples: ['편지를 써요.（写信。）'] },
      { type: 'word', prompt: '사다', answer: '买', partOfSpeech: '动词', examples: ['빵을 사요.（买面包。）'] },
    ],
  },
  {
    title: 'Unit 7 · 형용사①（描述）',
    items: [
      { type: 'word', prompt: '크다', answer: '大的', partOfSpeech: '形容词', examples: ['큰 집에 살고 싶어요.（想住大房子。）'] },
      { type: 'word', prompt: '작다', answer: '小的', partOfSpeech: '形容词', examples: ['작은 고양이가 있어요.（有一只小猫。）'] },
      { type: 'word', prompt: '새롭다', answer: '新的', partOfSpeech: '形容词', examples: ['새 휴대폰을 샀어요.（买了新手机。）'] },
      { type: 'word', prompt: '오래되다', answer: '旧的；老的', partOfSpeech: '形容词', examples: ['이것은 오래된 사진이에요.（这是老照片。）'] },
      { type: 'word', prompt: '높다', answer: '高的', partOfSpeech: '形容词', examples: ['이 산은 높아요.（这座山很高。）'] },
    ],
  },
  {
    title: 'Unit 8 · 형용사②（感觉）',
    items: [
      { type: 'word', prompt: '싸다', answer: '便宜的', partOfSpeech: '形容词', examples: ['이 가게는 싸요.（这家店很便宜。）'] },
      { type: 'word', prompt: '덥다', answer: '热的', partOfSpeech: '形容词', examples: ['오늘은 아주 더워요.（今天很热。）'] },
      { type: 'word', prompt: '춥다', answer: '冷的', partOfSpeech: '形容词', examples: ['겨울은 추워요.（冬天很冷。）'] },
      { type: 'word', prompt: '바쁘다', answer: '忙的', partOfSpeech: '形容词', examples: ['이번 주는 바빠요.（这周很忙。）'] },
      { type: 'word', prompt: '재미있다', answer: '有趣的', partOfSpeech: '形容词', examples: ['여행은 재미있어요.（旅行很有趣。）'] },
    ],
  },
  {
    title: 'Unit 9 · 장소·교통（场所·交通）',
    items: [
      { type: 'word', prompt: '역', answer: '车站', partOfSpeech: '名词', examples: ['역까지 걸어서 오 분이에요.（走到车站五分钟。）'] },
      { type: 'word', prompt: '지하철', answer: '地铁', partOfSpeech: '名词', examples: ['지하철로 회사에 가요.（坐地铁去公司。）'] },
      { type: 'word', prompt: '가게', answer: '店', partOfSpeech: '名词', examples: ['이 가게는 유명해요.（这家店很有名。）'] },
      { type: 'word', prompt: '병원', answer: '医院', partOfSpeech: '名词', examples: ['병원에 가요.（去医院。）'] },
      { type: 'word', prompt: '공원', answer: '公园', partOfSpeech: '名词', examples: ['공원에서 놀아요.（在公园玩。）'] },
    ],
  },
  {
    title: 'Unit 10 · 일상（日常）',
    items: [
      { type: 'word', prompt: '친구', answer: '朋友', partOfSpeech: '名词', examples: ['친구하고 식사해요.（和朋友吃饭。）'] },
      { type: 'word', prompt: '시간', answer: '时间', partOfSpeech: '名词', examples: ['시간이 없어요.（没有时间。）'] },
      { type: 'word', prompt: '날씨', answer: '天气', partOfSpeech: '名词', examples: ['오늘 날씨가 좋아요.（今天天气好。）'] },
      { type: 'word', prompt: '일', answer: '工作；事情', partOfSpeech: '名词', examples: ['일이 바빠요.（工作很忙。）'] },
      { type: 'word', prompt: '돈', answer: '钱', partOfSpeech: '名词', examples: ['돈이 부족해요.（钱不够。）'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（词数变化 = 内容更新）
export const TOPIK_VOCAB_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildTopikVocabularyBook(language: Language): StudyBook {
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
    id: TOPIK_VOCAB_BUILTIN_ID,
    title: 'TOPIK I 初级核心词汇',
    author: 'AI 生成 · 韩语初级词汇精选',
    language,
    glossLanguage: Language.Chinese,
    type: 'vocabulary',
    level: CEFRLevel.A1,
    source: 'built-in',
    chapters,
    totalItems: total,
    completedItems: 0,
    masteredItems: 0,
    createdAt: Date.now(),
  };
}
