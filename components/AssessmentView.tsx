import React, { useState } from 'react';
import { Language, AssessmentResult, CEFRLevel } from '../types';
import { assessUserLevel } from '../services/geminiService';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AssessmentViewProps {
  language: Language;
  onLevelSet: (level: CEFRLevel) => void;
}

const AssessmentView: React.FC<AssessmentViewProps> = ({ language, onLevelSet }) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAssessment = async () => {
    if (inputText.trim().length < 20) {
        setError("Please write at least a few sentences for an accurate assessment.");
        return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const data = await assessUserLevel(inputText, language);
      setResult(data);
      onLevelSet(data.level);
    } catch (err) {
      setError("Failed to connect to AI. Please check your API key or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-card p-6 rounded-2xl border border-gray-700/50">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-secondary">AI</span> Level Check
        </h2>
        <p className="text-gray-400 mb-6">
          Write a short paragraph about yourself, your hobbies, or your day (30-100 words). 
          Our AI will analyze your vocabulary and grammar to assign a CEFR level.
        </p>

        <textarea
          className="w-full h-48 bg-dark/50 border border-gray-700 rounded-xl p-4 text-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none resize-none transition-all"
          placeholder={`Write something in ${language} here...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />

        {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 text-red-300 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} />
                {error}
            </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleAssessment}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-secondary to-blue-600 hover:from-secondary/90 hover:to-blue-600/90 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {isLoading ? 'Analyzing...' : 'Analyze My Level'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="flex-shrink-0 text-center">
              <div className="w-32 h-32 rounded-full border-4 border-secondary flex items-center justify-center bg-secondary/10 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <span className="text-5xl font-bold text-white">{result.level}</span>
              </div>
              <p className="mt-3 text-sm text-gray-400 font-medium tracking-wider uppercase">CEFR Level</p>
            </div>

            <div className="flex-grow space-y-4">
              <h3 className="text-xl font-semibold text-white">Analysis Report</h3>
              <p className="text-gray-300 leading-relaxed">{result.reasoning}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-dark/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-gray-400">Vocabulary</span>
                        <span className="text-secondary font-bold">{result.vocabularyScore}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary transition-all duration-1000" style={{ width: `${result.vocabularyScore}%` }}></div>
                    </div>
                </div>
                <div className="bg-dark/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-gray-400">Grammar</span>
                        <span className="text-blue-500 font-bold">{result.grammarScore}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${result.grammarScore}%` }}></div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentView;
