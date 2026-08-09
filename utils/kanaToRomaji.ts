/**
 * 轻量假名 → 罗马字（romaji）转换，完全离线、无依赖。
 *
 * 覆盖：平假名 / 片假名基本音节、浊音 / 半浊音、拗音（两字符组合）、
 * 长音（ー）、促音（っ/ッ）、拨音（ん/ン，前接元音时加 ' 分隔）。
 * 非假名字符（汉字、拉丁字母、标点、数字、空格）原样保留。
 *
 * 用途：歌曲跟打（Song Lab）里为日语歌词逐句生成 romaji 注音。
 */

// 单字符映射（平假名 + 片假名合并）
const SINGLE: Record<string, string> = {
  // あ行
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  // か行
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  // さ行
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  // た行
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
  // な行
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  // は行
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
  // ま行
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  // や行
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  // ら行
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  // わ行
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
  // 浊音
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  'ダ': 'da', 'ヂ': 'di', 'ヅ': 'du', 'デ': 'de', 'ド': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
  // 半浊音
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  // 小假名（单独出现时按短元音 / y 处理）
  'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
  'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo',
  'ャ': 'ya', 'ュ': 'yu', 'ョ': 'yo',
  // 外来语音节（片假名，常见）
  'ヴ': 'v', 'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo',
  'ヴァ': 'va', 'ヴィ': 'vi', 'ヴェ': 've', 'ヴォ': 'vo', 'ヴュ': 'vyu',
  'シェ': 'she', 'ジェ': 'je', 'チェ': 'che',
  'ツァ': 'tsa', 'ツィ': 'tsi', 'ツェ': 'tse', 'ツォ': 'tso',
  'ティ': 'ti', 'トゥ': 'tu', 'ディ': 'di', 'ドゥ': 'du',
  'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
  'クァ': 'kwa', 'クィ': 'kwi', 'クェ': 'kwe', 'クォ': 'kwo',
  'グァ': 'gwa', 'グィ': 'gwi', 'グェ': 'gwe', 'グォ': 'gwo',
};

// 两字符拗音组合（平假名 + 片假名）
const YOON: Record<string, string> = {
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'ぢゃ': 'dya', 'ぢゅ': 'dyu', 'ぢょ': 'dyo',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  // 片假名
  'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
  'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
  'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
  'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
  'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
  'ヂャ': 'dya', 'ヂュ': 'dyu', 'ヂョ': 'dyo',
  'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
  'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
  'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
  'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
  'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
  'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
};

const SOKUON = new Set(['っ', 'ッ']);
const CHOON = 'ー';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** 取 romaji 开头的辅音簇，如 'chi'→'ch'、'tsu'→'ts'、'ka'→'k'、'n'→'n'。 */
function firstConsonant(rom: string): string {
  if (!rom) return '';
  const m = rom.match(/^[^aeiou]+/);
  return m ? m[0] : '';
}

/** 取 romaji 的最后一个元音字符（用于长音延展）。 */
function lastVowel(rom: string): string {
  for (let i = rom.length - 1; i >= 0; i--) {
    if (VOWELS.has(rom[i])) return rom[i];
  }
  return '';
}

/**
 * 假名（平/片）文本 → 罗马字。
 * 非假名字符原样保留。
 */
export function kanaToRomaji(text: string): string {
  let out = '';
  let lastVowelChar = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const nxt = chars[i + 1];

    // 促音：双写下一个音节的辅音
    if (SOKUON.has(c)) {
      if (nxt) {
        const nRom = SINGLE[nxt] ?? firstConsonant(SINGLE[nxt] ?? '');
        const cons = firstConsonant(nRom);
        if (cons) out += cons;
      }
      continue;
    }

    // 长音：延展前一个元音
    if (c === CHOON) {
      if (lastVowelChar) out += lastVowelChar;
      else out += '-';
      continue;
    }

    // 拗音（两字符）
    if (nxt && YOON[c + nxt]) {
      const r = YOON[c + nxt];
      out += r;
      lastVowelChar = lastVowel(r);
      i++;
      continue;
    }

    // 拨音 ん/ン：前接元音时加撇分隔，避免与后续元音粘连
    if (c === 'ん' || c === 'ン') {
      const follow = nxt;
      const followRom = follow ? (SINGLE[follow] ?? '') : '';
      const needSep = followRom ? VOWELS.has(followRom[0]) : false;
      out += needSep ? "n'" : 'n';
      lastVowelChar = '';
      continue;
    }

    // 单字符假名
    if (SINGLE[c] !== undefined) {
      const r = SINGLE[c];
      out += r;
      lastVowelChar = lastVowel(r);
      continue;
    }

    // 非假名：原样保留，更新 lastVowel（遇拉丁元音也延展长音）
    out += c;
    lastVowelChar = VOWELS.has(c.toLowerCase()) ? c.toLowerCase() : '';
  }
  return out;
}
