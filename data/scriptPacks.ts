import { ScriptPack, Language } from '../types';
import { JA_KANA_PACK } from './scriptPacks.ja';
import { KO_HANGUL_PACK } from './scriptPacks.ko';
import { RU_CYRILLIC_PACK } from './scriptPacks.ru';
import { EL_GREEK_PACK } from './scriptPacks.el';
import { AR_ABJAD_PACK } from './scriptPacks.ar';

// 已上线的字形包（数据驱动：新增语言只需在此追加一个 Pack）
export const SCRIPT_PACKS: ScriptPack[] = [
  JA_KANA_PACK,
  KO_HANGUL_PACK,
  RU_CYRILLIC_PACK,
  EL_GREEK_PACK,
  AR_ABJAD_PACK,
];

export const getScriptPackForLanguage = (lang: Language): ScriptPack | null =>
  SCRIPT_PACKS.find((p) => p.language === lang) ?? null;

export const getScriptPacks = (): ScriptPack[] => SCRIPT_PACKS;
