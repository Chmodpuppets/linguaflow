import { uuid } from '../../utils/uuid';

import { Language, CEFRLevel, StudyBook, StudyChapter, StudyItem } from '../../types';

// ============================================================
// 内置学习书：Key Words for Fluency（AI 生成等价版）
// - 高频多用途词汇（B1 水平），按主题组织，与 George Woolard
//   《Key Words for Fluency》的「关键词 + 搭配」理念同构。
// - 静态数据：零等待、无 AI key 也能学；随应用发布，内容已 review。
// - 21 主题 × 10 词 = 210 词（完整主题结构；每主题精选核心词）。
// ============================================================

export const KEYWORDS_BUILTIN_ID = 'builtin-keywords-for-fluency';

type RawItem = Omit<StudyItem, 'id' | 'box' | 'dueDate' | 'reviews' | 'lapses'>;

interface RawChapter {
  title: string;
  items: RawItem[];
}

const RAW_CHAPTERS: RawChapter[] = [
  {
    title: 'Time · 时间',
    items: [
      { type: 'word', prompt: 'eventually', answer: '最终；最后', examples: ['Eventually, she realized she had been wrong all along.'], partOfSpeech: 'adverb', collocations: ['eventually + verb', 'eventually lead to'] },
      { type: 'word', prompt: 'gradually', answer: '逐渐地；慢慢地', examples: ['The pain gradually disappeared over a few days.'], partOfSpeech: 'adverb', collocations: ['gradually improve', 'gradually increase'] },
      { type: 'word', prompt: 'recently', answer: '最近；近来', examples: ['Have you seen any good films recently?'], partOfSpeech: 'adverb', collocations: ['recently + past participle', 'until recently'] },
      { type: 'word', prompt: 'frequently', answer: '频繁地；经常', examples: ['He frequently travels abroad for work.'], partOfSpeech: 'adverb', collocations: ['frequently asked', 'occur frequently'] },
      { type: 'word', prompt: 'occasionally', answer: '偶尔；间或', examples: ['We occasionally go out for dinner on Fridays.'], partOfSpeech: 'adverb', collocations: ['occasionally + verb', 'very occasionally'] },
      { type: 'word', prompt: 'constantly', answer: '不断地；总是', examples: ['She is constantly checking her phone.'], partOfSpeech: 'adverb', collocations: ['constantly changing', 'constantly + verb'] },
      { type: 'word', prompt: 'currently', answer: '目前；当前', examples: ['The company is currently hiring new staff.'], partOfSpeech: 'adverb', collocations: ['currently + present participle', 'currently available'] },
      { type: 'word', prompt: 'previously', answer: '先前；之前', examples: ['The building was previously used as a school.'], partOfSpeech: 'adverb', collocations: ['previously + past participle', 'as previously mentioned'] },
      { type: 'word', prompt: 'instantly', answer: '立即；瞬间', examples: ['The news spread instantly across the internet.'], partOfSpeech: 'adverb', collocations: ['instantly recognizable', 'almost instantly'] },
      { type: 'word', prompt: 'simultaneously', answer: '同时地', examples: ['The two events happened simultaneously.'], partOfSpeech: 'adverb', collocations: ['occur simultaneously', 'simultaneously with'] },
    ],
  },
  {
    title: 'Distance · 距离',
    items: [
      { type: 'word', prompt: 'distant', answer: '遥远的；远方的', examples: ['We could hear distant thunder.'], partOfSpeech: 'adjective', collocations: ['distant future', 'a distant relative'] },
      { type: 'word', prompt: 'remote', answer: '偏远的；遥远的', examples: ['They live in a remote mountain village.'], partOfSpeech: 'adjective', collocations: ['remote area', 'remote control'] },
      { type: 'word', prompt: 'nearby', answer: '附近的；在附近', examples: ['We stayed at a nearby hotel.'], partOfSpeech: 'adjective', collocations: ['nearby town', 'somewhere nearby'] },
      { type: 'word', prompt: 'adjacent', answer: '毗邻的；相邻的', examples: ['The hotel is adjacent to the train station.'], partOfSpeech: 'adjective', collocations: ['adjacent to', 'adjacent rooms'] },
      { type: 'word', prompt: 'isolated', answer: '孤立的；偏远的', examples: ['The village was isolated by heavy snow.'], partOfSpeech: 'adjective', collocations: ['isolated community', 'feel isolated'] },
      { type: 'word', prompt: 'apart', answer: '分开；相隔', examples: ['The two cities are 200 kilometers apart.'], partOfSpeech: 'adverb', collocations: ['miles apart', 'far apart'] },
      { type: 'word', prompt: 'within reach', answer: '触手可及；够得着', examples: ['The remote control was within reach on the table.'], partOfSpeech: 'phrase', collocations: ['within easy reach', 'within reach of'] },
      { type: 'word', prompt: 'out of reach', answer: '够不着；达不到', examples: ['Keep medicines out of reach of children.'], partOfSpeech: 'phrase', collocations: ['out of reach of', 'just out of reach'] },
      { type: 'word', prompt: 'far-flung', answer: '遥远的；分布广的', examples: ['The company has offices in far-flung corners of the world.'], partOfSpeech: 'adjective', collocations: ['far-flung places', 'far-flung regions'] },
      { type: 'word', prompt: 'in the distance', answer: '在远处', examples: ['We could see a ship in the distance.'], partOfSpeech: 'phrase', collocations: ['vanish in the distance', 'loom in the distance'] },
    ],
  },
  {
    title: 'Size · 大小',
    items: [
      { type: 'word', prompt: 'considerable', answer: '相当大的；可观的', examples: ['The project required a considerable amount of time.'], partOfSpeech: 'adjective', collocations: ['a considerable amount', 'considerable interest'] },
      { type: 'word', prompt: 'enormous', answer: '巨大的；庞大的', examples: ['The new stadium is enormous.'], partOfSpeech: 'adjective', collocations: ['enormous pressure', 'enormous potential'] },
      { type: 'word', prompt: 'slight', answer: '轻微的；微小的', examples: ['There was a slight delay at the airport.'], partOfSpeech: 'adjective', collocations: ['a slight change', 'a slight difference'] },
      { type: 'word', prompt: 'substantial', answer: '大量的；实质的', examples: ['They made a substantial profit last year.'], partOfSpeech: 'adjective', collocations: ['substantial improvement', 'substantial amounts'] },
      { type: 'word', prompt: 'vast', answer: '广阔的；巨大的', examples: ['The Sahara is a vast desert.'], partOfSpeech: 'adjective', collocations: ['a vast majority', 'vast amounts'] },
      { type: 'word', prompt: 'significant', answer: '重要的；显著的', examples: ['There has been a significant increase in sales.'], partOfSpeech: 'adjective', collocations: ['significant difference', 'significant impact'] },
      { type: 'word', prompt: 'excessive', answer: '过度的；过多的', examples: ['Excessive drinking can damage your health.'], partOfSpeech: 'adjective', collocations: ['excessive amounts', 'excessive use'] },
      { type: 'word', prompt: 'negligible', answer: '微不足道的；可忽略的', examples: ['The cost of repairs was negligible.'], partOfSpeech: 'adjective', collocations: ['negligible impact', 'negligible effect'] },
      { type: 'word', prompt: 'massive', answer: '巨大的；大规模的', examples: ['The company suffered massive losses last quarter.'], partOfSpeech: 'adjective', collocations: ['massive scale', 'massive amounts'] },
      { type: 'word', prompt: 'tiny', answer: '极小的；微小的', examples: ['A tiny crack appeared in the wall.'], partOfSpeech: 'adjective', collocations: ['a tiny fraction', 'tiny details'] },
    ],
  },
  {
    title: 'Shape · 形状',
    items: [
      { type: 'word', prompt: 'circular', answer: '圆形的；循环的', examples: ['The table was circular and seated eight.'], partOfSpeech: 'adjective', collocations: ['circular shape', 'circular route'] },
      { type: 'word', prompt: 'rectangular', answer: '长方形的', examples: ['The room was rectangular and well-lit.'], partOfSpeech: 'adjective', collocations: ['rectangular shape', 'rectangular table'] },
      { type: 'word', prompt: 'curved', answer: '弯曲的；弧形的', examples: ['The road follows a curved path up the hill.'], partOfSpeech: 'adjective', collocations: ['curved surface', 'slightly curved'] },
      { type: 'word', prompt: 'straight', answer: '直的；笔直的', examples: ['Draw a straight line between the two points.'], partOfSpeech: 'adjective', collocations: ['straight line', 'straight hair'] },
      { type: 'word', prompt: 'oval', answer: '椭圆形的', examples: ['She has an oval face.'], partOfSpeech: 'adjective', collocations: ['oval shape', 'oval table'] },
      { type: 'word', prompt: 'spiral', answer: '螺旋形的', examples: ['The staircase winds up in a spiral.'], partOfSpeech: 'adjective', collocations: ['spiral staircase', 'spiral shape'] },
      { type: 'word', prompt: 'symmetrical', answer: '对称的', examples: ["The building's design is perfectly symmetrical."], partOfSpeech: 'adjective', collocations: ['perfectly symmetrical', 'symmetrical pattern'] },
      { type: 'word', prompt: 'irregular', answer: '不规则的；不整齐的', examples: ['The coastline has an irregular shape.'], partOfSpeech: 'adjective', collocations: ['irregular shape', 'irregular pattern'] },
      { type: 'word', prompt: 'flat', answer: '平的；扁平的', examples: ['The area was flat and featureless.'], partOfSpeech: 'adjective', collocations: ['flat surface', 'flat tire'] },
      { type: 'word', prompt: 'round', answer: '圆的；球形的', examples: ['The earth is round, not flat.'], partOfSpeech: 'adjective', collocations: ['round table', 'round face'] },
    ],
  },
  {
    title: 'Age · 年龄',
    items: [
      { type: 'word', prompt: 'elderly', answer: '年长的；上了年纪的', examples: ['An elderly man was sitting on the bench.'], partOfSpeech: 'adjective', collocations: ['elderly people', 'elderly care'] },
      { type: 'word', prompt: 'mature', answer: '成熟的；成年的', examples: ['She is very mature for her age.'], partOfSpeech: 'adjective', collocations: ['mature attitude', 'mature age'] },
      { type: 'word', prompt: 'youthful', answer: '年轻的；有朝气的', examples: ['He still has a youthful appearance.'], partOfSpeech: 'adjective', collocations: ['youthful energy', 'youthful appearance'] },
      { type: 'word', prompt: 'aging', answer: '衰老的；老化的', examples: ['The aging population needs more healthcare.'], partOfSpeech: 'adjective', collocations: ['aging population', 'aging process'] },
      { type: 'word', prompt: 'juvenile', answer: '青少年的；未成年的', examples: ['Juvenile crime has fallen in recent years.'], partOfSpeech: 'adjective', collocations: ['juvenile crime', 'juvenile court'] },
      { type: 'word', prompt: 'senior', answer: '资深的；年长的', examples: ['She is a senior manager at the firm.'], partOfSpeech: 'adjective', collocations: ['senior citizens', 'senior position'] },
      { type: 'word', prompt: 'middle-aged', answer: '中年的', examples: ['A middle-aged couple moved in next door.'], partOfSpeech: 'adjective', collocations: ['middle-aged man', 'middle-aged woman'] },
      { type: 'word', prompt: 'underage', answer: '未成年的', examples: ['It is illegal to sell alcohol to underage customers.'], partOfSpeech: 'adjective', collocations: ['underage drinking', 'underage children'] },
      { type: 'word', prompt: 'timeless', answer: '永恒的；不受时间影响的', examples: ['The novel has a timeless appeal.'], partOfSpeech: 'adjective', collocations: ['timeless classic', 'timeless beauty'] },
      { type: 'word', prompt: 'ancient', answer: '古老的；古代的', examples: ['They visited the ruins of an ancient city.'], partOfSpeech: 'adjective', collocations: ['ancient history', 'ancient civilization'] },
    ],
  },
  {
    title: 'Weather · 天气',
    items: [
      { type: 'word', prompt: 'humid', answer: '潮湿的；湿润的', examples: ['The air was hot and humid.'], partOfSpeech: 'adjective', collocations: ['hot and humid', 'humid climate'] },
      { type: 'word', prompt: 'mild', answer: '温和的；不冷不热的', examples: ['We had a mild winter this year.'], partOfSpeech: 'adjective', collocations: ['mild weather', 'mild climate'] },
      { type: 'word', prompt: 'severe', answer: '严重的；恶劣的', examples: ['Severe weather warnings have been issued.'], partOfSpeech: 'adjective', collocations: ['severe weather', 'severe storm'] },
      { type: 'word', prompt: 'overcast', answer: '阴天的；多云的', examples: ['The sky was overcast all morning.'], partOfSpeech: 'adjective', collocations: ['overcast sky', 'overcast day'] },
      { type: 'word', prompt: 'forecast', answer: '预报；预测', examples: ['The forecast says rain is likely tomorrow.'], partOfSpeech: 'noun', collocations: ['weather forecast', 'forecast predicts'] },
      { type: 'word', prompt: 'drizzle', answer: '毛毛雨；下毛毛雨', examples: ['It was only a light drizzle, so we kept walking.'], partOfSpeech: 'noun', collocations: ['light drizzle', 'steady drizzle'] },
      { type: 'word', prompt: 'scorching', answer: '灼热的；酷热的', examples: ['We walked in the scorching heat of noon.'], partOfSpeech: 'adjective', collocations: ['scorching heat', 'scorching sun'] },
      { type: 'word', prompt: 'freezing', answer: '极冷的；冰冻的', examples: ['It was freezing outside this morning.'], partOfSpeech: 'adjective', collocations: ['freezing cold', 'freezing temperatures'] },
      { type: 'word', prompt: 'breeze', answer: '微风', examples: ['A gentle breeze blew in from the sea.'], partOfSpeech: 'noun', collocations: ['gentle breeze', 'cool breeze'] },
      { type: 'word', prompt: 'climate', answer: '气候', examples: ['The climate here is warm all year round.'], partOfSpeech: 'noun', collocations: ['climate change', 'tropical climate'] },
    ],
  },
  {
    title: 'Sound · 声音',
    items: [
      { type: 'word', prompt: 'deafening', answer: '震耳欲聋的', examples: ['The crowd gave a deafening roar.'], partOfSpeech: 'adjective', collocations: ['deafening noise', 'deafening roar'] },
      { type: 'word', prompt: 'faint', answer: '微弱的；模糊的', examples: ['I heard a faint noise coming from upstairs.'], partOfSpeech: 'adjective', collocations: ['faint sound', 'faint voice'] },
      { type: 'word', prompt: 'audible', answer: '听得见的', examples: ['Her voice was barely audible over the noise.'], partOfSpeech: 'adjective', collocations: ['barely audible', 'clearly audible'] },
      { type: 'word', prompt: 'noisy', answer: '吵闹的；嘈杂的', examples: ['The restaurant was too noisy to talk in.'], partOfSpeech: 'adjective', collocations: ['noisy crowd', 'noisy environment'] },
      { type: 'word', prompt: 'silent', answer: '寂静的；沉默的', examples: ['The house fell silent when the lights went out.'], partOfSpeech: 'adjective', collocations: ['fall silent', 'silent night'] },
      { type: 'word', prompt: 'echo', answer: '回声；回响', examples: ['Her voice echoed through the empty hall.'], partOfSpeech: 'noun', collocations: ['echo through', 'echo back'] },
      { type: 'word', prompt: 'rumble', answer: '隆隆声；低沉的声音', examples: ['We heard the rumble of distant thunder.'], partOfSpeech: 'noun', collocations: ['rumble of thunder', 'low rumble'] },
      { type: 'word', prompt: 'whisper', answer: '低语；耳语', examples: ['They spoke in whispers so as not to wake the baby.'], partOfSpeech: 'noun', collocations: ['in a whisper', 'whisper softly'] },
      { type: 'word', prompt: 'screech', answer: '刺耳的尖叫声', examples: ['The car came to a screeching halt.'], partOfSpeech: 'noun', collocations: ['screech of brakes', 'screeching halt'] },
      { type: 'word', prompt: 'soothing', answer: '抚慰的；舒缓的', examples: ['She played some soothing music to relax.'], partOfSpeech: 'adjective', collocations: ['soothing music', 'soothing voice'] },
    ],
  },
  {
    title: 'Light · 光',
    items: [
      { type: 'word', prompt: 'bright', answer: '明亮的；鲜艳的', examples: ['The room was bright and airy.'], partOfSpeech: 'adjective', collocations: ['bright light', 'bright colors'] },
      { type: 'word', prompt: 'dim', answer: '昏暗的；模糊的', examples: ['The light was too dim to read by.'], partOfSpeech: 'adjective', collocations: ['dim light', 'dim lighting'] },
      { type: 'word', prompt: 'dazzling', answer: '耀眼的；炫目的', examples: ['The sun was dazzling on the white sand.'], partOfSpeech: 'adjective', collocations: ['dazzling sunlight', 'dazzling smile'] },
      { type: 'word', prompt: 'glowing', answer: '发光的；灼热的', examples: ['The embers were still glowing in the fire.'], partOfSpeech: 'adjective', collocations: ['glowing embers', 'glowing review'] },
      { type: 'word', prompt: 'flickering', answer: '闪烁的；摇曳的', examples: ['A flickering candle lit the room.'], partOfSpeech: 'adjective', collocations: ['flickering candle', 'flickering light'] },
      { type: 'word', prompt: 'shadowy', answer: '阴暗的；模糊的', examples: ['A shadowy figure emerged from the doorway.'], partOfSpeech: 'adjective', collocations: ['shadowy figure', 'shadowy corner'] },
      { type: 'word', prompt: 'luminous', answer: '发光的；明亮的', examples: ['The watch has a luminous dial.'], partOfSpeech: 'adjective', collocations: ['luminous dial', 'luminous paint'] },
      { type: 'word', prompt: 'radiant', answer: '光芒四射的；容光焕发的', examples: ['The bride looked radiant on her wedding day.'], partOfSpeech: 'adjective', collocations: ['radiant smile', 'radiant beauty'] },
      { type: 'word', prompt: 'pale', answer: '苍白的；淡的', examples: ['She looked pale after being ill.'], partOfSpeech: 'adjective', collocations: ['pale skin', 'pale light'] },
      { type: 'word', prompt: 'vivid', answer: '鲜明的；生动的', examples: ['The artist used vivid colors in the painting.'], partOfSpeech: 'adjective', collocations: ['vivid colors', 'vivid memory'] },
    ],
  },
  {
    title: 'Touch · 触觉',
    items: [
      { type: 'word', prompt: 'smooth', answer: '光滑的；平滑的', examples: ['The table had a smooth surface.'], partOfSpeech: 'adjective', collocations: ['smooth surface', 'smooth skin'] },
      { type: 'word', prompt: 'rough', answer: '粗糙的；不平的', examples: ['The wall was rough to the touch.'], partOfSpeech: 'adjective', collocations: ['rough surface', 'rough texture'] },
      { type: 'word', prompt: 'tender', answer: '柔软的；温柔的', examples: ['The meat was tender and juicy.'], partOfSpeech: 'adjective', collocations: ['tender meat', 'tender touch'] },
      { type: 'word', prompt: 'sharp', answer: '锋利的；尖的', examples: ['Be careful with that sharp knife.'], partOfSpeech: 'adjective', collocations: ['sharp edge', 'sharp pain'] },
      { type: 'word', prompt: 'delicate', answer: '精致的；脆弱的', examples: ['The delicate fabric tore easily.'], partOfSpeech: 'adjective', collocations: ['delicate fabric', 'delicate skin'] },
      { type: 'word', prompt: 'coarse', answer: '粗糙的；粗的', examples: ['The sack was made of coarse cloth.'], partOfSpeech: 'adjective', collocations: ['coarse cloth', 'coarse sand'] },
      { type: 'word', prompt: 'slippery', answer: '滑的；易滑倒的', examples: ['The road was slippery after the rain.'], partOfSpeech: 'adjective', collocations: ['slippery road', 'slippery surface'] },
      { type: 'word', prompt: 'sticky', answer: '粘的；黏糊糊的', examples: ['The floor was sticky from spilled juice.'], partOfSpeech: 'adjective', collocations: ['sticky fingers', 'sticky surface'] },
      { type: 'word', prompt: 'firm', answer: '坚固的；结实的', examples: ['The mattress was firm but comfortable.'], partOfSpeech: 'adjective', collocations: ['firm grip', 'firm handshake'] },
      { type: 'word', prompt: 'gentle', answer: '轻柔的；温和的', examples: ['She gave the baby a gentle pat.'], partOfSpeech: 'adjective', collocations: ['gentle touch', 'gentle breeze'] },
    ],
  },
  {
    title: 'Taste · 味觉',
    items: [
      { type: 'word', prompt: 'bitter', answer: '苦的；痛苦的', examples: ['The coffee was too bitter without sugar.'], partOfSpeech: 'adjective', collocations: ['bitter taste', 'bitter experience'] },
      { type: 'word', prompt: 'sour', answer: '酸的；馊的', examples: ['The milk had turned sour.'], partOfSpeech: 'adjective', collocations: ['sour taste', 'go sour'] },
      { type: 'word', prompt: 'sweet', answer: '甜的；悦耳的', examples: ['The cake was too sweet for my taste.'], partOfSpeech: 'adjective', collocations: ['sweet taste', 'sweet smell'] },
      { type: 'word', prompt: 'spicy', answer: '辣的；辛辣的', examples: ['The curry was very spicy.'], partOfSpeech: 'adjective', collocations: ['spicy food', 'hot and spicy'] },
      { type: 'word', prompt: 'bland', answer: '清淡的；乏味的', examples: ['The hospital food was bland and boring.'], partOfSpeech: 'adjective', collocations: ['bland food', 'bland taste'] },
      { type: 'word', prompt: 'savory', answer: '咸香的；开胃的', examples: ['The soup had a rich, savory flavor.'], partOfSpeech: 'adjective', collocations: ['savory flavor', 'savory dish'] },
      { type: 'word', prompt: 'tangy', answer: '味道浓烈的；有刺激性的', examples: ['The salad had a tangy lemon dressing.'], partOfSpeech: 'adjective', collocations: ['tangy flavor', 'tangy sauce'] },
      { type: 'word', prompt: 'delicious', answer: '美味的；可口的', examples: ['The homemade pasta was delicious.'], partOfSpeech: 'adjective', collocations: ['absolutely delicious', 'delicious food'] },
      { type: 'word', prompt: 'tasteless', answer: '无味的；没品位的', examples: ['The soup was watery and tasteless.'], partOfSpeech: 'adjective', collocations: ['tasteless food', 'tasteless joke'] },
      { type: 'word', prompt: 'refreshing', answer: '提神的；清爽的', examples: ['A cold drink is refreshing on a hot day.'], partOfSpeech: 'adjective', collocations: ['refreshing drink', 'refreshing change'] },
    ],
  },
  {
    title: 'Smell · 嗅觉',
    items: [
      { type: 'word', prompt: 'fragrant', answer: '芳香的；芬芳的', examples: ['The garden was fragrant with roses.'], partOfSpeech: 'adjective', collocations: ['fragrant flowers', 'fragrant scent'] },
      { type: 'word', prompt: 'pungent', answer: '刺鼻的；辛辣的', examples: ['The cheese had a pungent smell.'], partOfSpeech: 'adjective', collocations: ['pungent smell', 'pungent odor'] },
      { type: 'word', prompt: 'musty', answer: '发霉的；有霉味的', examples: ['The old books had a musty smell.'], partOfSpeech: 'adjective', collocations: ['musty smell', 'musty room'] },
      { type: 'word', prompt: 'stale', answer: '不新鲜的；陈腐的', examples: ['The bread had gone stale.'], partOfSpeech: 'adjective', collocations: ['stale bread', 'stale air'] },
      { type: 'word', prompt: 'aromatic', answer: '芳香的；有香味的', examples: ['The stew was full of aromatic herbs.'], partOfSpeech: 'adjective', collocations: ['aromatic herbs', 'aromatic spices'] },
      { type: 'word', prompt: 'foul', answer: '恶臭的；肮脏的', examples: ['A foul smell came from the drains.'], partOfSpeech: 'adjective', collocations: ['foul smell', 'foul odor'] },
      { type: 'word', prompt: 'scent', answer: '气味；香味', examples: ['The air was filled with the scent of flowers.'], partOfSpeech: 'noun', collocations: ['scent of flowers', 'sweet scent'] },
      { type: 'word', prompt: 'odor', answer: '气味（常指难闻的）', examples: ['An unpleasant odor filled the room.'], partOfSpeech: 'noun', collocations: ['unpleasant odor', 'strong odor'] },
      { type: 'word', prompt: 'whiff', answer: '一阵（气味）；一股', examples: ['A whiff of coffee drifted from the kitchen.'], partOfSpeech: 'noun', collocations: ['a whiff of', 'catch a whiff'] },
      { type: 'word', prompt: 'stench', answer: '恶臭', examples: ['The stench of rotting garbage was unbearable.'], partOfSpeech: 'noun', collocations: ['the stench of', 'overwhelming stench'] },
    ],
  },
  {
    title: 'Color · 颜色',
    items: [
      { type: 'word', prompt: 'vivid', answer: '鲜明的；生动的', examples: ['The sunset painted the sky in vivid colors.'], partOfSpeech: 'adjective', collocations: ['vivid colors', 'vivid imagination'] },
      { type: 'word', prompt: 'pale', answer: '苍白的；淡的', examples: ['She wore a pale blue dress.'], partOfSpeech: 'adjective', collocations: ['pale blue', 'pale complexion'] },
      { type: 'word', prompt: 'vibrant', answer: '充满活力的；鲜艳的', examples: ['The market was full of vibrant colors.'], partOfSpeech: 'adjective', collocations: ['vibrant colors', 'vibrant atmosphere'] },
      { type: 'word', prompt: 'dull', answer: '暗淡的；无光泽的', examples: ['The sky was a dull grey.'], partOfSpeech: 'adjective', collocations: ['dull color', 'dull grey'] },
      { type: 'word', prompt: 'bright', answer: '明亮的；鲜艳的', examples: ['She loves wearing bright colors.'], partOfSpeech: 'adjective', collocations: ['bright red', 'bright colors'] },
      { type: 'word', prompt: 'dark', answer: '暗的；深色的', examples: ['He wore a dark suit to the interview.'], partOfSpeech: 'adjective', collocations: ['dark blue', 'dark hair'] },
      { type: 'word', prompt: 'faded', answer: '褪色的；褪去的', examples: ['The curtains had faded in the sun.'], partOfSpeech: 'adjective', collocations: ['faded color', 'faded jeans'] },
      { type: 'word', prompt: 'glowing', answer: '发光的；灼热的', examples: ['The sign glowed in bright neon colors.'], partOfSpeech: 'adjective', collocations: ['glowing colors', 'glowing light'] },
      { type: 'word', prompt: 'multicolored', answer: '多色的；彩色的', examples: ['The parrot has multicolored feathers.'], partOfSpeech: 'adjective', collocations: ['multicolored lights', 'multicolored pattern'] },
      { type: 'word', prompt: 'translucent', answer: '半透明的', examples: ['The glass was thin and translucent.'], partOfSpeech: 'adjective', collocations: ['translucent material', 'translucent screen'] },
    ],
  },
  {
    title: 'Movement · 移动',
    items: [
      { type: 'word', prompt: 'swift', answer: '迅速的；敏捷的', examples: ['The horse made a swift movement across the field.'], partOfSpeech: 'adjective', collocations: ['swift movement', 'swift action'] },
      { type: 'word', prompt: 'gradual', answer: '逐渐的；渐进的', examples: ['There was a gradual shift in public opinion.'], partOfSpeech: 'adjective', collocations: ['gradual change', 'gradual process'] },
      { type: 'word', prompt: 'abrupt', answer: '突然的；唐突的', examples: ['The car came to an abrupt stop.'], partOfSpeech: 'adjective', collocations: ['abrupt stop', 'abrupt change'] },
      { type: 'word', prompt: 'steady', answer: '稳定的；平稳的', examples: ['He walked at a steady pace.'], partOfSpeech: 'adjective', collocations: ['steady pace', 'steady progress'] },
      { type: 'word', prompt: 'erratic', answer: '不稳定的；无规律的', examples: ['The car moved in an erratic pattern.'], partOfSpeech: 'adjective', collocations: ['erratic movement', 'erratic behavior'] },
      { type: 'word', prompt: 'forward', answer: '向前', examples: ['Take a step forward.'], partOfSpeech: 'adverb', collocations: ['move forward', 'step forward'] },
      { type: 'word', prompt: 'backward', answer: '向后', examples: ['She took a step backward in surprise.'], partOfSpeech: 'adverb', collocations: ['step backward', 'move backward'] },
      { type: 'word', prompt: 'drift', answer: '漂移；漂流', examples: ['The boat drifted slowly down the river.'], partOfSpeech: 'verb', collocations: ['drift away', 'drift apart'] },
      { type: 'word', prompt: 'glide', answer: '滑行；滑翔', examples: ['The skater glided across the ice.'], partOfSpeech: 'verb', collocations: ['glide across', 'glide smoothly'] },
      { type: 'word', prompt: 'wander', answer: '漫游；徘徊', examples: ['We wandered through the old town for hours.'], partOfSpeech: 'verb', collocations: ['wander around', 'wander off'] },
    ],
  },
  {
    title: 'Speed · 速度',
    items: [
      { type: 'word', prompt: 'rapid', answer: '迅速的；快速的', examples: ['The company experienced rapid growth.'], partOfSpeech: 'adjective', collocations: ['rapid growth', 'rapid change'] },
      { type: 'word', prompt: 'instant', answer: '立即的；瞬间的', examples: ['The app gives instant feedback.'], partOfSpeech: 'adjective', collocations: ['instant access', 'instant reply'] },
      { type: 'word', prompt: 'sluggish', answer: '迟缓的；懒散的', examples: ['I felt sluggish after the long flight.'], partOfSpeech: 'adjective', collocations: ['sluggish economy', 'feel sluggish'] },
      { type: 'word', prompt: 'brisk', answer: '轻快的；活跃的', examples: ['We took a brisk walk in the morning air.'], partOfSpeech: 'adjective', collocations: ['brisk walk', 'brisk pace'] },
      { type: 'word', prompt: 'swift', answer: '迅速的；敏捷的', examples: ['They made a swift decision.'], partOfSpeech: 'adjective', collocations: ['swift response', 'swift action'] },
      { type: 'word', prompt: 'steady', answer: '稳定的；平稳的', examples: ['The economy grew at a steady rate.'], partOfSpeech: 'adjective', collocations: ['steady speed', 'steady pace'] },
      { type: 'word', prompt: 'breakneck', answer: '极快的；危险的快', examples: ['They drove at breakneck speed.'], partOfSpeech: 'adjective', collocations: ['breakneck speed', 'breakneck pace'] },
      { type: 'word', prompt: 'leisurely', answer: '从容的；悠闲的', examples: ['We took a leisurely stroll along the beach.'], partOfSpeech: 'adjective', collocations: ['leisurely pace', 'leisurely stroll'] },
      { type: 'word', prompt: 'accelerate', answer: '加速；加快', examples: ['The car accelerated to overtake the truck.'], partOfSpeech: 'verb', collocations: ['accelerate rapidly', 'accelerate growth'] },
      { type: 'word', prompt: 'decelerate', answer: '减速', examples: ['The train decelerated as it approached the station.'], partOfSpeech: 'verb', collocations: ['decelerate rapidly', 'decelerate to'] },
    ],
  },
  {
    title: 'Change · 变化',
    items: [
      { type: 'word', prompt: 'transform', answer: '转变；彻底改变', examples: ['The internet has transformed the way we live.'], partOfSpeech: 'verb', collocations: ['transform into', 'completely transform'] },
      { type: 'word', prompt: 'alter', answer: '改变；修改', examples: ['We had to alter our plans at the last minute.'], partOfSpeech: 'verb', collocations: ['alter the course', 'significantly alter'] },
      { type: 'word', prompt: 'shift', answer: '转变；转移', examples: ['Public opinion has shifted in recent years.'], partOfSpeech: 'verb', collocations: ['shift towards', 'shift the focus'] },
      { type: 'word', prompt: 'fluctuate', answer: '波动；起伏', examples: ['Prices fluctuate according to demand.'], partOfSpeech: 'verb', collocations: ['fluctuate between', 'fluctuate wildly'] },
      { type: 'word', prompt: 'evolve', answer: '演变；进化', examples: ['The company has evolved into a global brand.'], partOfSpeech: 'verb', collocations: ['evolve over time', 'evolve into'] },
      { type: 'word', prompt: 'adapt', answer: '适应；改编', examples: ['It took her a while to adapt to the new job.'], partOfSpeech: 'verb', collocations: ['adapt to', 'adapt quickly'] },
      { type: 'word', prompt: 'modify', answer: '修改；调整', examples: ['We modified the design to reduce costs.'], partOfSpeech: 'verb', collocations: ['slightly modify', 'modify the plan'] },
      { type: 'word', prompt: 'convert', answer: '转换；转变', examples: ['They converted the old factory into apartments.'], partOfSpeech: 'verb', collocations: ['convert into', 'convert to'] },
      { type: 'word', prompt: 'revolutionize', answer: '彻底变革；革命化', examples: ['Smartphones have revolutionized communication.'], partOfSpeech: 'verb', collocations: ['revolutionize the way', 'completely revolutionize'] },
      { type: 'word', prompt: 'deteriorate', answer: '恶化；变坏', examples: ['His health deteriorated rapidly over the winter.'], partOfSpeech: 'verb', collocations: ['deteriorate rapidly', 'deteriorate into'] },
    ],
  },
  {
    title: 'Money · 金钱',
    items: [
      { type: 'word', prompt: 'afford', answer: '负担得起；买得起', examples: ["We can't afford to buy a new car this year."], partOfSpeech: 'verb', collocations: ['afford to', "can't afford"] },
      { type: 'word', prompt: 'invest', answer: '投资；投入', examples: ['She invested all her savings in the stock market.'], partOfSpeech: 'verb', collocations: ['invest in', 'invest heavily'] },
      { type: 'word', prompt: 'budget', answer: '预算', examples: ['The project went over budget.'], partOfSpeech: 'noun', collocations: ['on a budget', 'over budget'] },
      { type: 'word', prompt: 'expense', answer: '开支；费用', examples: ['Travel expenses are covered by the company.'], partOfSpeech: 'noun', collocations: ['at the expense of', 'living expenses'] },
      { type: 'word', prompt: 'revenue', answer: '收入；营收', examples: ["Advertising is the site's main source of revenue."], partOfSpeech: 'noun', collocations: ['generate revenue', 'annual revenue'] },
      { type: 'word', prompt: 'income', answer: '收入', examples: ['She has a steady income from her freelance work.'], partOfSpeech: 'noun', collocations: ['a steady income', 'income tax'] },
      { type: 'word', prompt: 'expenditure', answer: '支出；开销', examples: ['Government expenditure on health has risen.'], partOfSpeech: 'noun', collocations: ['public expenditure', 'cut expenditure'] },
      { type: 'word', prompt: 'savings', answer: '储蓄；存款', examples: ['They used their savings to buy a house.'], partOfSpeech: 'noun', collocations: ['life savings', 'savings account'] },
      { type: 'word', prompt: 'profitable', answer: '盈利的；有利可图的', examples: ['The restaurant is a highly profitable business.'], partOfSpeech: 'adjective', collocations: ['highly profitable', 'profitable business'] },
      { type: 'word', prompt: 'wealth', answer: '财富；财产', examples: ['He accumulated great wealth through his career.'], partOfSpeech: 'noun', collocations: ['great wealth', 'wealth of information'] },
    ],
  },
  {
    title: 'Health · 健康',
    items: [
      { type: 'word', prompt: 'recover', answer: '康复；恢复', examples: ['It took him weeks to recover from the flu.'], partOfSpeech: 'verb', collocations: ['recover from', 'fully recover'] },
      { type: 'word', prompt: 'diagnose', answer: '诊断', examples: ['She was diagnosed with diabetes last year.'], partOfSpeech: 'verb', collocations: ['diagnose with', 'diagnosed early'] },
      { type: 'word', prompt: 'prescribe', answer: '开（药）；规定', examples: ['The doctor prescribed some antibiotics.'], partOfSpeech: 'verb', collocations: ['prescribe medication', 'prescribed by'] },
      { type: 'word', prompt: 'symptom', answer: '症状', examples: ['A sore throat is a common symptom of a cold.'], partOfSpeech: 'noun', collocations: ['common symptom', 'show symptoms'] },
      { type: 'word', prompt: 'treatment', answer: '治疗；处理', examples: ['He is receiving treatment for his back pain.'], partOfSpeech: 'noun', collocations: ['receive treatment', 'medical treatment'] },
      { type: 'word', prompt: 'nutrition', answer: '营养', examples: ["Good nutrition is essential for children's growth."], partOfSpeech: 'noun', collocations: ['poor nutrition', 'proper nutrition'] },
      { type: 'word', prompt: 'fatigue', answer: '疲劳；疲惫', examples: ['She was suffering from extreme fatigue.'], partOfSpeech: 'noun', collocations: ['extreme fatigue', 'signs of fatigue'] },
      { type: 'word', prompt: 'immune', answer: '免疫的；不受影响的', examples: ['Most adults are immune to the disease.'], partOfSpeech: 'adjective', collocations: ['immune system', 'immune to'] },
      { type: 'word', prompt: 'chronic', answer: '慢性的；长期的', examples: ['He suffers from chronic back pain.'], partOfSpeech: 'adjective', collocations: ['chronic pain', 'chronic illness'] },
      { type: 'word', prompt: 'contagious', answer: '传染性的', examples: ['The flu is highly contagious.'], partOfSpeech: 'adjective', collocations: ['highly contagious', 'contagious disease'] },
    ],
  },
  {
    title: 'Mind · 心智',
    items: [
      { type: 'word', prompt: 'perceive', answer: '感知；认为', examples: ['People perceive risk in very different ways.'], partOfSpeech: 'verb', collocations: ['perceive as', 'perceive differently'] },
      { type: 'word', prompt: 'recall', answer: '回忆；想起', examples: ["I don't recall seeing him at the party."], partOfSpeech: 'verb', collocations: ['recall vividly', "can't recall"] },
      { type: 'word', prompt: 'conceive', answer: '构想；设想', examples: ['It is hard to conceive of life without the internet.'], partOfSpeech: 'verb', collocations: ['conceive of', 'conceive the idea'] },
      { type: 'word', prompt: 'comprehend', answer: '理解；领悟', examples: ['She could not comprehend the complexity of the problem.'], partOfSpeech: 'verb', collocations: ['fully comprehend', 'hard to comprehend'] },
      { type: 'word', prompt: 'contemplate', answer: '沉思；考虑', examples: ['He contemplated changing his career.'], partOfSpeech: 'verb', collocations: ['contemplate doing', 'contemplate the idea'] },
      { type: 'word', prompt: 'assume', answer: '假设；认为', examples: ['I assume you have already eaten.'], partOfSpeech: 'verb', collocations: ['assume that', 'assume responsibility'] },
      { type: 'word', prompt: 'deduce', answer: '推断；演绎', examples: ['We can deduce the answer from the evidence.'], partOfSpeech: 'verb', collocations: ['deduce from', 'deduce that'] },
      { type: 'word', prompt: 'imagine', answer: '想象；设想', examples: ['Imagine a world without war.'], partOfSpeech: 'verb', collocations: ['imagine that', 'hard to imagine'] },
      { type: 'word', prompt: 'memorize', answer: '记住；背诵', examples: ['She memorized the poem for the recital.'], partOfSpeech: 'verb', collocations: ['memorize words', 'memorize by heart'] },
      { type: 'word', prompt: 'reason', answer: '推理；思考', examples: ['Humans have the ability to reason.'], partOfSpeech: 'verb', collocations: ['reason logically', 'reason with'] },
    ],
  },
  {
    title: 'Feelings · 感受',
    items: [
      { type: 'word', prompt: 'anxious', answer: '焦虑的；担心的', examples: ['He felt anxious about the job interview.'], partOfSpeech: 'adjective', collocations: ['anxious about', 'feel anxious'] },
      { type: 'word', prompt: 'delighted', answer: '高兴的；愉快的', examples: ['We were delighted with the results.'], partOfSpeech: 'adjective', collocations: ['delighted with', 'delighted to'] },
      { type: 'word', prompt: 'frustrated', answer: '沮丧的；受挫的', examples: ['She was frustrated by the lack of progress.'], partOfSpeech: 'adjective', collocations: ['frustrated with', 'feel frustrated'] },
      { type: 'word', prompt: 'relieved', answer: '如释重负的；宽慰的', examples: ['I was relieved to hear the good news.'], partOfSpeech: 'adjective', collocations: ['relieved to', 'feel relieved'] },
      { type: 'word', prompt: 'overwhelmed', answer: '不知所措的；被压垮的', examples: ['He felt overwhelmed by all the work.'], partOfSpeech: 'adjective', collocations: ['feel overwhelmed', 'overwhelmed by'] },
      { type: 'word', prompt: 'curious', answer: '好奇的', examples: ['Children are naturally curious about the world.'], partOfSpeech: 'adjective', collocations: ['curious about', 'curious to know'] },
      { type: 'word', prompt: 'grateful', answer: '感激的', examples: ["I'm very grateful for your help."], partOfSpeech: 'adjective', collocations: ['grateful for', 'deeply grateful'] },
      { type: 'word', prompt: 'indifferent', answer: '漠不关心的；不感兴趣的', examples: ['He seemed indifferent to her feelings.'], partOfSpeech: 'adjective', collocations: ['indifferent to', 'remain indifferent'] },
      { type: 'word', prompt: 'envious', answer: '羡慕的；嫉妒的', examples: ["She was envious of her friend's success."], partOfSpeech: 'adjective', collocations: ['envious of', 'feel envious'] },
      { type: 'word', prompt: 'content', answer: '满足的；满意的', examples: ['He seemed content with his simple life.'], partOfSpeech: 'adjective', collocations: ['content with', 'feel content'] },
    ],
  },
  {
    title: 'Actions · 行为',
    items: [
      { type: 'word', prompt: 'achieve', answer: '实现；达到', examples: ['She achieved her goal of running a marathon.'], partOfSpeech: 'verb', collocations: ['achieve a goal', 'achieve success'] },
      { type: 'word', prompt: 'attempt', answer: '尝试；企图', examples: ['He attempted to break the world record.'], partOfSpeech: 'verb', collocations: ['attempt to', 'attempt a challenge'] },
      { type: 'word', prompt: 'commit', answer: '承诺；犯（错）', examples: ['She committed herself to the project.'], partOfSpeech: 'verb', collocations: ['commit to', 'commit a crime'] },
      { type: 'word', prompt: 'undertake', answer: '承担；着手做', examples: ['They undertook a major renovation.'], partOfSpeech: 'verb', collocations: ['undertake a task', 'undertake research'] },
      { type: 'word', prompt: 'perform', answer: '执行；表演', examples: ['The team performed well under pressure.'], partOfSpeech: 'verb', collocations: ['perform well', 'perform a task'] },
      { type: 'word', prompt: 'execute', answer: '执行；实施', examples: ['The plan was executed perfectly.'], partOfSpeech: 'verb', collocations: ['execute a plan', 'execute flawlessly'] },
      { type: 'word', prompt: 'accomplish', answer: '完成；达成', examples: ['We accomplished everything we set out to do.'], partOfSpeech: 'verb', collocations: ['accomplish a goal', 'accomplish a task'] },
      { type: 'word', prompt: 'pursue', answer: '追求；从事', examples: ['She decided to pursue a career in medicine.'], partOfSpeech: 'verb', collocations: ['pursue a career', 'pursue a goal'] },
      { type: 'word', prompt: 'abandon', answer: '放弃；抛弃', examples: ['They abandoned the plan due to lack of funds.'], partOfSpeech: 'verb', collocations: ['abandon a plan', 'abandon hope'] },
      { type: 'word', prompt: 'persist', answer: '坚持；持续', examples: ['If you persist, you will eventually succeed.'], partOfSpeech: 'verb', collocations: ['persist with', 'persist in'] },
    ],
  },
  {
    title: 'Success · 成功',
    items: [
      { type: 'word', prompt: 'attain', answer: '达到；获得', examples: ['She attained her highest score this year.'], partOfSpeech: 'verb', collocations: ['attain a goal', 'attain success'] },
      { type: 'word', prompt: 'flourish', answer: '繁荣；茁壮成长', examples: ['The business flourished under her leadership.'], partOfSpeech: 'verb', collocations: ['flourish in', 'continue to flourish'] },
      { type: 'word', prompt: 'thrive', answer: '兴旺；茁壮成长', examples: ['Small businesses can thrive in this area.'], partOfSpeech: 'verb', collocations: ['thrive on', 'thrive in'] },
      { type: 'word', prompt: 'prosper', answer: '繁荣；成功', examples: ['The family prospered after moving to the city.'], partOfSpeech: 'verb', collocations: ['prosper in', 'continue to prosper'] },
      { type: 'word', prompt: 'excel', answer: '擅长；超越', examples: ['She excels at mathematics.'], partOfSpeech: 'verb', collocations: ['excel at', 'excel in'] },
      { type: 'word', prompt: 'succeed', answer: '成功；继任', examples: ['He succeeded in passing the exam.'], partOfSpeech: 'verb', collocations: ['succeed in', 'succeed at'] },
      { type: 'word', prompt: 'triumph', answer: '胜利；成功', examples: ['It was a triumph of determination over adversity.'], partOfSpeech: 'noun', collocations: ['a triumph of', 'triumph over'] },
      { type: 'word', prompt: 'prevail', answer: '获胜；占上风', examples: ['Justice will prevail in the end.'], partOfSpeech: 'verb', collocations: ['prevail over', 'prevail in'] },
      { type: 'word', prompt: 'accomplishment', answer: '成就；完成', examples: ['Winning the award was a great accomplishment.'], partOfSpeech: 'noun', collocations: ['great accomplishment', 'sense of accomplishment'] },
      { type: 'word', prompt: 'milestone', answer: '里程碑；重大事件', examples: ['The launch was a major milestone for the company.'], partOfSpeech: 'noun', collocations: ['major milestone', 'reach a milestone'] },
    ],
  },
];

// 内置书内容版本信号：seed 时据此判断是否需要重建（词数变化 = 内容更新）
export const KEYWORDS_TOTAL_ITEMS = RAW_CHAPTERS.reduce((s, c) => s + c.items.length, 0);

export function buildKeyWordsForFluencyBook(language: Language): StudyBook {
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
    id: KEYWORDS_BUILTIN_ID,
    title: 'Key Words for Fluency',
    author: 'AI 生成 · B1 词汇精选',
    language,
    glossLanguage: Language.Chinese,
    type: 'vocabulary',
    level: CEFRLevel.B1,
    source: 'built-in',
    chapters,
    totalItems: total,
    completedItems: 0,
    masteredItems: 0,
    createdAt: Date.now(),
  };
}
