import React, { useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { getLevelInfo } from '../services/storageService';
import { Download, Share2, X } from 'lucide-react';

// 成就卡：纯前端 canvas 生成 PNG，可下载 / 系统分享（开源获客钩子）。
// 字体走系统栈，避免 canvas 依赖外部 Google Fonts（深圳直连常失败）。

const W = 1080;
const H = 1350;
const DPR = 2;
const FONT = '-apple-system, "PingFang SC", "Segoe UI", "Helvetica Neue", sans-serif';

// 等级 → 段位名（「星级/段位」感）
const rankOf = (level: number): string => {
  if (level >= 20) return '大师';
  if (level >= 12) return '高手';
  if (level >= 7) return '进阶';
  if (level >= 3) return '入门';
  return '新手';
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawCard = (canvas: HTMLCanvasElement, user: UserProfile): void => {
  const lang = user.learningLanguage;
  const lp = user.progress?.[lang];
  const xp = lp?.xp || 0;
  const { level, pct } = getLevelInfo(xp);
  const streak = user.currentStreak || 0;
  const cefr = lp?.cefrLevel || 'A1';

  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(DPR, DPR);
  ctx.textBaseline = 'middle';

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0b14');
  bg.addColorStop(0.55, '#12121f');
  bg.addColorStop(1, '#1a1830');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 紫色光晕
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, W * 0.55);
  glow.addColorStop(0, 'rgba(124,108,255,0.32)');
  glow.addColorStop(1, 'rgba(124,108,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 星点装饰
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137.5) % W;
    const sy = (i * 211.3) % (H * 0.4);
    ctx.globalAlpha = 0.12 + (i % 5) * 0.04;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  const px = 80;

  // 顶部：Logo + 日期
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7c6cff';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText('LinguaFlow', px, 90);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(new Date().toISOString().slice(0, 10), W - px, 90);
  ctx.textAlign = 'left';

  // 中心：连胜数字 + 天（整体居中）
  const cy = 500;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.font = `400 34px ${FONT}`;
  ctx.fillText('连续学习', W / 2, cy - 200);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 260px ${FONT}`;
  const numW = ctx.measureText(String(streak)).width;
  ctx.font = `bold 72px ${FONT}`;
  const dayW = ctx.measureText('天').width;
  const gap = 24;
  const startX = (W - numW - gap - dayW) / 2;
  ctx.font = `bold 260px ${FONT}`;
  ctx.fillText(String(streak), startX, cy);
  ctx.font = `bold 72px ${FONT}`;
  ctx.fillText('天', startX + numW + gap, cy);

  // 等级 + 段位 + XP
  const ly = 720;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a78bfa';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText(`Lv.${level} · ${rankOf(level)}`, px, ly);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText(`${xp} XP`, W - px, ly);
  ctx.textAlign = 'left';

  // 进度条
  const barX = px;
  const barY = ly + 52;
  const barW = W - px * 2;
  const barH = 16;
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  if (pct > 0) {
    roundRect(ctx, barX, barY, Math.max(barH, (barW * pct) / 100), barH, barH / 2);
    const pg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    pg.addColorStop(0, '#7c6cff');
    pg.addColorStop(1, '#a78bfa');
    ctx.fillStyle = pg;
    ctx.fill();
  }

  // 语言 + CEFR
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `400 36px ${FONT}`;
  ctx.fillText(`${lang}  ·  ${cefr}`, W / 2, barY + 58);
  ctx.textAlign = 'left';

  // 段位星（5 档：新手→大师，点亮当前段位）
  const RANKS = ['新手', '入门', '进阶', '高手', '大师'];
  const rankIdx = Math.max(0, RANKS.indexOf(rankOf(level)));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText('段位', W / 2, 908);

  ctx.textAlign = 'left';
  ctx.font = `44px ${FONT}`;
  const stars = RANKS.map((_, i) => (i <= rankIdx ? '★' : '☆'));
  const starWs = stars.map((c) => ctx.measureText(c).width);
  const starGap = 26;
  const starsTotal = starWs.reduce((a, b) => a + b, 0) + starGap * 4;
  let sx = (W - starsTotal) / 2;
  stars.forEach((c, i) => {
    ctx.fillStyle = i <= rankIdx ? '#7c6cff' : 'rgba(255,255,255,0.22)';
    ctx.fillText(c, sx, 958);
    sx += starWs[i] + starGap;
  });

  // 分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, 1060);
  ctx.lineTo(W - px, 1060);
  ctx.stroke();

  // 底部标语
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('每天进步一点点', W / 2, 1122);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText('LinguaFlow · 开源多语言学习', W / 2, 1192);
  ctx.textAlign = 'left';
};

interface AchievementCardProps {
  user: UserProfile;
  onClose: () => void;
}

const AchievementCard: React.FC<AchievementCardProps> = ({ user, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = React.useState(false);

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, user);
  }, [user]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `linguaflow-achievement-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) { setBusy(false); return; }
        const file = new File([blob], 'linguaflow-achievement.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'LinguaFlow 学习成就', text: '我在 LinguaFlow 连续学习打卡，一起进步！' });
            return;
          } catch {
            // 用户取消或分享失败 → 回退下载
          }
        }
        download();
      }, 'image/png');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-surface-2 text-muted transition-colors hover:text-white"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
        <canvas ref={canvasRef} className="h-auto w-full rounded-2xl border border-white/10 shadow-2xl" />
        <div className="mt-4 flex gap-3">
          <button
            onClick={download}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-sm font-semibold text-body transition-colors hover:bg-surface-2/80"
          >
            <Download size={16} /> 下载图片
          </button>
          <button
            onClick={share}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon via-primary to-neon-2 px-3 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-60"
          >
            <Share2 size={16} /> {busy ? '处理中…' : '分享'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AchievementCard;
