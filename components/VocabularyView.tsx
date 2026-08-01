
import React, { useState, useEffect } from 'react';
import { UserProfile, VocabularyItem } from '../types';
import { getVocabulary, saveVocabularyItem, deleteVocabularyItem, addActivity } from '../services/storageService';
import { generateWordDetails } from '../services/geminiService';
import { BookA, Plus, Search, Trash2, Sparkles, Volume2, Tag, Loader2, Save, X } from 'lucide-react';

interface VocabularyViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const VocabularyView: React.FC<VocabularyViewProps> = ({ user, onUpdateUser }) => {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [filter, setFilter] = useState('');
  
  // Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Filter items by current learning language
    setItems(getVocabulary().filter(v => v.language === user.learningLanguage));
  }, [user.learningLanguage]);

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
        `Added word: ${newWord}`,
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
             <BookA className="text-secondary" /> Vocabulary Bank
           </h2>
           <p className="text-gray-400 text-sm">Build your personal dictionary for {user.learningLanguage}.</p>
        </div>
        <button 
           onClick={() => setIsAdding(true)}
           className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all"
        >
            <Plus size={20} /> Add Word
        </button>
      </div>

      {/* Search & List */}
      <div className="flex-1 bg-card border border-gray-700 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-700 bg-gray-900/30">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search your words..."
                    className="w-full bg-dark border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-secondary focus:border-transparent outline-none"
                  />
              </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
              {items.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-500">
                      <BookA size={48} className="mb-4 opacity-30" />
                      <p>No words saved yet.</p>
                      <button onClick={() => setIsAdding(true)} className="text-secondary hover:underline mt-2">Add your first word</button>
                  </div>
              ) : filteredItems.length === 0 ? (
                  <div className="col-span-full text-center text-gray-500 py-12">No matches found.</div>
              ) : (
                  filteredItems.map(item => (
                      <div key={item.id} className="bg-dark/50 border border-gray-700 rounded-xl p-4 hover:border-gray-500 transition-colors group relative">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h3 className="text-xl font-bold text-white">{item.word}</h3>
                                  <span className="text-xs font-mono text-secondary px-2 py-0.5 bg-secondary/10 rounded-full border border-secondary/20 inline-block mt-1">
                                      {item.partOfSpeech || 'word'}
                                  </span>
                              </div>
                              <button 
                                onClick={() => handleDelete(item.id)}
                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              >
                                  <Trash2 size={16} />
                              </button>
                          </div>
                          
                          <p className="text-gray-300 text-sm mb-3 font-medium">{item.definition}</p>
                          
                          {item.exampleSentence && (
                              <div className="bg-gray-800/50 p-2 rounded-lg text-xs text-gray-400 italic border-l-2 border-gray-600">
                                  "{item.exampleSentence}"
                              </div>
                          )}
                          
                          <div className="mt-3 text-[10px] text-gray-600 flex justify-end">
                              Added {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* Add Word Modal */}
      {isAdding && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-card border border-gray-600 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                      <h3 className="font-bold text-white">Add New Word</h3>
                      <button onClick={resetForm} className="text-gray-400 hover:text-white"><X size={20} /></button>
                  </div>
                  
                  <div className="p-6 space-y-4 overflow-y-auto">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Word</label>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newWord}
                                  onChange={(e) => setNewWord(e.target.value)}
                                  className="flex-1 bg-dark border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-secondary"
                                  placeholder="e.g. Serendipity"
                                  autoFocus
                              />
                              <button 
                                  onClick={handleAIAutoFill}
                                  disabled={!newWord || isGenerating}
                                  className="bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/50 px-3 py-2 rounded-lg transition-colors"
                                  title="Auto-fill definition with AI"
                              >
                                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                              </button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Part of Speech</label>
                          <input 
                              type="text" 
                              value={partOfSpeech}
                              onChange={(e) => setPartOfSpeech(e.target.value)}
                              className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-secondary"
                              placeholder="e.g. Noun, Verb"
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Definition ({user.nativeLanguage})</label>
                          <textarea 
                              value={definition}
                              onChange={(e) => setDefinition(e.target.value)}
                              className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-secondary resize-none h-20"
                              placeholder="Meaning..."
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Example Sentence ({user.learningLanguage})</label>
                          <textarea 
                              value={example}
                              onChange={(e) => setExample(e.target.value)}
                              className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-secondary resize-none h-20"
                              placeholder="Usage example..."
                          />
                      </div>
                  </div>

                  <div className="p-4 border-t border-gray-700 bg-gray-900/30 flex justify-end gap-3">
                      <button onClick={resetForm} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancel</button>
                      <button 
                          onClick={handleSave}
                          disabled={!newWord}
                          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Save size={18} /> Save Word
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VocabularyView;
