import React from 'react';
import { TargetExam, ExamScores } from '../types';
import { EXAM_SCORECARD } from '../data/examScoring';

interface Props {
  exam: TargetExam;
  scores: ExamScores;
}

// 考试评分卡（共享）：作文编辑器与写作树引导写作共用。
// 渲染全维度条 + 估算等级/总分 + 逐维度点评。
export const ExamScoreCard: React.FC<Props> = ({ exam, scores }) => {
  const cfg = EXAM_SCORECARD[exam];
  if (!cfg) return null;
  const es = scores as unknown as Record<string, any>;
  const level = es[cfg.levelKey];
  const fb = (es.feedback ?? {}) as Record<string, string>;

  return (
    <div className="bg-dark/30 border border-amber-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold text-sm flex items-center gap-2">
          <span className="text-amber-300">考试评分 · {exam}</span>
        </h4>
        <span className="text-xs text-amber-200/80">
          {cfg.levelLabel}：<b className="text-amber-100">{String(level)}</b>
        </span>
      </div>
      {cfg.dims.map((d) => {
        const v = typeof es[d.key] === 'number' ? (es[d.key] as number) : undefined;
        const comment = fb[d.key];
        return (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300">{d.label}</span>
              <span className="text-sm text-neon font-bold">
                {v} / {d.max}
              </span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-neon"
                style={{ width: `${Math.min(100, Math.round(((v ?? 0) / d.max) * 100))}%` }}
              />
            </div>
            {comment && <p className="text-xs text-muted mt-1">{comment}</p>}
          </div>
        );
      })}
    </div>
  );
};
