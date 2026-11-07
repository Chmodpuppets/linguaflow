import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { SUPPORTED_LANGUAGES, EXAM_LANGUAGE_MAP } from '../constants';
import { ensureLanguageProgress } from '../services/storageService';

interface LanguageSwitcherProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  /** 侧栏折叠态：md 及以上收成 40×40 旗标按钮，下拉向右弹出（移动端抽屉内保持完整样式） */
  collapsed?: boolean;
  /** 恒为图标按钮（移动端顶栏，横向空间不足时用） */
  iconOnly?: boolean;
  /** 下拉面板对齐：right = 贴容器右边缘 */
  align?: 'full' | 'right';
  /**
   * 只显示「已开启」的语言（进度表里有记录）。
   * 未开启的语言从切换器里隐藏 —— 添加新语言走「我的资料 → 设置」。
   * 默认 true；设 false 可恢复成完整 11 语言列表。
   */
  onlyStarted?: boolean;
  /** 底部「添加语言」入口：跳到「我的资料 → 设置」；不传则不显示该入口 */
  onManageLanguages?: () => void;
  className?: string;
}

/**
 * 顶部语言切换器：一键切换当前学习语言，免去每次进「我的资料 → 设置」改。
 * 切换逻辑与设置页 handleLanguageSwitch 完全一致（补进度容器 + 考试目标回落），
 * 唯一区别是把 state 里的 progress 浅拷贝一次，避免 ensureLanguageProgress 就地改写当前 state。
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  user,
  onUpdateUser,
  collapsed = false,
  iconOnly = false,
  align = 'full',
  onlyStarted = true,
  onManageLanguages,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.id === user.learningLanguage) || SUPPORTED_LANGUAGES[0];

  // 只列「用过的语言」：进度表里有记录 = 用户选过 / 学过；当前语言无论如何都在列表里
  const shownLangs = onlyStarted
    ? SUPPORTED_LANGUAGES.filter((l) => !!user.progress[l.id] || l.id === user.learningLanguage)
    : SUPPORTED_LANGUAGES;
  const hiddenCount = SUPPORTED_LANGUAGES.length - shownLangs.length;

  // 点击外部 / 按 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelect = (lang: Language) => {
    setOpen(false);
    if (lang === user.learningLanguage) return;
    let updated: UserProfile = {
      ...user,
      progress: { ...user.progress },
      learningLanguage: lang,
    };
    updated = ensureLanguageProgress(updated, lang);
    // 考试目标与新语言不匹配时回落到通用 CEFR，避免「日语 + 雅思」这类无效组合
    const examLang = EXAM_LANGUAGE_MAP[updated.targetExam ?? 'none'];
    if (examLang && examLang !== lang) updated.targetExam = 'none';
    onUpdateUser(updated);
  };

  // md 折叠只在非 iconOnly 时生效，避免移动端抽屉里被压成图标
  const mdCollapse = collapsed && !iconOnly;
  const hideLabel = iconOnly;

  const panelClass = [
    'absolute z-[70] mt-2 max-h-[62vh] overflow-y-auto rounded-xl border border-white/10',
    'bg-surface-3/95 p-1.5 shadow-2xl backdrop-blur-xl custom-scrollbar',
    'animate-in fade-in slide-in-from-top-1 duration-150',
    align === 'right' ? 'right-0 w-56' : 'left-0 right-0',
    mdCollapse && align !== 'right' ? 'md:left-full md:right-auto md:top-0 md:mt-0 md:ml-2 md:w-56' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const buttonClass = [
    'flex items-center gap-2 rounded-xl border text-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/50',
    open
      ? 'border-neon/40 bg-white/[0.07]'
      : 'border-white/10 bg-white/[0.04] hover:border-neon/40 hover:bg-white/[0.07]',
    iconOnly ? 'h-10 w-10 justify-center px-0' : 'w-full px-3 py-2',
    mdCollapse ? 'md:h-10 md:w-10 md:justify-center md:px-0' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={boxRef}
      className={`relative ${mdCollapse ? 'md:flex md:justify-center' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`当前学习语言：${current.label}，点击切换`}
        title={`当前语言：${current.label}　点击切换`}
        className={buttonClass}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {current.flag}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-white ${
            hideLabel ? 'hidden' : ''
          } ${mdCollapse ? 'md:hidden' : ''}`}
        >
          {current.label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          } ${hideLabel ? 'hidden' : ''} ${mdCollapse ? 'md:hidden' : ''}`}
        />
      </button>

      {open && (
        <div role="listbox" aria-label="选择学习语言" className={panelClass}>
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
            {onlyStarted && hiddenCount > 0 ? '我的语言' : '切换学习语言'}
          </div>
          {shownLangs.map((l) => {
            const active = l.id === user.learningLanguage;
            const prog = user.progress[l.id];
            return (
              <button
                key={l.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(l.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-neon/10 text-white' : 'text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {l.flag}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{l.label}</span>
                <span
                  className={`shrink-0 text-[10px] font-bold tabular-nums ${
                    prog ? 'text-neon-2' : 'text-faint'
                  }`}
                >
                  {prog ? `Lv ${prog.level} · ${prog.cefrLevel}` : '未开始'}
                </span>
                {active && <Check size={14} className="shrink-0 text-neon" />}
              </button>
            );
          })}
          {/* 未开启的语言不再列出 —— 加语言统一走设置页，避免下拉被 8 个「未开始」撑满 */}
          {onManageLanguages && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManageLanguages();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/5 px-2.5 py-2 text-left text-xs font-medium text-neon-2 transition-colors hover:bg-white/5 hover:text-white"
            >
              ＋ 添加语言
              <span className="ml-auto text-[10px] font-normal text-faint">我的资料 · 设置</span>
            </button>
          )}
          <div className="px-2.5 py-1.5 text-[10px] leading-relaxed text-faint">
            各语言进度独立保存，切换只影响当前界面。
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
