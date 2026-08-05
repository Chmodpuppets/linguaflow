
import React, { useState, useEffect } from 'react';
import { UserProfile, ActivityLog } from '../types';
import { getLogs } from '../services/storageService';
import { Users, Share2, Copy, Server, Trophy, Flame, CheckCircle2 } from 'lucide-react';

interface SocialViewProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
}

const SocialView: React.FC<SocialViewProps> = ({ user }) => {
  const [weeklyOutput, setWeeklyOutput] = useState(0);
  const [totalOutput, setTotalOutput] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [copied, setCopied] = useState(false);
  const [buddyCode, setBuddyCode] = useState('');

  const progress = user.progress[user.learningLanguage];

  useEffect(() => {
    const logs: ActivityLog[] = getLogs();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    setWeeklyOutput(logs.filter((l) => l.timestamp >= weekAgo).reduce((a, l) => a + (l.details.wordCount || 0), 0));
    setTotalOutput(logs.reduce((a, l) => a + (l.details.wordCount || 0), 0));
    setActiveDays(new Set(logs.map((l) => l.date)).size);
    const code = btoa(
      encodeURIComponent(
        JSON.stringify({
          u: user.username,
          lv: progress?.level,
          st: user.currentStreak,
          lang: user.learningLanguage,
          goals: user.aiMemory.goals,
        })
      )
    );
    setBuddyCode(code);
  }, [user]);

  const shareText = `我在用 LinguaFlow 学 ${user.learningLanguage} 🌍\n等级 Lv.${progress?.level} · 连击 ${user.currentStreak} 天 · 本周输出 ${weeklyOutput} 字\n输出驱动，真正把语言学出来。一起来当学习搭子？`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-neon" /> 学习搭子
        </h1>
        <p className="text-muted text-sm mt-1">
          语言学习最怕一个人放弃。找个水平相近的搭子，互相打卡、共闯任务，坚持率翻倍。
        </p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg border border-yellow-700/40 bg-yellow-900/10 text-yellow-200 text-xs">
        <Server size={16} className="shrink-0" />
        <span>
          完整社交功能（搭子智能匹配、双人 AI 情景对话、创作市集）需要后端账号系统，当前为<b>本地演示</b>：下面的学习卡片与搭子码都在你本机生成，不会上传任何服务器。真实匹配将在后端就绪后开放。
        </span>
      </div>

      {/* 学习卡片 */}
      <div className="rounded-2xl border border-neon/30 bg-gradient-to-br from-neon/20 to-neon-2/10 p-6 shadow-glow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">{user.username}</div>
            <div className="text-xs text-muted">LinguaFlow · {user.learningLanguage}</div>
          </div>
          <div className="flex items-center gap-1 text-orange-400">
            <Flame size={18} /> <span className="text-lg font-bold">{user.currentStreak}</span>
            <span className="text-xs text-muted">天连击</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 text-center">
          <div className="bg-white/5 rounded-xl py-3">
            <div className="text-2xl font-bold text-white">Lv.{progress?.level}</div>
            <div className="text-[10px] text-muted uppercase">等级</div>
          </div>
          <div className="bg-white/5 rounded-xl py-3">
            <div className="text-2xl font-bold text-white">{weeklyOutput}</div>
            <div className="text-[10px] text-muted uppercase">本周输出</div>
          </div>
          <div className="bg-white/5 rounded-xl py-3">
            <div className="text-2xl font-bold text-white">{user.maxStreak}</div>
            <div className="text-[10px] text-muted uppercase">最长连击</div>
          </div>
        </div>
        <button
          onClick={() => copy(shareText)}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-neon/20 hover:bg-neon/30 text-white text-sm font-bold shadow-glow-neon"
        >
          <Share2 size={16} /> {copied ? '已复制分享文案' : '复制分享文案'}
        </button>
      </div>

      {/* 搭子码 */}
      <div className="p-4 rounded-xl border border-white/10 glass-panel">
        <div className="flex items-center gap-2 mb-2">
          <Copy size={16} className="text-neon-2" />
          <span className="text-sm font-bold text-white">我的搭子码</span>
        </div>
        <p className="text-xs text-muted mb-2">把这段代码发给朋友，对方在「导入搭子码」即可建立本地搭档关系（演示）。</p>
        <div className="flex gap-2">
          <code className="flex-1 text-[11px] text-muted bg-white/5 rounded p-2 break-all max-h-20 overflow-auto">
            {buddyCode}
          </code>
          <button
            onClick={() => copy(buddyCode)}
            className="px-3 py-2 rounded-lg bg-neon text-white text-xs font-bold self-start shadow-glow-sm"
          >
            复制
          </button>
        </div>
      </div>

      {/* 个人最佳 */}
      <div className="p-4 rounded-xl border border-white/10 glass-panel">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-yellow-400" />
          <span className="text-sm font-bold text-white">个人最佳（本地）</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-white">{totalOutput}</div>
            <div className="text-[10px] text-muted">累计输出字数</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{activeDays}</div>
            <div className="text-[10px] text-muted">活跃天数</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{user.joinedDate ? Math.max(1, Math.floor((Date.now() - user.joinedDate) / 86400000)) : 1}</div>
            <div className="text-[10px] text-muted">加入天数</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-green-400/80 border-t border-line pt-3">
        <CheckCircle2 size={14} /> 想让我把真实社交做出来？需要搭建后端（账号 + 匹配 + 实时对话）。可以下一步单独排期。
      </div>
    </div>
  );
};

export default SocialView;
