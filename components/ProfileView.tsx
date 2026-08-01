
import React, { useMemo, useState } from 'react';
import { UserProfile, ActivityLog, Language, LanguageProgress, CEFRLevel } from '../types';
import { getLogs, ensureLanguageProgress } from '../services/storageService';
import { Trophy, Flame, Calendar, Clock, PenTool, Type, Zap, TrendingUp, TrendingDown, Activity, Check, Globe, Settings, GraduationCap, ChevronDown, User, LogOut } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../constants';
import AssessmentView from './AssessmentView';

interface ProfileViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [showAssessment, setShowAssessment] = useState(false);

  const logs = getLogs();
  const currentProgress = user.progress[user.learningLanguage];
  
  // --- Analytics & Calculations ---
  const analytics = useMemo(() => {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Helper: Get logs for specific language
    const langLogs = logs.filter(l => l.language === user.learningLanguage);

    // 1. Calendar Data (Current Month)
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    
    const calendarDays = [];
    // Padding for empty start days
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push({ date: '', active: false, future: false });
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentYear, currentMonth, d);
        const dateStr = dateObj.toISOString().split('T')[0];
        const isActive = logs.some(l => l.date === dateStr);
        const isFuture = dateObj > now;
        calendarDays.push({ date: dateStr, dayNum: d, active: isActive, future: isFuture });
    }

    // 2. Trends: Avg Words (Last 30 Days)
    const thirtyDaysAgo = new Date(now.getTime() - (30 * oneDay));
    const last30DaysLogs = langLogs.filter(l => new Date(l.timestamp) >= thirtyDaysAgo);
    const totalWords30 = last30DaysLogs.reduce((acc, l) => acc + (l.details.wordCount || 0), 0);
    const avgWordsDaily = last30DaysLogs.length > 0 ? Math.round(totalWords30 / 30) : 0;

    // 3. Trends: Error Rate Change (Last 7 Days vs Previous 7)
    const sevenDaysAgo = new Date(now.getTime() - (7 * oneDay));
    const fourteenDaysAgo = new Date(now.getTime() - (14 * oneDay));
    
    const week1Logs = langLogs.filter(l => new Date(l.timestamp) >= sevenDaysAgo);
    const week2Logs = langLogs.filter(l => new Date(l.timestamp) >= fourteenDaysAgo && new Date(l.timestamp) < sevenDaysAgo);

    const getAvgError = (ls: ActivityLog[]) => {
        if (!ls.length) return 0;
        const totalAcc = ls.reduce((acc, l) => acc + (l.details.accuracy || 0), 0);
        const avgAcc = totalAcc / ls.length;
        return 100 - avgAcc;
    };

    const currentErrorRate = getAvgError(week1Logs);
    const prevErrorRate = getAvgError(week2Logs);
    const errorRateDiff = currentErrorRate - prevErrorRate; 

    // 4. Accuracy Trend (Last 7 active sessions)
    const recentSessions = [...langLogs]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-7);
        
    const accuracyTrend = recentSessions.map(l => ({
        date: l.date.slice(5),
        acc: l.details.accuracy || 0,
        type: l.type
    }));

    const nativeLangCode = SUPPORTED_LANGUAGES.find(l => l.id === user.nativeLanguage)?.code || 'en-US';

    return {
        calendarDays,
        avgWordsDaily,
        currentErrorRate,
        prevErrorRate,
        errorRateDiff,
        accuracyTrend,
        monthName: now.toLocaleString(nativeLangCode, { month: 'long' })
    };
  }, [logs, user.learningLanguage, user.nativeLanguage]);

  // --- Actions ---

  const handleLanguageSwitch = (lang: Language) => {
    let updatedUser = { ...user, learningLanguage: lang };
    updatedUser = ensureLanguageProgress(updatedUser, lang);
    onUpdateUser(updatedUser);
  };

  const handleLevelChange = (level: CEFRLevel) => {
    const updatedUser = { ...user };
    if (!updatedUser.progress[user.learningLanguage]) {
        // Ensure progress exists before setting level
        ensureLanguageProgress(updatedUser, user.learningLanguage);
    }
    updatedUser.progress[user.learningLanguage].cefrLevel = level;
    onUpdateUser(updatedUser);
    setShowAssessment(false); // Close assessment if open
  };

  // --- Render Helpers ---

  const getLanguageFlag = (lang: string) => {
    return SUPPORTED_LANGUAGES.find(l => l.id === lang)?.flag || '🌐';
  };

  const getLanguageLabel = (lang: string) => {
    return SUPPORTED_LANGUAGES.find(l => l.id === lang)?.label || lang;
  };

  const activeLanguages = (Object.entries(user.progress) as [string, LanguageProgress][])
    .sort(([, a], [, b]) => b.xp - a.xp);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header Profile Card */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
            <Trophy size={200} />
        </div>

        {/* Log Out Button */}
        <div className="absolute top-4 right-4 z-20">
            <button 
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-colors"
            >
                <LogOut size={14} /> Log Out
            </button>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-24 h-24 md:w-28 md:h-28 bg-gray-700 rounded-full flex items-center justify-center text-4xl md:text-5xl border-4 border-secondary shadow-lg">
                {getLanguageFlag(user.learningLanguage)}
            </div>
            
            <div className="text-center md:text-left flex-1">
                <h2 className="text-3xl font-bold text-white mb-2">{user.username}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-gray-300">
                    <span className="flex items-center gap-1 bg-gray-700/50 px-3 py-1 rounded-full text-sm">
                        <Calendar size={14} /> Joined {new Date(user.joinedDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 bg-gray-700/50 px-3 py-1 rounded-full text-sm border border-secondary/30">
                        {user.learningLanguage} • {currentProgress.cefrLevel}
                    </span>
                </div>
                
                {/* Level / XP Bar for CURRENT language */}
                <div className="mt-6 max-w-md w-full">
                    <div className="flex justify-between text-sm mb-1 font-semibold">
                        <span className="text-secondary">Level {currentProgress.level}</span>
                        <span className="text-gray-400">{currentProgress.xp} XP</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden w-full">
                        <div 
                            className="h-full bg-gradient-to-r from-primary to-secondary" 
                            style={{ width: `${Math.min(100, (currentProgress.xp % 100))}%` }} 
                        />
                    </div>
                </div>
            </div>

            {/* Main Streak Counter */}
            <div className="flex flex-col items-center p-5 bg-orange-500/10 border border-orange-500/30 rounded-2xl min-w-[140px]">
                <Flame size={36} className="text-orange-500 mb-2 animate-pulse" />
                <span className="text-4xl font-bold text-white">{user.currentStreak}</span>
                <span className="text-xs text-orange-400 uppercase font-bold tracking-wider">Day Streak</span>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-secondary text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Activity size={16} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-secondary text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Settings size={16} /> Learning Settings
          </button>
      </div>

      {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Left Col: Calendar & Multi-Language Stats */}
            <div className="space-y-6">
                
                {/* Multi-Language Stats Card */}
                <div className="bg-card border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Globe size={20} className="text-blue-400" /> Language Progress
                    </h3>
                    <div className="space-y-3">
                        {activeLanguages.map(([lang, prog]) => (
                            <div key={lang} className={`flex items-center gap-3 p-3 rounded-xl border ${lang === user.learningLanguage ? 'bg-secondary/10 border-secondary/30' : 'bg-dark/50 border-gray-800'}`}>
                                <div className="text-2xl">{getLanguageFlag(lang)}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-semibold text-sm ${lang === user.learningLanguage ? 'text-white' : 'text-gray-400'}`}>
                                            {getLanguageLabel(lang)}
                                        </span>
                                        <span className="text-xs font-bold text-secondary">Lvl {prog.level}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (prog.xp % 100))}%` }}></div>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                                        <span>{prog.totalWordsTyped} words typed</span>
                                        <span>{prog.xp} XP</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Calendar */}
                <div className="bg-card border border-gray-700 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Calendar size={20} className="text-primary" /> {analytics.monthName}
                        </h3>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-secondary"></span> Active
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2 text-center text-sm">
                        {['S','M','T','W','T','F','S'].map(d => (
                            <div key={d} className="text-gray-500 font-bold text-xs py-1">{d}</div>
                        ))}
                        {analytics.calendarDays.map((d, i) => (
                            <div 
                                key={i} 
                                className={`
                                    aspect-square rounded-lg flex items-center justify-center text-xs relative
                                    ${!d.dayNum ? 'invisible' : ''}
                                    ${d.active ? 'bg-secondary text-white font-bold shadow-lg shadow-secondary/20' : 'bg-gray-800/50 text-gray-500'}
                                    ${d.future ? 'opacity-30' : ''}
                                `}
                            >
                                {d.dayNum}
                                {d.active && <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Middle & Right Col: Analytics & Trends */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Habit Trends Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 30 Day Avg */}
                    <div className="bg-card border border-gray-700 p-5 rounded-2xl flex flex-col justify-between h-32">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">30-Day Avg Volume</p>
                                <p className="text-3xl font-bold text-white mt-2">{analytics.avgWordsDaily} <span className="text-base font-normal text-gray-500">words/day</span></p>
                            </div>
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                <Activity size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Error Rate Trend */}
                    <div className="bg-card border border-gray-700 p-5 rounded-2xl flex flex-col justify-between h-32">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Error Rate (Weekly)</p>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <p className="text-3xl font-bold text-white">{analytics.currentErrorRate.toFixed(1)}%</p>
                                    {analytics.prevErrorRate > 0 && (
                                        <span className={`text-sm font-bold flex items-center ${analytics.errorRateDiff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {analytics.errorRateDiff <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                                            {Math.abs(analytics.errorRateDiff).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={`p-2 rounded-lg ${analytics.errorRateDiff <= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {analytics.errorRateDiff <= 0 ? <Check size={24} /> : <Activity size={24} />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Accuracy Graph (Simple Visual) */}
                <div className="bg-card border border-gray-700 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-6">Recent Accuracy Trend</h3>
                    <div className="h-32 flex items-end justify-between gap-2">
                        {analytics.accuracyTrend.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 italic">No recent activity</div>
                        ) : (
                            analytics.accuracyTrend.map((item, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                    <div className="absolute -top-8 bg-gray-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {item.acc}% • {item.type}
                                    </div>
                                    <div 
                                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 hover:brightness-110 ${item.acc >= 90 ? 'bg-green-500' : item.acc >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                        style={{ height: `${item.acc}%` }}
                                    />
                                    <span className="text-xs text-gray-500">{item.date}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent History List */}
                <div className="bg-card border border-gray-700 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700 font-bold text-white flex items-center gap-2">
                        <Clock size={18} className="text-gray-400" /> Recent History
                    </div>
                    <div className="divide-y divide-gray-700 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {logs.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No activity yet. Start training!</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${log.type === 'writing' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                {log.type === 'writing' ? <PenTool size={14} /> : <Type size={14} />}
                                            </div>
                                            <span className="font-semibold text-white">{log.summary}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 pl-9 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            {getLanguageFlag(log.language)} {getLanguageLabel(log.language)}
                                        </span>
                                        {log.details.wpm && <span>Speed: <span className="text-gray-200">{log.details.wpm} WPM</span></span>}
                                        {log.details.accuracy && <span>Acc: <span className="text-gray-200">{log.details.accuracy}%</span></span>}
                                        <span className="text-yellow-500/80">+{log.xpEarned} XP</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
              
              {/* Language Settings Card */}
              <div className="bg-card border border-gray-700 rounded-2xl p-6 h-fit">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <User size={20} className="text-secondary" /> Language Configuration
                  </h3>

                  <div className="space-y-6">
                      {/* Language Selector */}
                      <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">Target Language</label>
                        <div className="relative">
                            <select 
                                value={user.learningLanguage}
                                onChange={(e) => handleLanguageSwitch(e.target.value as Language)}
                                className="w-full appearance-none bg-dark border border-gray-700 text-white rounded-xl py-3 pl-4 pr-10 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none cursor-pointer text-lg"
                            >
                                {SUPPORTED_LANGUAGES.map(l => {
                                    const hasProgress = user.progress[l.id];
                                    return (
                                        <option key={l.id} value={l.id}>
                                            {l.flag} {l.label} {hasProgress ? `(Lvl ${hasProgress.level})` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Switching languages will save your progress for the current language.</p>
                      </div>

                      {/* Level Selector */}
                      <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">Proficiency Level</label>
                        <div className="relative">
                            <select 
                                value={currentProgress.cefrLevel}
                                onChange={(e) => handleLevelChange(e.target.value as CEFRLevel)}
                                className="w-full appearance-none bg-dark border border-gray-700 text-white rounded-xl py-3 pl-4 pr-10 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none cursor-pointer text-lg"
                            >
                                {Object.values(CEFRLevel).map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                            <GraduationCap className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Manually adjust if you feel the content is too easy or too hard.</p>
                      </div>

                      {/* AI Assessment Trigger */}
                      <div className="pt-4 border-t border-gray-700">
                          <p className="text-sm text-gray-300 mb-3">Not sure about your level?</p>
                          <button 
                             onClick={() => setShowAssessment(true)}
                             className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                          >
                              <Zap size={18} /> Take AI Level Check
                          </button>
                      </div>
                  </div>
              </div>

              {/* Assessment Area */}
              {showAssessment ? (
                  <div className="bg-card border border-gray-700 rounded-2xl p-6 animate-in slide-in-from-right duration-500">
                       <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-white">Proficiency Assessment</h3>
                           <button onClick={() => setShowAssessment(false)} className="text-gray-500 hover:text-white text-sm">Cancel</button>
                       </div>
                       <AssessmentView language={user.learningLanguage} onLevelSet={handleLevelChange} />
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-900/30 border border-dashed border-gray-800 rounded-2xl">
                      <Zap size={48} className="text-gray-700 mb-4" />
                      <p className="text-gray-500 max-w-xs">
                          Take a level check to let our AI analyze your writing and automatically set your CEFR level.
                      </p>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default ProfileView;
