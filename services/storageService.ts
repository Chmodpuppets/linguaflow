
import { UserProfile, ActivityLog, Language, CEFRLevel, DailyQuest, UserContent, LanguageProgress, WritingNode, VocabularyItem } from '../types';

const STORAGE_KEY_USER = 'linguaflow_user';
const STORAGE_KEY_LOGS = 'linguaflow_logs';
const STORAGE_KEY_LIBRARY = 'linguaflow_library';
const STORAGE_KEY_TREE = 'linguaflow_writing_tree';
const STORAGE_KEY_VOCAB = 'linguaflow_vocabulary';

// --- Helper: Date String ---
const getTodayString = () => new Date().toISOString().split('T')[0];

export const getUser = (): UserProfile | null => {
  const data = localStorage.getItem(STORAGE_KEY_USER);
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    // Migration fallback
    if (parsed.xp !== undefined && !parsed.progress) {
        return {
            ...parsed,
            progress: {
                [parsed.learningLanguage]: {
                    xp: parsed.xp,
                    level: parsed.level,
                    cefrLevel: parsed.cefrLevel || CEFRLevel.A1,
                    totalWordsTyped: 0,
                    lastActive: Date.now(),
                    maxUnlockedStage: 0
                }
            }
        };
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

export const saveUser = (user: UserProfile) => {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
};

export const logoutUser = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
};

export const registerUser = (username: string, nativeLanguage: Language, learningLanguage: Language, level: CEFRLevel): UserProfile => {
  const newUser: UserProfile = {
    username,
    nativeLanguage,
    learningLanguage,
    progress: {
        [learningLanguage]: {
            xp: 0,
            level: 1,
            cefrLevel: level,
            totalWordsTyped: 0,
            lastActive: Date.now(),
            maxUnlockedStage: 0
        }
    },
    currentStreak: 1,
    maxStreak: 1,
    lastActiveDate: getTodayString(),
    joinedDate: Date.now()
  };
  saveUser(newUser);
  return newUser;
};

// Ensure language progress exists when switching languages
export const ensureLanguageProgress = (user: UserProfile, lang: Language): UserProfile => {
    if (!user.progress[lang]) {
        user.progress[lang] = {
            xp: 0,
            level: 1,
            cefrLevel: CEFRLevel.A1,
            totalWordsTyped: 0,
            lastActive: Date.now(),
            maxUnlockedStage: 0
        };
        saveUser(user);
    }
    return user;
};

// --- Activity Logs ---

export const getLogs = (): ActivityLog[] => {
  const data = localStorage.getItem(STORAGE_KEY_LOGS);
  return data ? JSON.parse(data) : [];
};

export const addActivity = (
    user: UserProfile, 
    type: ActivityLog['type'], 
    language: Language,
    xp: number, 
    summary: string, 
    details: any
): { user: UserProfile, log: ActivityLog } => {
  
  // 1. Update User Stats (Multi-language support)
  const today = getTodayString();
  const isNewDay = user.lastActiveDate !== today;
  
  let updatedUser = { ...user };
  
  // Ensure progress object exists
  if (!updatedUser.progress[language]) {
      updatedUser = ensureLanguageProgress(updatedUser, language);
  }

  const langProgress = updatedUser.progress[language];

  // Update specific language progress
  langProgress.xp += xp;
  langProgress.lastActive = Date.now();
  if (details.wordCount) {
      langProgress.totalWordsTyped += details.wordCount;
  }

  // Level Up Logic (Simple: Level = 1 + XP/500)
  const newLevel = 1 + Math.floor(langProgress.xp / 500);
  if (newLevel > langProgress.level) {
      langProgress.level = newLevel;
  }

  // Check for Stage Unlock (Typing Mode)
  if (type === 'typing' && details.passed && details.stageId !== undefined) {
      if (details.stageId === langProgress.maxUnlockedStage) {
          langProgress.maxUnlockedStage += 1;
      }
  }

  updatedUser.progress[language] = langProgress;

  // Global Streak Logic
  if (isNewDay) {
      // Check if consecutive day
      const last = new Date(user.lastActiveDate);
      const curr = new Date(today);
      const diffTime = Math.abs(curr.getTime() - last.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (diffDays === 1) {
          updatedUser.currentStreak += 1;
          if (updatedUser.currentStreak > updatedUser.maxStreak) {
              updatedUser.maxStreak = updatedUser.currentStreak;
          }
      } else if (diffDays > 1) {
          updatedUser.currentStreak = 1;
      }
      updatedUser.lastActiveDate = today;
  }

  saveUser(updatedUser);

  // 2. Add Log
  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    date: today,
    type,
    language,
    summary,
    details,
    xpEarned: xp
  };
  
  const logs = getLogs();
  const updatedLogs = [newLog, ...logs].slice(0, 100); // Keep last 100
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));

  return { user: updatedUser, log: newLog };
};

// --- Library (Memory Bank) ---

export const getLibrary = (): UserContent[] => {
    const data = localStorage.getItem(STORAGE_KEY_LIBRARY);
    return data ? JSON.parse(data) : [];
};

export const saveLibraryItem = (item: UserContent) => {
    const items = getLibrary();
    const existingIdx = items.findIndex(i => i.id === item.id);
    let updatedItems;
    if (existingIdx >= 0) {
        updatedItems = [...items];
        updatedItems[existingIdx] = item;
    } else {
        updatedItems = [item, ...items];
    }
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(updatedItems));
};

export const deleteLibraryItem = (id: string) => {
    const items = getLibrary().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(items));
};

// --- Writing Tree ---

export const getWritingTree = (): WritingNode[] => {
    const data = localStorage.getItem(STORAGE_KEY_TREE);
    return data ? JSON.parse(data) : [];
};

export const saveWritingTree = (nodes: WritingNode[]) => {
    localStorage.setItem(STORAGE_KEY_TREE, JSON.stringify(nodes));
};

// --- Vocabulary ---

export const getVocabulary = (): VocabularyItem[] => {
    const data = localStorage.getItem(STORAGE_KEY_VOCAB);
    return data ? JSON.parse(data) : [];
};

export const saveVocabularyItem = (item: VocabularyItem) => {
    const items = getVocabulary();
    // Prevent duplicates by word
    if (items.some(i => i.word.toLowerCase() === item.word.toLowerCase() && i.language === item.language)) {
        return; 
    }
    const updated = [item, ...items];
    localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(updated));
};

export const deleteVocabularyItem = (id: string) => {
    const items = getVocabulary().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(items));
};
