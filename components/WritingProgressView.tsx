import React from 'react';
import { UserProfile, CEFRLevel, ExamScores, TargetExam, IeltsBandScores, ToeflScores, JlptScores, TopikScores, DeleScores } from '../types';
import { getWritingHistoryByLang, ensureGrowthTree } from '../services/storageService';
import { LineChart as LineChartIcon, TrendingUp, Activity, Award, PenLine } from 'lucide-react';

interface WritingProgressViewProps {
  user: UserProfile;
}

const CEFR_ORDER: CEFRLevel[] = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2];
const cefrToNum = (c: CEFRLevel): number => CEFR_ORDER.indexOf(c) + 1; // 1..6

// 考试代表性总分（统一为可比较的连续数值，供趋势曲线使用）
const examTotal = (scores: ExamScores | null | undefined, exam: TargetExam): number | null => {
  if (!scores || exam === 'none') return null;
  switch (exam) {
    case 'IELTS': return (scores as IeltsBandScores).overall;
    case 'TOEFL': return (scores as ToeflScores).scaled;
    case 'JLPT': {
      const m: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
      return m[(scores as JlptScores).estimatedLevel] ?? null;
    }
    case 'TOPIK': return (scores as TopikScores).estimatedLevel;
    case 'DELE': {
      const s = scores as DeleScores;
      return (s.grammar + s.vocabulary + s.coherence + s.taskAdequacy) / 4;
    }
    default: return null;
  }
};
const examYMax = (exam: TargetExam): number => ({ IELTS: 9, TOEFL: 30, JLPT: 5, TOPIK: 6, DELE: 100 }[exam] ?? 100);
const examLabel = (exam: TargetExam): string =>
  ({ IELTS: '雅思总分 (0–9)', TOEFL: '托福总分 (0–30)', JLPT: 'JLPT 等级 (N5–N1)', TOPIK: 'TOPIK 等级 (1–6)', DELE: 'DELE 均分 (0–100)' }[exam] ?? '考试分');

// 通用折线图（纯 SVG，无第三方依赖）
const LineChart: React.FC<{
  values: number[];
  yMax: number;
  yMin?: number;
  color: string;
  yTicks?: { value: number; label: string }[];
  height?: number;
}> = ({ values, yMax, yMin = 0, color, yTicks, height = 240 }) => {
  const W = 680;
  const H = height;
  const padL = 46, padR = 22, padT = 22, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = values.length;

  if (n === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted text-sm border-2 border-dashed border-line rounded-xl bg-surface-2/30">
        暂无数据
      </div>
    );
  }

  const xAt = (i: number): number => (n <= 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));
  const yAt = (v: number): number => padT + innerH * (1 - (v - yMin) / (yMax - yMin));

  const pts = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
  const ticks = yTicks ?? [
    { value: yMax, label: String(yMax) },
    { value: (yMax + yMin) / 2, label: String(((yMax + yMin) / 2).toFixed(yMax <= 9 ? 1 : 0)) },
    { value: yMin, label: String(yMin) },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
      {/* 网格 + y 轴标签 */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={yAt(t.value)} x2={W - padR} y2={yAt(t.value)} stroke="#374151" strokeWidth={1} strokeDasharray="3 3" />
          <text x={padL - 8} y={yAt(t.value) + 4} fill="#9ca3af" fontSize={11} textAnchor="end">{t.label}</text>
        </g>
      ))}
      {/* 折线 */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* 数据点 */}
      {values.map((v, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(v)} r={n > 30 ? 2.5 : 4} fill={color} stroke="#0f172a" strokeWidth={1.5} />
      ))}
      {/* 最新值标注 */}
      {n > 0 && (
        <g>
          <circle cx={xAt(n - 1)} cy={yAt(values[n - 1])} r={5.5} fill={color} stroke="#fff" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: string }> = ({ icon, label, value, accent }) => (
  <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center gap-3">
    <div className={`p-2 rounded-lg bg-white/5 ${accent ?? 'text-neon'}`}>{icon}</div>
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const WritingProgressView: React.FC<WritingProgressViewProps> = ({ user }) => {
  const lang = user.learningLanguage;
  const targetExam = user.targetExam ?? 'none';
  const records = getWritingHistoryByLang(lang); // 已按时间正序

  // 写作者养成主线（spine）8 分支进度：从写作树读取各分支 task 完成情况
  const level = user.progress[lang]?.cefrLevel ?? CEFRLevel.A1;
  const tree = ensureGrowthTree(lang, level);
  const spineBranches = tree
    .filter((n) => n.type === 'theme' && n.parentId === 'spine' && n.id !== 'spine-portfolio')
    .map((b) => {
      const leaves = tree.filter((n) => n.parentId === b.id && n.type === 'task');
      const done = leaves.filter((n) => n.completed).length;
      return { id: b.id, title: b.title, done, total: leaves.length };
    })
    .filter((b) => b.total > 0);
  const spineDone = spineBranches.reduce((s, b) => s + b.done, 0);
  const spineTotal = spineBranches.reduce((s, b) => s + b.total, 0);

  const count = records.length;
  const cefrValues = records.map((r) => cefrToNum(r.cefrEstimation));

  // 统计
  const firstCefr = count > 0 ? records[0].cefrEstimation : null;
  const lastCefr = count > 0 ? records[count - 1].cefrEstimation : null;
  const progress = count > 0 ? cefrToNum(lastCefr!) - cefrToNum(firstCefr!) : 0;

  // 最长连续写作天数（按 date 去重后算连续跨度）
  const dates = Array.from(new Set(records.map((r) => r.date))).sort();
  let longestStreak = 0;
  let cur = 0;
  let prev: Date | null = null;
  for (const d of dates) {
    const dt = new Date(d + 'T00:00:00');
    if (prev) {
      const diff = Math.round((dt.getTime() - prev.getTime()) / 86400000);
      cur = diff === 1 ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    longestStreak = Math.max(longestStreak, cur);
    prev = dt;
  }

  // 考试趋势（仅当目标考试且存在对应记录）
  const examRecords = records.filter((r) => r.examScores && targetExam !== 'none');
  const examValues = examRecords.map((r) => examTotal(r.examScores, targetExam)).filter((v): v is number => v !== null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-neon/10 text-neon"><TrendingUp size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-white">写作趋势</h2>
          <p className="text-sm text-muted">语言：{lang} · 共 {count} 次批改记录</p>
        </div>
      </div>

      {count === 0 ? (
        <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Activity size={40} className="text-faint mb-3" />
          <p className="text-gray-300 font-medium">还没有写作记录</p>
          <p className="text-sm text-muted mt-1">去「写作」页完成几次 AI 批改，这里就会画出你的进步曲线。</p>
        </div>
      ) : (
        <>
          {/* 统计卡 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Activity size={18} />} label="批改次数" value={String(count)} />
            <StatCard icon={<Award size={18} />} label="首测等级" value={firstCefr ?? '—'} />
            <StatCard icon={<TrendingUp size={18} />} label="最新等级" value={lastCefr ?? '—'} accent="text-green-400" />
            <StatCard
              icon={<TrendingUp size={18} />}
              label="进步幅度"
              value={progress > 0 ? `+${progress} 级` : progress === 0 ? '持平' : `${progress} 级`}
              accent={progress > 0 ? 'text-green-400' : progress < 0 ? 'text-red-400' : 'text-yellow-400'}
            />
          </div>

          {/* 写作者养成主线（spine）8 分支进度 */}
          {spineBranches.length > 0 && (
            <div className="glass-panel p-6 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <PenLine size={16} className="text-violet-300" /> 写作者养成主线
                </h3>
                <span className="text-xs text-muted">{spineDone} / {spineTotal} 完成</span>
              </div>
              <div className="space-y-3">
                {spineBranches.map((b) => {
                  const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">{b.title}</span>
                        <span className="text-[10px] text-muted">{b.done}/{b.total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CEFR 等级趋势（通用，所有语言） */}
          <div className="glass-panel p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white">CEFR 等级趋势</h3>
              <span className="text-xs text-muted">{firstCefr} → {lastCefr}</span>
            </div>
            <LineChart
              values={cefrValues}
              yMin={1}
              yMax={6}
              color="#8b5cf6"
              yTicks={CEFR_ORDER.map((c, i) => ({ value: i + 1, label: c }))}
            />
          </div>

          {/* 考试总分趋势（仅当启用考试评分且存在记录） */}
          {examValues.length > 0 ? (
            <div className="glass-panel p-6 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white">{examLabel(targetExam)}</h3>
                <span className="text-xs text-muted">仅含启用考试目标后的记录</span>
              </div>
              <LineChart
                values={examValues}
                yMin={0}
                yMax={examYMax(targetExam)}
                color="#22d3ee"
                yTicks={[
                  { value: examYMax(targetExam), label: String(examYMax(targetExam)) },
                  { value: examYMax(targetExam) / 2, label: (examYMax(targetExam) / 2).toFixed(examYMax(targetExam) <= 9 ? 1 : 0) },
                  { value: 0, label: '0' },
                ]}
              />
            </div>
          ) : (
            targetExam !== 'none' && (
              <div className="bg-dark/40 border border-line rounded-xl p-4 text-sm text-muted">
                尚未累积「{examLabel(targetExam)}」的评分记录（需要带考试目标进行写作批改后才会显示）。
              </div>
            )
          )}

          {/* 连续写作提示 */}
          <p className="text-xs text-muted text-center">
            最长连续写作：{longestStreak} 天 · 坚持每天一篇，曲线会更稳。
          </p>
        </>
      )}
    </div>
  );
};

export default WritingProgressView;
