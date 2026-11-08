import { TypingContent } from '../types';
import { BASIC_ROMAJI, YOON_ROMAJI, DAKUON_ROMAJI } from './scriptPacks.ja';
import { romajiToKana } from '../services/romajiKana';

/**
 * 日语五十音「打字闯关」专项内容。
 *
 * 数据来源与「文字特训」的 JA_KANA_PACK 共用同一份罗马字表（scriptPacks.ja.ts），
 * 不另造字形；这里只把它变成打字引擎能直接吃的 TypingContent。
 * 纯静态：零 AI 调用、零 API Key，新人第一天就能练。
 *
 * 练习方式：看假名 → 用罗马字输入法（IME）依次打出 → 逐字符比对。
 * phoneticGuide 给罗马字提示，translation 说明本组内容。
 */

export interface KanaDrillDef {
  id: string;
  label: string;
  hint: string;
  romaji: string[];
  katakana?: boolean;
}

// 46 音切成两段（あ〜の / は〜ん），避免关卡列表被 20 个小按钮撑爆
const halves = (prefix: string) => [
  {
    id: `${prefix}-1`,
    label: `${prefix === 'hira' ? '平假名' : '片假名'} · あ〜の`,
    hint: BASIC_ROMAJI.slice(0, 25).join(' '),
    romaji: BASIC_ROMAJI.slice(0, 25),
    katakana: prefix === 'kata',
  },
  {
    id: `${prefix}-2`,
    label: `${prefix === 'hira' ? '平假名' : '片假名'} · は〜ん`,
    hint: BASIC_ROMAJI.slice(25).join(' '),
    romaji: BASIC_ROMAJI.slice(25),
    katakana: prefix === 'kata',
  },
];

export const KANA_DRILLS: KanaDrillDef[] = [
  ...halves('hira'),
  ...halves('kata'),
  {
    id: 'dakuon-hira',
    label: '浊音 · 平假名',
    hint: DAKUON_ROMAJI.slice(0, 10).join(' ') + ' …',
    romaji: DAKUON_ROMAJI,
  },
  {
    id: 'dakuon-kata',
    label: '浊音 · 片假名',
    hint: DAKUON_ROMAJI.slice(0, 10).join(' ') + ' …',
    romaji: DAKUON_ROMAJI,
    katakana: true,
  },
  {
    id: 'yoon-hira',
    label: '拗音 · 平假名',
    hint: 'きゃ きゅ きょ しゃ …',
    romaji: YOON_ROMAJI,
  },
  {
    id: 'yoon-kata',
    label: '拗音 · 片假名',
    hint: 'キャ キュ キョ シャ …',
    romaji: YOON_ROMAJI,
    katakana: true,
  },
];

export const buildKanaContent = (id: string): TypingContent | null => {
  const def = KANA_DRILLS.find((d) => d.id === id);
  if (!def) return null;
  const text = def.romaji.map((r) => romajiToKana(r, !!def.katakana)).join('');
  return {
    text,
    topic: `五十音 · ${def.label}`,
    phoneticGuide: def.romaji.join(' '),
    translation: `${def.label}｜看假名，用罗马字输入法依次打出（${def.romaji.length} 音）`,
    keyVocabulary: [],
  };
};

/** 任务「开始」用的默认落点：五十音第 1 组 */
export const DEFAULT_KANA_DRILL_ID = KANA_DRILLS[0]?.id || 'hira-1';