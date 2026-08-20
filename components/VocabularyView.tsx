
import React, { useState, useEffect } from 'react';
import { UserProfile, VocabularyItem } from '../types';
import { getVocabulary, saveVocabularyItem, deleteVocabularyItem, addActivity, getDueVocabulary, updateVocabularyItem, reviewVocabulary, progressQuests } from '../services/storageService';
import { generateWordDetails, playWord } from '../services/aiService';
import { BookA, Plus, Search, Trash2, Sparkles, Volume2, Tag, Loader2, Save, X, Repeat, Check, XCircle, Layers } from 'lucide-react';

interface VocabularyViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const VocabularyView: React.FC<VocabularyViewProps> = ({ user, onUpdateUser }) => {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'browse' | 'review'>('browse');
  const [dueCount, setDueCount] = useState(0);

  // Review state
  const [queue, setQueue] = useState<VocabularyItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewDone, setReviewDone] = useState(0);

  // Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // 英文单词发音口音（有道 dictvoice：uk=英式 type=2 / us=美式 type=1）；雅思默认英式
  const [accent, setAccent] = useState<'uk' | 'us'>('uk');

  useEffect(() => {
    // Filter items by current learning language
    const list = getVocabulary().filter(v => v.language === user.learningLanguage);
    setItems(list);
    setDueCount(getDueVocabulary().filter(v => v.language === user.learningLanguage).length);
  }, [user.learningLanguage, user]);

  const startReview = () => {
    const due = getDueVocabulary().filter(v => v.language === user.learningLanguage);
    setQueue(due);
    setReviewIdx(0);
    setReviewDone(0);
    setRevealed(false);
    setViewMode('review');
  };

  const handleReview = (known: boolean) => {
    const current = queue[reviewIdx];
    if (!current) return;
    const updated = reviewVocabulary(current, known);
    updateVocabularyItem(updated);
    const updatedUser = progressQuests(user, 'vocab_review', 1);
    onUpdateUser(updatedUser);
    setReviewDone((d) => d + 1);
    setRevealed(false);
    if (reviewIdx + 1 < queue.length) {
      setReviewIdx((i) => i + 1);
    } else {
      setQueue([]);
    }
  };

  const handleAIAutoFill = async () => {
    if (!newWord.trim()) return;
    setIsGenerating(true);
    try {
      const details = await generateWordDetails(newWord, user.learningLanguage, user.nativeLanguage);
      setDefinition(details.definition);
      setExample(details.example);
      setPartOfSpeech(details.partOfSpeech);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!newWord.trim()) return;

    const newItem: VocabularyItem = {
      id: crypto.randomUUID(),
      word: newWord,
      definition,
      exampleSentence: example,
      partOfSpeech,
      language: user.learningLanguage,
      createdAt: Date.now()
    };

    saveVocabularyItem(newItem);
    setItems(prev => [newItem, ...prev]);
    
    // Award a little XP for building vocab
    const { user: updatedUser } = addActivity(
        user,
        'vocabulary',
        user.learningLanguage,
        5, // 5 XP per word
        `已添加单词：${newWord}`,
        { word: newWord }
    );
    onUpdateUser(updatedUser);

    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteVocabularyItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const resetForm = () => {
    setNewWord('');
    setDefinition('');
    setExample('');
    setPartOfSpeech('');
    setIsAdding(false);
  };

  const filteredItems = items.filter(i => 
    i.word.toLowerCase().includes(filter.toLowerCase()) || 
    i.definition.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <BookA className="text-neon-2" /> 词汇库
           </h2>
           <p className="text-muted text-sm">为 {user.learningLanguage} 建立你的私人词典。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setViewMode('browse')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'browse' ? 'bg-neon text-white shadow-glow-neon' : 'text-muted hover:text-white'}`}
            >
              <Layers size={16} className="inline mr-1 -mt-0.5" /> 词库
            </button>
            <button
              onClick={startReview}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'review' ? 'bg-neon text-white shadow-glow-neon' : 'text-muted hover:text-white'}`}
            >
              <Repeat size={16} className="inline mr-1 -mt-0.5" /> 复习{dueCount > 0 ? ` (${dueCount})` : ''}
            </button>
          </div>
          <button
             onClick={() => setIsAdding(true)}
             className="px-6 py-3 bg-neon hover:bg-neon/80 text-white rounded-xl font-bold shadow-glow-neon flex items-center gap-2 transition-all"
          >
              <Plus size={20} /> 添加单词
          </button>
        </div>
      </div>

      {/* Review Mode (SRS) */}
      {viewMode === 'review' && (
        <div className="max-w-2xl mx-auto w-full">
          {queue.length > 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <div className="flex justify-between items-center mb-4 text-xs text-muted">
                <span>复习进度 {reviewDone}/{queue.length}</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-line-strong">
                  Box {queue[reviewIdx]?.box ?? 1}
                </span>
              </div>
              <div className="text-3xl font-bold text-white mb-2">{queue[reviewIdx]?.word}</div>
              <span className="text-xs font-mono text-neon-2 px-2 py-0.5 bg-neon-2/10 rounded-full border border-neon-2/20 inline-block mb-6">
                {queue[reviewIdx]?.partOfSpeech || '词性'}
              </span>

              {!revealed ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setRevealed(true)}
                    className="w-full py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
                  >
                    显示答案
                  </button>
                  {user.learningLanguage === 'English' && (
                    <div className="flex items-center justify-center">
                      <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-xs">
                        <button
                          onClick={() => setAccent('uk')}
                          className={`px-2.5 py-1 rounded ${accent === 'uk' ? 'bg-neon text-white' : 'text-muted hover:text-white'}`}
                          title="英式发音（有道）"
                        >英 UK</button>
                        <button
                          onClick={() => setAccent('us')}
                          className={`px-2.5 py-1 rounded ${accent === 'us' ? 'bg-neon text-white' : 'text-muted hover:text-white'}`}
                          title="美式发音（有道）"
                        >美 US</button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => playWord(queue[reviewIdx]?.word || '', user.learningLanguage, accent)}
                    className="flex items-center justify-center gap-2 w-full py-2 text-muted hover:text-neon-2"
                  >
                    <Volume2 size={16} /> 听发音
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-4 bg-white/5 rounded-xl text-left">
                    <p className="text-gray-200 text-sm mb-2">{queue[reviewIdx]?.definition}</p>
                    {queue[reviewIdx]?.exampleSentence && (
                      <p className="text-muted text-xs italic">"{queue[reviewIdx]?.exampleSentence}"</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleReview(false)}
                      className="py-3 rounded-xl bg-red-600/20 text-red-300 border border-red-700/40 font-bold hover:bg-red-600/30 flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} /> 还没记住
                    </button>
                    <button
                      onClick={() => handleReview(true)}
                      className="py-3 rounded-xl bg-green-600/20 text-green-300 border border-green-700/40 font-bold hover:bg-green-600/30 flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> 记住了
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <Repeat size={40} className="text-green-400 mx-auto mb-4" />
              <div className="text-xl font-bold text-white mb-1">本轮复习完成 🎉</div>
              <p className="text-muted text-sm mb-6">你刚刚复习了 {reviewDone} 个单词。间隔复习让记忆更牢。</p>
              <button
                onClick={() => setViewMode('browse')}
                className="px-6 py-3 rounded-xl bg-neon text-white font-bold hover:bg-neon/80 shadow-glow-neon"
              >
                返回词库
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search & List (browse) */}
      {viewMode === 'browse' && (
      <div className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-line-strong bg-white/5">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input 
                    type="text" 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="搜索你的单词…"
                    className="w-full bg-dark/60 border border-line-strong rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-neon focus:border-transparent outline-none"
                  />
              </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
              {items.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted">
                      <BookA size={48} className="mb-4 opacity-30" />
                      <p>还没有保存单词。</p>
                      <button onClick={() => setIsAdding(true)} className="text-neon-2 hover:underline mt-2">添加第一个单词</button>
                  </div>
              ) : filteredItems.length === 0 ? (
                  <div className="col-span-full text-center text-muted py-12">没有找到匹配项。</div>
              ) : (
                  filteredItems.map(item => (
                      <div key={item.id} className="bg-dark/40 border border-line-strong rounded-xl p-4 hover:border-neon/40 transition-all group relative hover:shadow-glow-sm">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h3 className="text-xl font-bold text-white">{item.word}</h3>
                                      <button
                                        onClick={() => playWord(item.word, user.learningLanguage, accent)}
                                        className="text-muted hover:text-neon-2 transition-colors"
                                        title="朗读单词"
                                      >
                                        <Volume2 size={16} />
                                      </button>
                                  </div>
                                  <span className="text-xs font-mono text-neon-2 px-2 py-0.5 bg-neon-2/10 rounded-full border border-neon-2/20 inline-block mt-1">
                                      {item.partOfSpeech || '词性'}
                                  </span>
                              </div>
                              <button 
                                onClick={() => handleDelete(item.id)}
                                className="text-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              >
                                  <Trash2 size={16} />
                              </button>
                          </div>
                          
                          <p className="text-gray-300 text-sm mb-3 font-medium">{item.definition}</p>
                          
                          {item.exampleSentence && (
                              <div className="bg-white/5 p-2 rounded-lg text-xs text-muted italic border-l-2 border-neon/40">
                                  "{item.exampleSentence}"
                              </div>
                          )}
                          
                          <div className="mt-3 text-[10px] text-faint flex justify-end">
                              添加于 {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
      )}

      {/* Add Word Modal */}
      {isAdding && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-line-strong flex justify-between items-center bg-white/5">
                      <h3 className="font-bold text-white">添加新单词</h3>
                      <button onClick={resetForm} className="text-muted hover:text-white"><X size={20} /></button>
                  </div>
                  
                  <div className="p-6 space-y-4 overflow-y-auto">
                      <div>
                          <label className="block text-xs font-bold text-muted uppercase mb-1">单词</label>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newWord}
                                  onChange={(e) => setNewWord(e.target.value)}
                                  className="flex-1 bg-dark border border-line-strong rounded-lg px-4 py-2 text-white outline-none focus:border-neon"
                                  placeholder="输入单词（如 Serendipity）"
                                  autoFocus
                              />
                              <button 
                                  onClick={handleAIAutoFill}
                                  disabled={!newWord || isGenerating}
                                  className="bg-neon/20 hover:bg-neon/30 text-neon border border-neon/50 px-3 py-2 rounded-lg transition-colors"
                                  title="用 AI 自动填充释义"
                              >
                                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                              </button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-muted uppercase mb-1">词性</label>
                          <input 
                              type="text" 
                              value={partOfSpeech}
                              onChange={(e) => setPartOfSpeech(e.target.value)}
                              className="w-full bg-dark border border-line-strong rounded-lg px-4 py-2 text-white outline-none focus:border-neon"
                              placeholder="例如：名词、动词"
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-muted uppercase mb-1">释义（{user.nativeLanguage}）</label>
                          <textarea 
                              value={definition}
                              onChange={(e) => setDefinition(e.target.value)}
                              className="w-full bg-dark border border-line-strong rounded-lg px-4 py-2 text-white outline-none focus:border-neon resize-none h-20"
                              placeholder="含义…"
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-muted uppercase mb-1">例句（{user.learningLanguage}）</label>
                          <textarea 
                              value={example}
                              onChange={(e) => setExample(e.target.value)}
                              className="w-full bg-dark border border-line-strong rounded-lg px-4 py-2 text-white outline-none focus:border-neon resize-none h-20"
                              placeholder="用法示例…"
                          />
                      </div>
                  </div>

                  <div className="p-4 border-t border-line-strong bg-white/5 flex justify-end gap-3">
                      <button onClick={resetForm} className="px-4 py-2 text-muted hover:text-white font-medium">取消</button>
                      <button 
                          onClick={handleSave}
                          disabled={!newWord}
                          className="px-6 py-2 bg-green-600 hover:bg-green-500 hover:brightness-110 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Save size={18} /> 保存单词
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VocabularyView;
