import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：English Phrasal Verbs in Use（AI 生成等价版）
// - 中级英语短语动词（B1），按核心动词分组，与 Michael McCarthy /
//   Felicity O'Dell 《English Phrasal Verbs in Use》理念同构。
// - phrase 类型 item：prompt = 短语动词（原形），answer = 中文释义，
//   partOfSpeech = 'phrasal verb'，collocations = 搭配，examples = 例句。
// - 例句尽量含短语原形（cloze 挖空友好）。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 10 单元 × 5 短语 = 50 个短语动词。
// ============================================================

export const PHRASAL_BUILTIN_ID = 'builtin-english-phrasal-verbs';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Unit 1 · break',
    items: [
      { type: 'phrase', prompt: 'break down', answer: '（机器）出故障；崩溃；（关系/谈判）破裂', partOfSpeech: 'phrasal verb', examples: ['Cars can break down without warning on a long trip.'], collocations: ['break down completely', 'break down into tears'] },
      { type: 'phrase', prompt: 'break up', answer: '分手；散开；结束', partOfSpeech: 'phrasal verb', examples: ['They decided to break up after two years together.'], collocations: ['break up with someone', 'break up a fight'] },
      { type: 'phrase', prompt: 'break into', answer: '闯入；突然开始（笑/唱/哭）', partOfSpeech: 'phrasal verb', examples: ['Thieves tried to break into the house last night.'], collocations: ['break into a house', 'break into a smile'] },
      { type: 'phrase', prompt: 'break out', answer: '（战争/火灾）爆发；逃出', partOfSpeech: 'phrasal verb', examples: ['War can break out when talks fail.'], collocations: ['break out of prison', 'fire breaks out'] },
      { type: 'phrase', prompt: 'break off', answer: '折断；中断（谈判/关系）', partOfSpeech: 'phrasal verb', examples: ['The two sides decided to break off negotiations.'], collocations: ['break off talks', 'break off a piece'] },
    ],
  },
  {
    title: 'Unit 2 · get',
    items: [
      { type: 'phrase', prompt: 'get along (with)', answer: '与…相处融洽；进展', partOfSpeech: 'phrasal verb', examples: ['Do you get along with your coworkers?'], collocations: ['get along well with', 'get along fine'] },
      { type: 'phrase', prompt: 'get over', answer: '从…恢复（疾病/失恋）；克服', partOfSpeech: 'phrasal verb', examples: ['It took her a month to get over the flu.'], collocations: ['get over an illness', 'get over a breakup'] },
      { type: 'phrase', prompt: 'get rid of', answer: '摆脱；除掉', partOfSpeech: 'phrasal verb', examples: ['We need to get rid of these old boxes.'], collocations: ['get rid of clutter', 'get rid of stress'] },
      { type: 'phrase', prompt: 'get by', answer: '勉强过活；应付过去', partOfSpeech: 'phrasal verb', examples: ['They manage to get by on a small salary.'], collocations: ['get by on', 'just get by'] },
      { type: 'phrase', prompt: 'get away', answer: '逃走；离开去度假', partOfSpeech: 'phrasal verb', examples: ['The thief managed to get away before the police arrived.'], collocations: ['get away from', 'get away with it'] },
    ],
  },
  {
    title: 'Unit 3 · take',
    items: [
      { type: 'phrase', prompt: 'take off', answer: '起飞；脱下；突然成功', partOfSpeech: 'phrasal verb', examples: ['The plane will take off in ten minutes.'], collocations: ['take off your coat', 'business takes off'] },
      { type: 'phrase', prompt: 'take up', answer: '开始（爱好）；占据（时间/空间）', partOfSpeech: 'phrasal verb', examples: ['She decided to take up yoga this year.'], collocations: ['take up a hobby', 'take up too much space'] },
      { type: 'phrase', prompt: 'take over', answer: '接管；取代', partOfSpeech: 'phrasal verb', examples: ['The new manager will take over next month.'], collocations: ['take over a company', 'take over the role'] },
      { type: 'phrase', prompt: 'take after', answer: '（长相/性格）像（长辈）', partOfSpeech: 'phrasal verb', examples: ['He takes after his father in looks.'], collocations: ['take after your mother', 'really take after'] },
      { type: 'phrase', prompt: 'take on', answer: '承担；雇用；呈现', partOfSpeech: 'phrasal verb', examples: ['She agreed to take on more responsibility.'], collocations: ['take on a challenge', 'take on new staff'] },
    ],
  },
  {
    title: 'Unit 4 · put',
    items: [
      { type: 'phrase', prompt: 'put off', answer: '推迟；使反感', partOfSpeech: 'phrasal verb', examples: ['Do not put off until tomorrow what you can do today.'], collocations: ['put off a meeting', 'put off doing'] },
      { type: 'phrase', prompt: 'put up with', answer: '忍受；容忍', partOfSpeech: 'phrasal verb', examples: ['I cannot put up with this noise any longer.'], collocations: ['put up with behavior', 'cannot put up with'] },
      { type: 'phrase', prompt: 'put on', answer: '穿上；上演；增加（体重）', partOfSpeech: 'phrasal verb', examples: ['Put on your coat before you go out.'], collocations: ['put on weight', 'put on a show'] },
      { type: 'phrase', prompt: 'put away', answer: '收起；存（钱）', partOfSpeech: 'phrasal verb', examples: ['Please put away your toys after playing.'], collocations: ['put away the dishes', 'put away savings'] },
      { type: 'phrase', prompt: 'put out', answer: '熄灭；发布；使不便', partOfSpeech: 'phrasal verb', examples: ['Firefighters worked hard to put out the fire.'], collocations: ['put out a fire', 'put out a statement'] },
    ],
  },
  {
    title: 'Unit 5 · come',
    items: [
      { type: 'phrase', prompt: 'come across', answer: '偶然遇到；发现；给人…印象', partOfSpeech: 'phrasal verb', examples: ['I came across an old photo in the drawer.'], collocations: ['come across as', 'come across a problem'] },
      { type: 'phrase', prompt: 'come up with', answer: '想出（主意/方案）', partOfSpeech: 'phrasal verb', examples: ['We need to come up with a better plan.'], collocations: ['come up with an idea', 'come up with a solution'] },
      { type: 'phrase', prompt: 'come back', answer: '回来；重新流行', partOfSpeech: 'phrasal verb', examples: ['Short skirts seem to come back into fashion.'], collocations: ['come back home', 'come back into fashion'] },
      { type: 'phrase', prompt: 'come down', answer: '下降；下来；降落', partOfSpeech: 'phrasal verb', examples: ['Prices are expected to come down next year.'], collocations: ['come down with a cold', 'prices come down'] },
      { type: 'phrase', prompt: 'come apart', answer: '散架；破裂；崩溃', partOfSpeech: 'phrasal verb', examples: ['The cheap toy started to come apart in his hands.'], collocations: ['come apart at the seams', 'come apart easily'] },
    ],
  },
  {
    title: 'Unit 6 · go',
    items: [
      { type: 'phrase', prompt: 'go on', answer: '继续；发生', partOfSpeech: 'phrasal verb', examples: ['Please go on with your story.'], collocations: ['go on with', 'go on for hours'] },
      { type: 'phrase', prompt: 'go off', answer: '（闹钟/炸弹）响/爆炸；变质', partOfSpeech: 'phrasal verb', examples: ['My alarm goes off at six every morning.'], collocations: ['alarm goes off', 'milk goes off'] },
      { type: 'phrase', prompt: 'go through', answer: '经历；仔细检查；用完', partOfSpeech: 'phrasal verb', examples: ['She went through a difficult time last year.'], collocations: ['go through a hard time', 'go through the files'] },
      { type: 'phrase', prompt: 'go out', answer: '外出（社交）；熄灭；（灯）灭', partOfSpeech: 'phrasal verb', examples: ['They like to go out for dinner on Fridays.'], collocations: ['go out with someone', 'the lights go out'] },
      { type: 'phrase', prompt: 'go with', answer: '与…相配；选择；伴随', partOfSpeech: 'phrasal verb', examples: ['This tie goes well with your shirt.'], collocations: ['go with the flow', 'go well with'] },
    ],
  },
  {
    title: 'Unit 7 · look',
    items: [
      { type: 'phrase', prompt: 'look after', answer: '照顾；照看', partOfSpeech: 'phrasal verb', examples: ['Can you look after my cat while I am away?'], collocations: ['look after children', 'look after yourself'] },
      { type: 'phrase', prompt: 'look up', answer: '查阅；好转；看望', partOfSpeech: 'phrasal verb', examples: ['You can look up the word in a dictionary.'], collocations: ['look up a word', 'things look up'] },
      { type: 'phrase', prompt: 'look forward to', answer: '期待；盼望', partOfSpeech: 'phrasal verb', examples: ['I look forward to hearing from you.'], collocations: ['look forward to + noun/-ing', 'really look forward to'] },
      { type: 'phrase', prompt: 'look into', answer: '调查；研究', partOfSpeech: 'phrasal verb', examples: ['The police promised to look into the matter.'], collocations: ['look into a problem', 'look into the possibility'] },
      { type: 'phrase', prompt: 'look out', answer: '当心；注意；向外看', partOfSpeech: 'phrasal verb', examples: ['Look out! There is a car coming.'], collocations: ['look out for', 'look out of the window'] },
    ],
  },
  {
    title: 'Unit 8 · turn',
    items: [
      { type: 'phrase', prompt: 'turn on', answer: '打开（电器/水龙头）', partOfSpeech: 'phrasal verb', examples: ['Could you turn on the light, please?'], collocations: ['turn on the TV', 'turn on the tap'] },
      { type: 'phrase', prompt: 'turn off', answer: '关掉（电器/水龙头）', partOfSpeech: 'phrasal verb', examples: ['Remember to turn off the lights before leaving.'], collocations: ['turn off the computer', 'turn off the gas'] },
      { type: 'phrase', prompt: 'turn down', answer: '调低（音量）；拒绝', partOfSpeech: 'phrasal verb', examples: ['Please turn down the music, it is too loud.'], collocations: ['turn down an offer', 'turn down the volume'] },
      { type: 'phrase', prompt: 'turn up', answer: '出现；调高（音量）', partOfSpeech: 'phrasal verb', examples: ['He finally turned up an hour late.'], collocations: ['turn up late', 'turn up the volume'] },
      { type: 'phrase', prompt: 'turn into', answer: '变成；转变成', partOfSpeech: 'phrasal verb', examples: ['The caterpillar will turn into a butterfly.'], collocations: ['turn into something', 'turn into a nightmare'] },
    ],
  },
  {
    title: 'Unit 9 · make',
    items: [
      { type: 'phrase', prompt: 'make up', answer: '编造；和解；化妆；组成', partOfSpeech: 'phrasal verb', examples: ['He made up an excuse for being late.'], collocations: ['make up a story', 'make up with someone'] },
      { type: 'phrase', prompt: 'make out', answer: '辨认出；理解；声称', partOfSpeech: 'phrasal verb', examples: ['I could barely make out the sign in the fog.'], collocations: ['make out the words', 'cannot make out'] },
      { type: 'phrase', prompt: 'make up for', answer: '弥补；补偿', partOfSpeech: 'phrasal verb', examples: ['Nothing can make up for lost time.'], collocations: ['make up for lost time', 'make up for a mistake'] },
      { type: 'phrase', prompt: 'make off with', answer: '偷走；卷走', partOfSpeech: 'phrasal verb', examples: ['The robbers made off with all the cash.'], collocations: ['make off with the money', 'make off with goods'] },
      { type: 'phrase', prompt: 'make do with', answer: '将就；凑合着用', partOfSpeech: 'phrasal verb', examples: ['We had to make do with what we had.'], collocations: ['make do with less', 'make do without'] },
    ],
  },
  {
    title: 'Unit 10 · give',
    items: [
      { type: 'phrase', prompt: 'give up', answer: '放弃；戒掉', partOfSpeech: 'phrasal verb', examples: ['You should not give up on your dreams.'], collocations: ['give up smoking', 'give up on'] },
      { type: 'phrase', prompt: 'give in', answer: '屈服；让步；上交', partOfSpeech: 'phrasal verb', examples: ['He refused to give in to pressure.'], collocations: ['give in to temptation', 'give in your homework'] },
      { type: 'phrase', prompt: 'give away', answer: '赠送；泄露（秘密）', partOfSpeech: 'phrasal verb', examples: ['She gave away all her old books.'], collocations: ['give away a secret', 'give away free samples'] },
      { type: 'phrase', prompt: 'give out', answer: '分发；用完；发出', partOfSpeech: 'phrasal verb', examples: ['They gave out flyers at the station.'], collocations: ['give out prizes', 'energy gives out'] },
      { type: 'phrase', prompt: 'give back', answer: '归还；回报', partOfSpeech: 'phrasal verb', examples: ['Please give back the book when you finish.'], collocations: ['give back the money', 'give back to the community'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（短语数变化 = 内容更新）
export const PHRASAL_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildEnglishPhrasalVerbsBook(language: Language): StudyBook {
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
    id: PHRASAL_BUILTIN_ID,
    title: 'English Phrasal Verbs in Use',
    author: 'AI 生成 · B1 中级短语动词精选',
    language,
    glossLanguage: Language.Chinese,
    type: 'phrases',
    level: CEFRLevel.B1,
    source: 'built-in',
    chapters,
    totalItems: total,
    completedItems: 0,
    masteredItems: 0,
    createdAt: Date.now(),
  };
}
