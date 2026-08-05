import React, { useRef, useEffect } from 'react';

interface HandwritePadProps {
  height?: number;
  disabled?: boolean;
  /** 自评对照时淡显的标准字形（pointer-events-none 叠加层，不干扰笔迹） */
  overlayChar?: string;
  onClear?: () => void;
}

// 手写产出板：鼠标 / 触摸指针绘制，支持高分屏与清除。
// 不内置 OCR —— 纯前端、无后端约束下，手写动作本身（普林斯顿研究）即产出价值，
// 判分交给用户自评（见 ScriptTrainerView 的"对照"流程）。
const HandwritePad: React.FC<HandwritePadProps> = ({ height = 220, disabled = false, overlayChar, onClear }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.clearRect(0, 0, rect.width, height);
  }, [height]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    last.current = pos(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current!.getContext('2d');
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear?.();
  };

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{ width: '100%', height, touchAction: 'none', background: '#0b0b16', borderRadius: 12, border: '1px solid rgba(139,92,246,0.4)' }}
        className={disabled ? 'opacity-50' : ''}
      />
      {overlayChar && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[7rem] leading-none text-white/20 font-mono select-none">{overlayChar}</span>
        </div>
      )}
      <button
        type="button"
        onClick={clear}
        disabled={disabled}
        className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-surface-2/80 text-xs text-gray-300 border border-neon/40 hover:text-neon hover:border-neon/70 transition-colors disabled:opacity-40"
      >
        清除
      </button>
    </div>
  );
};

export default HandwritePad;
