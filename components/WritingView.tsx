
import React, { useState } from 'react';
import { UserProfile, WritingFeedback } from '../types';
import { analyzeWriting } from '../services/aiService';
import { addActivity } from '../services/storageService';
import { Sparkles, ArrowRight, BookCheck, Wand2, Star } from 'lucide-react';

interface WritingViewProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
}

const TOPICS = [
  "Describe your favorite childhood memory.",
  "What is your opinion on social media?",
  "Describe the room you are currently in.",
  "Write a letter to a friend inviting them to dinner.",
  "Explain a traditional dish from your country."
];

const WritingView: React.FC<WritingViewProps> = ({ user, onComplete }) => {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('');

  const handleAnalyze = async () => {
    if (text.length < 10) return;
    setIsAnalyzing(true);
    setFeedback(null);
    try {
      const result = await analyzeWriting(text, user.learningLanguage, user.nativeLanguage);
      setFeedback(result);
      
      // Calculate XP: Base 50 + Length Bonus
      const wordCount = text.trim().split(/\s+/).length;
      const xp = 50 + Math.min(100, Math.floor(wordCount / 2));
      
      const { user: updatedUser } = addActivity(
          user,
          'writing',
          user.learningLanguage,
          xp,
          `Writing Practice (${wordCount} words)`,
          {
              wordCount: wordCount,
              feedback: result.generalComment
          }
      );
      onComplete(updatedUser);

    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const useTopic = (topic: string) => {
    setActiveTopic(topic);
    setFeedback(null);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
      
      {/* Left Column: Input Area */}
      <div className="flex flex-col space-y-4 h-full">
        {/* Topic Suggestion Carousel */}
        <div className="bg-card p-4 rounded-xl border border-gray-700">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Guided Topics</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {TOPICS.map((t, i) => (
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
                placeholder={`Start writing in ${user.learningLanguage} here...`}
                className="flex-grow w-full bg-dark/50 border border-gray-700 rounded-xl p-6 text-lg leading-relaxed text-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none resize-none transition-all"
            />
            <div className="absolute bottom-4 right-4 text-gray-500 text-sm font-mono">
                {text.length} chars
            </div>
        </div>

        <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || text.length < 10}
            className="w-full py-4 bg-gradient-to-r from-primary to-secondary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {isAnalyzing ? (
                <>Analyzing <Sparkles className="animate-spin" size={18} /></>
            ) : (
                <>Get AI Feedback <Wand2 size={18} /></>
            )}
        </button>
      </div>

      {/* Right Column: Feedback Area */}
      <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
        {!feedback ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-xl bg-card/20">
                <BookCheck size={48} className="mb-4 opacity-50" />
                <p>Submit your writing to receive detailed feedback.</p>
            </div>
        ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                
                {/* XP Badge */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-transparent p-4 rounded-xl border border-yellow-500/20 flex items-center gap-3">
                    <Star size={24} className="text-yellow-400 fill-current animate-pulse" />
                    <div>
                        <h4 className="font-bold text-yellow-100">Feedback Received!</h4>
                        <p className="text-xs text-yellow-200/70">You earned XP for your effort.</p>
                    </div>
                </div>

                {/* Score Card */}
                <div className="bg-card p-6 rounded-xl border border-gray-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-gray-400 text-sm font-medium">Estimated Level</h3>
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
                        AI Polished Version
                    </div>
                    <div className="p-6 text-gray-200 leading-relaxed bg-dark/30">
                        {feedback.correctedText}
                    </div>
                </div>

                {/* Specific Suggestions */}
                <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <BookCheck size={18} className="text-secondary" />
                        Specific Improvements
                    </h3>
                    {feedback.suggestions.length === 0 ? (
                        <p className="text-gray-500 italic">No specific errors found. Great job!</p>
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
  );
};

export default WritingView;
