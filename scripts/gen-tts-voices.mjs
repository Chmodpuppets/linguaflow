#!/usr/bin/env node
/**
 * 生成统一音色表 `services/ttsVoices.ts`。
 *
 * 数据源（两个都是公开接口，不落库、不带任何密钥）：
 * ① Trancy 的音色表 `https://api.trancy.org/1/tts/voices` —— 产品形态参考，
 *    140 个音色、17 种语言，字段 id/provider/voiceId/locale/gender/marks/previewUrl…
 * ② Edge 朗读端点自带的音色表 —— 决定「免费能不能真的合成出来」。
 *    只有两边都在的 voiceId 才能用 `edgeTts: true` 标记（否则选了会 403/断流）。
 *
 * 为什么要合并：Trancy 那 140 个里有 71 个是 Azure 订阅专属（*MultilingualNeural、
 * *TurboMultilingualNeural、部分新方言音色），免费 Edge 端点不放行。直接抄会让
 * 用户选到「点了没声音」的音色，所以这里显式标出 edgeTts:false，交给 UI 置灰。
 *
 * 另外补几个 Trancy 表里没有、但免费端点可用且是「标准音」的音色（EXTRA_VOICES）：
 * 中文尤其需要 —— Trancy 的中文全是 Multilingual 变体，免费端点一个都不给，
 * 不补 Xiaoxiao/Yunxi 的话中文朗读只剩辽宁/陕西口音。
 *
 * 用法：node scripts/gen-tts-voices.mjs
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'services/ttsVoices.ts');

const TRANCY_VOICES = 'https://api.trancy.org/1/tts/voices';
const EDGE_VOICES =
  'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

/** 17 个学习语言的展示名（zh 界面）；顺序就是 UI 里的分组顺序 */
const LANGUAGES = [
  ['en', '英语', 'English'],
  ['zh', '中文', '中文'],
  ['ja', '日语', '日本語'],
  ['ko', '韩语', '한국어'],
  ['es', '西班牙语', 'Español'],
  ['fr', '法语', 'Français'],
  ['de', '德语', 'Deutsch'],
  ['it', '意大利语', 'Italiano'],
  ['pt', '葡萄牙语', 'Português'],
  ['ru', '俄语', 'Русский'],
  ['ar', '阿拉伯语', 'العربية'],
  ['tr', '土耳其语', 'Türkçe'],
  ['fa', '波斯语', 'فارسی'],
  ['vi', '越南语', 'Tiếng Việt'],
  ['hi', '印地语', 'हिन्दी'],
  ['th', '泰语', 'ไทย'],
  ['id', '印尼语', 'Bahasa Indonesia'],
];

/** 每种语言一个默认音色（都必须是 edgeTts 可用的） */
const DEFAULT_VOICES = {
  en: 'en-US-JennyNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  it: 'it-IT-ElsaNeural',
  pt: 'pt-BR-FranciscaNeural',
  ru: 'ru-RU-SvetlanaNeural',
  ar: 'ar-SA-ZariyahNeural',
  tr: 'tr-TR-EmelNeural',
  fa: 'fa-IR-DilaraNeural',
  vi: 'vi-VN-HoaiMyNeural',
  hi: 'hi-IN-SwaraNeural',
  th: 'th-TH-PremwadeeNeural',
  id: 'id-ID-GadisNeural',
};

/** Trancy 表里缺、但免费端点可用且值得补的「标准音」 */
const EXTRA_VOICES = [
  'en-US-JennyNeural',
  'en-US-AriaNeural',
  'en-US-GuyNeural',
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-YunjianNeural',
];

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'linguaflow-voice-table/1.0' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
};

const main = async () => {
  const [trancyRaw, edgeList] = await Promise.all([fetchJson(TRANCY_VOICES), fetchJson(EDGE_VOICES)]);
  const trancy = Array.isArray(trancyRaw) ? trancyRaw : trancyRaw.data || [];
  const edge = new Map(edgeList.map((v) => [v.ShortName, v]));

  const byVoice = new Map();
  for (const v of trancy) {
    if (!v?.voiceId) continue;
    byVoice.set(v.voiceId, {
      id: v.voiceId,
      voiceId: v.voiceId,
      provider: 'azure',
      displayName: v.displayName || v.localName || v.voiceId,
      localName: v.localName || '',
      locale: v.locale,
      localeName: v.localeName || v.locale,
      localeShortName: v.localeShortName || '',
      language: v.language,
      gender: v.gender || 'Female',
      previewUrl: v.previewUrl || '',
      source: 'trancy',
    });
  }
  for (const name of EXTRA_VOICES) {
    if (byVoice.has(name)) continue;
    const e = edge.get(name);
    if (!e) continue;
    byVoice.set(name, {
      id: name,
      voiceId: name,
      provider: 'azure',
      displayName: (e.FriendlyName || name).replace(/^Microsoft\s+/, '').replace(/\s+Online.*$/, '').trim(),
      localName: '',
      locale: e.Locale,
      localeName: e.Locale,
      localeShortName: '',
      language: e.Locale.split('-')[0],
      gender: e.Gender || 'Female',
      previewUrl: '',
      source: 'extra',
    });
  }

  const langs = new Set(LANGUAGES.map(([c]) => c));
  const voices = [...byVoice.values()]
    .filter((v) => langs.has(v.language))
    // 免费端点在场 = 真能合成；不在场 = Azure 订阅专属
    .map((v) => ({ ...v, edgeTts: edge.has(v.voiceId) }))
    .sort((a, b) => {
      const la = LANGUAGES.findIndex(([c]) => c === a.language);
      const lb = LANGUAGES.findIndex(([c]) => c === b.language);
      if (la !== lb) return la - lb;
      if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
      if (a.gender !== b.gender) return a.gender === 'Female' ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

  const supported = voices.filter((v) => v.edgeTts);
  for (const [code, def] of Object.entries(DEFAULT_VOICES)) {
    if (!supported.some((v) => v.voiceId === def)) {
      console.warn(`⚠ 默认音色不可用：${code} -> ${def}`);
    }
  }

  const line = (v) =>
    `  { id: ${JSON.stringify(v.id)}, voiceId: ${JSON.stringify(v.voiceId)}, provider: "azure", ` +
    `displayName: ${JSON.stringify(v.displayName)}, localName: ${JSON.stringify(v.localName)}, ` +
    `locale: ${JSON.stringify(v.locale)}, localeName: ${JSON.stringify(v.localeName)}, ` +
    `localeShortName: ${JSON.stringify(v.localeShortName)}, language: ${JSON.stringify(v.language)}, ` +
    `gender: ${JSON.stringify(v.gender)}, edgeTts: ${v.edgeTts}, source: ${JSON.stringify(v.source)}, ` +
    `previewUrl: ${JSON.stringify(v.previewUrl)} },`;

  const ts = `/**
 * 统一音色表 —— **由 scripts/gen-tts-voices.mjs 生成，不要手改**。
 *
 * 音色全部是微软 Azure Neural TTS（和 Trancy 同款）：产品形态对齐 Trancy 的
 * \`/1/tts/voices\`（140 个音色 / 17 种语言），能不能真合成以免费 Edge 朗读端点为准。
 *
 * \`edgeTts: false\` = Azure 订阅专属音色（*Multilingual / *Turbo / 新方言），
 * 免费端点会直接断流，UI 上要置灰或跳过，不要静默换成别的音色（音色是用户选的）。
 *
 * 生成于 ${new Date().toISOString()} | Trancy ${trancy.length} 条，免费可用 ${supported.length} 条，合计 ${voices.length} 条
 */

export type VoiceGender = 'Female' | 'Male' | 'Neutral';

export interface TtsVoice {
  /** 唯一 id（这里就等于 Azure voiceId） */
  id: string;
  /** Azure 音色名，传给合成接口 */
  voiceId: string;
  provider: 'azure';
  /** 英文展示名，如 "Jenny" */
  displayName: string;
  /** 本地语展示名（Azure 只给部分音色），没有就是空串 */
  localName: string;
  /** BCP-47 地区，如 "en-US" */
  locale: string;
  /** 英文地区名，如 "United States"（Trancy 的 localeName 实际是地区） */
  localeName: string;
  localeShortName: string;
  /** 语言码（17 种之一） */
  language: string;
  gender: VoiceGender;
  /** 免费 Edge 端点是否支持；false 需要 Azure 订阅 Key */
  edgeTts: boolean;
  /** trancy = 对齐 Trancy 音色表；extra = 为保证标准音补的 */
  source: 'trancy' | 'extra';
  /** Trancy 的试听 mp3（没配就是空串） */
  previewUrl: string;
}

export interface TtsLanguage {
  code: string;
  /** 中文名 */
  name: string;
  /** 母语名 */
  nativeName: string;
  /** 该语言默认音色（保证 edgeTts 可用） */
  defaultVoice: string;
}

export const TTS_VOICES: TtsVoice[] = [
${voices.map(line).join('\n')}
];

export const TTS_LANGUAGES: TtsLanguage[] = [
${LANGUAGES.map(
  ([code, name, nativeName]) =>
    `  { code: ${JSON.stringify(code)}, name: ${JSON.stringify(name)}, nativeName: ${JSON.stringify(nativeName)}, defaultVoice: ${JSON.stringify(DEFAULT_VOICES[code])} },`
).join('\n')}
];

const VOICE_BY_ID = new Map(TTS_VOICES.map((v) => [v.id, v]));
const VOICE_BY_MAIN = new Map(TTS_VOICES.map((v) => [v.voiceId, v]));

/** 按 id 或 voiceId 查找；大小写不敏感（本地存的老值可能是小写） */
export const findTtsVoice = (idOrVoiceId?: string | null): TtsVoice | undefined => {
  if (!idOrVoiceId) return undefined;
  const raw = idOrVoiceId.trim();
  return VOICE_BY_ID.get(raw) || VOICE_BY_MAIN.get(raw) || VOICE_BY_ID.get(raw.replace(/^azure:/, '').split(':')[0]);
};

/** 是否免费端点可合成（未收录的音色一律 false，避免盲发请求） */
export const isEdgeVoice = (idOrVoiceId?: string | null): boolean => !!findTtsVoice(idOrVoiceId)?.edgeTts;

/** 语言默认音色；语言不认识时退回英语默认 */
export const defaultVoiceFor = (language?: string | null): string =>
  TTS_LANGUAGES.find((l) => l.code === language)?.defaultVoice || 'en-US-JennyNeural';

/** 某语言的全部音色（含不可用的，UI 自己决定置灰；可用的一律排前面） */
export const voicesForLanguage = (language: string): TtsVoice[] =>
  TTS_VOICES.filter((v) => v.language === language).sort((a, b) => Number(b.edgeTts) - Number(a.edgeTts));

/** 音色的中文标签，如「Jenny（女 · 美国）」 */
export const voiceLabel = (v: TtsVoice): string =>
  \`\${v.displayName}（\${v.gender === 'Female' ? '女' : '男'} · \${v.localeName || v.locale}）\`;

/** 给 <select> 用的分组：按语言分组，组内可用音色在前 */
export const ttsVoiceGroups = (): { language: TtsLanguage; voices: TtsVoice[] }[] =>
  TTS_LANGUAGES.map((language) => ({
    language,
    voices: voicesForLanguage(language.code),
  })).filter((g) => g.voices.length > 0);
`;

  await writeFile(OUT, ts, 'utf8');
  console.log(`✓ ${path.relative(ROOT, OUT)}`);
  console.log(`  Trancy ${trancy.length} 条 / 免费可用 ${supported.length} 条 / 合计 ${voices.length} 条`);
  console.log(
    '  每语言可用数：' +
      LANGUAGES.map(([c]) => `${c}:${supported.filter((v) => v.language === c).length}`).join(' ')
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
