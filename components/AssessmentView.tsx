import React, { useState } from 'react';
import { Language, AssessmentResult, CEFRLevel } from '../types';
import { assessUserLevel } from '../services/aiService';
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
        setError("请至少写几句话，以便进行准确的评估。");
        return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const data = await assessUserLevel(inputText, language);
      setResult(data);
      onLevelSet(data.level);
    } catch (err) {
      setError("无法连接 AI，请检查你的 API 密钥或重试。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-neon-2">AI</span> 水平测试
        </h2>
        <p className="text-muted mb-6">
          用{language}写一小段关于你自己、爱好或日常的文字（30–100 词）。
          AI 会分析你的词汇和语法，给出 CEFR 等级。
        </p>

        <textarea
          className="w-full h-48 bg-dark/60 border border-line-strong rounded-xl p-4 text-gray-200 focus:ring-2 focus:ring-neon focus:border-transparent outline-none resize-none transition-all"
          placeholder={`在这里用 ${language} 写点什么……`}
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
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-neon to-neon-2 hover:from-neon/90 hover:to-neon-2/90 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-neon"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {isLoading ? '分析中……' : '分析我的等级'}
          </button>
        </div>
      </div>

      {result && (
        <div className="glass-panel p-8 rounded-2xl border border-neon/30 shadow-glow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="flex-shrink-0 text-center">
              <div className="w-32 h-32 rounded-full border-4 border-neon flex items-center justify-center bg-neon/10 shadow-glow-neon">
                <span className="text-5xl font-bold text-white">{result.level}</span>
              </div>
              <p className="mt-3 text-sm text-muted font-medium tracking-wider uppercase">CEFR 等级</p>
            </div>

            <div className="flex-grow space-y-4">
              <h3 className="text-xl font-semibold text-white">分析报告</h3>
              <p className="text-gray-300 leading-relaxed">{result.reasoning}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-dark/40 p-3 rounded-lg border border-line-strong/50">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-muted">词汇</span>
                        <span className="text-neon font-bold">{result.vocabularyScore}%</span>
                    </div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full bg-neon transition-all duration-1000" style={{ width: `${result.vocabularyScore}%` }}></div>
                    </div>
                </div>
                <div className="bg-dark/40 p-3 rounded-lg border border-line-strong/50">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-muted">语法</span>
                        <span className="text-neon-2 font-bold">{result.grammarScore}%</span>
                    </div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full bg-neon-2 transition-all duration-1000" style={{ width: `${result.grammarScore}%` }}></div>
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
