
import React, { useState, useEffect, useRef } from 'react';
import { Language, CEFRLevel, AppMode, UserProfile } from './types';
import { SUPPORTED_LANGUAGES, NAV_ITEMS } from './constants';
import { getUser, saveUser, ensureLanguageProgress, logoutUser, checkStreakOnLoad, rolloverDailyQuests, getDueErrorCards, getLevelInfo } from './services/storageService';
import TypingView from './components/TypingView';
import WritingView from './components/WritingView';
import LibraryView from './components/LibraryView';
import ProfileView from './components/ProfileView';
import LoginView from './components/LoginView';
import WritingTreeView from './components/WritingTreeView';
import CompositionStudioView from './components/CompositionStudioView';
import PortfolioView from './components/PortfolioView';
import VocabularyView from './components/VocabularyView';
import RPGView from './components/RPGView';
import DailyView from './components/DailyView';
import ImportView from './components/ImportView';
import SocialView from './components/SocialView';
import ScriptTrainerView from './components/ScriptTrainerView';
import ErrorBookView from './components/ErrorBookView';
import ErrorPatternsView from './components/ErrorPatternsView';
import WritingProgressView from './components/WritingProgressView';
import InkQuestView from './components/InkQuestView';
import ContentRepoView from './components/ContentRepoView';
import { GraduationCap, ChevronDown, Menu, Flame, Star } from 'lucide-react';

// 侧边栏导航分组（信息架构：降低 15 个一级入口的视觉过载）
const NAV_GROUPS: { label: string; items: string[] }[] = [
  { label: '学习', items: ['daily', 'typing', 'writing', 'rpg'] },
  { label: '精进', items: ['writing_tree', 'composition_studio', 'ink_quest', 'script_trainer', 'vocabulary', 'errorbook', 'error_patterns'] },
  { label: '资源', items: ['library', 'content_repo', 'import', 'trend', 'portfolio'] },
  { label: '社区', items: ['social', 'profile'] },
];

const GITHUB_REPO = 'Chmodpuppets/linguaflow';
const GITHUB_STARS_KEY = 'linguaflow_github_stars';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.Daily);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [typingInitialData, setTypingInitialData] = useState<{text: string; title: string; notes?: string} | null>(null);
  const [stars, setStars] = useState<number | null>(null);

  // Initial Load
  useEffect(() => {
    const loadedUser = getUser();
    if (loadedUser) {
      const refreshed = rolloverDailyQuests(checkStreakOnLoad(loadedUser));
      setUser(refreshed);
    }
  }, []);

  // GitHub stars：侧栏卡片实时展示，缓存到 localStorage 每天刷新一次（公开 API，无需鉴权）
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const cached = JSON.parse(localStorage.getItem(GITHUB_STARS_KEY) || 'null');
      if (cached && cached.date === today && typeof cached.count === 'number') {
        setStars(cached.count);
        return;
      }
    } catch {}
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.stargazers_count === 'number') {
          setStars(d.stargazers_count);
          try { localStorage.setItem(GITHUB_STARS_KEY, JSON.stringify({ count: d.stargazers_count, date: today })); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // HOOK 必须在 early return 之前无条件调用，否则登录前后 hook 数量不一致
  // → React 报 "Rendered more hooks than during the previous render"
  const prevLevelRef = useRef<number | null>(null);
  const [levelUpFlash, setLevelUpFlash] = useState<number | null>(null);

  // 升级检测：等级跨 500 边界跃升时闪光；ref 用 lazy 守卫避免首登后立即触发
  useEffect(() => {
    if (!user) return;
    const cur = user.progress[user.learningLanguage]?.level ?? 1;
    if (prevLevelRef.current === null) {
      prevLevelRef.current = cur;
      return;
    }
    if (cur > prevLevelRef.current) {
      setLevelUpFlash(cur);
      const t = setTimeout(() => setLevelUpFlash(null), 2600);
      prevLevelRef.current = cur;
      return () => clearTimeout(t);
    }
    prevLevelRef.current = cur;
  }, [user]);

  // Update user wrapper to force re-render on storage change
  const handleUserUpdate = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    saveUser(updatedUser);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setMode(AppMode.Daily);
  };

  const handlePracticeFromLibrary = (content: {text: string; title: string; notes?: string}) => {
    setTypingInitialData(content);
    setMode(AppMode.Typing);
  };

  const handleModeChange = (newMode: AppMode) => {
    if (newMode !== AppMode.Typing) {
        setTypingInitialData(null); // Clear custom data if leaving typing or switching explicitly
    }
    setMode(newMode);
    setIsMenuOpen(false);
  };

  if (!user) {
    return <LoginView onLogin={(u) => setUser(u)} />;
  }

  // Derived state for current language stats
  const currentFlag = SUPPORTED_LANGUAGES.find(l => l.id === user.learningLanguage)?.flag || '🌐';
  const currentProgress = user.progress[user.learningLanguage] || { xp: 0, level: 1, cefrLevel: CEFRLevel.A1 };
  // 错题本待复习数量（按当前学习语言），用于导航角标
  const dueErrorCount = getDueErrorCards().filter((c) => c.language === user.learningLanguage).length;
  // 等级与进度条统一从单一计算源取，消除多处公式漂移
  const levelInfo = getLevelInfo(currentProgress.xp);

  // hooks 已统一上移到 early return 之前，避免登录前后 hook 数量漂移

  const renderContent = () => {
    switch (mode) {
      case AppMode.Typing:
        return (
            <TypingView 
                user={user}
                onComplete={handleUserUpdate}
                initialData={typingInitialData}
            />
        );
      case AppMode.Writing:
        return (
            <WritingView 
                user={user}
                onComplete={handleUserUpdate}
            />
        );
      case AppMode.WritingTree:
        return (
            <WritingTreeView 
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.CompositionStudio:
        return (
            <CompositionStudioView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.Portfolio:
        return (
            <PortfolioView
                user={user}
            />
        );
      case AppMode.Library:
        return (
            <LibraryView 
                user={user}
                onPractice={handlePracticeFromLibrary}
            />
        );
      case AppMode.Vocabulary:
        return (
            <VocabularyView 
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.ErrorBook:
        return (
            <ErrorBookView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.ErrorPatterns:
        return (
            <ErrorPatternsView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.Trend:
        return (
            <WritingProgressView
                user={user}
            />
        );
      case AppMode.ScriptTrainer:
        return (
            <ScriptTrainerView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.InkQuest:
        return (
            <InkQuestView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.ContentRepo:
        return (
            <ContentRepoView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.RPG:
        return (
            <RPGView 
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.Daily:
        return (
            <DailyView
                user={user}
                onUpdateUser={handleUserUpdate}
                onNavigate={handleModeChange}
            />
        );
      case AppMode.Import:
        return (
            <ImportView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.Social:
        return (
            <SocialView
                user={user}
                onUpdateUser={handleUserUpdate}
            />
        );
      case AppMode.Profile:
        return <ProfileView user={user} onUpdateUser={handleUserUpdate} onLogout={handleLogout} />;
      default:
        return <TypingView user={user} onComplete={handleUserUpdate} />;
    }
  };

  return (
    <div className="relative min-h-screen bg-dark text-body flex flex-col md:flex-row font-sans selection:bg-neon/30 selection:text-white">

      {/* 暗夜氛围背景：极光漂移 + 细网格（纯装饰） */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="aurora aurora-a" />
        <div className="aurora aurora-b" />
        <div className="aurora aurora-c" />
        <div className="grid-overlay" />
      </div>

      {/* Sidebar / Mobile Menu */}
      <aside className={`fixed md:relative z-50 glass-panel md:border-r md:border-white/5 h-full w-64 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="logo-glow w-10 h-10 bg-gradient-to-br from-neon via-primary to-neon-2 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform duration-300 hover:scale-110 hover:rotate-3">
                L
            </div>
            <div>
                <h1 className="font-bold tracking-tight neon-text text-lg">LinguaFlow</h1>
                <p className="text-xs text-muted">以输出练就流利</p>
            </div>
        </div>

        {/* Mini User Profile in Sidebar */}
        <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-surface-3/70 flex items-center justify-center border border-neon/25 shadow-glow-sm">
                    {currentFlag}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate text-white">{user.username}</div>
                    <div className="text-xs text-muted">等级 {currentProgress.level} • {currentProgress.cefrLevel}</div>
                </div>
                <div className="flex flex-col items-center">
                    <Flame size={14} className="text-orange-500 flame-flicker" />
                    <span className="text-xs font-bold text-orange-400">{user.currentStreak}</span>
                </div>
            </div>
            {/* XP Bar + 升级闪光 */}
            <div className="relative w-full">
              {levelUpFlash !== null && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-neon to-neon-2 text-white text-xs font-extrabold shadow-glow-neon animate-[pop_0.4s_ease-out] whitespace-nowrap">
                  🎉 升级！Level {levelUpFlash}
                </div>
              )}
              <div className="w-full h-1.5 bg-line/70 rounded-full overflow-hidden">
                <div className="h-full xp-bar rounded-full transition-[width] duration-700 ease-out" style={{ width: `${levelInfo.pct}%` }}></div>
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-muted mt-1">
                 <span>{currentProgress.xp} 经验</span>
                 <span>距下一级还需 {levelInfo.xpToNext}</span>
            </div>
        </div>

        <nav className="flex-1 p-4 space-y-5 overflow-y-auto custom-scrollbar">
            {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                    <div className="text-[11px] font-semibold text-faint uppercase tracking-[0.18em] mb-2 px-2 flex items-center gap-2">
                        <span className="h-px w-3 bg-gradient-to-r from-neon/60 to-transparent" />
                        {group.label}
                    </div>
                    <div className="space-y-1">
                        {group.items.map((id) => {
                            const item = NAV_ITEMS.find((n) => n.id === id);
                            if (!item) return null;
                            const dueBadge = id === 'errorbook' && dueErrorCount > 0 ? dueErrorCount : 0;
                            const active = mode === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleModeChange(id as AppMode)}
                                    className={`
                                        nav-item relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold outline-none
                                        focus-visible:ring-2 focus-visible:ring-neon/60
                                        ${active
                                            ? 'nav-item-active text-white'
                                            : 'text-muted hover:text-white'
                                        }
                                    `}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    {item.label}
                                    {dueBadge > 0 && (
                                        <span className="badge-pulse ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{dueBadge}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>

        {/* GitHub Star 卡片：侧栏底部，实时展示 stars 数 + 仓库链接 */}
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          className="m-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-neon/40 hover:text-white"
        >
          <Star size={16} className="text-amber-300" />
          <span className="flex-1 truncate">Star on GitHub</span>
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
            {stars != null ? stars : '—'}
          </span>
        </a>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 glass-panel">
            <div className="flex items-center gap-2">
                 <div className="logo-glow w-8 h-8 bg-gradient-to-br from-neon to-neon-2 rounded-lg flex items-center justify-center text-white font-bold text-sm">L</div>
                 <span className="font-bold neon-text">LinguaFlow</span>
            </div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Menu size={24} />
            </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">

            {/* Context Badge */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2 opacity-50 pointer-events-none">
                <span className="text-4xl">{currentFlag}</span>
                <span className="text-6xl font-black text-line select-none uppercase -ml-4 z-[-1] tracking-tighter">{user.learningLanguage}</span>
            </div>

            <div className="max-w-6xl mx-auto h-full flex flex-col">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                        {NAV_ITEMS.find(n => n.id === mode)?.label}
                    </h2>
                    <div className="title-underline w-24 mt-2" />
                    <p className="text-muted text-sm mt-2">
                        {currentProgress.cefrLevel} 级 • 共 {currentProgress.xp} 经验
                    </p>
                </div>

                {/* 页面切换：mode 作为 key，触发霓虹渐入过渡 */}
                <div key={mode} className="page-enter flex-1">
                    {renderContent()}
                </div>
            </div>
        </div>
      </main>

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-md"
            onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
