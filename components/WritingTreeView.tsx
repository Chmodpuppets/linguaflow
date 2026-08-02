
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, WritingNode, NodeType } from '../types';
import { getWritingTree, saveWritingTree, addActivity } from '../services/storageService';
import { generateTreeStructure, classifyInspiration, getWritingCoachFeedback, polishText } from '../services/aiService';
import { 
  FolderTree, FileText, Plus, ChevronRight, ChevronDown, 
  Lightbulb, Sparkles, Save, Bot, 
  Layout, Trash2, FolderOpen, GitBranch,
  CornerDownRight, XCircle, CheckCircle2, AlertTriangle, Wand2, ArrowUpRight
} from 'lucide-react';

interface WritingTreeViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

// Simple Toast Notification Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'info' | 'error', onClose: () => void }) => (
    <div className={`fixed bottom-4 right-4 z-[110] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${type === 'success' ? 'bg-green-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white border border-gray-700'}`}>
        {type === 'success' && <CheckCircle2 size={18} />}
        {type === 'error' && <XCircle size={18} />}
        <span className="font-medium text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><XCircle size={14} /></button>
    </div>
);

const WritingTreeView: React.FC<WritingTreeViewProps> = ({ user, onUpdateUser }) => {
  const [nodes, setNodes] = useState<WritingNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  
  // Editor State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // AI State
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);
  
  // Inspiration Box
  const [inspirationText, setInspirationText] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);

  // Notifications & Modals
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info' | 'error'} | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);

  useEffect(() => {
    const loadedNodes = getWritingTree();
    setNodes(loadedNodes);
  }, []);

  // Sync Editor with Active Node
  useEffect(() => {
    if (activeNodeId) {
      const node = nodes.find(n => n.id === activeNodeId);
      if (node) {
        setTitle(node.title);
        setContent(node.content);
        setCoachFeedback(null); 
      }
    } else {
        setTitle('');
        setContent('');
    }
  }, [activeNodeId, nodes]);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'info') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  // --- Tree Operations ---

  // Helper to ensure all parents of a node are expanded
  const expandAncestors = (nodeId: string, currentNodes: WritingNode[]): WritingNode[] => {
      let updatedNodes = [...currentNodes];
      let curr = updatedNodes.find(n => n.id === nodeId);
      
      while (curr && curr.parentId) {
          const parentIndex = updatedNodes.findIndex(n => n.id === curr!.parentId);
          if (parentIndex >= 0) {
              updatedNodes[parentIndex] = { ...updatedNodes[parentIndex], isExpanded: true };
              curr = updatedNodes[parentIndex];
          } else {
              curr = undefined;
          }
      }
      return updatedNodes;
  };

  const handleCreateNode = (type: NodeType, parentId: string | null = null, defaultTitle = 'Untitled', initialContent = '') => {
    const newNode: WritingNode = {
      id: crypto.randomUUID(),
      parentId,
      type,
      title: defaultTitle,
      content: initialContent,
      progress: 0,
      wordCount: initialContent ? initialContent.split(/\s+/).length : 0,
      tags: [],
      isExpanded: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // 1. Add Node
    let updatedNodes = [...nodes, newNode];
    
    // 2. Expand Ancestors so the new node is visible
    updatedNodes = expandAncestors(newNode.id, updatedNodes);

    setNodes(updatedNodes);
    saveWritingTree(updatedNodes);
    setActiveNodeId(newNode.id);
    
    // Explicitly set editor content immediately
    setTitle(defaultTitle);
    setContent(initialContent);
    
    return newNode;
  };

  const handleToggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = nodes.map(n => n.id === id ? { ...n, isExpanded: !n.isExpanded } : n);
    setNodes(updated);
    saveWritingTree(updated);
  };

  const confirmDeleteNode = () => {
    if (!nodeToDelete) return;
    const id = nodeToDelete;

    // Recursive delete helper
    const getDescendants = (parentId: string, currentNodes: WritingNode[]): string[] => {
        const children = currentNodes.filter(n => n.parentId === parentId);
        let ids = children.map(c => c.id);
        children.forEach(c => {
            ids = [...ids, ...getDescendants(c.id, currentNodes)];
        });
        return ids;
    };

    const idsToDelete = [id, ...getDescendants(id, nodes)];
    const updated = nodes.filter(n => !idsToDelete.includes(n.id));
    
    setNodes(updated);
    saveWritingTree(updated);
    
    // If we deleted the active node, deselect
    if (activeNodeId && idsToDelete.includes(activeNodeId)) {
        setActiveNodeId(null);
    }
    
    setNodeToDelete(null);
    showToast("Project item deleted", "success");
  };

  // --- Editor Operations ---

  const handleSave = async () => {
    if (!activeNodeId) return;
    setIsSaving(true);
    
    const wordCount = content.trim().split(/\s+/).length;
    const previousNode = nodes.find(n => n.id === activeNodeId);
    const wordDiff = wordCount - (previousNode?.wordCount || 0);

    const updatedNode: WritingNode = {
        ...previousNode!,
        title,
        content,
        wordCount,
        updatedAt: Date.now()
    };
    
    // Update local state
    const updatedNodes = nodes.map(n => n.id === activeNodeId ? updatedNode : n);
    setNodes(updatedNodes);
    saveWritingTree(updatedNodes); // Persist

    // Time Deposit: Log activity if significant writing occurred
    if (wordDiff > 20) {
        const xp = Math.floor(wordDiff / 2); // 1 XP per 2 words
        const { user: updatedUser } = addActivity(
            user, 
            'tree_writing', 
            user.learningLanguage, 
            xp, 
            `Worked on "${title}"`,
            { wordCount: wordDiff, nodeTitle: title }
        );
        onUpdateUser(updatedUser);
    }

    setTimeout(() => {
        setIsSaving(false);
        showToast("Saved successfully", "success");
    }, 500);
  };

  // --- AI Operations ---

  const handleGenerateStructure = async () => {
      if (!activeNodeId) return;
      setIsGeneratingStructure(true);
      const parent = nodes.find(n => n.id === activeNodeId);
      
      try {
        const subStructure = await generateTreeStructure(parent?.title || title, user.learningLanguage);
        
        if (!subStructure || subStructure.length === 0) {
            showToast("AI 没有返回结构，请重试", "error");
            return;
        }

        const newNodes: WritingNode[] = subStructure.map(item => ({
            id: crypto.randomUUID(),
            parentId: activeNodeId,
            type: item.type as NodeType,
            title: item.title,
            content: '',
            progress: 0,
            wordCount: 0,
            tags: [],
            isExpanded: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }));

        let updatedNodes = [...nodes, ...newNodes];
        // Auto expand parent
        updatedNodes = expandAncestors(newNodes[0].id, updatedNodes);
        
        setNodes(updatedNodes);
        saveWritingTree(updatedNodes);
        showToast(`Generated ${newNodes.length} sections`, "success");
      } catch (e) {
        showToast("Failed to generate structure", "error");
      } finally {
        setIsGeneratingStructure(false);
      }
  };

  const handlePolishInspiration = async () => {
      if (!inspirationText.trim()) return;
      setIsPolishing(true);
      try {
          const polished = await polishText(inspirationText, user.learningLanguage);
          setInspirationText(polished);
          showToast("Text polished & formatted", "success");
      } catch (e) {
          showToast("Failed to polish text", "error");
      } finally {
          setIsPolishing(false);
      }
  };

  const handleInsertInspiration = () => {
      if (!inspirationText.trim()) return;
      if (!activeNodeId) {
          showToast("Select a node to insert text", "error");
          return;
      }
      
      const newContent = content ? content + '\n\n' + inspirationText : inspirationText;
      setContent(newContent);
      setInspirationText('');
      showToast("Merged into document", "success");
  };

  const handleClassifyInspiration = async () => {
      if (!inspirationText.trim()) return;
      
      // If no project exists, warn user
      if (nodes.length === 0) {
          if (confirm("You don't have any projects yet. Create a new root project to start?")) {
               handleCreateNode('root', null, 'My Project', inspirationText);
               setInspirationText('');
          }
          return;
      }

      setIsClassifying(true);
      
      try {
          const result = await classifyInspiration(inspirationText, nodes, user.learningLanguage);
          
          let targetParentId = activeNodeId;
          let targetParentTitle = activeNodeId ? (nodes.find(n => n.id === activeNodeId)?.title || "Current Node") : "Root";

          // Try to find the suggested parent in our tree
          // Enhance matching: exact match > partial match
          const normalizedSuggestion = result.suggestedParentTitle.toLowerCase();
          const exactMatch = nodes.find(n => n.title.toLowerCase() === normalizedSuggestion);
          const partialMatch = nodes.find(n => n.title.toLowerCase().includes(normalizedSuggestion));
          
          const suggestedParent = exactMatch || partialMatch;
          
          if (suggestedParent) {
              targetParentId = suggestedParent.id;
              targetParentTitle = suggestedParent.title;
          } else if (!activeNodeId) {
              // Smart Fallback if no active selection
              const inboxNode = nodes.find(n => ["inbox", "ideas", "unsorted", "drafts"].includes(n.title.toLowerCase()));
              if (inboxNode) {
                  targetParentId = inboxNode.id;
                  targetParentTitle = inboxNode.title;
              } else {
                  // Fallback to the first root node
                  const root = nodes.find(n => n.type === 'root') || nodes[0];
                  targetParentId = root.id;
                  targetParentTitle = root.title;
              }
          }

          // Use the REFINED title and content from AI
          const newNode = handleCreateNode('idea', targetParentId, result.refinedTitle || "New Idea", result.refinedContent || inspirationText);
          
          setInspirationText('');
          setActiveNodeId(newNode.id);
          
          showToast(`Created new node: "${result.refinedTitle}"`, "success");
      } catch (e) {
          showToast("AI classification failed", "error");
      } finally {
          setIsClassifying(false);
      }
  };

  const handleCoach = async () => {
      if (!activeNodeId) return;
      setIsCoaching(true);
      const feedback = await getWritingCoachFeedback(nodes.find(n => n.id === activeNodeId)!, user.learningLanguage);
      setCoachFeedback(feedback);
      setIsCoaching(false);
  };

  // --- Render Helpers ---

  const renderTree = (parentId: string | null, depth = 0) => {
    const children = nodes.filter(n => n.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className={`flex flex-col ${depth > 0 ? 'ml-4 border-l border-gray-700/50' : ''}`}>
        {children.map(node => (
            <div key={node.id}>
                <div 
                    onClick={() => setActiveNodeId(node.id)}
                    className={`
                        group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-sm pr-2 mb-1 select-none
                        ${activeNodeId === node.id ? 'bg-secondary/20 text-white border border-secondary/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'}
                    `}
                >
                    <button 
                        onClick={(e) => handleToggleExpand(node.id, e)} 
                        className={`p-0.5 rounded hover:bg-white/10 ${children.length === 0 && 'opacity-0 pointer-events-none'}`} 
                    >
                        {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {node.type === 'root' ? <FolderOpen size={16} className="text-blue-400 flex-shrink-0" /> :
                     node.type === 'chapter' ? <FolderTree size={16} className="text-secondary flex-shrink-0" /> :
                     node.type === 'idea' ? <Lightbulb size={16} className="text-yellow-400 flex-shrink-0" /> :
                     <FileText size={16} className="flex-shrink-0" />
                    }
                    
                    <span className="truncate flex-1 font-medium">{node.title || 'Untitled'}</span>

                    {/* Actions - Always Visible */}
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleCreateNode('section', node.id, 'New Section'); }}
                            className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded-md transition-colors"
                            title="Add Child Node"
                        >
                            <Plus size={14} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setNodeToDelete(node.id); }}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-md transition-colors"
                            title="Delete Node"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                
                {node.isExpanded && renderTree(node.id, depth + 1)}
            </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4 relative">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* Delete Confirmation Modal */}
        {nodeToDelete && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-card border border-gray-600 p-6 rounded-2xl shadow-2xl max-w-sm w-full transform transition-all animate-in zoom-in-95">
                    <div className="flex items-center gap-3 text-red-400 mb-2">
                        <AlertTriangle size={24} />
                        <h3 className="text-xl font-bold text-white">Delete Item?</h3>
                    </div>
                    <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                        Are you sure you want to delete <span className="font-bold text-white">"{nodes.find(n => n.id === nodeToDelete)?.title}"</span>? 
                        <br/><br/>
                        This will permanently delete this item and any content inside it. This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setNodeToDelete(null)}
                            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors font-medium text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDeleteNode}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors flex items-center gap-2 text-sm shadow-lg shadow-red-900/20"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* LEFT: Tree Navigation */}
        <div className="w-full lg:w-1/4 bg-card border border-gray-700 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                <span className="font-bold text-gray-300 flex items-center gap-2">
                    <GitBranch size={18} /> Structure
                </span>
                <button 
                    onClick={() => handleCreateNode('root', null, 'New Book Project')}
                    className="flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded-md text-xs font-bold transition-all"
                    title="Add Root Project"
                >
                    <Plus size={14} /> New Book
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {nodes.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 text-sm">
                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <FolderOpen className="text-gray-600" />
                        </div>
                        <p className="mb-2">No projects yet.</p>
                        <button onClick={() => handleCreateNode('root', null, 'My First Book')} className="text-secondary hover:underline font-bold">Create your first book</button>
                    </div>
                ) : (
                    renderTree(null)
                )}
            </div>
        </div>

        {/* CENTER: Editor */}
        <div className="flex-1 bg-card border border-gray-700 rounded-xl flex flex-col relative">
            {!activeNodeId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                    <Layout size={64} className="mb-4 opacity-20" />
                    <p className="text-lg">Select a node from the tree to start writing</p>
                    <p className="text-sm opacity-50">Or create a new one</p>
                </div>
            ) : (
                <>
                    <div className="p-4 border-b border-gray-700 flex items-center gap-4 bg-gray-900/20">
                        <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-transparent text-xl font-bold text-white outline-none flex-1 placeholder-gray-600 focus:placeholder-gray-500"
                            placeholder="Node Title..."
                        />
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isSaving ? 'bg-green-600/50 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                             >
                                <Save size={18} /> {isSaving ? 'Saving...' : 'Save'}
                             </button>
                        </div>
                    </div>
                    
                    <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="flex-1 bg-transparent p-6 resize-none outline-none text-gray-200 leading-relaxed text-lg custom-scrollbar placeholder-gray-700 font-serif"
                        placeholder="Start writing your masterpiece..."
                    />
                    
                    <div className="p-2 bg-gray-900/50 border-t border-gray-700 text-xs text-gray-500 flex justify-between px-4">
                         <span>{content.trim().split(/\s+/).filter(w=>w).length} words</span>
                         {activeNodeId && nodes.find(n => n.id === activeNodeId)?.updatedAt && (
                             <span>Last saved: {new Date(nodes.find(n => n.id === activeNodeId)!.updatedAt).toLocaleTimeString()}</span>
                         )}
                    </div>
                </>
            )}
        </div>

        {/* RIGHT: Inspiration & Coach */}
        <div className="w-full lg:w-1/4 flex flex-col gap-4">
            
            {/* AI Coach Card */}
            <div className="bg-card border border-gray-700 rounded-xl p-4 flex flex-col flex-1 max-h-[50%]">
                <div className="flex items-center gap-2 font-bold text-white mb-3">
                    <Bot size={18} className="text-secondary" /> AI Writing Coach
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-dark/30 rounded-lg p-3 text-sm text-gray-300 mb-3 border border-gray-800">
                    {activeNodeId ? (
                        coachFeedback ? (
                            <div className="whitespace-pre-wrap leading-relaxed">{coachFeedback}</div>
                        ) : (
                            <div className="text-gray-500 italic text-center py-4 flex flex-col items-center gap-2">
                                <Sparkles className="opacity-20" size={24} />
                                <p>"Select 'Coach Me' to get structural feedback and style advice."</p>
                            </div>
                        )
                    ) : (
                        <div className="text-gray-500 italic">Select a node to get feedback.</div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={handleGenerateStructure}
                        disabled={!activeNodeId || isGeneratingStructure}
                        className="p-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 text-blue-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                        {isGeneratingStructure ? <Sparkles size={14} className="animate-spin"/> : <FolderTree size={14} />}
                        Auto-Structure
                    </button>
                    <button 
                        onClick={handleCoach}
                        disabled={!activeNodeId || isCoaching}
                        className="p-2 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 text-secondary rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                         {isCoaching ? <Sparkles size={14} className="animate-spin"/> : <Bot size={14} />}
                        Coach Me
                    </button>
                </div>
            </div>

            {/* Inspiration Box */}
            <div className="bg-card border border-gray-700 rounded-xl p-4 flex flex-col flex-1">
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-bold text-white">
                        <Lightbulb size={18} className="text-yellow-400" /> Inspiration Box
                    </div>
                    {inspirationText && (
                        <button onClick={() => setInspirationText('')} className="text-xs text-gray-500 hover:text-white">Clear</button>
                    )}
                </div>
                <textarea 
                    value={inspirationText}
                    onChange={(e) => setInspirationText(e.target.value)}
                    className="flex-1 bg-dark/30 border border-gray-800 rounded-lg p-3 resize-none outline-none text-sm text-gray-300 mb-3 focus:border-gray-600 transition-colors placeholder-gray-600"
                    placeholder="Drop raw ideas, quotes, or snippets here... Then let AI organize them."
                />
                
                <div className="grid grid-cols-3 gap-1.5">
                    {/* Polish Button */}
                    <button 
                        onClick={handlePolishInspiration}
                        disabled={!inspirationText.trim() || isPolishing}
                        className="py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-bold border border-indigo-500/30 transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                        title="AI Polish (Grammar & Format)"
                    >
                        {isPolishing ? <Sparkles size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        Polish
                    </button>

                    {/* INSERT Button (Replaces "Add Here") */}
                    <button 
                        onClick={handleInsertInspiration}
                        disabled={!inspirationText.trim()}
                        className="py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg text-xs font-bold border border-green-500/30 transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                        title="Append to current document"
                    >
                        <ArrowUpRight size={14} /> 
                        Insert
                    </button>

                    {/* Smart Node Button (Renamed from Auto-File) */}
                    <button 
                        onClick={handleClassifyInspiration}
                        disabled={!inspirationText.trim() || isClassifying}
                        className="py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold border border-gray-600 transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                        title="Create new node in tree"
                    >
                        {isClassifying ? <Sparkles size={14} className="animate-spin text-yellow-400" /> : <GitBranch size={14} />}
                        New Node
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default WritingTreeView;
