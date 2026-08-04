
import React, { useMemo, useState, useRef } from 'react';
import { UserProfile, ActivityLog, Language, LanguageProgress, CEFRLevel, MentorPersona, TargetExam } from '../types';
import { getLogs, ensureLanguageProgress, saveUser, getAIConfig, saveAIConfig, clearAllLearningData, AIConfig } from '../services/storageService';
import { testModelConnection, GLM_ENV_API_KEY } from '../services/aiService';
import { Trophy, Flame, Calendar, Clock, PenTool, Type, Zap, TrendingUp, TrendingDown, Activity, Check, Globe, Settings, GraduationCap, ChevronDown, User, LogOut, Download, Upload, Database, Crown, AlertTriangle } from 'lucide-react';
import { SUPPORTED_LANGUAGES, MENTOR_PERSONAS, TOPIC_PACKAGES } from '../constants';
import AssessmentView from './AssessmentView';

interface ProfileViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

// 考试目标 ↔ 语言 映射（用于下拉筛选与切换语言时自动回落）
const EXAM_LANGUAGE_MAP: Record<TargetExam, Language | null> = {
  none: null,
  IELTS: Language.English,
  TOEFL: Language.English,
  JLPT: Language.Japanese,
  TOPIK: Language.Korean,
  DELE: Language.Spanish,
};

const EXAM_OPTIONS: { value: TargetExam; label: string; lang: Language | null }[] = [
  { value: 'none', label: '无（通用 CEFR 反馈）', lang: null },
  { value: 'IELTS', label: '雅思 IELTS（英语）', lang: Language.English },
  { value: 'TOEFL', label: '托福 TOEFL（英语·暂未评分）', lang: Language.English },
  { value: 'JLPT', label: '日语 JLPT', lang: Language.Japanese },
  { value: 'TOPIK', label: '韩语 TOPIK', lang: Language.Korean },
  { value: 'DELE', label: '西语 DELE', lang: Language.Spanish },
];

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [showAssessment, setShowAssessment] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [clearDataOnLogout, setClearDataOnLogout] = useState(false);

  // --- Runtime model switcher (Settings -> 模型设置) ---
  const [modelCfg, setModelCfg] = useState<AIConfig>(() => getAIConfig());
  const [modelTest, setModelTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'error'; msg: string }>({ status: 'idle', msg: '' });

  const updateActiveProvider = (patch: Partial<{ baseUrl: string; model: string; apiKey: string }>) => {
    const key = modelCfg.active;
    if (key !== 'glm' && key !== 'custom') return;
    setModelCfg({ ...modelCfg, [key]: { ...modelCfg[key], ...patch } });
  };
  const handleSaveModel = () => {
    saveAIConfig(modelCfg);
    setModelTest({ status: 'idle', msg: '已保存。下一次 AI 调用将使用所选模型。' });
  };
  const handleTestModel = async () => {
    setModelTest({ status: 'testing', msg: '正在测试连接…' });
    try {
      const res = await testModelConnection(modelCfg);
      setModelTest({ status: 'ok', msg: `连接成功：${res.trim().slice(0, 60)}` });
    } catch (e: any) {
      setModelTest({ status: 'error', msg: `连接失败：${e?.message || e}` });
    }
  };

  const logs = getLogs();
  const currentProgress = user.progress[user.learningLanguage];

  // 考试下拉：仅显示与当前学习语言匹配的考试（保留已选但暂不匹配的项）
  const selectedExam = user.targetExam ?? 'none';
  const examOptions = useMemo(() => {
    const list = EXAM_OPTIONS.filter(o => o.lang === null || o.lang === user.learningLanguage);
    if (!list.some(o => o.value === selectedExam)) {
      const extra = EXAM_OPTIONS.find(o => o.value === selectedExam);
      if (extra) list.push(extra);
    }
    return list;
  }, [user.learningLanguage, selectedExam]);
  
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
        // Only sessions that actually recorded accuracy (e.g. typing) count.
        // Writing/tree/vocab logs have no accuracy and must not pollute the rate.
        const accLogs = ls.filter(l => typeof l.details.accuracy === 'number');
        if (!accLogs.length) return 0;
        const totalAcc = accLogs.reduce((acc, l) => acc + (l.details.accuracy as number), 0);
        const avgAcc = totalAcc / accLogs.length;
        return 100 - avgAcc;
    };

    const currentErrorRate = getAvgError(week1Logs);
    const prevErrorRate = getAvgError(week2Logs);
    const errorRateDiff = currentErrorRate - prevErrorRate; 

    // 4. Accuracy Trend (Last 7 active sessions that recorded accuracy)
    const recentSessions = [...langLogs]
        .filter(l => typeof l.details.accuracy === 'number')
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-7);
        
    const accuracyTrend = recentSessions.map(l => ({
        date: l.date.slice(5),
        acc: l.details.accuracy as number,
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
    // 考试目标与该语言不匹配时回落到通用 CEFR，避免无效组合
    const examLang = EXAM_LANGUAGE_MAP[updatedUser.targetExam ?? 'none'];
    if (examLang && examLang !== lang) updatedUser.targetExam = 'none';
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

  // 考试目标（写作批改评分体系门控）。雅思仅对英语生效。
  const handleTargetExamChange = (exam: TargetExam) => {
    const updatedUser = { ...user, targetExam: exam };
    onUpdateUser(updatedUser);
  };

  // --- Personalization (Phase 2/3) ---
  const handleMentorChange = (id: MentorPersona) => {
    const updatedUser = { ...user, mentorPersona: id };
    onUpdateUser(updatedUser);
  };

  const handleTopicToggle = (id: string) => {
    const has = user.preferredTopics.includes(id);
    const preferredTopics = has ? user.preferredTopics.filter(t => t !== id) : [...user.preferredTopics, id];
    const updatedUser = {
      ...user,
      preferredTopics,
      aiMemory: { ...user.aiMemory, interests: preferredTopics },
    };
    onUpdateUser(updatedUser);
  };

  const handleGoalsChange = (text: string) => {
    const goals = text.split(/[\n；;]/).map(s => s.trim()).filter(Boolean);
    const updatedUser = { ...user, aiMemory: { ...user.aiMemory, goals } };
    onUpdateUser(updatedUser);
  };

  const [newWeakPoint, setNewWeakPoint] = useState('');
  const handleAddWeakPoint = () => {
    const w = newWeakPoint.trim();
    if (!w) return;
    if (user.aiMemory.weakPoints.includes(w)) { setNewWeakPoint(''); return; }
    const updatedUser = { ...user, aiMemory: { ...user.aiMemory, weakPoints: [...user.aiMemory.weakPoints, w] } };
    onUpdateUser(updatedUser);
    setNewWeakPoint('');
  };

  // --- Local backup / restore (Phase 3 云同步占位) ---
  const fileRef = useRef<HTMLInputElement>(null);
  const BACKUP_KEYS = [
    'linguaflow_user', 'linguaflow_logs', 'linguaflow_library',
    'linguaflow_writing_tree', 'linguaflow_vocabulary', 'linguaflow_rpg_session',
  ];

  const exportBackup = () => {
    const data: Record<string, string | null> = {};
    BACKUP_KEYS.forEach(k => { data[k] = localStorage.getItem(k); });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linguaflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        BACKUP_KEYS.forEach(k => {
          if (data[k] != null) localStorage.setItem(k, data[k]);
        });
        const reloaded = localStorage.getItem('linguaflow_user');
        if (reloaded) onUpdateUser(JSON.parse(reloaded));
        alert('备份已导入，数据已恢复。');
      } catch {
        alert('导入失败：文件格式不正确。');
      }
    };
    reader.readAsText(file);
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
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-colors"
            >
                <LogOut size={14} /> 退出登录
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
                        <Calendar size={14} /> 加入于 {new Date(user.joinedDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 bg-gray-700/50 px-3 py-1 rounded-full text-sm border border-secondary/30">
                        {user.learningLanguage} • {currentProgress.cefrLevel}
                    </span>
                </div>
                
                {/* Level / XP Bar for CURRENT language */}
                <div className="mt-6 max-w-md w-full">
                    <div className="flex justify-between text-sm mb-1 font-semibold">
                        <span className="text-secondary">等级 {currentProgress.level}</span>
                        <span className="text-gray-400">{currentProgress.xp} 经验</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden w-full">
                        <div 
                            className="h-full bg-gradient-to-r from-primary to-secondary" 
                            style={{ width: `${Math.min(100, ((currentProgress.xp % 500) / 500) * 100)}%` }} 
                        />
                    </div>
                </div>
            </div>

            {/* Main Streak Counter */}
            <div className="flex flex-col items-center p-5 bg-orange-500/10 border border-orange-500/30 rounded-2xl min-w-[140px]">
                <Flame size={36} className="text-orange-500 mb-2 animate-pulse" />
                <span className="text-4xl font-bold text-white">{user.currentStreak}</span>
                <span className="text-xs text-orange-400 uppercase font-bold tracking-wider">连续天数</span>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-secondary text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Activity size={16} /> 概览
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-secondary text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Settings size={16} /> 学习设置
          </button>
      </div>

      {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Left Col: Calendar & Multi-Language Stats */}
            <div className="space-y-6">
                
                {/* Multi-Language Stats Card */}
                <div className="bg-card border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Globe size={20} className="text-blue-400" /> 语言进度
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
                                        <span className="text-xs font-bold text-secondary">等级 {prog.level}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-secondary" style={{ width: `${Math.min(100, ((prog.xp % 500) / 500) * 100)}%` }}></div>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                                        <span>{prog.totalWordsTyped} 字已输入</span>
                                        <span>{prog.xp} 经验</span>
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
                            <span className="w-2 h-2 rounded-full bg-secondary"></span> 已活跃
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2 text-center text-sm">
                        {['日','一','二','三','四','五','六'].map(d => (
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
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">30 天平均输出量</p>
                                <p className="text-3xl font-bold text-white mt-2">{analytics.avgWordsDaily} <span className="text-base font-normal text-gray-500">字/天</span></p>
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
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">错误率（每周）</p>
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
                    <h3 className="text-lg font-bold text-white mb-6">近期准确率趋势</h3>
                    <div className="h-32 flex items-end justify-between gap-2">
                        {analytics.accuracyTrend.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 italic">近期没有活动</div>
                        ) : (
                            analytics.accuracyTrend.map((item, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                    <div className="absolute -top-8 bg-gray-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {item.acc}%
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
                        <Clock size={18} className="text-gray-400" /> 近期记录
                    </div>
                    <div className="divide-y divide-gray-700 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {logs.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">还没有活动，开始训练吧！</div>
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
                                        {log.details.wpm && <span>速度：<span className="text-gray-200">{log.details.wpm} 词/分</span></span>}
                                        {log.details.accuracy && <span>准确率：<span className="text-gray-200">{log.details.accuracy}%</span></span>}
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
                      <User size={20} className="text-secondary" /> 语言设置
                  </h3>

                  <div className="space-y-6">
                      {/* Language Selector */}
                      <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">目标语言</label>
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
                        <p className="text-xs text-gray-500 mt-2">切换语言会保存当前语言的学习进度。</p>
                      </div>

                      {/* Level Selector */}
                      <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">熟练度等级</label>
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
                        <p className="text-xs text-gray-500 mt-2">如果觉得内容太简单或太难，可手动调整。</p>
                      </div>

                      {/* Target Exam Selector */}
                      <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">考试目标（写作评分）</label>
                        <div className="relative">
                            <select
                                value={user.targetExam ?? 'none'}
                                onChange={(e) => handleTargetExamChange(e.target.value as TargetExam)}
                                className="w-full appearance-none bg-dark border border-gray-700 text-white rounded-xl py-3 pl-4 pr-10 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none cursor-pointer text-lg"
                            >
                                {examOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">考试评分与学习语言一一对应：IELTS→英语、JLPT→日语、TOPIK→韩语、DELE→西语；选错语言会自动回落到通用 CEFR 反馈。TOEFL 暂未实现。</p>
                      </div>

                      {/* AI Assessment Trigger */}
                      <div className="pt-4 border-t border-gray-700">
                          <p className="text-sm text-gray-300 mb-3">不确定自己的水平？</p>
                          <button 
                             onClick={() => setShowAssessment(true)}
                             className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                          >
                              <Zap size={18} /> 进行 AI 水平测试
                          </button>
                      </div>
                  </div>
              </div>

              {/* Personalization Card */}
              <div className="bg-card border border-gray-700 rounded-2xl p-6 h-fit">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <User size={20} className="text-secondary" /> AI 导师与兴趣
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block">导师风格</label>
                    <div className="grid grid-cols-2 gap-2">
                      {MENTOR_PERSONAS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleMentorChange(m.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${user.mentorPersona === m.id ? 'bg-primary/20 border-primary' : 'bg-dark border-gray-600 hover:border-gray-400'}`}
                        >
                          <div className="text-sm font-bold text-white">{m.emoji} {m.label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{m.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block">兴趣主题（决定练习内容偏向）</label>
                    <div className="flex flex-wrap gap-2">
                      {TOPIC_PACKAGES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTopicToggle(t.id)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${user.preferredTopics.includes(t.id) ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-dark border-gray-600 text-gray-400 hover:border-gray-400'}`}
                        >
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block">学习目标（每行一个，AI 会记住并据此陪练）</label>
                    <textarea
                      value={user.aiMemory.goals.join('\n')}
                      onChange={(e) => handleGoalsChange(e.target.value)}
                      placeholder={"例如：\n能去咖啡店点单\n通过雅思口语6.5\n看懂无字幕美剧"}
                      className="w-full bg-dark border border-gray-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-secondary resize-none h-24"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block">薄弱点（AI 会据此重点纠正，可手动补充）</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.aiMemory.weakPoints.length === 0 && (
                        <span className="text-xs text-gray-600">暂无记录。练得越多，AI 越懂你的弱点。</span>
                      )}
                      {user.aiMemory.weakPoints.map((w, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-300">
                          {w}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newWeakPoint}
                        onChange={(e) => setNewWeakPoint(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddWeakPoint()}
                        placeholder="如：过去时态、发音 r/l"
                        className="flex-1 bg-dark border border-gray-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-secondary"
                      />
                      <button
                        onClick={handleAddWeakPoint}
                        className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/80"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Settings Card */}
              <div className="bg-card border border-gray-700 rounded-2xl p-6 h-fit">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Settings size={20} className="text-purple-400" /> 模型设置
                </h3>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  切换驱动 AI 的底层模型。保存后，打字、写作批改、RPG 对话等所有 AI 功能都会使用所选模型。
                </p>

                <label className="text-sm font-bold text-gray-400 mb-2 block">当前模型</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {([
                    { id: 'glm', label: '智谱 GLM', desc: 'GLM-4.7-Flash' },
                    { id: 'qwen', label: 'Qwen', desc: 'DashScope' },
                    { id: 'openrouter', label: 'OpenRouter', desc: '多模型网关' },
                    { id: 'custom', label: '自定义', desc: 'OpenAI 兼容端点' },
                  ] as const).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setModelCfg({ ...modelCfg, active: p.id })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${modelCfg.active === p.id ? 'bg-primary/20 border-primary' : 'bg-dark border-gray-600 hover:border-gray-400'}`}
                    >
                      <div className="text-sm font-bold text-white">{p.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {(modelCfg.active === 'glm' || modelCfg.active === 'custom') && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">API 地址（Base URL）</label>
                      <input
                        value={modelCfg[modelCfg.active as 'glm' | 'custom'].baseUrl}
                        onChange={(e) => updateActiveProvider({ baseUrl: e.target.value })}
                        placeholder="https://open.bigmodel.cn/api/paas/v4"
                        className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">模型名称</label>
                      <input
                        value={modelCfg[modelCfg.active as 'glm' | 'custom'].model}
                        onChange={(e) => updateActiveProvider({ model: e.target.value })}
                        placeholder="GLM-4.7-Flash"
                        className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">API 密钥</label>
                      <input
                        type="password"
                        value={modelCfg[modelCfg.active as 'glm' | 'custom'].apiKey}
                        onChange={(e) => updateActiveProvider({ apiKey: e.target.value })}
                        placeholder={modelCfg.active === 'glm' && GLM_ENV_API_KEY ? '已配置 .env 中的 GLM_API_KEY（可留空）' : '留空则使用 .env 密钥'}
                        className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-secondary"
                      />
                    </div>
                  </div>
                )}

                {(modelCfg.active === 'qwen' || modelCfg.active === 'openrouter') && (
                  <p className="text-xs text-gray-500 mb-4">该模型的密钥来自 <code className="text-gray-300">.env</code>，在此不可编辑。</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveModel}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white text-sm font-bold transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleTestModel}
                    disabled={modelTest.status === 'testing'}
                    className="flex-1 py-2.5 rounded-xl bg-dark hover:bg-gray-800 text-gray-200 border border-gray-600 text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {modelTest.status === 'testing' ? '测试中…' : '测试连接'}
                  </button>
                </div>
                {modelTest.msg && (
                  <p className={`text-xs mt-3 ${modelTest.status === 'error' ? 'text-red-400' : modelTest.status === 'ok' ? 'text-green-400' : 'text-gray-400'}`}>
                    {modelTest.msg}
                  </p>
                )}
              </div>

              {/* Data & Backup Card */}
              <div className="bg-card border border-gray-700 rounded-2xl p-6 h-fit">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Database size={20} className="text-blue-400" /> 数据备份与同步
                </h3>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  LinguaFlow 默认<b className="text-white">纯本地</b>存储，隐私不出本机。导出备份可在换设备时恢复；云端同步（多端实时同步、无限存储）是计划中的增值功能。
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={exportBackup}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/50 font-bold transition-colors"
                  >
                    <Download size={16} /> 导出本地备份
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark hover:bg-gray-800 text-gray-200 border border-gray-600 font-bold transition-colors"
                  >
                    <Upload size={16} /> 导入备份恢复
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importBackup(f);
                      e.target.value = '';
                    }}
                  />
                </div>

                <div className="mt-5 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={16} className="text-yellow-400" />
                    <span className="text-sm font-bold text-white">LinguaFlow 高级</span>
                    {user.premium && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">已解锁</span>}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    高级模型、无限云同步、真人陪练预约等增值能力正在规划中。当前所有核心功能完全免费、本地可用。
                  </p>
                </div>
              </div>

              {/* Assessment Area */}
              {showAssessment ? (
                  <div className="bg-card border border-gray-700 rounded-2xl p-6 animate-in slide-in-from-right duration-500">
                       <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-white">水平评估</h3>
                           <button onClick={() => setShowAssessment(false)} className="text-gray-500 hover:text-white text-sm">取消</button>
                       </div>
                       <AssessmentView language={user.learningLanguage} onLevelSet={handleLevelChange} />
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-900/30 border border-dashed border-gray-800 rounded-2xl">
                      <Zap size={48} className="text-gray-700 mb-4" />
                      <p className="text-gray-500 max-w-xs">
                          做一次水平测试，让 AI 分析你的写作并自动设定 CEFR 等级。
                      </p>
                  </div>
              )}
          </div>
      )}

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-gray-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white">退出登录</h3>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed mb-2">
              退出只会回到登录页，<b className="text-white">本机练习数据仍会保留</b>。如果你换个昵称重新注册，新账号会沿用这些已有数据。
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              想彻底清空、重新开始，请勾选下方选项。
            </p>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-dark border border-gray-700 cursor-pointer mb-6 hover:border-gray-500 transition-colors">
              <input
                type="checkbox"
                checked={clearDataOnLogout}
                onChange={(e) => setClearDataOnLogout(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer"
              />
              <span className="text-sm text-gray-300 leading-relaxed">
                同时清除本机所有学习数据（写作树、词库、活动日志、词汇、字形进度）。
                <span className="block text-xs text-gray-500 mt-1">AI 模型配置将保留，无需重新填写密钥。</span>
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowLogoutModal(false); setClearDataOnLogout(false); }}
                className="flex-1 py-2.5 rounded-xl bg-dark hover:bg-gray-800 text-gray-200 border border-gray-600 font-bold transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (clearDataOnLogout) clearAllLearningData();
                  setShowLogoutModal(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
