
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X } from 'lucide-react';

interface QrScannerModalProps {
  onClose: () => void;
  onScan: (code: string) => void; // 已提取的 6 位好友码
}

// 从扫描结果提取好友码：支持 `LF:XXXXXX` 前缀，或裸 6 位大写字母数字
const extractCode = (raw: string): string | null => {
  const t = raw.trim();
  const m = t.match(/^LF:([A-Z0-9]{6})$/i);
  if (m) return m[1].toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(t)) return t;
  return null;
};

const QrScannerModal: React.FC<QrScannerModalProps> = ({ onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            const extracted = extractCode(code.data);
            if (extracted) {
              onScan(extracted);
              return; // 成功即停止扫描循环
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (e) {
        setError(
          '无法打开摄像头：' +
            (e instanceof DOMException && e.name === 'NotAllowedError'
              ? '请允许摄像头权限'
              : e instanceof Error
              ? e.message
              : '未知错误')
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="relative w-full max-w-sm">
        <button
          onClick={onClose}
          className="absolute -top-1 right-0 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black">
          <video ref={videoRef} playsInline muted className="w-full aspect-square object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {/* 取景框 */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-3/5 h-3/5 border-2 border-neon/70 rounded-xl" />
          </div>
        </div>
        {error ? (
          <p className="mt-3 text-xs text-red-300 text-center">{error}</p>
        ) : (
          <p className="mt-3 text-xs text-white/70 text-center">对准好友的二维码，识别后自动添加</p>
        )}
      </div>
    </div>
  );
};

export default QrScannerModal;
