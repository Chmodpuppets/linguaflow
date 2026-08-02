
import React, { useState, useEffect } from 'react';
import { Language, CEFRLevel, AppMode, UserProfile } from './types';
import { SUPPORTED_LANGUAGES, NAV_ITEMS } from './constants';
import { getUser, saveUser, ensureLanguageProgress, logoutUser, checkStreakOnLoad, rolloverDailyQuests } from './services/storageService';
import TypingView from './components/TypingView';
import WritingView from './components/WritingView';
import LibraryView from './components/LibraryView';
import ProfileView from './components/ProfileView';
import LoginView from './components/LoginView';
import WritingTreeView from './components/WritingTreeView';
import VocabularyView from './components/VocabularyView';
import RPGView from './components/RPGView';
import DailyView from './components/DailyView';
import ImportView from './components/ImportView';
import SocialView from './components/SocialView';
import { GraduationCap, ChevronDown, Menu, Flame, Star } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.Daily);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [typingInitialData, setTypingInitialData] = useState<{text: string; title: string; notes?: string} | null>(null);

  // Initial Load
  useEffect(() => {
    const loadedUser = getUser();
    if (loadedUser) {
      const refreshed = rolloverDailyQuests(checkStreakOnLoad(loadedUser));
      setUser(refreshed);
    }
  }, []);

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
  // 等级 = 1 + floor(xp / 500)，进度条反映"到本级满"的真实进度
  const XP_PER_LEVEL = 500;
  const xpInLevel = currentProgress.xp % XP_PER_LEVEL;
  const xpToNext = XP_PER_LEVEL - xpInLevel;

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
    <div className="min-h-screen bg-dark text-gray-200 flex flex-col md:flex-row font-sans selection:bg-secondary/30 selection:text-white">
      
      {/* Sidebar / Mobile Menu */}
      <aside className={`fixed md:relative z-50 bg-card border-r border-gray-800 h-full w-64 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="p-6 border-b border-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                L
            </div>
            <div>
                <h1 className="font-bold text-white tracking-tight">LinguaFlow</h1>
                <p className="text-xs text-gray-500">以输出练就流利</p>
            </div>
        </div>

        {/* Mini User Profile in Sidebar */}
        <div className="p-4 bg-gray-900/50 border-b border-gray-800">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600 shadow-sm">
                    {currentFlag}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate text-white">{user.username}</div>
                    <div className="text-xs text-gray-500">等级 {currentProgress.level} • {currentProgress.cefrLevel}</div>
                </div>
                <div className="flex flex-col items-center">
                    <Flame size={14} className="text-orange-500" />
                    <span className="text-xs font-bold text-orange-500">{user.currentStreak}</span>
                </div>
            </div>
            {/* XP Bar */}
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-secondary" style={{ width: `${(xpInLevel / XP_PER_LEVEL) * 100}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                 <span>{currentProgress.xp} 经验</span>
                 <span>距下一级还需 {xpToNext}</span>
            </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">菜单</div>
            {NAV_ITEMS.map((item) => (
                <button
                    key={item.id}
                    onClick={() => handleModeChange(item.id as AppMode)}
                    className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold outline-none
                        ${mode === item.id 
                            ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-200'
                        }
                    `}
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-card">
            <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold text-sm">L</div>
                 <span className="font-bold text-white">LinguaFlow</span>
            </div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2">
                <Menu size={24} />
            </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
            
            {/* Context Badge */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2 opacity-50 pointer-events-none">
                <span className="text-4xl">{currentFlag}</span>
                <span className="text-6xl font-black text-gray-800 select-none uppercase -ml-4 z-[-1] tracking-tighter">{user.learningLanguage}</span>
            </div>

            <div className="max-w-6xl mx-auto h-full flex flex-col">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {NAV_ITEMS.find(n => n.id === mode)?.label}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {currentProgress.cefrLevel} 级 • 共 {currentProgress.xp} 经验
                    </p>
                </div>
                
                <div className="flex-1">
                    {renderContent()}
                </div>
            </div>
        </div>
      </main>
      
      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
