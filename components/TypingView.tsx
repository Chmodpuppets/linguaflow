
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TypingContent, UserProfile, UserContent, CEFRLevel, VocabularyItem } from '../types';
import { generateTypingContent, generateSpeech, cancelSpeech, transcribeAudio, languageToSpeechLang } from '../services/aiService';
import { addActivity, getLibrary, saveLibraryItem, saveVocabularyItem, getTypingLibraryItems, saveTypingLibraryItem, deleteTypingLibraryItem, touchTypingLibraryItem, TypingLibraryItem } from '../services/storageService';
import { TYPING_STAGES, DRILL_TOPICS } from '../constants';
import { RefreshCw, Play, Keyboard, Eye, EyeOff, BookOpen, Zap, Star, Sparkles, LayoutGrid, Book, Volume2, StopCircle, Loader2, Mic, Square, Trash2, Ear, Pause, X, Lock, CheckCircle2, Swords, Crown, ShieldAlert, Plus, Check, Bookmark, Library, Repeat } from 'lucide-react';
import TtsAudioPlayer, { TtsAudioPlayerHandle } from './TtsAudioPlayer';

interface TypingViewProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
  initialData?: { text: string; title: string; notes?: string } | null;
}

// --- Helper: Safe ID Generation ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// --- 记忆化分段组件：把连续同状态（未输入/正确/错误）的字符合并成一个
//     span，长文本下 DOM 节点数从 N 降到「状态切换次数」(通常仅几十个)，
//     每次按键只需协调几十个节点，从根本上消除打字卡顿 ---
interface RunSpanProps {
    text: string;
    status: 'untyped' | 'correct' | 'wrong';
}
const RunSpan = React.memo(({ text, status }: RunSpanProps) => {
    const cls =
        status === 'correct'
            ? 'text-emerald-400'
            : status === 'wrong'
            ? 'text-red-400 underline decoration-red-500/70 decoration-wavy underline-offset-4'
            : 'text-muted';
    return <span className={cls}>{text}</span>;
});

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
  // TTS 复读播放器 ref：toolbar 的「朗读」按钮通过它触发播放/暂停
  const ttsPlayerRef = useRef<TtsAudioPlayerHandle | null>(null);
  const [ttsPlayerVisible, setTtsPlayerVisible] = useState(false);
  // 首次点击 toolbar「朗读」会先把面板拉起 + 自动开始播放
  const ttsShouldAutoplayRef = useRef(false);
  
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
  const [activeTab, setActiveTab] = useState<'campaign' | 'practice' | 'memory' | 'typinglib'>('campaign');
  const [libraryItems, setLibraryItems] = useState<UserContent[]>([]);
  const [typingLib, setTypingLib] = useState<TypingLibraryItem[]>(() => getTypingLibraryItems(user.learningLanguage));
  
  const inputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const currentCharRef = useRef<HTMLSpanElement>(null);

  // --- Accuracy tracking refs (keystroke-level) ---
  const totalTypedRef = useRef(0);   // total characters typed (incl. corrections)
  const errorCountRef = useRef(0);   // characters typed wrong at the moment of typing
  const prevInputLenRef = useRef(0); // previous input length, to detect additions
  const [accuracy, setAccuracy] = useState(100);

  useEffect(() => {
      setLibraryItems(getLibrary().filter(i => i.language === user.learningLanguage));
      setTypingLib(getTypingLibraryItems(user.learningLanguage));
  }, [user.learningLanguage]);

  // Cleanup audio on unmount
  useEffect(() => {
      return () => {
          cancelSpeech();
          ttsPlayerRef.current?.stop();
          if (userAudioUrl) {
              URL.revokeObjectURL(userAudioUrl);
          }
      };
  }, []);

  // Reset and stop audio when content changes
  useEffect(() => {
      cancelSpeech();
      setIsSpeaking(false);
      ttsPlayerRef.current?.stop();
      setTtsPlayerVisible(false);
      deleteUserRecording();
      setSavedToLibrary(false);
      setAddedVocabWords(new Set());
      setErrorMsg(null);
      // Reset accuracy tracking for the new drill
      totalTypedRef.current = 0;
      errorCountRef.current = 0;
      prevInputLenRef.current = 0;
      setAccuracy(100);
      // 新练习开始时文本区回到顶部
      if (textContainerRef.current) {
          textContainerRef.current.scrollTop = 0;
      }
  }, [content]);

  // 打字时让当前光标保持在可视区域：交给浏览器原生 scrollIntoView 处理，
  // 仅当光标真正离屏时才滚动，且不再手动读取布局（getBoundingClientRect
  // 会强制同步重排，长文本下每次按键都会触发，是卡顿主因之一）
  useEffect(() => {
      if (!content || finished) return;
      const cursor = currentCharRef.current;
      if (!cursor) return;
      cursor.scrollIntoView({ block: 'nearest' });
  }, [inputValue, content, finished]);

  // --- Audio Engine Logic (delegated to TtsAudioPlayer) ---
  // 工具栏的「朗读」按钮通过 ref 调用播放器；播放器自己管理 url / 进度 / AB / 循环。
  // 这里只保留启停 + 显隐控制。

  const stopAudio = () => {
      ttsPlayerRef.current?.stop();
      setIsSpeaking(false);
  };

  const togglePlayback = useCallback(async () => {
      if (!content) return;
      const handle = ttsPlayerRef.current;
      // 第一次点击 → 拉起播放器（面板稍后由下一个 effect 自动开始播放）
      if (!ttsPlayerVisible || !handle) {
          setTtsPlayerVisible(true);
          ttsShouldAutoplayRef.current = true;
          return;
      }
      if (handle.isPlaying()) {
          handle.pause();
          setIsSpeaking(false);
      } else {
          await handle.play();
          setIsSpeaking(true);
      }
  }, [content, ttsPlayerVisible]);

  // 面板挂载 + 标记 autoplay 时，自动触发首次播放
  useEffect(() => {
      if (ttsPlayerVisible && ttsShouldAutoplayRef.current && ttsPlayerRef.current) {
          ttsShouldAutoplayRef.current = false;
          ttsPlayerRef.current.play().then(() => setIsSpeaking(true)).catch(() => {});
      }
  }, [ttsPlayerVisible, content?.text]);

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

  // AI 生成的打字内容自动入「打字库」，省 token 且可重复练习
  const persistGenerated = (data: TypingContent, cefr: CEFRLevel, source: 'stage' | 'practice') => {
    try {
      const item: TypingLibraryItem = {
        id: generateId(),
        language: user.learningLanguage,
        cefr,
        topic: data.topic || '打字练习',
        source,
        text: data.text,
        translation: data.translation,
        phoneticGuide: data.phoneticGuide || '',
        keyVocabulary: data.keyVocabulary || [],
        createdAt: Date.now(),
        practiceCount: 0,
      };
      setTypingLib(saveTypingLibraryItem(item));
    } catch {
      /* 入库失败不影响本次练习 */
    }
  };

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
          persistGenerated(data, stage.cefr, 'stage');
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
          persistGenerated(data, currentLevel, 'practice');
          setTimeout(() => inputRef.current?.focus(), 100);
      } catch (error) {
          console.error(error);
          setErrorMsg("内容生成失败，请检查网络连接。");
          setContent(null);
      } finally {
          setIsLoading(false);
      }
  };

  // 从打字库载入一条已生成内容重练（不调 AI，省 token）
  const loadFromTypingLibrary = (item: TypingLibraryItem) => {
      stopAudio();
      setIsLoading(false);
      setErrorMsg(null);
      setInputValue('');
      setStartTime(null);
      setWpm(0);
      setFinished(false);
      setPassedStage(false);
      setActiveStage(null);
      setIsAISource(false); // 重练不重复写通用记忆库
      setContent({
        text: item.text,
        topic: item.topic,
        phoneticGuide: item.phoneticGuide,
        translation: item.translation,
        keyVocabulary: item.keyVocabulary,
      });
      setTypingLib(touchTypingLibraryItem(item.id, item.language));
      setTimeout(() => inputRef.current?.focus(), 100);
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

    // 实时准确率：随输入立即更新，方便用户在顶部工具栏看到当前状态
    const totalTyped = totalTypedRef.current;
    const errors = errorCountRef.current;
    setAccuracy(
      totalTyped > 0
        ? Math.max(0, Math.min(100, Math.round(((totalTyped - errors) / totalTyped) * 100)))
        : 100
    );

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
    const text = content.text;
    const len = inputValue.length;
    const showCursor = !finished;

    // 把文本按「已输入正确 / 已输入错误 / 未输入」三种状态合并成连续片段，
    // 仅在光标位置插入一个独立的光标 span，避免逐字符渲染上千个 DOM 节点。
    const nodes: React.ReactNode[] = [];
    let runStart = 0;
    let runStatus: 'correct' | 'wrong' | 'untyped' | null = null;

    const pushRun = (end: number) => {
      if (runStatus === null) return;
      const chunk = text.slice(runStart, end);
      if (chunk) {
        nodes.push(
          <RunSpan
            key={`${runStatus}-${runStart}`}
            text={chunk}
            status={runStatus}
          />
        );
      }
      runStart = end;
    };

    for (let idx = 0; idx < text.length; idx++) {
      // 在光标所在位置插入光标竖线（仅在未完成且未到达末尾时）
      if (showCursor && idx === len) {
        pushRun(idx);
        nodes.push(
          <span
            key="cursor"
            ref={currentCharRef}
            className="relative inline-block rounded-sm bg-secondary/15"
          >
            <span className="absolute left-0 top-0 h-full w-[3px] bg-secondary text-secondary shadow-[0_0_6px_currentColor] animate-pulse" />
            {'​'}
          </span>
        );
        runStatus = null;
      }
      const status: 'correct' | 'wrong' | 'untyped' =
        idx < len
          ? inputValue[idx] === text[idx]
            ? 'correct'
            : 'wrong'
          : 'untyped';
      if (runStatus !== status) {
        pushRun(idx);
        runStatus = status;
      }
    }
    pushRun(text.length);

    return (
      <div className="text-lg md:text-xl lg:text-2xl font-sans leading-loose break-words text-gray-200">
        {nodes}
      </div>
    );
  };

  // Level Map Component
  const renderStageMap = () => {
      const unlockedStage = user.progress[user.learningLanguage]?.maxUnlockedStage || 0;
      
      return (
          <div className="flex flex-col items-center pb-12">
              <div className="bg-surface-2/50 p-4 rounded-xl border border-line-strong mb-8 max-w-lg w-full text-center">
                  <div className="flex items-center justify-center gap-2 text-yellow-500 mb-2">
                      <ShieldAlert size={20} />
                      <span className="font-bold">硬核模式已开启</span>
                  </div>
                  <p className="text-sm text-muted">
                      在闯关模式下，所有提示（译文、音频、发音）都会关闭。
                      只能靠纯记忆和打字硬实力。
                  </p>
              </div>

              <div className="relative w-full max-w-lg space-y-8 mt-4">
                  {/* Vertical Line Connector：霓虹渐变光路 */}
                  <div className="absolute left-1/2 top-4 bottom-4 w-1 -translate-x-1/2 z-0 rounded-full bg-gradient-to-b from-neon/50 via-neon-2/30 to-transparent"></div>
                  
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
                                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-700 text-white shadow-[0_0_18px_rgba(74,222,128,0.45)]'
                                          : isCurrent
                                              ? 'bg-gradient-to-br from-neon to-neon-2 border-purple-700 text-white animate-bounce-slight shadow-[0_0_26px_rgba(139,92,246,0.75)]'
                                              : 'bg-surface-3/70 border-line text-muted cursor-not-allowed grayscale'
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
                                      absolute top-full mt-3 glass-panel rounded-xl p-3 w-48 text-center shadow-glow-neon opacity-0 scale-95 pointer-events-none transition-all
                                      group-hover:opacity-100 group-hover:scale-100 group-hover:z-50
                                  `}>
                                      <div className="font-bold text-white text-sm mb-1">{stage.title}</div>
                                      <div className="text-xs text-muted mb-2">{stage.description}</div>
                                      <div className="flex justify-center gap-2 text-[10px] font-mono uppercase bg-surface/50 p-1 rounded">
                                          <span className="text-violet-300">{stage.cefr}</span>
                                          <span className="text-cyan-300">{stage.minWpm} WPM</span>
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
        <div className="glass-panel p-4 rounded-xl animate-in slide-in-from-top-4 space-y-4 shadow-card">
            {/* 标题 / 等级 / 统计 / 退出 */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="px-3 py-1 rounded-full bg-neon/15 text-violet-300 text-sm font-bold border border-neon/30 shadow-glow-sm shrink-0">
                        {activeStage ? activeStage.cefr : "练习"}
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm md:text-base font-bold text-white truncate">{content.topic}</h2>
                        <p className="text-xs text-muted">
                            {inputValue.length}/{content.text.length} 字符 · {Math.min(100, Math.round((inputValue.length / content.text.length) * 100))}%
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2/50 rounded-lg border border-line-strong">
                        <span className="text-xs text-muted">WPM</span>
                        <span className="text-base md:text-lg font-bold text-white tabular-nums">{wpm}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2/50 rounded-lg border border-line-strong">
                        <span className="text-xs text-muted">准确率</span>
                        <span className="text-base md:text-lg font-bold text-white tabular-nums">{accuracy}%</span>
                    </div>
                    <button
                        onClick={() => setContent(null)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 hover:bg-surface-3 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                        退出
                    </button>
                </div>
            </div>

            {/* 进度条：霓虹流光 */}
            <div className="h-1.5 w-full bg-surface-2/70 rounded-full overflow-hidden">
                <div
                    className="h-full xp-bar rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(100, (inputValue.length / content.text.length) * 100)}%` }}
                />
            </div>

            {/* 功能按钮 */}
            <div className="flex flex-wrap items-center gap-2">
                {!isStrictMode && (
                    <>
                        <div className="flex items-center gap-1 bg-surface-2/50 rounded-lg p-1 border border-line-strong">
                            <button
                                onClick={togglePlayback}
                                disabled={!content}
                                className={`p-2 rounded-md transition-colors flex items-center gap-1.5 text-sm ${isSpeaking ? 'bg-green-500/20 text-green-400' : 'hover:bg-surface-3 text-gray-300'}`}
                                title="播放音频"
                            >
                                {isSpeaking ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                <span className="hidden sm:inline text-xs">朗读</span>
                            </button>
                            <button onClick={toggleSpeed} className="px-2 py-1 text-xs font-bold text-muted hover:text-white hover:bg-surface-3 rounded">
                                {playbackSpeed}x
                            </button>
                        </div>

                        <div className="flex items-center gap-1 bg-surface-2/50 rounded-lg p-1 border border-line-strong">
                            {!userAudioUrl ? (
                                <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-md flex items-center gap-1.5 text-sm ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-surface-3 text-gray-300'}`} title="录制你的声音">
                                    {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
                                    <span className="hidden sm:inline text-xs">{isRecording ? '录音中' : '录音'}</span>
                                </button>
                            ) : (
                                <>
                                    <button onClick={playUserRecording} className={`p-2 rounded-md ${isPlayingUser ? 'text-secondary' : 'text-gray-300'}`}><Ear size={16} /></button>
                                    <button
                                        onClick={handleTranscribe}
                                        disabled={isTranscribing}
                                        className={`p-2 rounded-md ${isTranscribing ? 'text-secondary animate-pulse' : 'text-gray-300 hover:text-white'}`}
                                        title="用 AI 识别你的发音"
                                    >
                                        {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    </button>
                                    <button onClick={deleteUserRecording} className="p-2 rounded-md text-muted hover:text-red-400"><Trash2 size={16} /></button>
                                </>
                            )}
                        </div>

                        {userAudioUrl && userTranscript !== null && (
                            <div className="text-sm text-gray-300 bg-surface-2/40 rounded-lg px-3 py-2 border border-line-strong">
                                <span className="text-muted mr-2">识别结果:</span>
                                {userTranscript || "（无语音内容）"}
                            </div>
                        )}

                        <button
                            onClick={handleManualSave}
                            disabled={savedToLibrary}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors border font-medium text-sm
                                ${savedToLibrary 
                                    ? 'bg-green-500/20 text-green-400 border-green-500/50 cursor-default' 
                                    : 'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20 hover:text-white'
                                }
                            `}
                            title={savedToLibrary ? "内容已存入记忆库" : "保存到记忆库"}
                        >
                            {savedToLibrary ? <Check size={16} /> : <Bookmark size={16} />}
                            <span className="hidden sm:inline">{savedToLibrary ? "已保存" : "保存"}</span>
                        </button>

                        {content?.phoneticGuide && (
                            <button onClick={() => setShowPhonetic(!showPhonetic)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ${showPhonetic ? 'bg-secondary/20 text-secondary' : 'text-muted hover:text-gray-200 hover:bg-surface-3'}`} title="切换发音指南"><Keyboard size={16} /><span className="hidden sm:inline">注音</span></button>
                        )}
                        <button onClick={() => setShowTranslation(!showTranslation)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ${showTranslation ? 'bg-blue-500/20 text-blue-400' : 'text-muted hover:text-gray-200 hover:bg-surface-3'}`} title="切换译文"><Eye size={16} /><span className="hidden sm:inline">译文</span></button>
                    </>
                )}
                
                {isStrictMode && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold uppercase tracking-wider">
                        <Lock size={12} /> 硬核模式
                    </div>
                )}

                {/* TTS 复读播放器：首次点击「朗读」按钮后出现。
                   提供进度条 / A-B 区间循环 / 速度调节，自带按文本缓存。 */}
                {ttsPlayerVisible && content && (
                  <TtsAudioPlayer
                    ref={ttsPlayerRef}
                    text={content.text}
                    speed={playbackSpeed}
                    webSpeechLang={languageToSpeechLang(user.learningLanguage)}
                    onPlayingChange={setIsSpeaking}
                  />
                )}
            </div>
        </div>
      )}

      {/* Main Content / Setup Area */}
      <div className="relative">
      
      {isLoading ? (
          <div className="glass-panel rounded-2xl p-12 shadow-card min-h-[300px] flex items-center justify-center flex-col gap-4">
             <div className="w-12 h-12 border-4 border-neon border-t-transparent rounded-full animate-spin shadow-glow-neon"></div>
             <p className="text-muted animate-pulse">正在生成专属练习……</p>
             {errorMsg && (
                 <div className="mt-4 p-3 bg-red-900/20 border border-red-800 text-red-300 rounded-lg text-sm max-w-sm text-center">
                     {errorMsg}
                     <button onClick={() => fetchPracticeContent('random')} className="block mx-auto mt-2 text-xs underline hover:text-white">重试</button>
                 </div>
             )}
          </div>
        ) : !content ? (
            // Setup Screen
            <div className="glass-panel rounded-2xl p-6 md:p-8 shadow-card min-h-[400px]">
                 <div className="text-center mb-8">
                     <h3 className="text-2xl font-bold mb-2 neon-text">打字闯关</h3>
                     <p className="text-muted">选择一种模式开始训练。</p>
                 </div>

                 {/* Mode Tabs */}
                 <div className="flex flex-wrap justify-center gap-4 mb-8">
                     <button
                        onClick={() => setActiveTab('campaign')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'campaign' ? 'bg-gradient-to-r from-neon to-neon-2 text-white shadow-glow-neon scale-105' : 'bg-surface-2/70 text-muted hover:bg-surface-3 hover:text-white'}`}
                     >
                        <Swords size={18} /> 闯关 <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-white/70">硬核</span>
                     </button>
                     <button
                        onClick={() => setActiveTab('practice')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'practice' ? 'bg-surface-3 text-white shadow-glow-sm border border-neon/40' : 'bg-surface-2/70 text-muted hover:bg-surface-3 hover:text-white'}`}
                     >
                        <LayoutGrid size={18} /> AI 练习
                     </button>
                    <button
                        onClick={() => setActiveTab('memory')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'memory' ? 'bg-gradient-to-r from-neon to-neon-2 text-white shadow-glow-neon' : 'bg-surface-2/70 text-muted hover:bg-surface-3 hover:text-white'}`}
                    >
                        <Book size={18} /> 记忆库
                    </button>
                    <button
                        onClick={() => setActiveTab('typinglib')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'typinglib' ? 'bg-gradient-to-r from-neon to-neon-2 text-white shadow-glow-neon' : 'bg-surface-2/70 text-muted hover:bg-surface-3 hover:text-white'}`}
                    >
                        <Library size={18} /> 打字库
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
                                className="flex flex-col items-center justify-center gap-2 p-4 bg-surface-2/50 hover:bg-surface-3/80 hover:scale-105 border border-white/[0.06] hover:border-neon/50 hover:shadow-glow-sm rounded-xl transition-all duration-200 group"
                             >
                                 <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{topic.icon}</span>
                                 <span className="text-sm font-medium text-gray-300 group-hover:text-white">{topic.label}</span>
                             </button>
                         ))}
                         {/* Random Button */}
                         <button
                            onClick={() => fetchPracticeContent('random daily topic')}
                            className="flex flex-col items-center justify-center gap-2 p-4 bg-gradient-to-br from-neon/15 to-neon-2/10 hover:brightness-125 border border-neon/25 hover:border-neon/60 hover:shadow-glow-neon rounded-xl transition-all duration-200"
                         >
                             <Sparkles size={32} className="text-yellow-400" />
                             <span className="text-sm font-bold text-white">随机来一个</span>
                         </button>
                     </div>
                 )}

                 {activeTab === 'memory' && (
                     <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                         {libraryItems.length === 0 ? (
                             <div className="text-center py-12 border-2 border-dashed border-line rounded-xl">
                                 <p className="text-muted mb-4">你的记忆库还是空的。</p>
                                 <div className="text-sm text-faint">完成 AI 练习或添加自己的内容，就能在这里复习。</div>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {libraryItems.map(item => (
                                     <button
                                        key={item.id}
                                        onClick={() => handleUseLibraryItem(item)}
                                        className="text-left p-4 bg-surface-2/50 hover:bg-surface-3/80 border border-white/[0.06] hover:border-neon/45 hover:shadow-glow-sm rounded-xl transition-all duration-200 group"
                                     >
                                         <h4 className="font-bold text-gray-200 group-hover:text-white mb-1 truncate">{item.title}</h4>
                                         <p className="text-xs text-muted truncate">{item.content}</p>
                                     </button>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}

                 {activeTab === 'typinglib' && (
                     <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                         {typingLib.length === 0 ? (
                             <div className="text-center py-12 border-2 border-dashed border-line rounded-xl">
                                 <p className="text-muted mb-4">你的打字库还是空的。</p>
                                 <div className="text-sm text-faint">完成「闯关」或「AI 练习」后，生成的打字内容会自动存到这里，可随时无 token 重练。</div>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {typingLib.map(item => (
                                     <div
                                        key={item.id}
                                        className="p-4 bg-surface-2/50 hover:bg-surface-3/80 border border-white/[0.06] hover:border-neon/45 hover:shadow-glow-sm rounded-xl transition-all duration-200 group"
                                     >
                                         <div className="flex items-start justify-between gap-2 mb-1">
                                             <h4 className="font-bold text-gray-200 group-hover:text-white truncate">{item.topic}</h4>
                                             <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold border border-primary/30">{item.cefr}</span>
                                         </div>
                                         <p className="text-xs text-muted truncate mb-1">
                                             {item.source === 'stage' ? '关卡' : '练习'} · 已练 {item.practiceCount ?? 0} 次
                                         </p>
                                         <p className="text-xs text-muted/80 line-clamp-2 mb-3">{item.text}</p>
                                         <div className="flex items-center gap-2">
                                             <button
                                                onClick={() => loadFromTypingLibrary(item)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110 transition"
                                             >
                                                <Repeat size={14} /> 重练
                                             </button>
                                             <button
                                                onClick={() => setTypingLib(deleteTypingLibraryItem(item.id, item.language))}
                                                className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                                                title="删除"
                                             >
                                                <Trash2 size={14} />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}
            </div>
        ) : (
          <div
            className="glass-panel rounded-2xl p-6 md:p-10 min-h-[260px] cursor-text relative shadow-card transition-shadow duration-500 focus-within:shadow-glow-neon focus-within:border-neon/25"
            onClick={() => inputRef.current?.focus()}
          >
            <div
              ref={textContainerRef}
              className="max-h-[60vh] overflow-y-auto pr-3 pb-2 custom-scrollbar space-y-5"
            >
                {/* Phonetic / Input Hint */}
                {content.phoneticGuide && showPhonetic && !isStrictMode && (
                    <div className="text-muted font-sans text-sm leading-relaxed select-none">
                        {content.phoneticGuide}
                    </div>
                )}

                {/* The Actual Text */}
                {renderText()}

                {/* Translation Overlay (if enabled) */}
                {showTranslation && !isStrictMode && (
                    <div className="pt-5 border-t border-line/60 text-blue-400/90 italic text-base md:text-lg animate-in fade-in">
                        {content.translation}
                    </div>
                )}
            </div>

            {/* Hidden Input：覆盖整张卡片用于点击聚焦，但不拦截鼠标事件，避免挡住滚动条 */}
            <input
              ref={inputRef}
              type="text"
              className="opacity-0 absolute inset-0 cursor-default pointer-events-none"
              value={inputValue}
              onChange={handleInput}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>
        )}
      </div>

      {/* Success State */}
      {finished && (
        <div className="glass-panel border-green-400/30 shadow-[0_0_28px_-6px_rgba(74,222,128,0.5)] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full text-dark shadow-[0_0_18px_rgba(74,222,128,0.7)] animate-[pop_0.45s_ease-out]">
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
                  <div key={idx} className="glass-panel p-4 rounded-xl transition-all duration-300 hover:border-neon/30 hover:shadow-glow-sm hover:-translate-y-0.5 group relative">
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-violet-300" />
                            <span className="text-xs text-muted uppercase font-semibold">{item.partOfSpeech}</span>
                          </div>
                          <button 
                             onClick={() => handleAddVocabulary(item)}
                             disabled={addedVocabWords.has(item.word)}
                             className={`text-muted hover:text-white transition-colors ${addedVocabWords.has(item.word) ? 'text-green-500 opacity-50 cursor-default' : ''}`}
                             title="加入词库"
                          >
                             {addedVocabWords.has(item.word) ? <Check size={16} /> : <Plus size={16} />}
                          </button>
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1 group-hover:text-secondary transition-colors">{item.word}</h4>
                      <p className="text-sm text-muted">{item.meaning}</p>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default TypingView;
