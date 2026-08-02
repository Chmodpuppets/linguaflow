// Romaji → Kana converter (hiragana & katakana)
// 供「文字特训」中日语 romaji 输入与答案字形对照使用。
// 跨语言脚本（韩文、西里尔等）不走此转换器，改用屏幕虚拟键盘点按。

const ROMAJI: Record<string, string> = {
  // 元音
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  // 清音
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', chi: 'ち', tsu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を',
  // 浊音
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  // 拗音
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  // 常见替代表记
  si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ',
};

const SMALL_TSU = 'っ';

// 平假名码点范围 0x3041–0x3096，片假名 = +0x60
function toKatakanaStr(hira: string): string {
  let out = '';
  for (const ch of hira) {
    const code = ch.codePointAt(0) ?? 0;
    out += (code >= 0x3041 && code <= 0x3096)
      ? String.fromCodePoint(code + 0x60)
      : ch;
  }
  return out;
}

const isConsonant = (c: string) => /[bcdfghjkmnpqrstvwyz]/.test(c);

/**
 * 将罗马字转换为假名。
 * @param input 罗马字输入
 * @param toKatakana 是否转片假名（默认平假名）
 */
export function romajiToKana(input: string, toKatakana = false): string {
  const s = (input || '')
    .toLowerCase()
    .replace(/l/g, 'r')   // 习惯上 l→r
    .replace(/\s+/g, '');

  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    // 促音：双写辅音（如 kka → っか）
    if (i + 1 < s.length && s[i + 1] === c && isConsonant(c) && c !== 'n') {
      out += SMALL_TSU;
      i += 1;
      continue;
    }

    const three = s.substr(i, 3);
    const two = s.substr(i, 2);
    if (ROMAJI[three]) { out += ROMAJI[three]; i += 3; continue; }
    if (ROMAJI[two]) { out += ROMAJI[two]; i += 2; continue; }
    if (ROMAJI[c] !== undefined) { out += ROMAJI[c]; i += 1; continue; }

    // 拨音 n（无法与后续组成音节时）
    if (c === 'n') { out += 'ん'; i += 1; continue; }

    // 长元音兜底：重复元音只发一次（如 aa → あ）
    if (/[aiueo]/.test(c) && s[i + 1] === c) {
      out += ROMAJI[c] ?? c;
      i += 2;
      continue;
    }

    // 无法识别的字符原样保留（标点、空格等）
    out += c;
    i += 1;
  }

  return toKatakana ? toKatakanaStr(out) : out;
}
