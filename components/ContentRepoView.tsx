import React, { useState, useEffect, useRef } from 'react';
import { Language, CEFRLevel, UserProfile, ScriptItem, TypingContent } from '../types';
import {
  getInkQuestCards, deleteInkQuestCard,
  getInkQuestListeningItems, deleteInkQuestListeningItem, saveInkQuestListeningItem,
  getTypingLibraryItems, deleteTypingLibraryItem, saveTypingLibraryItem,
  getLibrary, deleteLibraryItem, saveLibraryItem,
  getVocabulary, deleteVocabularyItem, saveVocabularyItem,
  getCustomScriptItems, deleteCustomScriptItem, saveCustomScriptItem, CustomScriptItem,
  getCustomWritingPrompts, deleteCustomWritingPrompt, saveCustomWritingPrompt, CustomWritingPrompt,
  saveInkQuestCard,
} from '../services/storageService';
import { INK_QUEST_SEASONS } from '../data/inkQuestSeasons';
import { SCRIPT_PACKS } from '../data/scriptPacks';
import { SUPPORTED_LANGUAGES } from '../constants';
import {
  Warehouse, Plus, Download, Upload, Search, Trash2, X, Feather, Headphones,
  Keyboard, Library, BookA, PenLine, Sparkles, Layers, CheckCircle2,
} from 'lucide-react';

type RepoKind =
  | 'inkquest_handbook' | 'inkquest_listening' | 'typing' | 'library'
  | 'vocab' | 'custom_script' | 'custom_writing' | 'preset_season' | 'preset_scriptpack';

interface RepoItem {
  kind: RepoKind;
  source: 'ai' | 'user' | 'preset';
  language: Language | 'all';
  cefr?: CEFRLevel;
  preview: string;
  createdAt: number;
  usage: number;
  deletable: boolean;
  payload: unknown;
}

const KIND_META: Record<RepoKind, { label: string; icon: React.ReactNode; color: string }> = {
  inkquest_handbook: { label: '写作手帐', icon: <Feather size={14} />, color: 'text-emerald-300' },
  inkquest_listening: { label: '听力库', icon: <Headphones size={14} />, color: 'text-sky-300' },
  typing: { label: '打字库', icon: <Keyboard size={14} />, color: 'text-amber-300' },
  library: { label: '记忆库', icon: <Library size={14} />, color: 'text-violet-300' },
  vocab: { label: '词汇', icon: <BookA size={14} />, color: 'text-rose-300' },
  custom_script: { label: '字形卡·自建', icon: <PenLine size={14} />, color: 'text-cyan-300' },
  custom_writing: { label: '写作题·自建', icon: <Sparkles size={14} />, color: 'text-fuchsia-300' },
  preset_season: { label: '赛季卡·预置', icon: <Layers size={14} />, color: 'text-slate-400' },
  preset_scriptpack: { label: '字形包·预置', icon: <Layers size={14} />, color: 'text-slate-400' },
};

const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[];
const REGISTERS = ['casual', 'neutral', 'polite', 'formal', 'business'] as const;
const SCRIPT_TARGETS = ['', 'hiragana', 'katakana', 'other'] as const;

const genId = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const langLabel = (l: Language | 'all') =>
  l === 'all' ? '全部语言' : (SUPPORTED_LANGUAGES.find((s) => s.id === l)?.label ?? String(l));

interface ContentRepoViewProps {
  user: UserProfile;
  onUpdateUser?: (u: UserProfile) => void;
}

const ContentRepoView: React.FC<ContentRepoViewProps> = ({ user }) => {
  const [items, setItems] = useState<RepoItem[]>([]);
  const [filterType, setFilterType] = useState<RepoKind | 'all'>('all');
  const [filterLang, setFilterLang] = useState<Language | 'all'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'ai' | 'user' | 'preset'>('all');
  const [search, setSearch] = useState('');
  const [showBuild, setShowBuild] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const buildItems = (): RepoItem[] => {
    const out: RepoItem[] = [];
    getInkQuestCards().forEach((c: any) => out.push({
      kind: 'inkquest_handbook', source: 'user', language: c.language,
      preview: c.highlight || c.userText, createdAt: c.createdAt, usage: 0, deletable: true, payload: c,
    }));
    getInkQuestListeningItems().forEach((c: any) => out.push({
      kind: 'inkquest_listening', source: 'ai', language: c.language,
      preview: c.sentence, createdAt: c.createdAt, usage: c.attempts?.length || 0, deletable: true, payload: c,
    }));
    getTypingLibraryItems().forEach((c: any) => out.push({
      kind: 'typing', source: 'ai', language: c.language, cefr: c.cefr,
      preview: c.text, createdAt: c.createdAt, usage: c.practiceCount, deletable: true, payload: c,
    }));
    getLibrary().forEach((c: any) => out.push({
      kind: 'library', source: 'user', language: c.language,
      preview: c.content, createdAt: c.createdAt, usage: 0, deletable: true, payload: c,
    }));
    getVocabulary().forEach((c: any) => out.push({
      kind: 'vocab', source: 'user', language: c.language,
      preview: `${c.word} — ${c.definition}`, createdAt: c.createdAt, usage: c.reviews || 0, deletable: true, payload: c,
    }));
    getCustomScriptItems().forEach((c: any) => out.push({
      kind: 'custom_script', source: 'user', language: c.language,
      preview: `${c.prompt} → ${c.answer}`, createdAt: c.createdAt, usage: 0, deletable: true, payload: c,
    }));
    getCustomWritingPrompts().forEach((c: any) => out.push({
      kind: 'custom_writing', source: 'user', language: c.language,
      preview: c.text, createdAt: c.createdAt, usage: 0, deletable: true, payload: c,
    }));
    INK_QUEST_SEASONS.forEach((s) => out.push({
      kind: 'preset_season', source: 'preset', language: 'all',
      preview: `${s.title}｜${s.blurb}`, createdAt: 0, usage: s.cards.length, deletable: false, payload: s,
    }));
    SCRIPT_PACKS.forEach((p) => out.push({
      kind: 'preset_scriptpack', source: 'preset', language: p.language,
      preview: `${p.name}｜${p.description}`, createdAt: 0, usage: p.items.length, deletable: false, payload: p,
    }));
    return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const reload = () => setItems(buildItems());
  useEffect(() => { reload(); }, [user.learningLanguage]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = items.filter((it) => {
    if (filterType !== 'all' && it.kind !== filterType) return false;
    if (filterLang !== 'all' && it.language !== filterLang) return false;
    if (filterSource !== 'all' && it.source !== filterSource) return false;
    if (search && !`${KIND_META[it.kind].label} ${it.preview}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const deleteItem = (it: RepoItem) => {
    if (!it.deletable) return;
    const id = (it.payload as { id: string }).id;
    switch (it.kind) {
      case 'inkquest_handbook': deleteInkQuestCard(id); break;
      case 'inkquest_listening': deleteInkQuestListeningItem(id); break;
      case 'typing': deleteTypingLibraryItem(id); break;
      case 'library': deleteLibraryItem(id); break;
      case 'vocab': deleteVocabularyItem(id); break;
      case 'custom_script': deleteCustomScriptItem(id); break;
      case 'custom_writing': deleteCustomWritingPrompt(id); break;
    }
    reload();
    setToast('已删除 1 条');
  };

  const exportItems = () => {
    const toExport = filtered.filter((it) => it.deletable);
    const pack = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'linguaflow-content-pack',
      items: toExport.map((it) => ({ kind: it.kind, payload: it.payload })),
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linguaflow-content-pack-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(`已导出 ${toExport.length} 条内容`);
  };

  const routeToStore = (kind: RepoKind, payload: any): boolean => {
    const id = genId();
    switch (kind) {
      case 'inkquest_handbook': saveInkQuestCard({ ...payload, id }); return true;
      case 'inkquest_listening': saveInkQuestListeningItem({ ...payload, id, attempts: payload.attempts || [] }); return true;
      case 'typing': saveTypingLibraryItem({ ...payload, id, practiceCount: payload.practiceCount || 0 }); return true;
      case 'library': saveLibraryItem({ ...payload, id }); return true;
      case 'vocab': saveVocabularyItem({ ...payload, id }); return true;
      case 'custom_script': saveCustomScriptItem({ ...payload, id }); return true;
      case 'custom_writing': saveCustomWritingPrompt({ ...payload, id }); return true;
      default: return false;
    }
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const pack = JSON.parse(String(reader.result));
        const arr = Array.isArray(pack?.items) ? pack.items : [];
        let n = 0;
        arr.forEach((entry: { kind: RepoKind; payload: any }) => {
          try { if (routeToStore(entry.kind, entry.payload)) n++; } catch { /* skip bad entry */ }
        });
        reload();
        setToast(`已导入 ${n} 条内容`);
      } catch {
        setToast('文件解析失败，请检查 JSON 格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const kindOptions = Object.keys(KIND_META) as RepoKind[];
  const deletableCount = items.filter((i) => i.deletable).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Warehouse size={22} className="text-neon" />
          <h1 className="text-2xl font-bold text-white">内容仓库</h1>
        </div>
        <p className="text-sm text-muted">
          你所有的内容中枢：AI 生成、自建、导入的内容在此聚合 · 共 {items.length} 条（可导出 {deletableCount} 条）
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowBuild(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-neon to-neon-2 px-3.5 py-2 text-sm font-bold text-white shadow-glow-neon transition hover:brightness-110"
        >
          <Plus size={16} /> 新建内容
        </button>
        <button
          onClick={exportItems}
          className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-3/40 px-3.5 py-2 text-sm font-semibold text-gray-200 transition hover:text-white hover:border-neon/40 hover:bg-surface-3/60"
        >
          <Download size={16} /> 导出 JSON
        </button>
        <button
          onClick={() => importRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-3/40 px-3.5 py-2 text-sm font-semibold text-gray-200 transition hover:text-white hover:border-neon/40 hover:bg-surface-3/60"
        >
          <Upload size={16} /> 导入 JSON
        </button>
        <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importFile} />

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索内容…"
              className="w-44 rounded-lg border border-line-strong bg-surface-2 py-2 pl-8 pr-3 text-sm text-gray-100 outline-none placeholder:text-muted focus:border-neon"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as RepoKind | 'all')}
          className="rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-gray-200 outline-none focus:border-neon">
          <option value="all">全部类型</option>
          {kindOptions.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
        </select>
        <select value={filterLang} onChange={(e) => setFilterLang(e.target.value as Language | 'all')}
          className="rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-gray-200 outline-none focus:border-neon">
          <option value="all">全部语言</option>
          {SUPPORTED_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value as any)}
          className="rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-gray-200 outline-none focus:border-neon">
          <option value="all">全部来源</option>
          <option value="ai">AI 生成</option>
          <option value="user">自建/导入</option>
          <option value="preset">预置</option>
        </select>
        <span className="ml-1 text-muted">共 {filtered.length} 条</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2/40 py-16 text-center text-muted hover:border-neon/40 transition-colors">
          没有匹配的内容。试试切换筛选，或点「新建内容」自己造一条。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it, idx) => {
            const meta = KIND_META[it.kind];
            const sourceBadge =
              it.source === 'ai' ? 'AI 生成' : it.source === 'preset' ? '预置' : '自建';
            return (
              <div key={`${it.kind}-${idx}`} className="flex flex-col rounded-xl glass-panel p-3.5 transition hover:border-neon/50">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted">
                    {sourceBadge}
                  </span>
                </div>
                <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-gray-200">{it.preview}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                  <span>{langLabel(it.language)}{it.cefr ? ` · ${it.cefr}` : ''}</span>
                  <span>
                    {it.usage > 0 ? `使用 ${it.usage} 次` : ''}
                    {it.createdAt > 0 ? ` · ${new Date(it.createdAt).toLocaleDateString()}` : ''}
                  </span>
                </div>
                {it.deletable && (
                  <button
                    onClick={() => deleteItem(it)}
                    className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-line-strong py-1.5 text-xs font-medium text-gray-400 transition hover:border-rose-500/50 hover:text-rose-300"
                  >
                    <Trash2 size={13} /> 删除
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Build modal */}
      {showBuild && (
        <BuildModal
          onClose={() => setShowBuild(false)}
          onDone={(msg) => { reload(); setShowBuild(false); setToast(msg); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-neon/30 bg-surface-3/90 px-4 py-2.5 text-sm font-medium text-white shadow-xl shadow-glow-sm backdrop-blur">
          <CheckCircle2 size={16} className="text-emerald-300" /> {toast}
        </div>
      )}
    </div>
  );
};

// ---------------- Build modal ----------------
type BuildKind = 'custom_writing' | 'typing' | 'inkquest_listening' | 'custom_script' | 'vocab';

const buildOptions: { kind: BuildKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'custom_writing', label: '写作题', icon: <Sparkles size={16} /> },
  { kind: 'typing', label: '打字段', icon: <Keyboard size={16} /> },
  { kind: 'inkquest_listening', label: '听写句', icon: <Headphones size={16} /> },
  { kind: 'custom_script', label: '字形卡', icon: <PenLine size={16} /> },
  { kind: 'vocab', label: '词汇', icon: <BookA size={16} /> },
];

const BuildModal: React.FC<{ onClose: () => void; onDone: (msg: string) => void }> = ({ onClose, onDone }) => {
  const [buildType, setBuildType] = useState<BuildKind>('custom_writing');
  const [language, setLanguage] = useState<Language>(Language.Japanese);
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [topic, setTopic] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>('A1');
  const [register, setRegister] = useState<typeof REGISTERS[number]>('neutral');
  const [group, setGroup] = useState('');
  const [answer, setAnswer] = useState('');
  const [romaji, setRomaji] = useState('');
  const [targetScript, setTargetScript] = useState<typeof SCRIPT_TARGETS[number]>('');
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [kvRaw, setKvRaw] = useState(''); // "word=meaning" lines
  const [err, setErr] = useState<string | null>(null);

  const parseKV = (): TypingContent['keyVocabulary'] =>
    kvRaw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [w, m] = l.split('=');
      return { word: (w || '').trim(), meaning: (m || '').trim(), partOfSpeech: '' };
    });

  const submit = () => {
    setErr(null);
    try {
      if (buildType === 'custom_writing') {
        if (!text.trim()) return setErr('请填写写作主题/任务');
        saveCustomWritingPrompt({ id: genId(), text: text.trim(), register, language, createdAt: Date.now() });
        onDone('已新建写作题');
      } else if (buildType === 'typing') {
        if (!text.trim()) return setErr('请填写打字段文本');
        const item = {
          id: genId(), language, cefr, topic: topic || '自建',
          source: 'practice' as const, text: text.trim(), translation: translation.trim(),
          phoneticGuide: phonetic.trim(), keyVocabulary: parseKV(), createdAt: Date.now(), practiceCount: 0,
        };
        saveTypingLibraryItem(item);
        onDone('已新建打字段');
      } else if (buildType === 'inkquest_listening') {
        if (!text.trim()) return setErr('请填写听写句');
        saveInkQuestListeningItem({
          id: genId(), date: todayStr(), language, seasonId: 'custom', cardId: 'custom',
          theme: topic || '自建听写', sentence: text.trim(), createdAt: Date.now(), attempts: [],
        });
        onDone('已新建听写句');
      } else if (buildType === 'custom_script') {
        if (!answer.trim() || !text.trim()) return setErr('请填写提示与正确字形');
        const item: CustomScriptItem = {
          id: genId(), group: group.trim() || '自建', prompt: text.trim(), answer: answer.trim(),
          romaji: romaji.trim() || undefined,
          targetScript: (targetScript || undefined) as ScriptItem['targetScript'],
          audioText: answer.trim(), language,
        };
        saveCustomScriptItem(item);
        onDone('已新建字形卡');
      } else if (buildType === 'vocab') {
        if (!word.trim()) return setErr('请填写单词');
        saveVocabularyItem({
          id: genId(), word: word.trim(), definition: definition.trim(),
          exampleSentence: example.trim(), partOfSpeech: partOfSpeech.trim(), language, createdAt: Date.now(),
        });
        onDone('已新建词汇');
      }
    } catch {
      setErr('保存失败，请检查输入');
    }
  };

  const inputCls = 'w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-muted focus:border-neon';
  const labelCls = 'mb-1 block text-xs font-medium text-muted';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl glass-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Plus size={18} /> 新建内容</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted transition hover:text-white"><X size={18} /></button>
        </div>

        {/* type tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {buildOptions.map((o) => (
            <button key={o.kind} onClick={() => setBuildType(o.kind)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                buildType === o.kind ? 'bg-neon text-white shadow-glow-sm' : 'bg-surface-3/50 text-gray-300 hover:text-white'
              }`}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>

        {/* language (all types) */}
        <div className="mb-3">
          <label className={labelCls}>语言</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={inputCls}>
            {SUPPORTED_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>

        {/* type-specific fields */}
        {buildType === 'custom_writing' && (
          <>
            <div className="mb-3">
              <label className={labelCls}>写作主题 / 任务（中文）</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls}
                placeholder="例如：描述你最难忘的一次旅行" />
            </div>
            <div>
              <label className={labelCls}>语体</label>
              <select value={register} onChange={(e) => setRegister(e.target.value as any)} className={inputCls}>
                {REGISTERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </>
        )}

        {buildType === 'typing' && (
          <>
            <div className="mb-3">
              <label className={labelCls}>打字段文本</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls}
                placeholder="目标语文本，例如：朝ごはんは毎日パンを食べます。" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>译文</label>
                <input value={translation} onChange={(e) => setTranslation(e.target.value)} className={inputCls} placeholder="中文意思" />
              </div>
              <div>
                <label className={labelCls}>注音/罗马字</label>
                <input value={phonetic} onChange={(e) => setPhonetic(e.target.value)} className={inputCls} placeholder="asahi 等" />
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>主题</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls} placeholder="日常 / 旅行…" />
              </div>
              <div>
                <label className={labelCls}>CEFR</label>
                <select value={cefr} onChange={(e) => setCefr(e.target.value as CEFRLevel)} className={inputCls}>
                  {CEFR_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>关键词汇（每行 "词=意思"）</label>
              <textarea value={kvRaw} onChange={(e) => setKvRaw(e.target.value)} rows={2} className={inputCls}
                placeholder={'朝ごはん=早餐\nパン=面包'} />
            </div>
          </>
        )}

        {buildType === 'inkquest_listening' && (
          <>
            <div className="mb-3">
              <label className={labelCls}>听写句（目标语）</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls}
                placeholder="AI 会朗读这句，你写下来。例如：どこへ行きますか。" />
            </div>
            <div>
              <label className={labelCls}>主题（中文，可选）</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls} placeholder="问路" />
            </div>
          </>
        )}

        {buildType === 'custom_script' && (
          <>
            <div className="mb-3">
              <label className={labelCls}>提示（不给答案字形，如 romaji 或 意思）</label>
              <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="kya" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>正确字形</label>
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} className={inputCls} placeholder="きゃ" />
              </div>
              <div>
                <label className={labelCls}>罗马字（可选）</label>
                <input value={romaji} onChange={(e) => setRomaji(e.target.value)} className={inputCls} placeholder="kya" />
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>分组</label>
                <input value={group} onChange={(e) => setGroup(e.target.value)} className={inputCls} placeholder="拗音" />
              </div>
              <div>
                <label className={labelCls}>目标文字</label>
                <select value={targetScript} onChange={(e) => setTargetScript(e.target.value as any)} className={inputCls}>
                  {SCRIPT_TARGETS.map((t) => <option key={t} value={t}>{t || '（无）'}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {buildType === 'vocab' && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>单词</label>
                <input value={word} onChange={(e) => setWord(e.target.value)} className={inputCls} placeholder="cat" />
              </div>
              <div>
                <label className={labelCls}>词性</label>
                <input value={partOfSpeech} onChange={(e) => setPartOfSpeech(e.target.value)} className={inputCls} placeholder="noun" />
              </div>
            </div>
            <div className="mb-3">
              <label className={labelCls}>释义</label>
              <input value={definition} onChange={(e) => setDefinition(e.target.value)} className={inputCls} placeholder="猫" />
            </div>
            <div>
              <label className={labelCls}>例句（可选）</label>
              <input value={example} onChange={(e) => setExample(e.target.value)} className={inputCls} placeholder="I have a cat." />
            </div>
          </>
        )}

        {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-gray-300 transition hover:text-white">取消</button>
          <button onClick={submit}
            className="rounded-lg bg-gradient-to-r from-neon to-neon-2 px-5 py-2 text-sm font-bold text-white shadow-glow-neon transition hover:brightness-110">
            保存到仓库
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentRepoView;
