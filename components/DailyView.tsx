import React, { useState, useEffect } from 'react';
import { UserProfile, AppMode, QuestKind, ActivityLog, DailyFlywheel, FlywheelStep } from '../types';
import { getDueVocabulary, getLogs, getDailyFlywheel, commitDailyStreak } from '../services/storageService';
import { getScriptPackForLanguage } from '../data/scriptPacks';
import { Flame, Shield, CheckCircle2, ArrowRight, Sparkles, Target, BookOpen, MessageSquare, PenTool, Type, Trophy, PenLine, Feather, Headphones } from 'lucide-react';
import { GlassCard, NeonButton, NeonBadge, SectionTitle } from './ui';

interface DailyViewProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
  onNavigate: (mode: AppMode) => void;
}

const QUEST_TO_MODE: Record<QuestKind, AppMode> = {
  typing_words: AppMode.Typing,
  vocab_review: AppMode.Vocabulary,
  rpg_sessions: AppMode.RPG,
  writing_words: AppMode.InkQuest,
  script_practice: AppMode.ScriptTrainer,
};

const QUEST_ICON: Record<QuestKind, React.ReactNode> = {
  typing_words: <Type size={18} />,
  vocab_review: <BookOpen size={18} />,
  rpg_sessions: <MessageSquare size={18} />,
  writing_words: <PenTool size={18} />,
  script_practice: <PenLine size={18} />,
};

const todayStr = () => new Date().toISOString().split('T')[0];

const DailyView: React.FC<DailyViewProps> = ({ user, onUpdateUser, onNavigate }) => {
  const [dueCount, setDueCount] = useState(0);
  const [weeklyOutput, setWeeklyOutput] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [flywheel, setFlywheel] = useState<DailyFlywheel | null>(null);

  // 当前学习语言是否有字形包：决定飞轮是否要求 script 步（无包语言仅需写作 + 听写）
  const needsScript = !!getScriptPackForLanguage(user.learningLanguage);
  const requiredSteps: FlywheelStep[] = needsScript
    ? ['writing', 'dictation', 'script']
    : ['writing', 'dictation'];
  const flywheelDone = flywheel ? requiredSteps.filter((s) => flywheel.steps[s]).length : 0;
  const flywheelTotal = requiredSteps.length;

  useEffect(() => {
    setDueCount(getDueVocabulary().length);
    const logs: ActivityLog[] = getLogs();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const weekLogs = logs.filter((l) => l.timestamp >= weekAgo);
    const out = weekLogs.reduce((acc, l) => acc + (l.details.wordCount || 0), 0);
    setWeeklyOutput(out);
    setDoneCount(user.dailyQuests.filter((q) => q.completed).length);
    const fw = getDailyFlywheel();
    setFlywheel(fw);
    // 若今日产出线已完成但连胜尚未计入，补记（commitDailyStreak 内部防重）
    if (fw && fw.allDone && user.lastStreakDate !== todayStr()) {
      onUpdateUser(commitDailyStreak(user));
    }
  }, [user]);

  const questsCompletedAll = user.dailyQuests.length > 0 && user.dailyQuests.every((q) => q.completed);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Hero：极光渐变 + 玻璃面 */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-neon/20 via-surface-2/70 to-surface-2/50 backdrop-blur-xl p-6 md:p-8 shadow-card">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-neon/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-10 h-36 w-36 rounded-full bg-neon-2/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              你好，<span className="neon-text">{user.username}</span> 👋
            </h1>
            <p className="mt-1 text-sm text-muted">
              {questsCompletedAll
                ? '今天的任务全部完成，太棒了！继续保持 🔥'
                : '今天也来输出一点点，比昨天更靠近母语一点点。'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center rounded-xl border border-orange-400/20 bg-surface-3/50 backdrop-blur-lg px-4 py-2 transition-shadow duration-300 hover:shadow-[0_0_18px_rgba(251,146,60,0.35)]">
              <div className="flex items-center gap-1 text-orange-400">
                <Flame size={20} className="flame-flicker" />
                <span className="text-2xl font-bold">{user.currentStreak}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted">连续天数</span>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-neon-2/20 bg-surface-3/50 backdrop-blur-lg px-4 py-2 transition-shadow duration-300 hover:shadow-glow-cyan">
              <div className="flex items-center gap-1 text-cyan-300">
                <Shield size={20} />
                <span className="text-2xl font-bold">{user.streakShields}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted">护盾</span>
            </div>
          </div>
        </div>
      </section>

      {/* 今日产出线（Daily Flywheel） */}
      <section className="page-enter" style={{ animationDelay: '40ms' }}>
        <SectionTitle
          className="mb-3"
          title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-neon" />今日产出线</span>}
          right={<NeonBadge tone={flywheel?.allDone ? 'cyan' : 'neon'}>{flywheel ? `${flywheelDone}/${flywheelTotal} 完成` : '—'}</NeonBadge>}
        />
        {flywheel && (
          <GlassCard className="p-5">
            <div className="mb-3">
              <div className="text-xs text-muted">今日主题</div>
              <div className="text-lg font-bold text-white">{flywheel.theme}</div>
              <div className="text-xs text-muted mt-0.5">{flywheel.themePrompt}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                { step: 'writing', label: '墨程 · 自由写', mode: AppMode.InkQuest, icon: <PenTool size={16} /> },
                { step: 'dictation', label: '墨程 · 听写', mode: AppMode.InkQuest, icon: <Headphones size={16} /> },
                { step: 'script', label: '文字特训', mode: AppMode.ScriptTrainer, icon: <PenLine size={16} /> },
              ] as const).map((m) => {
                const done = flywheel.steps[m.step as FlywheelStep];
                const na = m.step === 'script' && !needsScript;
                if (na) {
                  return (
                    <div
                      key={m.step}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2/20 p-3 text-faint"
                      title="当前语言无字形包，文字特训步骤自动免修"
                    >
                      <PenLine size={16} />
                      <span className="text-sm font-semibold">文字特训 · 免修</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={m.step}
                    onClick={() => onNavigate(m.mode)}
                    className={`group flex items-center gap-2 rounded-2xl border p-3 text-left backdrop-blur-xl transition-all duration-300 ${
                      done
                        ? 'border-green-400/30 bg-green-500/10 text-green-300 shadow-[0_0_16px_-4px_rgba(74,222,128,0.35)]'
                        : 'border-white/[0.07] bg-surface-2/70 shadow-card hover:-translate-y-0.5 hover:border-neon/35 hover:shadow-glow-neon'
                    }`}
                  >
                    <span className={`transition-all duration-300 ${done ? '' : 'text-violet-300 group-hover:scale-110 group-hover:text-violet-200 group-hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]'}`}>
                      {done ? <CheckCircle2 size={16} /> : m.icon}
                    </span>
                    <span className={`text-sm font-semibold ${done ? '' : 'text-white'}`}>{m.label}</span>
                  </button>
                );
              })}
            </div>
            {flywheel.allDone && flywheel.reflection && (
              <div className="mt-3 rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-xs text-violet-200">
                {flywheel.reflection}
              </div>
            )}
            {!flywheel.allDone && (
              <p className="mt-3 text-xs text-muted">{needsScript ? '完成写作 + 听写 + 字形三路，即可点亮今日连胜 🔥' : '完成写作 + 听写两路，即可点亮今日连胜 🔥'}</p>
            )}
          </GlassCard>
        )}
      </section>

      {/* Daily Quests */}
      <section className="page-enter" style={{ animationDelay: '80ms' }}>
        <SectionTitle
          className="mb-3"
          title={<span className="flex items-center gap-2"><Target size={18} className="text-neon" />今日任务</span>}
          right={<NeonBadge tone={questsCompletedAll ? 'cyan' : 'neon'}>{doneCount}/{user.dailyQuests.length} 完成</NeonBadge>}
        />
        <div className="grid gap-3">
          {user.dailyQuests.map((q, i) => {
            const pct = Math.min(100, Math.round((q.current / q.target) * 100));
            return (
              <GlassCard
                key={q.id}
                className={`page-enter flex items-center gap-4 p-4 ${
                  q.completed ? 'border-green-400/25 shadow-[0_0_16px_-4px_rgba(74,222,128,0.35)]' : ''
                }`}
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
                  q.completed
                    ? 'bg-green-500/15 text-green-400 shadow-[0_0_12px_rgba(74,222,128,0.4)]'
                    : 'bg-neon/12 text-violet-300 shadow-glow-sm'
                }`}>
                  {q.completed ? <CheckCircle2 size={20} /> : QUEST_ICON[q.kind]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`truncate text-sm font-semibold ${q.completed ? 'text-green-300' : 'text-white'}`}>
                      {q.label}
                    </span>
                    <span className="ml-2 whitespace-nowrap text-xs text-muted">
                      {Math.min(q.current, q.target)}/{q.target}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-line/70">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${q.completed ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'xp-bar'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {!q.completed && (
                  <NeonButton size="sm" onClick={() => onNavigate(QUEST_TO_MODE[q.kind])}>
                    去完成 <ArrowRight size={14} />
                  </NeonButton>
                )}
                {q.completed && (
                  <NeonBadge tone="pink" className="whitespace-nowrap">
                    <Sparkles size={13} />+{q.rewardXP} XP
                  </NeonBadge>
                )}
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* Quick stats + review */}
      <section className="page-enter grid gap-3 md:grid-cols-3" style={{ animationDelay: '160ms' }}>
        <GlassCard interactive={dueCount > 0} className="flex items-center gap-3 p-4" onClick={dueCount > 0 ? () => onNavigate(AppMode.Vocabulary) : undefined}>
          <BookOpen size={22} className="text-violet-300 drop-shadow-[0_0_6px_rgba(139,92,246,0.7)]" />
          <div>
            <div className="text-xl font-bold text-white">{dueCount}</div>
            <div className="text-xs text-muted">待复习单词</div>
          </div>
          {dueCount > 0 && (
            <span className="ml-auto text-xs font-bold text-violet-300">复习 →</span>
          )}
        </GlassCard>
        <GlassCard className="flex items-center gap-3 p-4">
          <Trophy size={22} className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
          <div>
            <div className="text-xl font-bold text-white">{weeklyOutput}</div>
            <div className="text-xs text-muted">本周输出字数</div>
          </div>
        </GlassCard>
        <GlassCard className="flex items-center gap-3 p-4">
          <Flame size={22} className="text-orange-400 flame-flicker" />
          <div>
            <div className="text-xl font-bold text-white">{user.maxStreak}</div>
            <div className="text-xs text-muted">最长连击</div>
          </div>
        </GlassCard>
      </section>

      {/* Mode launcher */}
      <section className="page-enter" style={{ animationDelay: '220ms' }}>
        <SectionTitle className="mb-3" title="随便练点什么" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { mode: AppMode.RPG, label: '剧情对话', icon: <MessageSquare size={22} />, desc: '情景对话练口语' },
            { mode: AppMode.Typing, label: '打字冒险', icon: <Type size={22} />, desc: '手感与速度' },
            { mode: AppMode.Writing, label: '写作工坊', icon: <PenTool size={22} />, desc: 'AI 批改输出' },
            { mode: AppMode.InkQuest, label: '墨程', icon: <Feather size={22} />, desc: '微写作 + AI 教练' },
            { mode: AppMode.Import, label: '导入内容', icon: <BookOpen size={22} />, desc: '学你自己的材料' },
          ].map((m, i) => (
            <GlassCard
              key={m.mode}
              interactive
              onClick={() => onNavigate(m.mode)}
              className="page-enter group p-4 text-left"
              style={{ animationDelay: `${260 + i * 50}ms` }}
            >
              <div className="mb-2 text-violet-300 transition-all duration-300 group-hover:scale-110 group-hover:text-violet-200 group-hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]">{m.icon}</div>
              <div className="text-sm font-bold text-white">{m.label}</div>
              <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DailyView;
