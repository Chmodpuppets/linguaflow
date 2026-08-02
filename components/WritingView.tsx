
import React, { useState } from 'react';
import { UserProfile, WritingFeedback, CEFRLevel } from '../types';
import { analyzeWriting } from '../services/aiService';
import { addActivity } from '../services/storageService';
import { countWords } from '../services/textUtils';
import GuidedWritingView from './GuidedWritingView';
import { Sparkles, ArrowRight, BookCheck, Wand2, Star, AlertCircle } from 'lucide-react';

interface WritingViewProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
}

// 按 CEFR 等级分级的写作题目（母语提示，让学习者用目标语言产出）
const TOPICS_BY_LEVEL: Record<CEFRLevel, string[]> = {
  [CEFRLevel.A1]: [
    '用目标语言做个自我介绍：你叫什么、是哪国人、做什么工作或学生。',
    '描述你身边的一件物品：这是什么、什么颜色、是大还是小。',
    '写写你今天做了什么（用过去时），至少两句。',
    '说说你喜欢什么、不喜欢什么（用"喜欢/讨厌"句型）。',
    '描述你房间里某样东西在哪里（用方位词）。',
  ],
  [CEFRLevel.A2]: [
    '描述你一天的日常（从早到晚，至少四句）。',
    '写写你上个周末做了什么（用过去时）。',
    '比较两种食物或两个城市，说说你更喜欢哪个、为什么。',
    '写一段话邀请朋友周末一起做某事，说明时间地点。',
    '你在餐厅，用目标语言点一餐并和服务员简单对话。',
  ],
  [CEFRLevel.B1]: [
    '描述一次让你印象深刻的旅行：去了哪、做了什么、感受如何。',
    '谈谈你对某件事的看法（用"我认为"句型），并给出理由。',
    '比较住在城市和乡下的优缺点。',
    '写一封信给朋友，讲讲你最近的计划和打算。',
    '介绍一部你喜欢的电影或书，并说明推荐理由。',
  ],
  [CEFRLevel.B2]: [
    '描述一段童年回忆，以及它对你的影响。',
    '谈谈你对社交媒体的看法：利与弊。',
    '介绍一道你家乡的传统菜，并写明做法。',
    '就一个社会话题阐述你的观点，正反两面都要涉及。',
    '写一封正式邮件，申请一个职位或项目。',
  ],
  [CEFRLevel.C1]: [
    '就一个争议性话题写一篇议论文，立场鲜明、论证充分。',
    '描述一个复杂的技术或文化概念，让外行也能懂。',
    '写一篇评论文章，评析最近的一部作品或事件。',
    '用目标语言写一篇短文，反思你学习这门语言的过程与心得。',
  ],
  [CEFRLevel.C2]: [
    '用目标语言创作一篇短篇散文或故事，注重文采与风格。',
    '就一个抽象主题（如时间、自由）写一篇哲学思辨短文。',
    '翻译并评析一段你母语的文学片段。',
  ],
};

const WritingView: React.FC<WritingViewProps> = ({ user, onComplete }) => {
  // 按用户当前目标语言的 CEFR 等级选题（无等级记录默认 A1）
  const userLevel = user.progress[user.learningLanguage]?.cefrLevel ?? CEFRLevel.A1;
  const currentTopics = TOPICS_BY_LEVEL[userLevel] ?? TOPICS_BY_LEVEL[CEFRLevel.A1];

  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'free' | 'guided'>('free');

  const handleAnalyze = async () => {
    if (text.length < 10) return;
    setIsAnalyzing(true);
    setFeedback(null);
    setError(null);
    try {
      const result = await analyzeWriting(text, user.learningLanguage, user.nativeLanguage, userLevel);
      setFeedback(result);
      
      // Calculate XP: Base 50 + Length Bonus（CJK 按字符数，拉丁按词数）
      const wordCount = countWords(text, user.learningLanguage);
      const xp = 50 + Math.min(100, Math.floor(wordCount / 2));
      
      const { user: updatedUser } = addActivity(
          user,
          'writing',
          user.learningLanguage,
          xp,
          `写作练习（${wordCount} 词）`,
          {
              wordCount: wordCount,
              feedback: result.generalComment
          }
      );
      onComplete(updatedUser);

    } catch (err) {
      console.error(err);
      setError('AI 批改失败，请检查 API Key / 网络后重试。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const useTopic = (topic: string) => {
    setActiveTopic(topic);
    setFeedback(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* 模式切换：自由写作 / 引导练习 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('free')}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${mode === 'free' ? 'bg-primary text-white border-primary' : 'bg-card border-gray-700 text-gray-300 hover:border-secondary'}`}
        >
          自由写作
        </button>
        <button
          onClick={() => setMode('guided')}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${mode === 'guided' ? 'bg-primary text-white border-primary' : 'bg-card border-gray-700 text-gray-300 hover:border-secondary'}`}
        >
          引导练习（A1 友好）
        </button>
      </div>

      {mode === 'guided' ? (
        <GuidedWritingView user={user} onComplete={onComplete} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
      
      {/* Left Column: Input Area */}
      <div className="flex flex-col space-y-4 h-full">
        {/* Topic Suggestion Carousel */}
        <div className="bg-card p-4 rounded-xl border border-gray-700">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">写作题目（{userLevel} 级）</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {currentTopics.map((t, i) => (
                    <button 
                        key={i} 
                        onClick={() => useTopic(t)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition-all ${activeTopic === t ? 'bg-secondary text-white border-secondary' : 'bg-dark border-gray-700 text-gray-400 hover:border-gray-500'}`}
                    >
                        {t.slice(0, 25)}...
                    </button>
                ))}
            </div>
            {activeTopic && (
                <div className="mt-3 text-white font-medium bg-dark/50 p-3 rounded-lg border-l-4 border-secondary">
                    {activeTopic}
                </div>
            )}
        </div>

        <div className="flex-grow flex flex-col relative">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`用 ${user.learningLanguage} 写点什么……`}
                className="flex-grow w-full bg-dark/50 border border-gray-700 rounded-xl p-6 text-lg leading-relaxed text-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none resize-none transition-all"
            />
            <div className="absolute bottom-4 right-4 text-gray-500 text-sm font-mono">
                {text.length} 字
            </div>
        </div>

        <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || text.length < 10}
            className="w-full py-4 bg-gradient-to-r from-primary to-secondary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {isAnalyzing ? (
                <>分析中 <Sparkles className="animate-spin" size={18} /></>
            ) : (
                <>获取 AI 批改 <Wand2 size={18} /></>
            )}
        </button>
      </div>

      {/* Right Column: Feedback Area */}
      <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
        {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-800 text-red-300 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold mb-1">批改失败</p>
                    <p className="text-sm text-red-300/80">{error}</p>
                    <button onClick={handleAnalyze} disabled={isAnalyzing || text.length < 10} className="mt-2 text-xs underline hover:text-white disabled:opacity-50">重试</button>
                </div>
            </div>
        )}
        {!feedback ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-xl bg-card/20">
                <BookCheck size={48} className="mb-4 opacity-50" />
                <p>提交你的作文，获取详细批改。</p>
            </div>
        ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                
                {/* XP Badge */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-transparent p-4 rounded-xl border border-yellow-500/20 flex items-center gap-3">
                    <Star size={24} className="text-yellow-400 fill-current animate-pulse" />
                    <div>
                        <h4 className="font-bold text-yellow-100">已收到批改！</h4>
                        <p className="text-xs text-yellow-200/70">你的努力已获得经验值。</p>
                    </div>
                </div>

                {/* Score Card */}
                <div className="bg-card p-6 rounded-xl border border-gray-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-gray-400 text-sm font-medium">预估等级</h3>
                        <p className="text-3xl font-bold text-white mt-1">{feedback.cefrEstimation}</p>
                    </div>
                    <div className="text-right max-w-[60%]">
                        <p className="text-gray-300 italic">"{feedback.generalComment}"</p>
                    </div>
                </div>

                {/* Corrections */}
                <div className="bg-card rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 bg-gray-800/50 border-b border-gray-700 font-semibold text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-yellow-400" />
                        AI 润色版
                    </div>
                    <div className="p-6 text-gray-200 leading-relaxed bg-dark/30">
                        {feedback.correctedText}
                    </div>
                </div>

                {/* Specific Suggestions */}
                <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <BookCheck size={18} className="text-secondary" />
                        具体改进建议
                    </h3>
                    {feedback.suggestions.length === 0 ? (
                        <p className="text-gray-500 italic">没有发现具体错误，写得真好！</p>
                    ) : (
                        feedback.suggestions.map((item, idx) => (
                            <div key={idx} className="bg-card p-4 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="w-1/2 p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-red-200 line-through decoration-red-500/50">
                                        {item.original}
                                    </div>
                                    <ArrowRight className="text-gray-500 mt-3 flex-shrink-0" size={20} />
                                    <div className="w-1/2 p-3 bg-green-900/10 border border-green-900/30 rounded-lg text-green-200 font-medium">
                                        {item.suggestion}
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-gray-400 pl-1 border-l-2 border-gray-600">
                                    💡 {item.reason}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
};

export default WritingView;
