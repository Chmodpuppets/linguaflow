
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, RPGScenario, RPGMessage, RPGTurnResult } from '../types';
import { startRPGScenario, continueRPGTurn, generateSpeech, cancelSpeech } from '../services/aiService';
import { addActivity, saveVocabularyItem } from '../services/storageService';
import { 
    Send, Mic, Volume2, User, Bot, CheckCircle2, 
    Shield, Gamepad2, Sparkles, BookA, ArrowRight,
    Loader2, Trophy, RotateCcw, XCircle, Play, Pause, Repeat, X, 
    Languages, Lightbulb, Keyboard, AlertTriangle, XSquare
} from 'lucide-react';

interface RPGViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

// --- Audio Helper Functions ---
function decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const THEMES = [
    { id: 'cafe', label: 'Cafe & Ordering', icon: '☕' },
    { id: 'business', label: 'Job Interview', icon: '💼' },
    { id: 'travel', label: 'Lost in City', icon: '🗺️' },
    { id: 'fantasy', label: 'Mystic Quest', icon: '🐉' },
    { id: 'sci-fi', label: 'Space Station', icon: '🚀' },
    { id: 'romance', label: 'First Date', icon: '💘' },
    { id: 'emergency', label: 'Medical Help', icon: '🚑' },
    { id: 'shopping', label: 'Market Bargain', icon: '🛍️' },
];

const RPGView: React.FC<RPGViewProps> = ({ user, onUpdateUser }) => {
    // Game State
    const [scenario, setScenario] = useState<RPGScenario | null>(null);
    const [messages, setMessages] = useState<RPGMessage[]>([]);
    const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(new Set());
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    
    // UI State
    const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
    const [showPhonetics, setShowPhonetics] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [currentSuggestion, setCurrentSuggestion] = useState<string | null>(null);
    const [currentSuggestionPhonetic, setCurrentSuggestionPhonetic] = useState<string | null>(null);
    const [showVictoryModal, setShowVictoryModal] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    // --- Audio Player State ---
    const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [playerState, setPlayerState] = useState({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1.0,
        loopA: null as number | null,
        loopB: null as number | null
    });

    // Refs for Audio Logic
    const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
    const audioContextRef = useRef<AudioContext | null>(null);
    const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedAtRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);

    // Scroll to bottom on new message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            cancelSpeech();
        };
    }, []);

    // --- Simplified Audio Logic (Qwen TTS / Web Speech) ---
    const onAudioButton = (msgId: string, text: string) => {
        if (activeMessageId === msgId && isPlaying) {
            cancelSpeech();
            setIsPlaying(false);
            return;
        }
        cancelSpeech();
        setActiveMessageId(msgId);
        setIsPlaying(true);
        generateSpeech(text, {
            lang: user.learningLanguage,
            onEnd: () => {
                setIsPlaying(false);
                if (activeMessageId === msgId) setActiveMessageId(null);
            },
        });
    };

    const onStopAudio = () => {
        cancelSpeech();
        setIsPlaying(false);
        setActiveMessageId(null);
    };

    // --- Audio Logic ---

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        return audioContextRef.current;
    };

    const stopAudio = () => {
        cancelSpeech();
        setIsPlaying(false);
    };

    const playBuffer = (buffer: AudioBuffer, offset: number) => {
        const ctx = initAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Stop previous if exists
        if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch(e) {}
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playerState.playbackRate;

        // Loop Logic
        if (playerState.loopA !== null && playerState.loopB !== null) {
            source.loop = true;
            source.loopStart = playerState.loopA;
            source.loopEnd = playerState.loopB;
            // Ensure offset is within loop if looping
            if (offset < playerState.loopA || offset >= playerState.loopB) {
                offset = playerState.loopA;
            }
        }

        source.connect(ctx.destination);
        
        source.onended = () => {
             // Only handle natural end if not looping
             if (!source.loop) {
                 setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
                 pausedAtRef.current = 0;
                 cancelAnimationFrame(rafRef.current!);
             }
        };

        source.start(0, offset);
        activeSourceRef.current = source;
        startTimeRef.current = ctx.currentTime;
        pausedAtRef.current = offset; // Track where we started

        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        
        // Animation Loop for Progress
        const updateProgress = () => {
            if (!activeSourceRef.current || !ctx) return;
            
            const elapsed = (ctx.currentTime - startTimeRef.current) * playerState.playbackRate;
            let current = pausedAtRef.current + elapsed;

            // Visual Loop adjustment
            if (playerState.loopA !== null && playerState.loopB !== null) {
                if (current >= playerState.loopB) {
                    const loopDur = playerState.loopB - playerState.loopA;
                    current = playerState.loopA + ((current - playerState.loopB) % loopDur);
                }
            } else if (current >= buffer.duration) {
                current = buffer.duration;
            }

            setPlayerState(prev => ({ ...prev, currentTime: current }));
            rafRef.current = requestAnimationFrame(updateProgress);
        };
        rafRef.current = requestAnimationFrame(updateProgress);
    };

    const togglePlay = () => {
        if (!activeMessageId) return;
        const buffer = audioCache.current.get(activeMessageId);
        if (!buffer) return;

        if (playerState.isPlaying) {
            // Pause
            stopAudio();
            // Record where we paused. Note: currentTime state is constantly updated by RAF
            pausedAtRef.current = playerState.currentTime; 
        } else {
            // Play
            let startAt = pausedAtRef.current;
            if (startAt >= buffer.duration) startAt = 0;
            playBuffer(buffer, startAt);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setPlayerState(prev => ({ ...prev, currentTime: time }));
        pausedAtRef.current = time;
        
        if (playerState.isPlaying && activeMessageId) {
            const buffer = audioCache.current.get(activeMessageId);
            if (buffer) {
                playBuffer(buffer, time);
            }
        }
    };

    const initializePlayer = async (msgId: string, text: string) => {
        // If clicking same message, just toggle collapse? For now, we keep it open.
        if (activeMessageId === msgId) return;

        // Stop current
        stopAudio();
        setActiveMessageId(msgId);
        pausedAtRef.current = 0;
        
        // Reset Player State
        setPlayerState({
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            playbackRate: 1.0,
            loopA: null,
            loopB: null
        });

        // Check Cache
        if (audioCache.current.has(msgId)) {
            const buffer = audioCache.current.get(msgId)!;
            setPlayerState(prev => ({ ...prev, duration: buffer.duration, isPlaying: true }));
            playBuffer(buffer, 0);
            return;
        }

        // Fetch
        setIsLoadingAudio(true);
        try {
            const base64 = await generateSpeech(text);
            if (base64) {
                const ctx = initAudioContext();
                const bytes = decodeBase64(base64);
                const buffer = await decodeAudioData(bytes, ctx);
                
                audioCache.current.set(msgId, buffer);
                setPlayerState(prev => ({ ...prev, duration: buffer.duration, isPlaying: true }));
                playBuffer(buffer, 0);
            }
        } catch (e) {
            console.error(e);
            setActiveMessageId(null);
        } finally {
            setIsLoadingAudio(false);
        }
    };

    const toggleSpeed = () => {
        const speeds = [0.8, 1.0, 1.25, 1.5];
        const nextIdx = (speeds.indexOf(playerState.playbackRate) + 1) % speeds.length;
        const newRate = speeds[nextIdx];
        
        setPlayerState(prev => ({ ...prev, playbackRate: newRate }));
        
        // Apply immediately if playing
        if (playerState.isPlaying && activeSourceRef.current) {
            activeSourceRef.current.playbackRate.value = newRate;
        }
    };

    const toggleLoopA = () => {
        setPlayerState(prev => {
            const newA = prev.loopA === null ? prev.currentTime : null;
            // If setting A clears A, also clear B
            return { ...prev, loopA: newA, loopB: newA === null ? null : prev.loopB };
        });
    };

    const toggleLoopB = () => {
         setPlayerState(prev => {
             // B must be after A
             if (prev.loopA === null || prev.currentTime <= prev.loopA) return prev;
             const newB = prev.loopB === null ? prev.currentTime : null;
             return { ...prev, loopB: newB };
         });
    };

    const clearLoops = () => {
        setPlayerState(prev => ({ ...prev, loopA: null, loopB: null }));
    };

    // Apply loop changes while playing
    useEffect(() => {
        if (playerState.isPlaying && activeSourceRef.current) {
            if (playerState.loopA !== null && playerState.loopB !== null) {
                activeSourceRef.current.loop = true;
                activeSourceRef.current.loopStart = playerState.loopA;
                activeSourceRef.current.loopEnd = playerState.loopB;
            } else {
                activeSourceRef.current.loop = false;
            }
        }
    }, [playerState.loopA, playerState.loopB]);


    const handleStart = async (themeId: string) => {
        setIsProcessing(true);
        try {
            const themeLabel = THEMES.find(t => t.id === themeId)?.label || themeId;
            const newScenario = await startRPGScenario(themeLabel, user.progress[user.learningLanguage]?.cefrLevel || 'A1', user.learningLanguage, user.nativeLanguage);
            setScenario(newScenario);
            setMessages([{
                id: 'init',
                sender: 'ai',
                text: newScenario.initialMessage,
                phonetic: newScenario.initialPhonetic,
                translation: 'Start the conversation...', // Initial placeholder
            }]);
            setCurrentSuggestion(newScenario.initialSuggestedReply || "Hello!");
            setCurrentSuggestionPhonetic(newScenario.initialSuggestedReplyPhonetic || null);
            setCompletedObjectives(new Set());
            setIsFinished(false);
            setShowVictoryModal(false);
            setShowHint(false); // Reset hints on start
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !scenario) return;

        const userMsg: RPGMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: input
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsProcessing(true);
        setFeedbackToast(null);
        setCurrentSuggestion(null); // Clear suggestion while processing
        setCurrentSuggestionPhonetic(null);
        setShowHint(false); // Reset hint toggle

        // Stop audio when sending new message
        if (playerState.isPlaying) stopAudio();

        try {
            const turnResult = await continueRPGTurn(
                scenario,
                messages.map(m => ({ sender: m.sender, text: m.text })),
                userMsg.text,
                user.learningLanguage,
                user.nativeLanguage
            );

            // Update objectives
            if (turnResult.completedObjectives.length > 0) {
                setCompletedObjectives(prev => {
                    const next = new Set(prev);
                    turnResult.completedObjectives.forEach(obj => next.add(obj));
                    return next;
                });
            }

            // Provide feedback if any
            if (turnResult.feedback) {
                setFeedbackToast(turnResult.feedback);
            }

            // Set next suggestion
            if (turnResult.suggestedUserReply) {
                setCurrentSuggestion(turnResult.suggestedUserReply);
                setCurrentSuggestionPhonetic(turnResult.suggestedUserReplyPhonetic || null);
            }

            const aiMsg: RPGMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: turnResult.aiReply,
                phonetic: turnResult.phonetic,
                translation: turnResult.translation,
                vocabularyHighlights: turnResult.vocabulary
            };

            setMessages(prev => [...prev, aiMsg]);

            if (turnResult.isScenarioComplete) {
                setIsFinished(true);
                setShowVictoryModal(true);
                awardXP(50); // Finish Bonus
            } else {
                // Participation XP
                awardXP(10);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const awardXP = (amount: number) => {
        const { user: u } = addActivity(
            user,
            'rpg',
            user.learningLanguage,
            amount,
            scenario ? `RPG: ${scenario.theme}` : 'RPG Session',
            { scenarioTitle: scenario?.title }
        );
        onUpdateUser(u);
    };

    const saveWord = (word: string, meaning: string) => {
        saveVocabularyItem({
            id: crypto.randomUUID(),
            word,
            definition: meaning,
            exampleSentence: "",
            partOfSpeech: "",
            language: user.learningLanguage,
            createdAt: Date.now()
        });
        // Small XP for saving word
        awardXP(5);
    };

    // Actual teardown logic
    const performExit = () => {
        stopAudio();
        setActiveMessageId(null);
        setScenario(null);
        setMessages([]);
        setCompletedObjectives(new Set());
        setFeedbackToast(null);
        setCurrentSuggestion(null);
        setCurrentSuggestionPhonetic(null);
        setShowExitConfirm(false);
        setIsFinished(false);
        setShowVictoryModal(false);
    };

    // Toggle confirmation modal
    const handleExitClick = () => {
        setShowExitConfirm(true);
    };

    // --- RENDER: LOBBY ---
    if (!scenario) {
        return (
            <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col items-center justify-center animate-in fade-in">
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                        <Gamepad2 size={40} className="text-secondary" /> LinguaQuest
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto text-lg">
                        Immersive Role-Playing Scenarios. Choose a setting, become a character, and complete objectives through conversation.
                    </p>
                </div>

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={48} className="animate-spin text-primary" />
                        <p className="text-gray-300 animate-pulse">Generating your unique scenario...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                        {THEMES.map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => handleStart(theme.id)}
                                className="group relative bg-card border border-gray-700 hover:border-secondary hover:bg-secondary/10 p-6 rounded-2xl transition-all duration-300 flex flex-col items-center gap-3 hover:-translate-y-1 hover:shadow-xl"
                            >
                                <span className="text-4xl group-hover:scale-110 transition-transform">{theme.icon}</span>
                                <span className="font-bold text-gray-200 group-hover:text-white">{theme.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- RENDER: GAME ---
    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4 relative">
            
            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-red-900/50 p-6 rounded-2xl shadow-2xl max-w-sm w-full transform transition-all animate-in zoom-in-95">
                        <div className="flex items-center gap-3 text-red-400 mb-3">
                            <AlertTriangle size={32} />
                            <h3 className="text-xl font-bold text-white">Exit Quest?</h3>
                        </div>
                        <p className="text-gray-300 mb-6 leading-relaxed">
                            Are you sure you want to leave? Your current conversation history and progress will be lost.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowExitConfirm(false)}
                                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={performExit}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-900/20"
                            >
                                Confirm Exit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Victory Overlay */}
            {showVictoryModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-card border border-secondary p-8 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] text-center max-w-sm mx-4 transform animate-in zoom-in-95 relative">
                        {/* Close button for overlay */}
                        <button 
                            onClick={() => setShowVictoryModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1"
                            title="Close and review chat"
                        >
                            <X size={20} />
                        </button>

                        <Trophy size={64} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-3xl font-bold text-white mb-2">Quest Complete!</h2>
                        <p className="text-gray-400 mb-6">You successfully completed the scenario and earned XP.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={performExit} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold">
                                Exit
                            </button>
                            <button onClick={() => handleStart(scenario.theme)} className="px-6 py-3 bg-secondary hover:bg-secondary/90 text-white rounded-xl font-bold flex items-center gap-2">
                                <RotateCcw size={18} /> Replay
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left Panel: Info & Objectives */}
            <div className="w-full lg:w-1/4 bg-card border border-gray-700 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 bg-gray-900/50 border-b border-gray-700">
                    <button onClick={handleExitClick} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 mb-2">
                        <ArrowRight className="rotate-180" size={12} /> Exit Quest
                    </button>
                    <h3 className="font-bold text-white text-lg leading-tight">{scenario.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{scenario.context}</p>
                </div>

                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Roles</h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <User size={16} className="text-primary" /> 
                                <span className="font-bold">You:</span> {scenario.userRole}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Bot size={16} className="text-secondary" /> 
                                <span className="font-bold">AI:</span> {scenario.aiRole}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mission Objectives</h4>
                        <div className="space-y-3">
                            {scenario.objectives.map((obj, idx) => {
                                const isDone = completedObjectives.has(obj);
                                return (
                                    <div key={idx} className={`flex items-start gap-2 text-sm p-2 rounded-lg transition-colors ${isDone ? 'bg-green-900/20 text-green-400' : 'bg-gray-800/50 text-gray-400'}`}>
                                        <div className={`mt-0.5 ${isDone ? 'text-green-500' : 'text-gray-600'}`}>
                                            {isDone ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                                        </div>
                                        <span className={isDone ? 'line-through opacity-70' : ''}>{obj}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                {/* Progress Bar based on objectives */}
                <div className="p-4 border-t border-gray-700 bg-gray-900/30">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round((completedObjectives.size / scenario.objectives.length) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-secondary transition-all duration-500" 
                            style={{ width: `${(completedObjectives.size / scenario.objectives.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Right Panel: Chat Interface */}
            <div className="flex-1 bg-card border border-gray-700 rounded-2xl flex flex-col overflow-hidden relative">
                
                {/* Chat Area */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {messages.map((msg) => {
                        const isAi = msg.sender === 'ai';
                        const isAudioActive = activeMessageId === msg.id;

                        return (
                            <div key={msg.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[85%] lg:max-w-[70%] rounded-2xl p-4 ${isAi ? 'bg-gray-800 rounded-tl-none' : 'bg-primary/20 border border-primary/30 rounded-tr-none'}`}>
                                    {/* Header */}
                                    {isAi && (
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-secondary">{scenario.aiRole}</span>
                                            
                                            {!isAudioActive && (
                                                <button 
                                                    onClick={() => onAudioButton(msg.id, msg.text)}
                                                    className="p-1 rounded-full text-gray-500 hover:text-white transition-colors"
                                                    title="Listen"
                                                >
                                                    <Volume2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Phonetic Guide (Optional) */}
                                    {isAi && showPhonetics && msg.phonetic && (
                                        <p className="text-gray-500 text-sm mb-1 font-mono tracking-wide">
                                            {msg.phonetic}
                                        </p>
                                    )}

                                    {/* Text Content */}
                                    <p className="text-gray-200 leading-relaxed text-lg">
                                        {msg.text}
                                    </p>
                                    
                                    {/* Translation (for AI) */}
                                    {isAi && msg.translation && (
                                        <p className="text-gray-500 text-sm mt-2 italic border-t border-gray-700/50 pt-2">
                                            {msg.translation}
                                        </p>
                                    )}

                                    {/* Audio Player */}
                                    {isAi && isAudioActive && (
                                        <div className="mt-3 bg-gray-900/80 rounded-lg p-3 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => onAudioButton(msg.id, msg.text)}
                                                    className="w-8 h-8 flex items-center justify-center bg-secondary hover:bg-secondary/90 text-white rounded-full transition-colors"
                                                >
                                                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                                </button>
                                                <span className="text-sm text-gray-400 flex-1">
                                                    {isPlaying ? "播放中…" : "已暂停"}
                                                </span>
                                                <button onClick={onStopAudio} className="text-gray-500 hover:text-white">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vocab Chips */}
                                    {isAi && msg.vocabularyHighlights && msg.vocabularyHighlights.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-gray-700/50">
                                            {msg.vocabularyHighlights.map((vocab, vIdx) => (
                                                <button
                                                    key={vIdx}
                                                    onClick={() => saveWord(vocab.word, vocab.meaning)}
                                                    className="flex items-center gap-1.5 px-2 py-1 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 rounded-md text-xs text-secondary transition-colors"
                                                    title={`Save: ${vocab.meaning}`}
                                                >
                                                    <BookA size={12} />
                                                    <span className="font-bold">{vocab.word}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    
                    {isProcessing && (
                         <div className="flex justify-start">
                             <div className="bg-gray-800 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                             </div>
                         </div>
                    )}
                    
                    {/* Spacer for bottom input */}
                    <div className="h-4"></div>
                </div>

                {/* Feedback Toast */}
                {feedbackToast && (
                    <div className="absolute bottom-28 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-orange-900/90 border border-orange-700 text-orange-100 p-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-2 flex items-start gap-3 z-10 backdrop-blur-sm">
                        <Sparkles size={18} className="mt-0.5 shrink-0 text-orange-400" />
                        <div className="text-sm">
                            <span className="font-bold block mb-1 text-orange-300">Coach Feedback</span>
                            {feedbackToast}
                        </div>
                        <button onClick={() => setFeedbackToast(null)} className="ml-auto text-orange-400 hover:text-white"><XCircle size={14} /></button>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-gray-900 border-t border-gray-700">
                    
                    {/* Hint Display */}
                    {showHint && currentSuggestion && (
                         <div className="mb-3 p-3 bg-indigo-900/30 border border-indigo-700/50 rounded-xl animate-in slide-in-from-bottom-2 flex justify-between items-start gap-3">
                             <div>
                                 <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide block mb-1">Suggested Reply</span>
                                 {showPhonetics && currentSuggestionPhonetic && (
                                     <p className="text-xs text-indigo-300 font-mono mb-1">{currentSuggestionPhonetic}</p>
                                 )}
                                 <p className="text-indigo-200 italic">{currentSuggestion}</p>
                             </div>
                             <button 
                                onClick={() => setInput(currentSuggestion)}
                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors whitespace-nowrap"
                             >
                                Use this
                             </button>
                         </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <button 
                            onClick={() => setShowHint(!showHint)}
                            disabled={!currentSuggestion}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showHint ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30'}`}
                            title="Show a suggested reply"
                        >
                            <Lightbulb size={14} className={showHint ? "text-yellow-300 fill-yellow-300" : ""} /> Hint
                        </button>
                        
                        <button 
                            onClick={() => setShowPhonetics(!showPhonetics)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showPhonetics ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            title="Toggle Phonetic Guide (Romaji/Pinyin)"
                        >
                            <Languages size={14} /> Phonetic Guide
                        </button>
                    </div>

                    <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={`Reply as ${scenario.userRole}...`}
                            disabled={isProcessing || isFinished}
                            className="w-full bg-dark border border-gray-700 rounded-xl pl-4 pr-12 py-4 text-white placeholder-gray-600 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none disabled:opacity-50"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isProcessing || isFinished}
                            className="absolute right-2 p-2 bg-secondary text-white rounded-lg hover:brightness-110 disabled:opacity-0 disabled:pointer-events-none transition-all"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                    <div className="text-center mt-2">
                         <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Type to Speak</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RPGView;
