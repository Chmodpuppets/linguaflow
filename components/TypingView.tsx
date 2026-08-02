
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TypingContent, UserProfile, UserContent, CEFRLevel, VocabularyItem } from '../types';
import { generateTypingContent, generateSpeech, cancelSpeech, transcribeAudio } from '../services/aiService';
import { addActivity, getLibrary, saveLibraryItem, saveVocabularyItem } from '../services/storageService';
import { TYPING_STAGES, DRILL_TOPICS } from '../constants';
import { RefreshCw, Play, Keyboard, Eye, EyeOff, BookOpen, Zap, Star, Sparkles, LayoutGrid, Book, Volume2, StopCircle, Loader2, Mic, Square, Trash2, Ear, Pause, X, Lock, CheckCircle2, Swords, Crown, ShieldAlert, Plus, Check, Bookmark } from 'lucide-react';

interface TypingViewProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
  initialData?: { text: string; title: string; notes?: string } | null;
}

// --- Helper: Safe ID Generation ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// --- Helper: Parse Notes for Context ---
const parseNotes = (notes: string) => {
    const translationMatch = notes.match(/\[Translation\]\n([\s\S]*?)(?=\n\[|$)/);
    const phoneticMatch = notes.match(/\[Phonetic Guide\]\n([\s\S]*?)(?=\n\[|$)/);
    return {
        translation: translationMatch ? translationMatch[1].trim() : "暂无译文",
        phoneticGuide: phoneticMatch ? phoneticMatch[1].trim() : ""
    };
};

// --- Audio: AI TTS now uses the browser's Web Speech API (see generateSpeech) ---

const TypingView: React.FC<TypingViewProps> = ({ user, onComplete, initialData }) => {
  const [content, setContent] = useState<TypingContent | null>(null);
  const [activeStage, setActiveStage] = useState<typeof TYPING_STAGES[0] | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [finished, setFinished] = useState(false);
  const [passedStage, setPassedStage] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  
  // Track if current content is from AI (for auto-saving)
  const [isAISource, setIsAISource] = useState(false);
  
  // Error state for API issues
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Vocabulary state
  const [addedVocabWords, setAddedVocabWords] = useState<Set<string>>(new Set());

  // Audio State (AI TTS via Web Speech API)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Recording State (User Voice)
  const [isRecording, setIsRecording] = useState(false);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [isPlayingUser, setIsPlayingUser] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const userAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [userTranscript, setUserTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Selection Mode State
  const [activeTab, setActiveTab] = useState<'campaign' | 'practice' | 'memory'>('campaign');
  const [libraryItems, setLibraryItems] = useState<UserContent[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Accuracy tracking refs (keystroke-level) ---
  const totalTypedRef = useRef(0);   // total characters typed (incl. corrections)
  const errorCountRef = useRef(0);   // characters typed wrong at the moment of typing
  const prevInputLenRef = useRef(0); // previous input length, to detect additions
  const [accuracy, setAccuracy] = useState(100);

  useEffect(() => {
      setLibraryItems(getLibrary().filter(i => i.language === user.learningLanguage));
  }, [user.learningLanguage]);

  // Cleanup audio on unmount
  useEffect(() => {
      return () => {
          cancelSpeech();
          if (userAudioUrl) {
              URL.revokeObjectURL(userAudioUrl);
          }
      };
  }, []);

  // Reset and stop audio when content changes
  useEffect(() => {
      cancelSpeech();
      setIsSpeaking(false);
      deleteUserRecording();
      setSavedToLibrary(false);
      setAddedVocabWords(new Set());
      setErrorMsg(null);
      // Reset accuracy tracking for the new drill
      totalTypedRef.current = 0;
      errorCountRef.current = 0;
      prevInputLenRef.current = 0;
      setAccuracy(100);
  }, [content]);

  // --- Audio Engine Logic (Web Speech API) ---

  const stopAudio = () => {
      cancelSpeech();
      setIsSpeaking(false);
  };

  const togglePlayback = () => {
      if (isSpeaking) {
          stopAudio();
          return;
      }
      if (!content) return;
      setIsSpeaking(true);
      generateSpeech(content.text, {
          lang: user.learningLanguage,
          rate: playbackSpeed,
          onEnd: () => setIsSpeaking(false),
      });
  };

  const toggleSpeed = () => {
      const speeds = [0.75, 1.0, 1.25];
      const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
      setPlaybackSpeed(speeds[nextIdx]);
  };

  // --- User Recording Logic ---
  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setUserAudioUrl(url);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        alert("无法访问麦克风。");
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const playUserRecording = () => {
      if (!userAudioUrl) return;
      if (isPlayingUser && userAudioPlayerRef.current) {
          userAudioPlayerRef.current.pause();
          userAudioPlayerRef.current.currentTime = 0;
          setIsPlayingUser(false);
          return;
      }
      const audio = new Audio(userAudioUrl);
      userAudioPlayerRef.current = audio;
      audio.onended = () => setIsPlayingUser(false);
      setIsPlayingUser(true);
      audio.play();
  };

  const deleteUserRecording = () => {
      if (userAudioPlayerRef.current) {
          userAudioPlayerRef.current.pause();
          userAudioPlayerRef.current = null;
      }
      setIsPlayingUser(false);
      setUserTranscript(null);
      if (userAudioUrl) {
          URL.revokeObjectURL(userAudioUrl);
          setUserAudioUrl(null);
      }
  };

  const handleTranscribe = async () => {
      if (!userAudioUrl) return;
      setIsTranscribing(true);
      setUserTranscript(null);
      try {
          const blob = await fetch(userAudioUrl).then(r => r.blob());
          const text = await transcribeAudio(blob, user.learningLanguage);
          setUserTranscript(text);
      } catch (e: any) {
          console.error(e);
          setUserTranscript("识别失败：" + (e?.message || e));
      } finally {
          setIsTranscribing(false);
      }
  };

  // --- Vocabulary Logic ---

  const handleAddVocabulary = (vocabItem: { word: string; meaning: string; partOfSpeech: string }) => {
      if (addedVocabWords.has(vocabItem.word)) return;

      const newItem: VocabularyItem = {
          id: generateId(),
          word: vocabItem.word,
          definition: vocabItem.meaning,
          exampleSentence: "", // Could be enhanced in future
          partOfSpeech: vocabItem.partOfSpeech,
          language: user.learningLanguage,
          createdAt: Date.now()
      };

      saveVocabularyItem(newItem);
      setAddedVocabWords(prev => new Set(prev).add(vocabItem.word));
  };


  // --- Content & Game Logic ---

  const fetchStageContent = async (stage: typeof TYPING_STAGES[0]) => {
      stopAudio();
      setIsLoading(true);
      setErrorMsg(null);
      setInputValue('');
      setStartTime(null);
      setWpm(0);
      setFinished(false);
      setPassedStage(false);
      setActiveStage(stage);
      setIsAISource(true); // MARK AS AI SOURCE

      try {
          // Extra instructions for the AI based on stage type
          const instructions = stage.isBoss 
            ? "Create a challenging, dense paragraph with complex sentence structures. Focus on accuracy."
            : `Create a text focusing on ${stage.description}. Keep difficulty consistent with ${stage.cefr}.`;
          
          const data = await generateTypingContent(user.learningLanguage, user.nativeLanguage, stage.cefr, stage.title, instructions);
          setContent(data);
          setTimeout(() => inputRef.current?.focus(), 100);
      } catch (error) {
          console.error(error);
          setErrorMsg("内容生成失败，服务器可能繁忙，请重试。");
          setContent(null);
      } finally {
          setIsLoading(false);
      }
  };

  const fetchPracticeContent = async (topic: string) => {
      stopAudio();
      setIsLoading(true);
      setErrorMsg(null);
      setInputValue('');
      setStartTime(null);
      setWpm(0);
      setFinished(false);
      setPassedStage(false);
      setActiveStage(null);
      setIsAISource(true); // MARK AS AI SOURCE

      try {
          const currentLevel = user.progress[user.learningLanguage]?.cefrLevel || CEFRLevel.A1;
          const data = await generateTypingContent(user.learningLanguage, user.nativeLanguage, currentLevel, topic);
          setContent(data);
          setTimeout(() => inputRef.current?.focus(), 100);
      } catch (error) {
          console.error(error);
          setErrorMsg("内容生成失败，请检查网络连接。");
          setContent(null);
      } finally {
          setIsLoading(false);
      }
  };

  // Manual Save Function
  const handleManualSave = () => {
    if (!content) return;
    
    // Build notes string from context
    const notesParts = [];
    if (content.translation) {
        notesParts.push(`[Translation]\n${content.translation}`);
    }
    if (content.phoneticGuide) {
        notesParts.push(`[Phonetic Guide]\n${content.phoneticGuide}`);
    }

    const newItem: UserContent = {
      id: generateId(),
      title: content.topic || '打字练习',
      content: content.text,
      notes: notesParts.join('\n\n'), // Persist translation/phonetics here
      language: user.learningLanguage,
      createdAt: Date.now()
    };
    
    saveLibraryItem(newItem);
    setSavedToLibrary(true);
  };

  // Handle Initial Data or Clean Start
  useEffect(() => {
    if (initialData) {
        stopAudio();
        // Use provided content (e.g. from Library)
        // Try to parse translation/phonetics from notes if available
        const parsed = initialData.notes ? parseNotes(initialData.notes) : { translation: "自定义记忆库内容", phoneticGuide: "" };

        setContent({
            text: initialData.text,
            topic: initialData.title,
            translation: parsed.translation,
            phoneticGuide: parsed.phoneticGuide, 
            keyVocabulary: []
        });
        setActiveStage(null); 
        setActiveTab('memory');
        setIsAISource(false); // LOADED FROM LIBRARY, NOT AI SOURCE
        setInputValue('');
        setStartTime(null);
        setWpm(0);
        setFinished(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    } else {
        // Reset if we switch back to generic mode without data
        stopAudio();
        setContent(null);
        setInputValue('');
        setFinished(false);
    }
  }, [initialData]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (finished) return;
    const val = e.target.value;
    if (!startTime) setStartTime(Date.now());

    // Accuracy tracking: count each newly-added character against the target
    const prevLen = prevInputLenRef.current;
    if (val.length > prevLen && content?.text) {
      for (let i = prevLen; i < val.length; i++) {
        totalTypedRef.current += 1;
        if (val[i] !== content.text[i]) {
          errorCountRef.current += 1;
        }
      }
    }
    prevInputLenRef.current = val.length;

    setInputValue(val);

    if (startTime) {
      const timeElapsed = (Date.now() - startTime) / 60000;
      const wordsTyped = val.length / 5;
      setWpm(Math.round(wordsTyped / timeElapsed) || 0);
    }

    if (content && content.text && val === content.text) {
        finishDrill(val.length);
    }
  };

  const finishDrill = (length: number) => {
      setFinished(true);
      
      const baseXP = 20;
      const lengthXP = Math.floor(length / 5);
      const speedBonus = wpm > 40 ? 10 : 0;
      const totalXP = baseXP + lengthXP + speedBonus;

      // Real accuracy: correct keystrokes / total keystrokes typed
      const totalTyped = totalTypedRef.current;
      const errors = errorCountRef.current;
      const finalAccuracy = totalTyped > 0
        ? Math.max(0, Math.min(100, Math.round(((totalTyped - errors) / totalTyped) * 100)))
        : 100;
      setAccuracy(finalAccuracy);
      
      let stagePassed = false;
      // Check pass criteria if in Adventure Mode
      if (activeStage) {
          if (wpm >= activeStage.minWpm) {
              stagePassed = true;
              setPassedStage(true);
          }
      } else {
          stagePassed = true; // Custom/Practice/Memory bank always "Passes" just for XP
      }

      // ** AUTO-SAVE TO MEMORY BANK **
      // Use explicit isAISource flag for reliability
      if (content && content.text && isAISource) {
          handleManualSave(); // Use same logic
      }

      const { user: updatedUser } = addActivity(
          user,
          'typing',
          user.learningLanguage,
          totalXP,
          activeStage ? `Stage ${activeStage.id + 1}: ${activeStage.title}` : `Drill: ${content?.topic}`,
          {
              wpm: wpm,
              accuracy: finalAccuracy, 
              wordCount: Math.floor(length / 5),
              stageId: activeStage?.id,
              passed: stagePassed
          }
      );
      onComplete(updatedUser);
  };

  const handleUseLibraryItem = (item: UserContent) => {
      stopAudio();
      // Parse notes to get back translation/phonetic guide
      const parsed = parseNotes(item.notes);

      setContent({
            text: item.content,
            topic: item.title,
            translation: parsed.translation,
            phoneticGuide: parsed.phoneticGuide, 
            keyVocabulary: []
        });
        setActiveStage(null);
        setIsAISource(false); // Explicitly NOT AI
        setInputValue('');
        setStartTime(null);
        setWpm(0);
        setFinished(false);
        setTimeout(() => inputRef.current?.focus(), 100);
  };

  const renderText = () => {
    if (!content || !content.text) return null;
    return (
      <div className="text-2xl md:text-3xl font-mono leading-relaxed break-words tracking-wide">
        {content.text.split('').map((char, index) => {
          let colorClass = 'text-gray-500';
          let bgClass = 'bg-transparent';
          const isCurrent = index === inputValue.length;

          if (index < inputValue.length) {
            if (inputValue[index] === char) {
              colorClass = 'text-green-400';
            } else {
              colorClass = 'text-red-400';
              bgClass = 'bg-red-900/30';
            }
          }
          return (
            <span key={index} className={`relative ${colorClass} ${bgClass} transition-colors duration-75`}>
              {isCurrent && <span className="absolute -left-[1px] -top-1 h-8 w-[2px] bg-secondary animate-pulse" />}
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  // Level Map Component
  const renderStageMap = () => {
      const unlockedStage = user.progress[user.learningLanguage]?.maxUnlockedStage || 0;
      
      return (
          <div className="flex flex-col items-center pb-12">
              <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 mb-8 max-w-lg w-full text-center">
                  <div className="flex items-center justify-center gap-2 text-yellow-500 mb-2">
                      <ShieldAlert size={20} />
                      <span className="font-bold">硬核模式已开启</span>
                  </div>
                  <p className="text-sm text-gray-400">
                      在闯关模式下，所有提示（译文、音频、发音）都会关闭。
                      只能靠纯记忆和打字硬实力。
                  </p>
              </div>

              <div className="relative w-full max-w-lg space-y-8 mt-4">
                  {/* Vertical Line Connector */}
                  <div className="absolute left-1/2 top-4 bottom-4 w-1 bg-gray-700 -translate-x-1/2 z-0 rounded-full"></div>
                  
                  {TYPING_STAGES.map((stage, index) => {
                      const isUnlocked = index <= unlockedStage;
                      const isCompleted = index < unlockedStage;
                      const isCurrent = index === unlockedStage;
                      const isBoss = stage.isBoss;
                      
                      // Zig-zag offset
                      const offsetClass = index % 2 === 0 ? 'translate-x-0' : (index % 4 === 1 ? 'translate-x-12' : '-translate-x-12');

                      return (
                          <div key={stage.id} className={`relative z-10 flex justify-center transition-transform ${offsetClass}`}>
                              <button
                                  onClick={() => isUnlocked && fetchStageContent(stage)}
                                  disabled={!isUnlocked}
                                  className={`
                                      group relative flex items-center justify-center rounded-full border-b-4 transition-all duration-200
                                      ${isBoss ? 'w-24 h-24' : 'w-20 h-20'}
                                      ${isCompleted 
                                          ? 'bg-green-500 border-green-700 text-white' 
                                          : isCurrent 
                                              ? 'bg-secondary border-purple-700 text-white animate-bounce-slight shadow-[0_0_20px_rgba(168,85,247,0.6)]' 
                                              : 'bg-gray-700 border-gray-800 text-gray-500 cursor-not-allowed grayscale'
                                      }
                                  `}
                              >
                                  <span className="text-3xl filter drop-shadow-md">{stage.icon}</span>
                                  
                                  {isCompleted && (
                                      <div className="absolute -right-1 -bottom-1 bg-yellow-400 text-yellow-900 p-1 rounded-full shadow-sm">
                                          <Star size={14} fill="currentColor" />
                                      </div>
                                  )}
                                  
                                  {/* Tooltip Card */}
                                  <div className={`
                                      absolute top-full mt-3 bg-gray-800 border border-gray-700 rounded-xl p-3 w-48 text-center shadow-xl opacity-0 scale-95 pointer-events-none transition-all
                                      group-hover:opacity-100 group-hover:scale-100 group-hover:z-50
                                  `}>
                                      <div className="font-bold text-white text-sm mb-1">{stage.title}</div>
                                      <div className="text-xs text-gray-400 mb-2">{stage.description}</div>
                                      <div className="flex justify-center gap-2 text-[10px] font-mono uppercase bg-gray-900/50 p-1 rounded">
                                          <span className="text-secondary">{stage.cefr}</span>
                                          <span className="text-blue-400">{stage.minWpm} WPM</span>
                                      </div>
                                  </div>
                              </button>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  // --- Strict Mode Logic ---
  const isStrictMode = activeTab === 'campaign';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* HEADER CONTROLS (Only visible when drilling) */}
      {content && (
        <div className="flex flex-col gap-4 bg-card p-4 rounded-xl border border-gray-700 animate-in slide-in-from-top-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-bold border border-primary/30">
                        {activeStage ? activeStage.cefr : "练习"}
                    </span>
                    
                    {/* HINT & AUDIO CONTROLS - HIDDEN IN STRICT CAMPAIGN MODE */}
                    {!isStrictMode && (
                        <>
                            <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
                                <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
                                    <button
                                        onClick={togglePlayback}
                                        disabled={!content}
                                        className={`p-2 rounded-md transition-colors flex items-center gap-2 ${isSpeaking ? 'bg-green-500/20 text-green-400' : 'hover:bg-gray-700 text-gray-300'}`}
                                        title="播放音频"
                                    >
                                        {isSpeaking ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                                    </button>

                                    <button onClick={toggleSpeed} className="p-1 px-2 text-xs font-mono font-bold text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                                        {playbackSpeed}x
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
                                    {!userAudioUrl ? (
                                        <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-md ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-700 text-gray-300'}`} title="Record Your Voice">
                                            {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={playUserRecording} className={`p-2 rounded-md ${isPlayingUser ? 'text-secondary' : 'text-gray-300'}`}><Ear size={18} /></button>
                                            <button
                                                onClick={handleTranscribe}
                                                disabled={isTranscribing}
                                                className={`p-2 rounded-md ${isTranscribing ? 'text-secondary animate-pulse' : 'text-gray-300 hover:text-white'}`}
                                                title="用 AI 识别你的发音"
                                            >
                                                {isTranscribing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                            </button>
                                            <button onClick={deleteUserRecording} className="p-2 rounded-md text-gray-400 hover:text-red-400"><Trash2 size={18} /></button>
                                        </>
                                    )}
                                </div>

                                {userAudioUrl && userTranscript !== null && (
                                    <div className="text-sm text-gray-300 bg-gray-800/40 rounded-lg p-2 border border-gray-700">
                                        <span className="text-gray-500 mr-2">识别结果:</span>
                                        {userTranscript || "（无语音内容）"}
                                    </div>
                                )}

                                {/* Save To Memory Bank Button */}
                                <button
                                    onClick={handleManualSave}
                                    disabled={savedToLibrary}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border font-medium text-sm
                                        ${savedToLibrary 
                                            ? 'bg-green-500/20 text-green-400 border-green-500/50 cursor-default' 
                                            : 'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20 hover:text-white'
                                        }
                                    `}
                                    title={savedToLibrary ? "内容已存入记忆库" : "保存到记忆库"}
                                >
                                    {savedToLibrary ? <Check size={16} /> : <Bookmark size={16} />}
                                    {savedToLibrary ? "已保存" : "保存"}
                                </button>

                            </div>

                            {content?.phoneticGuide && (
                                <button onClick={() => setShowPhonetic(!showPhonetic)} className={`ml-2 p-2 rounded-lg ${showPhonetic ? 'bg-secondary/20 text-secondary' : 'text-gray-400 hover:text-gray-200'}`} title="切换发音指南"><Keyboard size={18} /></button>
                            )}
                            <button onClick={() => setShowTranslation(!showTranslation)} className={`p-2 rounded-lg ${showTranslation ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`} title="切换译文"><Eye size={18} /></button>
                        </>
                    )}
                    
                    {/* STRICT MODE INDICATOR */}
                    {isStrictMode && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-xs font-bold uppercase tracking-wider">
                            <Lock size={12} /> 硬核模式
                        </div>
                    )}

                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500 uppercase tracking-widest">速度</span>
                        <span className="text-xl font-mono font-bold text-white">{wpm} <span className="text-sm font-normal text-gray-500">WPM</span></span>
                    </div>
                    <button 
                        onClick={() => setContent(null)} 
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                        退出练习
                    </button>
                </div>
            </div>
            
        </div>
      )}

      {/* Main Content / Setup Area */}
      <div className="relative">
      
      {isLoading ? (
          <div className="bg-dark rounded-2xl p-12 border border-gray-800 shadow-2xl min-h-[300px] flex items-center justify-center flex-col gap-4">
             <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
             <p className="text-gray-400 animate-pulse">正在生成专属练习……</p>
             {errorMsg && (
                 <div className="mt-4 p-3 bg-red-900/20 border border-red-800 text-red-300 rounded-lg text-sm max-w-sm text-center">
                     {errorMsg}
                     <button onClick={() => fetchPracticeContent('random')} className="block mx-auto mt-2 text-xs underline hover:text-white">重试</button>
                 </div>
             )}
          </div>
        ) : !content ? (
            // Setup Screen
            <div className="bg-dark rounded-2xl p-6 md:p-8 border border-gray-800 shadow-2xl min-h-[400px]">
                 <div className="text-center mb-8">
                     <h3 className="text-2xl font-bold text-white mb-2">打字闯关</h3>
                     <p className="text-gray-400">选择一种模式开始训练。</p>
                 </div>

                 {/* Mode Tabs */}
                 <div className="flex flex-wrap justify-center gap-4 mb-8">
                     <button 
                        onClick={() => setActiveTab('campaign')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'campaign' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                     >
                        <Swords size={18} /> 闯关 <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-white/70">硬核</span>
                     </button>
                     <button 
                        onClick={() => setActiveTab('practice')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'practice' ? 'bg-gray-700 text-white shadow-lg border border-gray-600' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                     >
                        <LayoutGrid size={18} /> AI 练习
                     </button>
                     <button 
                        onClick={() => setActiveTab('memory')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'memory' ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                     >
                        <Book size={18} /> 记忆库
                     </button>
                 </div>

                 {/* Content Selection */}
                 {activeTab === 'campaign' && renderStageMap()}

                 {activeTab === 'practice' && (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 animate-in fade-in slide-in-from-bottom-2">
                         {DRILL_TOPICS.map(topic => (
                             <button
                                key={topic.id}
                                onClick={() => fetchPracticeContent(topic.label)}
                                className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-800/50 hover:bg-gray-700 hover:scale-105 border border-gray-700 hover:border-primary/50 rounded-xl transition-all group"
                             >
                                 <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{topic.icon}</span>
                                 <span className="text-sm font-medium text-gray-300 group-hover:text-white">{topic.label}</span>
                             </button>
                         ))}
                         {/* Random Button */}
                         <button
                            onClick={() => fetchPracticeContent('random daily topic')}
                            className="flex flex-col items-center justify-center gap-2 p-4 bg-gradient-to-br from-gray-800 to-gray-700 hover:brightness-110 border border-gray-700 hover:border-white/30 rounded-xl transition-all"
                         >
                             <Sparkles size={32} className="text-yellow-400" />
                             <span className="text-sm font-bold text-white">随机来一个</span>
                         </button>
                     </div>
                 )}

                 {activeTab === 'memory' && (
                     <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                         {libraryItems.length === 0 ? (
                             <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
                                 <p className="text-gray-500 mb-4">你的记忆库还是空的。</p>
                                 <div className="text-sm text-gray-600">完成 AI 练习或添加自己的内容，就能在这里复习。</div>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {libraryItems.map(item => (
                                     <button
                                        key={item.id}
                                        onClick={() => handleUseLibraryItem(item)}
                                        className="text-left p-4 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 hover:border-secondary/50 rounded-xl transition-all group"
                                     >
                                         <h4 className="font-bold text-gray-200 group-hover:text-white mb-1 truncate">{item.title}</h4>
                                         <p className="text-xs text-gray-500 truncate">{item.content}</p>
                                     </button>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}
            </div>
        ) : (
          <div 
            className="bg-dark rounded-2xl p-8 md:p-12 border border-gray-800 shadow-2xl min-h-[300px] flex flex-col justify-center cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="space-y-6">
                {/* Phonetic / Input Hint */}
                {content.phoneticGuide && showPhonetic && !isStrictMode && (
                    <div className="text-gray-500 font-mono text-sm md:text-base leading-loose tracking-wide mb-2 opacity-70 select-none">
                        {content.phoneticGuide}
                    </div>
                )}
                
                {/* The Actual Text */}
                {renderText()}

                {/* Translation Overlay (if enabled) */}
                {showTranslation && !isStrictMode && (
                    <div className="mt-8 pt-6 border-t border-gray-800 text-blue-300/80 italic text-lg animate-in fade-in">
                        "{content.translation}"
                    </div>
                )}
                
                {/* Hidden Input */}
                <input
                ref={inputRef}
                type="text"
                className="opacity-0 absolute inset-0 cursor-default"
                value={inputValue}
                onChange={handleInput}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                />
            </div>
          </div>
        )}
      </div>

      {/* Success State */}
      {finished && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500 rounded-full text-dark">
                    {passedStage ? <Crown size={24} fill="currentColor" /> : <Zap size={24} fill="currentColor" />}
                </div>
                <div>
                    <h3 className="text-xl font-bold text-green-400">
                        {activeStage ? (passedStage ? "关卡通过！" : "练习完成") : "练习已完成！"}
                    </h3>
                    <p className="text-green-300/70">
                        {savedToLibrary && isAISource ? "已获得经验并存入记忆库。" : "已获得经验，记忆已巩固。"}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="flex flex-col items-center px-4 border-r border-green-800">
                     <span className="text-xs text-green-500/80 uppercase">准确率</span>
                     <span className="text-2xl font-bold text-white">
                         {accuracy}%
                     </span>
                 </div>
                 <div className="flex flex-col items-center px-4 border-r border-green-800">
                     <span className="text-xs text-green-500/80 uppercase">获得经验</span>
                     <span className="text-2xl font-bold text-white flex items-center gap-1">
                         <Star size={16} className="text-yellow-400" fill="currentColor" /> 
                         {20 + Math.floor(content!.text.length/5) + (wpm > 40 ? 10 : 0)}
                     </span>
                 </div>
                 <button 
                    onClick={() => {setContent(null); setFinished(false);}}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                    下一个练习 <Play size={16} />
                </button>
            </div>
        </div>
      )}

      {/* Vocabulary Cards */}
      {!isLoading && content && content.keyVocabulary?.length > 0 && !isStrictMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {(content.keyVocabulary || []).map((item, idx) => (
                  <div key={idx} className="bg-card/50 p-4 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors group relative">
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-secondary" />
                            <span className="text-xs text-gray-500 uppercase font-semibold">{item.partOfSpeech}</span>
                          </div>
                          <button 
                             onClick={() => handleAddVocabulary(item)}
                             disabled={addedVocabWords.has(item.word)}
                             className={`text-gray-500 hover:text-white transition-colors ${addedVocabWords.has(item.word) ? 'text-green-500 opacity-50 cursor-default' : ''}`}
                             title="加入词库"
                          >
                             {addedVocabWords.has(item.word) ? <Check size={16} /> : <Plus size={16} />}
                          </button>
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1 group-hover:text-secondary transition-colors">{item.word}</h4>
                      <p className="text-sm text-gray-400">{item.meaning}</p>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default TypingView;
