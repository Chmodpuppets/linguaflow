
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, RPGScenario, RPGMessage, ScenarioDef } from '../types';
import { RPG_PACKS } from '../data/rpgScenarios';
import { startRPGScenario, continueRPGTurn, generateSpeech, cancelSpeech, transcribeAudio, buildTutorSystemPrompt } from '../services/aiService';
import { addActivity, saveVocabularyItem } from '../services/storageService';
import { 
    Send, Mic, Volume2, User, Bot, CheckCircle2, 
    Gamepad2, Sparkles, BookA, ArrowRight,
    Loader2, Trophy, RotateCcw, XCircle, Play, Pause, X,
    Languages, Lightbulb, AlertTriangle, Square
} from 'lucide-react';

interface RPGViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

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
    const [hasSavedSession, setHasSavedSession] = useState(false);
    const [currentDef, setCurrentDef] = useState<ScenarioDef | null>(null); // 当前预置剧本（用于“再玩一次”）
    const [currentChoices, setCurrentChoices] = useState<string[]>([]);    // 本轮回合的剧情分支选项

    // AI 导师"记住你"的系统提示（人设 + 目标 + 薄弱点）
    const tutorSystem = buildTutorSystemPrompt(user);

    // --- RPG 进度本地保存（可续玩） ---
    const RPG_SESSION_KEY = 'linguaflow_rpg_session';
    const saveSession = (scn: RPGScenario | null, msgs: RPGMessage[], completed: string[]) => {
        try {
            localStorage.setItem(RPG_SESSION_KEY, JSON.stringify({
                scenario: scn,
                messages: msgs,
                completed,
            }));
        } catch { /* ignore quota */ }
    };
    const loadSession = (): { scenario: RPGScenario; messages: RPGMessage[]; completed: string[] } | null => {
        try {
            const raw = localStorage.getItem(RPG_SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    };
    const clearSession = () => {
        localStorage.removeItem(RPG_SESSION_KEY);
        setHasSavedSession(false);
    };

    useEffect(() => {
        setHasSavedSession(!!loadSession());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resumeSession = () => {
        const s = loadSession();
        if (!s) return;
        setScenario(s.scenario);
        setMessages(s.messages);
        setCompletedObjectives(new Set(s.completed || []));
        setIsFinished(false);
        setShowVictoryModal(false);
        setShowHint(false);
    };

    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Audio State (simplified: Web Speech / Qwen TTS via generateSpeech) ---
    const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // --- Voice Input State (user speech → STT → input) ---
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    // Scroll to bottom on new message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Cleanup audio + recording on unmount
    useEffect(() => {
        return () => {
            cancelSpeech();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // --- Audio Playback ---
    const onAudioButton = (msgId: string, text: string) => {
        if (activeMessageId === msgId && isPlaying) {
            cancelSpeech();
            setIsPlaying(false);
            setActiveMessageId(null);
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

    // --- Voice Input (record → transcribe → fill input) ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                if (blob.size === 0) return;
                setIsTranscribing(true);
                try {
                    const text = await transcribeAudio(blob, user.learningLanguage);
                    setInput(prev => (prev ? prev + ' ' : '') + (text || ''));
                } catch (e: any) {
                    console.error(e);
                    setFeedbackToast('语音识别失败：' + (e?.message || e) + '（注：浏览器直连可能受 CORS 限制）');
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            setFeedbackToast('无法访问麦克风，请检查浏览器权限。');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleStart = async (def: ScenarioDef, packName: string) => {
        setIsProcessing(true);
        try {
            const newScenario = await startRPGScenario(
                packName,
                user.progress[user.learningLanguage]?.cefrLevel || 'A1',
                user.learningLanguage,
                user.nativeLanguage,
                tutorSystem,
                def
            );
            clearSession();
            setScenario(newScenario);
            setCurrentDef(def);
            setCurrentChoices([]);
            const initMsg: RPGMessage = {
                id: 'init',
                sender: 'ai',
                text: newScenario.initialMessage,
                phonetic: newScenario.initialPhonetic,
                translation: '',
            };
            setMessages([initMsg]);
            setCurrentSuggestion(newScenario.initialSuggestedReply || "你好！");
            setCurrentSuggestionPhonetic(newScenario.initialSuggestedReplyPhonetic || null);
            setCompletedObjectives(new Set());
            setIsFinished(false);
            setShowVictoryModal(false);
            setShowHint(false); // Reset hints on start
            saveSession(newScenario, [initMsg], []);
        } catch (e) {
            console.error(e);
            setFeedbackToast('场景生成失败，请检查 API Key 或网络后重试。');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSend = async (override?: string) => {
        const text = (override ?? input).trim();
        if (!text || !scenario) return;

        const userMsg: RPGMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text
        };

        setMessages(prev => [...prev, userMsg]);
        if (!override) setInput('');
        setIsProcessing(true);
        setFeedbackToast(null);
        setCurrentSuggestion(null); // Clear suggestion while processing
        setCurrentSuggestionPhonetic(null);
        setCurrentChoices([]);     // 发送后清空上轮分支选项
        setShowHint(false); // Reset hint toggle

        // Stop audio when sending new message
        if (isPlaying) onStopAudio();

        try {
            const turnResult = await continueRPGTurn(
                scenario,
                messages.map(m => ({ sender: m.sender, text: m.text })),
                userMsg.text,
                user.learningLanguage,
                user.nativeLanguage,
                tutorSystem
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
            // Set branching choices for next turn
            if (turnResult.choices && turnResult.choices.length > 0) {
                setCurrentChoices(turnResult.choices);
            }

            const aiMsg: RPGMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: turnResult.aiReply,
                phonetic: turnResult.phonetic,
                translation: turnResult.translation,
                vocabularyHighlights: turnResult.vocabulary
            };

            const newCompleted: Set<string> = new Set(completedObjectives);
            turnResult.completedObjectives.forEach((o) => newCompleted.add(o));
            setMessages(prev => [...prev, aiMsg]);
            saveSession(scenario, [...messages, userMsg, aiMsg], Array.from(newCompleted));

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
            setFeedbackToast('回复失败，请检查网络或 API 额度后重试。');
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
            scenario ? `剧情对话：${scenario.theme}` : '剧情对话',
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
        cancelSpeech();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsPlaying(false);
        setActiveMessageId(null);
        setIsRecording(false);
        setIsTranscribing(false);
        setScenario(null);
        setMessages([]);
        setCompletedObjectives(new Set());
        setFeedbackToast(null);
        setCurrentSuggestion(null);
        setCurrentSuggestionPhonetic(null);
        setShowExitConfirm(false);
        setIsFinished(false);
        setShowVictoryModal(false);
        clearSession();
    };

    // Toggle confirmation modal
    const handleExitClick = () => {
        setShowExitConfirm(true);
    };

    // --- RENDER: LOBBY ---
    if (!scenario) {
        return (
            <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col items-center justify-start overflow-y-auto custom-scrollbar animate-in fade-in py-4">
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                        <Gamepad2 size={40} className="text-secondary" /> 剧情对话
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto text-lg">
                        沉浸式角色扮演场景。选择一个场景，化身角色，通过对话完成任务。
                    </p>
                </div>

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={48} className="animate-spin text-primary" />
                        <p className="text-gray-300 animate-pulse">正在生成你的专属场景……</p>
                    </div>
                ) : (
                    <div className="w-full">
                        {hasSavedSession && (
                            <button
                                onClick={resumeSession}
                                className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-secondary/20 border border-secondary/50 text-secondary font-bold hover:bg-secondary/30 transition-colors"
                            >
                                <RotateCcw size={18} /> 继续上次的对话
                            </button>
                        )}
                        <div className="space-y-8">
                            {RPG_PACKS.map(pack => (
                                <div key={pack.id}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-2xl">{pack.icon}</span>
                                        <div>
                                            <h3 className="text-white font-bold">{pack.name}</h3>
                                            <p className="text-xs text-gray-500">{pack.description}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {pack.scenarios.map(sc => (
                                            <button
                                                key={sc.id}
                                                onClick={() => handleStart(sc, pack.name)}
                                                className="text-left bg-card border border-gray-700 hover:border-secondary hover:bg-secondary/10 p-4 rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-gray-200 group-hover:text-white">{sc.title}</span>
                                                    {sc.inspiredBy && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 whitespace-nowrap">影视</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sc.context}</p>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {sc.tags.map(t => (
                                                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{t}</span>
                                                    ))}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
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
                            <h3 className="text-xl font-bold text-white">退出任务？</h3>
                        </div>
                        <p className="text-gray-300 mb-6 leading-relaxed">
                            确定要离开吗？当前的对话记录和进度都会丢失。
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowExitConfirm(false)}
                                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors font-medium text-sm"
                            >
                                取消
                            </button>
                            <button 
                                onClick={performExit}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-900/20"
                            >
                                确认退出
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
                            title="关闭并查看对话"
                        >
                            <X size={20} />
                        </button>

                        <Trophy size={64} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-3xl font-bold text-white mb-2">
                            {scenario && scenario.objectives.length > 0 && completedObjectives.size >= scenario.objectives.length
                                ? '完美通关！'
                                : '任务完成！'}
                        </h2>
                        <p className="text-gray-400 mb-6">
                            {scenario && scenario.objectives.length > 0
                                ? `你完成了 ${completedObjectives.size} / ${scenario.objectives.length} 个目标，获得了经验值。`
                                : '你成功完成了场景，获得了经验值。'}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={performExit} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold">
                                退出
                            </button>
                            {currentDef && (
                                <button onClick={() => handleStart(currentDef, scenario?.universe || '')} className="px-6 py-3 bg-secondary hover:bg-secondary/90 text-white rounded-xl font-bold flex items-center gap-2">
                                    <RotateCcw size={18} /> 再玩一次
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Left Panel: Info & Objectives */}
            <div className="w-full lg:w-1/4 bg-card border border-gray-700 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 bg-gray-900/50 border-b border-gray-700">
                    <button onClick={handleExitClick} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 mb-2">
                        <ArrowRight className="rotate-180" size={12} /> 退出任务
                    </button>
                    <h3 className="font-bold text-white text-lg leading-tight">{scenario.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{scenario.context}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {scenario.universe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/30">
                                {scenario.universe}
                            </span>
                        )}
                        {scenario.inspiredBy && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                                灵感来自：{scenario.inspiredBy}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">角色</h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <User size={16} className="text-primary" /> 
                                <span className="font-bold">你：</span> {scenario.userRole}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Bot size={16} className="text-secondary" /> 
                                <span className="font-bold">AI：</span> {scenario.aiRole}
                            </div>
                        </div>
                        {scenario.character && (
                            <div className="mt-3 p-3 rounded-lg bg-secondary/5 border border-secondary/20">
                                <div className="flex items-center gap-2 text-sm text-secondary font-bold mb-1">
                                    <Sparkles size={14} /> {scenario.character.name}
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed">{scenario.character.persona}</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">任务目标</h4>
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
                        <span>进度</span>
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
                                                    title="听发音"
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

                                    {/* Audio Player (simplified) */}
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
                                                    title={`保存：${vocab.meaning}`}
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
                            <span className="font-bold block mb-1 text-orange-300">教练反馈</span>
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
                                 <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide block mb-1">建议回复</span>
                                 {showPhonetics && currentSuggestionPhonetic && (
                                     <p className="text-xs text-indigo-300 font-mono mb-1">{currentSuggestionPhonetic}</p>
                                 )}
                                 <p className="text-indigo-200 italic">{currentSuggestion}</p>
                             </div>
                             <button 
                                onClick={() => setInput(currentSuggestion)}
                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors whitespace-nowrap"
                             >
                                用这句
                             </button>
                         </div>
                    )}

                    {/* Branching Choices */}
                    {currentChoices.length > 0 && !isProcessing && !isFinished && (
                        <div className="mb-3 animate-in slide-in-from-bottom-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-2">剧情分支 · 选一个推进</span>
                            <div className="flex flex-wrap gap-2">
                                {currentChoices.map((c, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(c)}
                                        className="text-sm px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/25 border border-primary/30 text-primary hover:text-white transition-colors text-left"
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <button 
                            onClick={() => setShowHint(!showHint)}
                            disabled={!currentSuggestion}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showHint ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30'}`}
                            title="显示建议回复"
                        >
                            <Lightbulb size={14} className={showHint ? "text-yellow-300 fill-yellow-300" : ""} /> Hint
                        </button>
                        
                        <button 
                            onClick={() => setShowPhonetics(!showPhonetics)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showPhonetics ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            title="切换发音指南（罗马音/拼音）"
                        >
                            <Languages size={14} /> 发音指南
                        </button>

                        {/* Voice Input Toggle */}
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isProcessing || isFinished || isTranscribing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30 ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            title={isRecording ? '停止录音并识别' : '语音输入（录音后自动转写）'}
                        >
                            {isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={14} />}
                            {isTranscribing ? '识别中…' : isRecording ? '停止' : '语音'}
                        </button>
                    </div>

                    <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setCurrentChoices([]); }}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={`以「${scenario.userRole}」的身份回复……`}
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
                         <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">打字或语音回复</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RPGView;
