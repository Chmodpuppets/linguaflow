import { ScriptPack, ScriptItem, Language } from '../types';
import { hangulFromRoman } from '../services/scriptTransliterate';

// 韩语：罗马字 → Hangul 音节块（转换器生成答案，保证一致）
const build = (group: string, romanList: string[]): ScriptItem[] =>
  romanList.map((r) => {
    const answer = hangulFromRoman(r);
    return {
      id: `ko-${group}-${r}`,
      group,
      prompt: r,
      answer,
      romaji: r,
      audioText: answer,
    };
  });

// 基础音节（初声 + 中声，无终声）：覆盖 12 个常用初声 × 5 个常用中声
const BASIC = [
  'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa', 'ja', 'ka', 'ta', 'pa', 'ha',
  'geo', 'neo', 'deo', 'reo', 'meo', 'beo', 'seo', 'jeo', 'keo', 'teo', 'peo', 'heo',
  'gi', 'ni', 'di', 'ri', 'mi', 'bi', 'si', 'ji', 'ki', 'ti', 'pi', 'hi',
  'go', 'no', 'do', 'ro', 'mo', 'bo', 'so', 'jo', 'ko', 'to', 'po', 'ho',
  'gu', 'nu', 'du', 'ru', 'mu', 'bu', 'su', 'ju', 'ku', 'tu', 'pu', 'hu',
];

// 双收音（终声组合）：练"音节 + 韵尾"的产出
const BATCHIM = [
  'gal', 'mal', 'sal', 'pal', 'nal', 'dam', 'ram', 'bam', 'sam', 'ham',
  'gong', 'bong', 'song', 'jong', 'gwang', 'bang', 'dang', 'hang', 'bing', 'ok',
];

// 常见整词（多音节连写）：练真实词汇的产出，覆盖问候/国家/感谢等高频词
const WORDS = [
  'seoul', 'sarang', 'hangeul', 'gamsa', 'gamsahapnida', 'annyeong',
  'nae', 'daehan', 'sigan', 'il',
];

export const KO_HANGUL_PACK: ScriptPack = {
  id: 'ko-hangul',
  language: Language.Korean,
  name: '韩语 Hangul · 音节 / 收音 / 整词',
  description:
    '从罗马字主动写出 Hangul 音节块。覆盖基础音节、双收音（韵尾），以及常见整词连写（서울·사랑·한글·감사합니다）。生成式练习——不显示答案，逼你从记忆里产出，专治"看得懂韩剧字幕却打不出谚文"。',
  groups: ['基础音节', '双收音', '常见整词'],
  items: [
    ...build('基础音节', BASIC),
    ...build('双收音', BATCHIM),
    ...build('常见整词', WORDS),
  ],
  transliterate: (input) => hangulFromRoman(input),
};
