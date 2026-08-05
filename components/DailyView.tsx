
import React, { useState, useEffect } from 'react';
import { UserProfile, AppMode, QuestKind, ActivityLog } from '../types';
import { getDueVocabulary, getLogs } from '../services/storageService';
import { Flame, Shield, CheckCircle2, ArrowRight, Sparkles, Target, BookOpen, MessageSquare, PenTool, Type, Trophy, PenLine, Feather } from 'lucide-react';

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

  useEffect(() => {
    setDueCount(getDueVocabulary().length);
    const logs: ActivityLog[] = getLogs();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const weekLogs = logs.filter((l) => l.timestamp >= weekAgo);
    const out = weekLogs.reduce((acc, l) => acc + (l.details.wordCount || 0), 0);
    setWeeklyOutput(out);
    setDoneCount(user.dailyQuests.filter((q) => q.completed).length);
  }, [user]);

  const questsCompletedAll = user.dailyQuests.length > 0 && user.dailyQuests.every((q) => q.completed);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-primary/15 via-surface-2 to-surface-2 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">
              你好，{user.username} 👋
            </h1>
            <p className="mt-1 text-sm text-muted">
              {questsCompletedAll
                ? '今天的任务全部完成，太棒了！继续保持 🔥'
                : '今天也来输出一点点，比昨天更靠近母语一点点。'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center rounded-xl border border-line bg-surface-3/60 px-4 py-2">
              <div className="flex items-center gap-1 text-orange-500">
                <Flame size={20} />
                <span className="text-2xl font-bold">{user.currentStreak}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted">连续天数</span>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-line bg-surface-3/60 px-4 py-2">
              <div className="flex items-center gap-1 text-sky-400">
                <Shield size={20} />
                <span className="text-2xl font-bold">{user.streakShields}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted">护盾</span>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Quests */}
      <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="mb-3 flex items-center gap-2">
          <Target size={18} className="text-secondary" />
          <h2 className="text-lg font-bold text-white">今日任务</h2>
          <span className="text-xs text-muted">
            {doneCount}/{user.dailyQuests.length} 完成
          </span>
        </div>
        <div className="grid gap-3">
          {user.dailyQuests.map((q) => {
            const pct = Math.min(100, Math.round((q.current / q.target) * 100));
            return (
              <div
                key={q.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  q.completed ? 'border-green-700/40 bg-green-900/10' : 'border-line bg-surface-2'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  q.completed ? 'bg-green-600/20 text-green-400' : 'bg-primary/15 text-primary'
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
                  <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                    <div className={`h-full transition-all duration-500 ${q.completed ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {!q.completed && (
                  <button
                    onClick={() => onNavigate(QUEST_TO_MODE[q.kind])}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/80"
                  >
                    去完成 <ArrowRight size={14} />
                  </button>
                )}
                {q.completed && (
                  <span className="flex items-center gap-1 text-xs font-bold text-yellow-400">
                    <Sparkles size={14} />+{q.rewardXP} XP
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick stats + review */}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <BookOpen size={22} className="text-secondary" />
          <div>
            <div className="text-xl font-bold text-white">{dueCount}</div>
            <div className="text-xs text-muted">待复习单词</div>
          </div>
          {dueCount > 0 && (
            <button onClick={() => onNavigate(AppMode.Vocabulary)} className="ml-auto text-xs font-bold text-primary">
              复习 →
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <Trophy size={22} className="text-yellow-400" />
          <div>
            <div className="text-xl font-bold text-white">{weeklyOutput}</div>
            <div className="text-xs text-muted">本周输出字数</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <Flame size={22} className="text-orange-400" />
          <div>
            <div className="text-xl font-bold text-white">{user.maxStreak}</div>
            <div className="text-xs text-muted">最长连击</div>
          </div>
        </div>
      </section>

      {/* Mode launcher */}
      <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h2 className="mb-3 text-lg font-bold text-white">随便练点什么</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { mode: AppMode.RPG, label: '剧情对话', icon: <MessageSquare size={22} />, desc: '情景对话练口语' },
            { mode: AppMode.Typing, label: '打字冒险', icon: <Type size={22} />, desc: '手感与速度' },
            { mode: AppMode.Writing, label: '写作工坊', icon: <PenTool size={22} />, desc: 'AI 批改输出' },
            { mode: AppMode.InkQuest, label: '墨程', icon: <Feather size={22} />, desc: '微写作 + AI 教练' },
            { mode: AppMode.Import, label: '导入内容', icon: <BookOpen size={22} />, desc: '学你自己的材料' },
          ].map((m) => (
            <button
              key={m.mode}
              onClick={() => onNavigate(m.mode)}
              className="group rounded-xl border border-line bg-surface-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-surface-3"
            >
              <div className="mb-2 text-primary transition-transform group-hover:scale-110">{m.icon}</div>
              <div className="text-sm font-bold text-white">{m.label}</div>
              <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DailyView;
