
import React, { useState, useEffect } from 'react';
import { UserProfile, AppMode, QuestKind, ActivityLog } from '../types';
import { getDueVocabulary, getLogs } from '../services/storageService';
import { Flame, Shield, CheckCircle2, ArrowRight, Sparkles, Target, BookOpen, MessageSquare, PenTool, Type, Trophy } from 'lucide-react';

interface DailyViewProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
  onNavigate: (mode: AppMode) => void;
}

const QUEST_TO_MODE: Record<QuestKind, AppMode> = {
  typing_words: AppMode.Typing,
  vocab_review: AppMode.Vocabulary,
  rpg_sessions: AppMode.RPG,
  writing_words: AppMode.Writing,
};

const QUEST_ICON: Record<QuestKind, React.ReactNode> = {
  typing_words: <Type size={18} />,
  vocab_review: <BookOpen size={18} />,
  rpg_sessions: <MessageSquare size={18} />,
  writing_words: <PenTool size={18} />,
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/20 to-secondary/10 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              你好，{user.username} 👋
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {questsCompletedAll
                ? '今天的任务全部完成，太棒了！继续保持 🔥'
                : '今天也来输出一点点，比昨天更靠近母语一点点。'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center px-4 py-2 bg-gray-900/60 rounded-xl border border-gray-800">
              <div className="flex items-center gap-1 text-orange-500">
                <Flame size={20} />
                <span className="text-2xl font-bold">{user.currentStreak}</span>
              </div>
              <span className="text-[10px] text-gray-500 uppercase">Day Streak</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 bg-gray-900/60 rounded-xl border border-gray-800">
              <div className="flex items-center gap-1 text-sky-400">
                <Shield size={20} />
                <span className="text-2xl font-bold">{user.streakShields}</span>
              </div>
              <span className="text-[10px] text-gray-500 uppercase">护盾</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Quests */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Target size={18} className="text-secondary" />
          <h2 className="text-lg font-bold text-white">今日任务</h2>
          <span className="text-xs text-gray-500">
            {doneCount}/{user.dailyQuests.length} 完成
          </span>
        </div>
        <div className="grid gap-3">
          {user.dailyQuests.map((q) => {
            const pct = Math.min(100, Math.round((q.current / q.target) * 100));
            return (
              <div
                key={q.id}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  q.completed ? 'border-green-700/40 bg-green-900/10' : 'border-gray-800 bg-card'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  q.completed ? 'bg-green-600/20 text-green-400' : 'bg-primary/15 text-primary'
                }`}>
                  {q.completed ? <CheckCircle2 size={20} /> : QUEST_ICON[q.kind]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-semibold truncate ${q.completed ? 'text-green-300' : 'text-white'}`}>
                      {q.label}
                    </span>
                    <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                      {Math.min(q.current, q.target)}/{q.target}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${q.completed ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {!q.completed && (
                  <button
                    onClick={() => onNavigate(QUEST_TO_MODE[q.kind])}
                    className="flex items-center gap-1 text-xs font-bold text-white bg-primary hover:bg-primary/80 px-3 py-2 rounded-lg transition-colors"
                  >
                    去完成 <ArrowRight size={14} />
                  </button>
                )}
                {q.completed && (
                  <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                    <Sparkles size={14} />+{q.rewardXP} XP
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick stats + review */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-gray-800 bg-card flex items-center gap-3">
          <BookOpen size={22} className="text-secondary" />
          <div>
            <div className="text-xl font-bold text-white">{dueCount}</div>
            <div className="text-xs text-gray-500">待复习单词</div>
          </div>
          {dueCount > 0 && (
            <button onClick={() => onNavigate(AppMode.Vocabulary)} className="ml-auto text-xs text-primary font-bold">
              复习 →
            </button>
          )}
        </div>
        <div className="p-4 rounded-xl border border-gray-800 bg-card flex items-center gap-3">
          <Trophy size={22} className="text-yellow-400" />
          <div>
            <div className="text-xl font-bold text-white">{weeklyOutput}</div>
            <div className="text-xs text-gray-500">本周输出字数</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-gray-800 bg-card flex items-center gap-3">
          <Flame size={22} className="text-orange-400" />
          <div>
            <div className="text-xl font-bold text-white">{user.maxStreak}</div>
            <div className="text-xs text-gray-500">最长连击</div>
          </div>
        </div>
      </div>

      {/* Mode launcher */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3">随便练点什么</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { mode: AppMode.RPG, label: 'LinguaQuest', icon: <MessageSquare size={22} />, desc: '情景对话练口语' },
            { mode: AppMode.Typing, label: '打字冒险', icon: <Type size={22} />, desc: '手感与速度' },
            { mode: AppMode.Writing, label: '写作工坊', icon: <PenTool size={22} />, desc: 'AI 批改输出' },
            { mode: AppMode.Import, label: '导入内容', icon: <BookOpen size={22} />, desc: '学你自己的材料' },
          ].map((m) => (
            <button
              key={m.mode}
              onClick={() => onNavigate(m.mode)}
              className="p-4 rounded-xl border border-gray-800 bg-card hover:border-primary/60 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="text-primary mb-2">{m.icon}</div>
              <div className="text-sm font-bold text-white">{m.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DailyView;
