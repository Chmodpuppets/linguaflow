import React from 'react';

/**
 * LinguaFlow 暗夜霓虹 UI 基座
 * 统一玻璃拟态面板、霓虹按钮、徽章、标题、数据徽章。
 * 所有动效在 styles.css 中定义，prefers-reduced-motion 下自动关闭。
 */

/* ---------- GlassCard：玻璃拟态容器 ---------- */
type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** hover 时浮起 + 霓虹描边光 */
  interactive?: boolean;
  /** 更通透的弱层级 */
  subtle?: boolean;
};

export const GlassCard: React.FC<GlassCardProps> = ({
  interactive = false,
  subtle = false,
  className = '',
  children,
  ...rest
}) => (
  <div
    className={`
      rounded-2xl border backdrop-blur-xl transition-all duration-300
      ${subtle
        ? 'bg-surface-2/40 border-white/5'
        : 'bg-surface-2/70 border-white/[0.07] shadow-card'}
      ${interactive
        ? 'hover:border-neon/35 hover:shadow-glow-neon hover:-translate-y-0.5 cursor-pointer'
        : ''}
      ${className}
    `}
    {...rest}
  >
    {children}
  </div>
);

/* ---------- NeonButton：主 / 次 / 幽灵 三档 ---------- */
type NeonButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export const NeonButton: React.FC<NeonButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}) => {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-7 py-3.5 text-base rounded-xl',
  };
  const variants = {
    primary: `
      bg-gradient-to-r from-neon via-primary to-neon-2 text-white font-bold
      shadow-glow-sm hover:shadow-glow-neon hover:brightness-110
      active:scale-[0.97] active:brightness-95
    `,
    secondary: `
      bg-surface-3/70 text-white font-semibold border border-neon/25
      hover:border-neon/60 hover:shadow-glow-sm hover:bg-surface-3
      active:scale-[0.97]
    `,
    ghost: `
      bg-transparent text-muted font-semibold
      hover:text-white hover:bg-white/5
      active:scale-[0.97]
    `,
  };
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 select-none
        transition-all duration-200 outline-none
        focus-visible:ring-2 focus-visible:ring-neon/60
        disabled:opacity-50 disabled:pointer-events-none
        ${sizes[size]} ${variants[variant]} ${className}
      `}
      {...rest}
    >
      {children}
    </button>
  );
};

/* ---------- NeonBadge：状态角标 ---------- */
type NeonBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neon' | 'cyan' | 'pink' | 'warn' | 'muted';
  pulse?: boolean;
};

export const NeonBadge: React.FC<NeonBadgeProps> = ({
  tone = 'neon',
  pulse = false,
  className = '',
  children,
  ...rest
}) => {
  const tones = {
    neon: 'bg-neon/15 text-violet-300 border-neon/30',
    cyan: 'bg-neon-2/10 text-cyan-300 border-neon-2/30',
    pink: 'bg-neon-3/10 text-pink-300 border-neon-3/30',
    warn: 'bg-red-500/90 text-white border-red-400/50',
    muted: 'bg-surface-3/70 text-muted border-white/10',
  };
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        text-xs font-bold border
        ${tone === 'warn' && pulse ? 'badge-pulse' : ''}
        ${tones[tone]} ${className}
      `}
      {...rest}
    >
      {children}
    </span>
  );
};

/* ---------- SectionTitle：区块标题（带渐变光条） ---------- */
type SectionTitleProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subtitle,
  right,
  className = '',
}) => (
  <div className={`flex items-end justify-between gap-4 ${className}`}>
    <div>
      <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
        {title}
      </h3>
      <div className="title-underline w-16 mt-1.5" />
      {subtitle && <p className="text-muted text-sm mt-1.5">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

/* ---------- StatChip：数据徽章（图标 + 数值） ---------- */
type StatChipProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'neon' | 'cyan' | 'pink' | 'orange';
};

export const StatChip: React.FC<StatChipProps> = ({
  icon,
  label,
  value,
  tone = 'neon',
  className = '',
  ...rest
}) => {
  const tones = {
    neon: 'text-violet-300',
    cyan: 'text-cyan-300',
    pink: 'text-pink-300',
    orange: 'text-orange-400',
  };
  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl
        bg-surface-2/60 border border-white/[0.06] backdrop-blur-lg
        transition-all duration-300 hover:border-neon/30 hover:shadow-glow-sm
        ${className}
      `}
      {...rest}
    >
      {icon && <span className={`${tones[tone]} [&>svg]:drop-shadow-[0_0_6px_currentColor]`}>{icon}</span>}
      <div className="min-w-0">
        <div className="text-[11px] text-faint uppercase tracking-wider">{label}</div>
        <div className="text-sm font-bold text-white truncate">{value}</div>
      </div>
    </div>
  );
};
