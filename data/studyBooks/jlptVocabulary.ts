import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：JLPT N5/N4 核心词汇（AI 生成等价版）
// - 日语初级高频词（N5/N4，约 CEFR A1），按主题组织。
// - 中文释义（glossLanguage = Chinese），假名注音放 pronunciation。
// - 例句「日语 + 中文翻译」：让中文母语学习者能理解语境。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 10 主题 × 5 词 = 50 词。
// ============================================================

export const JLPT_VOCAB_BUILTIN_ID = 'builtin-jlpt-n5n4-vocabulary';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Unit 1 · 时间',
    items: [
      { type: 'word', prompt: '今日', pronunciation: 'きょう', answer: '今天', partOfSpeech: '名词', examples: ['今日はいい天気です。（今天天气很好。）'] },
      { type: 'word', prompt: '明日', pronunciation: 'あした', answer: '明天', partOfSpeech: '名词', examples: ['明日は休みです。（明天休息。）'] },
      { type: 'word', prompt: '昨日', pronunciation: 'きのう', answer: '昨天', partOfSpeech: '名词', examples: ['昨日、映画を見ました。（昨天看了电影。）'] },
      { type: 'word', prompt: '今週', pronunciation: 'こんしゅう', answer: '这周', partOfSpeech: '名词', examples: ['今週はとても忙しいです。（这周很忙。）'] },
      { type: 'word', prompt: '来年', pronunciation: 'らいねん', answer: '明年', partOfSpeech: '名词', examples: ['来年、日本へ行きます。（明年去日本。）'] },
    ],
  },
  {
    title: 'Unit 2 · 家族',
    items: [
      { type: 'word', prompt: '家族', pronunciation: 'かぞく', answer: '家人；家庭', partOfSpeech: '名词', examples: ['家族は四人です。（家里有四口人。）'] },
      { type: 'word', prompt: '母', pronunciation: 'はは', answer: '母亲（称自己的）', partOfSpeech: '名词', examples: ['母は料理が上手です。（妈妈做菜很好。）'] },
      { type: 'word', prompt: '父', pronunciation: 'ちち', answer: '父亲（称自己的）', partOfSpeech: '名词', examples: ['父は会社員です。（爸爸是公司职员。）'] },
      { type: 'word', prompt: '兄', pronunciation: 'あに', answer: '哥哥（称自己的）', partOfSpeech: '名词', examples: ['兄は大学生です。（哥哥是大学生。）'] },
      { type: 'word', prompt: '妹', pronunciation: 'いもうと', answer: '妹妹（称自己的）', partOfSpeech: '名词', examples: ['妹はまだ小学生です。（妹妹还是小学生。）'] },
    ],
  },
  {
    title: 'Unit 3 · 学校',
    items: [
      { type: 'word', prompt: '学校', pronunciation: 'がっこう', answer: '学校', partOfSpeech: '名词', examples: ['学校は駅の近くにあります。（学校在车站附近。）'] },
      { type: 'word', prompt: '先生', pronunciation: 'せんせい', answer: '老师', partOfSpeech: '名词', examples: ['田中先生は日本語を教えます。（田中老师教日语。）'] },
      { type: 'word', prompt: '学生', pronunciation: 'がくせい', answer: '学生', partOfSpeech: '名词', examples: ['私は日本語の学生です。（我是日语学生。）'] },
      { type: 'word', prompt: '勉強', pronunciation: 'べんきょう', answer: '学习', partOfSpeech: '名词／动词', examples: ['毎日、日本語を勉強します。（每天学日语。）'] },
      { type: 'word', prompt: '宿題', pronunciation: 'しゅくだい', answer: '作业', partOfSpeech: '名词', examples: ['今日の宿題は多いです。（今天的作业很多。）'] },
    ],
  },
  {
    title: 'Unit 4 · 食べ物',
    items: [
      { type: 'word', prompt: '食べ物', pronunciation: 'たべもの', answer: '食物', partOfSpeech: '名词', examples: ['好きな食べ物は何ですか。（喜欢的食物是什么？）'] },
      { type: 'word', prompt: '水', pronunciation: 'みず', answer: '水', partOfSpeech: '名词', examples: ['水を一杯ください。（请给我一杯水。）'] },
      { type: 'word', prompt: 'ご飯', pronunciation: 'ごはん', answer: '米饭；饭', partOfSpeech: '名词', examples: ['朝ご飯を食べました。（吃了早饭。）'] },
      { type: 'word', prompt: '肉', pronunciation: 'にく', answer: '肉', partOfSpeech: '名词', examples: ['この店の肉はおいしいです。（这家店的肉很好吃。）'] },
      { type: 'word', prompt: '野菜', pronunciation: 'やさい', answer: '蔬菜', partOfSpeech: '名词', examples: ['野菜をたくさん食べます。（吃很多蔬菜。）'] },
    ],
  },
  {
    title: 'Unit 5 · 動詞①（动作）',
    items: [
      { type: 'word', prompt: '食べる', pronunciation: 'たべる', answer: '吃', partOfSpeech: '动词（他动）', examples: ['毎朝パンを食べる。（每天早上吃面包。）'] },
      { type: 'word', prompt: '飲む', pronunciation: 'のむ', answer: '喝', partOfSpeech: '动词（他动）', examples: ['コーヒーを飲む。（喝咖啡。）'] },
      { type: 'word', prompt: '行く', pronunciation: 'いく', answer: '去', partOfSpeech: '动词（自动）', examples: ['学校へ行く。（去学校。）'] },
      { type: 'word', prompt: '来る', pronunciation: 'くる', answer: '来', partOfSpeech: '动词（自动）', examples: ['友達が家に来る。（朋友来家里。）'] },
      { type: 'word', prompt: '見る', pronunciation: 'みる', answer: '看', partOfSpeech: '动词（他动）', examples: ['テレビを見る。（看电视。）'] },
    ],
  },
  {
    title: 'Unit 6 · 動詞②（交流）',
    items: [
      { type: 'word', prompt: '聞く', pronunciation: 'きく', answer: '听；问', partOfSpeech: '动词（他动）', examples: ['音楽を聞く。（听音乐。）'] },
      { type: 'word', prompt: '話す', pronunciation: 'はなす', answer: '说；交谈', partOfSpeech: '动词（他动）', examples: ['日本語で話す。（用日语说。）'] },
      { type: 'word', prompt: '読む', pronunciation: 'よむ', answer: '读', partOfSpeech: '动词（他动）', examples: ['本を読む。（读书。）'] },
      { type: 'word', prompt: '書く', pronunciation: 'かく', answer: '写', partOfSpeech: '动词（他动）', examples: ['手紙を書く。（写信。）'] },
      { type: 'word', prompt: '買う', pronunciation: 'かう', answer: '买', partOfSpeech: '动词（他动）', examples: ['パンを買う。（买面包。）'] },
    ],
  },
  {
    title: 'Unit 7 · 形容詞①（描述）',
    items: [
      { type: 'word', prompt: '大きい', pronunciation: 'おおきい', answer: '大的', partOfSpeech: '形容词（い）', examples: ['大きい家に住みたいです。（想住大房子。）'] },
      { type: 'word', prompt: '小さい', pronunciation: 'ちいさい', answer: '小的', partOfSpeech: '形容词（い）', examples: ['小さい猫がいます。（有一只小猫。）'] },
      { type: 'word', prompt: '新しい', pronunciation: 'あたらしい', answer: '新的', partOfSpeech: '形容词（い）', examples: ['新しい携帯を買いました。（买了新手机。）'] },
      { type: 'word', prompt: '古い', pronunciation: 'ふるい', answer: '旧的；老的', partOfSpeech: '形容词（い）', examples: ['これは古い写真です。（这是老照片。）'] },
      { type: 'word', prompt: '高い', pronunciation: 'たかい', answer: '高的；贵的', partOfSpeech: '形容词（い）', examples: ['この山は高いです。（这座山很高。）'] },
    ],
  },
  {
    title: 'Unit 8 · 形容詞②（感觉）',
    items: [
      { type: 'word', prompt: '安い', pronunciation: 'やすい', answer: '便宜的', partOfSpeech: '形容词（い）', examples: ['この店は安いです。（这家店很便宜。）'] },
      { type: 'word', prompt: '暑い', pronunciation: 'あつい', answer: '热的', partOfSpeech: '形容词（い）', examples: ['今日はとても暑いです。（今天很热。）'] },
      { type: 'word', prompt: '寒い', pronunciation: 'さむい', answer: '冷的', partOfSpeech: '形容词（い）', examples: ['冬は寒いです。（冬天很冷。）'] },
      { type: 'word', prompt: '忙しい', pronunciation: 'いそがしい', answer: '忙的', partOfSpeech: '形容词（い）', examples: ['今週は忙しいです。（这周很忙。）'] },
      { type: 'word', prompt: '楽しい', pronunciation: 'たのしい', answer: '开心的', partOfSpeech: '形容词（い）', examples: ['旅行は楽しいです。（旅行很开心。）'] },
    ],
  },
  {
    title: 'Unit 9 · 場所・交通',
    items: [
      { type: 'word', prompt: '駅', pronunciation: 'えき', answer: '车站', partOfSpeech: '名词', examples: ['駅まで歩いて五分です。（走到车站五分钟。）'] },
      { type: 'word', prompt: '電車', pronunciation: 'でんしゃ', answer: '电车', partOfSpeech: '名词', examples: ['電車で会社へ行きます。（坐电车去公司。）'] },
      { type: 'word', prompt: '店', pronunciation: 'みせ', answer: '店', partOfSpeech: '名词', examples: ['この店は有名です。（这家店很有名。）'] },
      { type: 'word', prompt: '病院', pronunciation: 'びょういん', answer: '医院', partOfSpeech: '名词', examples: ['病院へ行きます。（去医院。）'] },
      { type: 'word', prompt: '公園', pronunciation: 'こうえん', answer: '公园', partOfSpeech: '名词', examples: ['公園で遊びます。（在公园玩。）'] },
    ],
  },
  {
    title: 'Unit 10 · 日常',
    items: [
      { type: 'word', prompt: '友達', pronunciation: 'ともだち', answer: '朋友', partOfSpeech: '名词', examples: ['友達と食事をします。（和朋友吃饭。）'] },
      { type: 'word', prompt: '時間', pronunciation: 'じかん', answer: '时间', partOfSpeech: '名词', examples: ['時間がありません。（没有时间。）'] },
      { type: 'word', prompt: '天気', pronunciation: 'てんき', answer: '天气', partOfSpeech: '名词', examples: ['今日の天気はいいです。（今天天气好。）'] },
      { type: 'word', prompt: '仕事', pronunciation: 'しごと', answer: '工作', partOfSpeech: '名词', examples: ['仕事が忙しいです。（工作很忙。）'] },
      { type: 'word', prompt: 'お金', pronunciation: 'おかね', answer: '钱', partOfSpeech: '名词', examples: ['お金が足りません。（钱不够。）'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（词数变化 = 内容更新）
export const JLPT_VOCAB_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildJlptVocabularyBook(language: Language): StudyBook {
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
    id: JLPT_VOCAB_BUILTIN_ID,
    title: 'JLPT N5/N4 核心词汇',
    author: 'AI 生成 · 日语初级词汇精选',
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
