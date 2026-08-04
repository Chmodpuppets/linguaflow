
import React, { useState, useEffect } from 'react';
import { UserProfile, UserContent, ReadingReflection } from '../types';
import { getLibrary, saveLibraryItem, deleteLibraryItem } from '../services/storageService';
import { analyzeReadingContent } from '../services/aiService';
import { Plus, Trash2, Save, BookOpen, PenLine, Type, ArrowLeft, Sparkles, BrainCircuit, ChevronDown, ChevronUp, FileText } from 'lucide-react';

interface LibraryViewProps {
  user: UserProfile;
  onPractice: (content: { text: string; title: string; notes?: string }) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ user, onPractice }) => {
  const [items, setItems] = useState<UserContent[]>([]);
  const [selectedItem, setSelectedItem] = useState<UserContent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

  // Reflection State
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionTopic, setReflectionTopic] = useState('');
  const [reflectionPoint, setReflectionPoint] = useState('');
  const [reflectionExamples, setReflectionExamples] = useState('');
  const [reflectionOpinion, setReflectionOpinion] = useState('');
  const [reflectionSummary, setReflectionSummary] = useState('');
  const [isAnalyzingReflection, setIsAnalyzingReflection] = useState(false);

  useEffect(() => {
    setItems(getLibrary().filter(i => i.language === user.learningLanguage));
  }, [user.learningLanguage]);

  useEffect(() => {
    if (selectedItem) {
      setTitle(selectedItem.title);
      setContent(selectedItem.content);
      setNotes(selectedItem.notes);
      
      // Load reflection data if exists
      if (selectedItem.reflection) {
          setShowReflection(true);
          setReflectionTopic(selectedItem.reflection.topic || '');
          setReflectionPoint(selectedItem.reflection.impressivePoint || '');
          setReflectionExamples(selectedItem.reflection.examples || '');
          setReflectionOpinion(selectedItem.reflection.userOpinion || '');
          setReflectionSummary(selectedItem.reflection.summary || '');
      } else {
          setShowReflection(false);
          resetReflectionFields();
      }
      
      setIsCreating(false);
    }
  }, [selectedItem]);

  const resetReflectionFields = () => {
      setReflectionTopic('');
      setReflectionPoint('');
      setReflectionExamples('');
      setReflectionOpinion('');
      setReflectionSummary('');
  };

  const handleCreateNew = () => {
    setSelectedItem(null);
    setIsCreating(true);
    setTitle('');
    setContent('');
    setNotes('');
    setShowReflection(false); // Default to standard notes
    resetReflectionFields();
  };

  const handleCreateReadingLog = () => {
    handleCreateNew();
    setShowReflection(true); // Force open the Reflection tab
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;

    // Construct reflection object if enabled or populated
    let reflection: ReadingReflection | undefined = undefined;
    if (showReflection) {
        reflection = {
            topic: reflectionTopic,
            impressivePoint: reflectionPoint,
            examples: reflectionExamples,
            userOpinion: reflectionOpinion,
            summary: reflectionSummary
        };
    }

    const newItem: UserContent = {
      id: selectedItem?.id || crypto.randomUUID(),
      title,
      content,
      notes,
      language: user.learningLanguage,
      createdAt: selectedItem?.createdAt || Date.now(),
      reflection
    };

    saveLibraryItem(newItem);
    setItems(getLibrary().filter(i => i.language === user.learningLanguage));
    setSelectedItem(newItem);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    deleteLibraryItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
      setIsCreating(false);
    }
  };

  const handleAnalyzeReflection = async () => {
      if (!content.trim()) return;
      setIsAnalyzingReflection(true);
      try {
          const result = await analyzeReadingContent(content, user.learningLanguage, user.nativeLanguage);
          if (result.topic) setReflectionTopic(result.topic);
          if (result.impressivePoint) setReflectionPoint(result.impressivePoint);
          if (result.examples) setReflectionExamples(result.examples);
          if (result.summary) setReflectionSummary(result.summary);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAnalyzingReflection(false);
      }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6">
      {/* Sidebar List */}
      <div className={`w-full lg:w-1/3 bg-card border border-line-strong rounded-xl flex flex-col ${selectedItem || isCreating ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-line-strong flex justify-between items-center bg-surface/50">
          <h2 className="font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-secondary" />
            记忆库
          </h2>
          <div className="flex gap-2">
              <button 
                onClick={handleCreateReadingLog}
                className="p-2 bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/50 rounded-lg transition-colors"
                title="新建阅读反思日志"
              >
                <BrainCircuit size={20} />
              </button>
              <button 
                onClick={handleCreateNew}
                className="p-2 bg-primary hover:bg-primary/80 rounded-lg text-white transition-colors shadow-lg shadow-primary/20"
                title="添加普通记忆"
              >
                <Plus size={20} />
              </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {items.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-muted text-sm text-center px-4">
                <Sparkles className="mb-4 opacity-30" size={48} />
                <p className="text-lg font-medium text-muted mb-2">记忆库还是空的</p>
                <p className="mb-6 opacity-70 max-w-[200px]">在这里保存文章、书籍摘录或你的想法。</p>
                <div className="flex flex-col gap-3 w-full max-w-[200px]">
                    <button 
                        onClick={handleCreateNew}
                        className="flex items-center justify-center gap-2 py-2 px-4 bg-surface-2 hover:bg-surface-3 border border-line-strong rounded-lg transition-colors font-medium text-white"
                    >
                        <FileText size={16} /> 添加文本
                    </button>
                    <button 
                        onClick={handleCreateReadingLog}
                        className="flex items-center justify-center gap-2 py-2 px-4 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 text-secondary rounded-lg transition-colors font-medium"
                    >
                        <BrainCircuit size={16} /> 记录阅读
                    </button>
                </div>
             </div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`w-full text-left p-3 rounded-lg transition-colors border ${selectedItem?.id === item.id ? 'bg-secondary/20 border-secondary text-white' : 'border-transparent text-gray-300 hover:bg-surface-3'}`}
              >
                <div className="font-semibold truncate flex items-center gap-2">
                    {item.reflection ? <BrainCircuit size={14} className="text-secondary shrink-0" /> : <FileText size={14} className="text-muted shrink-0" />}
                    <span className="truncate">{item.title}</span>
                </div>
                <div className="text-xs text-muted mt-1 truncate pl-6">{item.content.substring(0, 40)}...</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`w-full flex-1 bg-card border border-line-strong rounded-xl flex flex-col ${!selectedItem && !isCreating ? 'hidden lg:flex justify-center items-center text-muted' : 'flex'}`}>
        
        {/* Placeholder if nothing selected */}
        {!selectedItem && !isCreating && (
          <div className="flex flex-col items-center opacity-50">
            <BookOpen size={48} className="mb-4" />
            <p>选择一条记忆来复习，或新建一条。</p>
          </div>
        )}

        {/* Editor / Reader View */}
        {(selectedItem || isCreating) && (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b border-line-strong flex justify-between items-center gap-4 bg-surface/20">
              <div className="flex items-center gap-2 flex-1">
                 <button className="lg:hidden p-2 text-muted" onClick={() => {setSelectedItem(null); setIsCreating(false)}}>
                    <ArrowLeft size={20} />
                 </button>
                 <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="标题（如：最爱的诗、每日格言）"
                    className="bg-transparent text-lg font-bold text-white outline-none w-full placeholder-muted"
                 />
              </div>
              <div className="flex items-center gap-2">
                 {!isCreating && (
                    <button 
                        onClick={() => handleDelete(selectedItem!.id)}
                        className="p-2 text-muted hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                        title="删除"
                    >
                        <Trash2 size={20} />
                    </button>
                 )}
                 <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-900/20"
                 >
                    <Save size={18} /> 保存
                 </button>
              </div>
            </div>

            {/* Split View: Content & Notes/Reflection */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-line-strong">
                {/* Source Content */}
                <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar relative group bg-gradient-to-b from-surface/0 to-surface/10">
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold text-muted uppercase tracking-wider">原文内容</span>
                         {!isCreating && (
                             <button 
                                onClick={() => onPractice({ text: content, title, notes })}
                                className="text-xs flex items-center gap-1 bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-600/40 transition-colors font-medium border border-blue-500/30"
                             >
                                <Type size={12} /> 加入练习
                             </button>
                         )}
                    </div>
                    <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="在这里粘贴一段优美的文字、一句名言，或文章片段……"
                        className="flex-1 bg-transparent resize-none outline-none text-gray-200 leading-relaxed custom-scrollbar placeholder-muted text-lg font-serif"
                    />
                </div>

                {/* Right Panel: Notes & Deep Reading Log */}
                <div className="flex-1 flex flex-col bg-dark/20 overflow-hidden">
                    {/* Toggle */}
                    <div className="flex border-b border-line-strong">
                        <button 
                            onClick={() => setShowReflection(false)}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${!showReflection ? 'text-white bg-transparent border-b-2 border-primary' : 'text-muted hover:text-gray-300 border-b-2 border-transparent bg-black/20'}`}
                        >
                            <PenLine size={14} className="inline mr-1 -mt-0.5" /> 快速笔记
                        </button>
                        <button 
                             onClick={() => setShowReflection(true)}
                             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${showReflection ? 'text-secondary bg-secondary/5 border-b-2 border-secondary' : 'text-muted hover:text-gray-300 border-b-2 border-transparent bg-black/20'}`}
                        >
                            <BrainCircuit size={14} className="inline mr-1 -mt-0.5" /> 深度阅读日志
                        </button>
                    </div>

                    {showReflection ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-secondary/5">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                                    <Sparkles size={14} /> 引导式反思
                                </h4>
                                <button 
                                    onClick={handleAnalyzeReflection}
                                    disabled={!content.trim() || isAnalyzingReflection}
                                    className="text-xs flex items-center gap-1 bg-secondary text-white px-3 py-1.5 rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 shadow-lg shadow-secondary/20"
                                >
                                    {isAnalyzingReflection ? <Sparkles size={12} className="animate-spin" /> : <BrainCircuit size={12} />} 
                                    {isAnalyzingReflection ? '分析中……' : 'AI 分析文本'}
                                </button>
                            </div>
                            
                            {!content.trim() && (
                                <div className="p-3 bg-yellow-900/20 border border-yellow-800/30 text-yellow-500 text-xs rounded-lg">
                                    请在左侧粘贴文本，以使用 AI 分析。
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1.5">主要主题是什么？</label>
                                    <input 
                                        type="text" 
                                        value={reflectionTopic}
                                        onChange={e => setReflectionTopic(e.target.value)}
                                        className="w-full bg-dark border border-line-strong rounded-lg p-2.5 text-sm text-white focus:border-secondary outline-none transition-colors"
                                        placeholder="例如：每日写作的好处……"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1.5">最打动你 / 最关键的点？</label>
                                    <textarea 
                                        value={reflectionPoint}
                                        onChange={e => setReflectionPoint(e.target.value)}
                                        className="w-full bg-dark border border-line-strong rounded-lg p-2.5 text-sm text-white focus:border-secondary outline-none resize-none h-20 transition-colors"
                                        placeholder="哪一点让你印象深刻？"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1.5">作者举了哪些例子？</label>
                                    <textarea 
                                        value={reflectionExamples}
                                        onChange={e => setReflectionExamples(e.target.value)}
                                        className="w-full bg-dark border border-line-strong rounded-lg p-2.5 text-sm text-white focus:border-secondary outline-none resize-none h-20 transition-colors"
                                        placeholder="列出文中提到的例子……"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1.5">你自己的看法？</label>
                                    <textarea 
                                        value={reflectionOpinion}
                                        onChange={e => setReflectionOpinion(e.target.value)}
                                        className="w-full bg-dark border border-line-strong rounded-lg p-2.5 text-sm text-white focus:border-secondary outline-none resize-none h-20 transition-colors"
                                        placeholder="你赞同吗？为什么？"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1.5">一句话总结</label>
                                    <textarea 
                                        value={reflectionSummary}
                                        onChange={e => setReflectionSummary(e.target.value)}
                                        className="w-full bg-dark border border-line-strong rounded-lg p-2.5 text-sm text-white focus:border-secondary outline-none resize-none h-16 transition-colors"
                                        placeholder="概括核心观点……"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar">
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="在这里写词汇笔记、语法拆解，或你的想法……"
                                className="flex-1 bg-transparent resize-none outline-none text-yellow-100/80 font-mono text-sm leading-relaxed custom-scrollbar placeholder-muted/50"
                            />
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
