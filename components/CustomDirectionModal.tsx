// 自定义写作方向创建弹窗：一句话描述为主，可选展开兴趣标签 + 自定义方向名。
// AI 不可用时由 customDirectionService 自动回退本地模板，弹窗本身不区分来源。
import React, { useState } from 'react';
import { Language, CEFRLevel, CustomDirectionSeed } from '../types';
import { createCustomDirection, updateCustomDirection, MAX_CUSTOM_DIRECTIONS } from '../services/customDirectionService';
import { Sparkles, Loader2, X, ChevronDown } from 'lucide-react';

interface CustomDirectionModalProps {
  lang: Language;
  level: CEFRLevel;
  nativeLanguage: Language;
  currentCount: number;
  onClose: () => void;
  onCreated: (seed: CustomDirectionSeed) => void;
}

const EXAMPLES = [
  '我想用外语写我的健身打卡日记',
  '我想记录自己玩游戏的感想',
  '我想每周总结一次学到的技术知识',
  '我想给朋友介绍我喜欢的电视剧',
];
const INTERESTS = ['职场工作', '美食烹饪', '旅行见闻', '游戏动漫', '追剧娱乐', '体育健身', '技术开发', '生活方式', '情感表达', '学习备考'];

const CustomDirectionModal: React.FC<CustomDirectionModalProps> = ({ lang, level, nativeLanguage, currentCount, onClose, onCreated }) => {
  const [desc, setDesc] = useState('');
  const [title, setTitle] = useState('');
  const [interest, setInterest] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentCount >= MAX_CUSTOM_DIRECTIONS) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
        <div className="glass-panel border border-line-strong rounded-2xl p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <Sparkles size={28} className="mx-auto mb-3 text-fuchsia-400" />
          <h3 className="font-bold text-white mb-2">自定义方向已达上限</h3>
          <p className="text-sm text-muted mb-4">最多同时保留 {MAX_CUSTOM_DIRECTIONS} 个写作方向，可先删除不用的方向再添加。</p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-neon text-white text-sm font-bold hover:bg-neon/80">知道了</button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const d = desc.trim();
    if (!d || creating) return;
    setCreating(true);
    setError(null);
    try {
      const fullDesc = interest ? `${d}（兴趣领域：${interest}）` : d;
      const seed = await createCustomDirection(fullDesc, lang, level, nativeLanguage);
      const t = title.trim();
      if (t && t !== seed.title) {
        seed.title = t;
        updateCustomDirection(lang, seed);
      }
      onCreated(seed);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={creating ? undefined : onClose}>
      <div className="glass-panel border border-neon/30 rounded-2xl p-6 w-full max-w-lg animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-fuchsia-400" /> 添加我的写作方向
          </h3>
          <button onClick={onClose} disabled={creating} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition disabled:opacity-40">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-muted mb-4">告诉我们你想练什么，AI 会为你定制一组由易到难的写作任务，完成一题解锁下一题。</p>

        <label className="text-sm font-bold text-muted mb-2 block">你想写什么方向？</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          disabled={creating}
          placeholder="用一句话描述，例如：我想坚持写健身打卡日记"
          className="w-full bg-surface-2/70 border border-line-strong rounded-xl p-3 text-white placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition resize-none text-sm"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setDesc(ex)}
              disabled={creating}
              className="px-2.5 py-1 rounded-full border border-line-strong text-[11px] text-muted hover:text-white hover:border-neon/50 transition disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAdvanced(!advanced)}
          className="mt-4 flex items-center gap-1 text-xs text-muted hover:text-white transition"
        >
          <ChevronDown size={13} className={`transition-transform ${advanced ? 'rotate-180' : ''}`} />
          更多设置（可选）
        </button>
        {advanced && (
          <div className="mt-3 space-y-4 animate-in fade-in slide-in-from-top-1">
            <div>
              <label className="text-xs font-bold text-muted mb-1.5 block">兴趣领域</label>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map((it) => (
                  <button
                    key={it}
                    onClick={() => setInterest(interest === it ? null : it)}
                    disabled={creating}
                    className={`px-2.5 py-1 rounded-full border text-[11px] transition disabled:opacity-40 ${
                      interest === it ? 'bg-neon/15 border-neon/40 text-white' : 'border-line-strong text-muted hover:text-white hover:border-neon/40'
                    }`}
                  >
                    {it}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted mb-1.5 block">方向名（留空则自动起名）</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={creating}
                maxLength={12}
                placeholder="例如：健身打卡日记"
                className="w-full bg-surface-2/70 border border-line-strong rounded-xl px-3 py-2 text-white text-sm placeholder:text-faint outline-none focus:ring-2 focus:ring-neon transition"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
            <X size={13} /> {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={creating} className="px-4 py-2.5 text-sm text-muted hover:text-white transition disabled:opacity-40">
            取消
          </button>
          <button
            onClick={submit}
            disabled={!desc.trim() || creating}
            className="px-5 py-2.5 rounded-xl bg-neon text-white text-sm font-bold hover:bg-neon/80 shadow-glow-neon transition disabled:opacity-40 disabled:shadow-none flex items-center gap-2"
          >
            {creating ? (
              <><Loader2 size={15} className="animate-spin" /> AI 生成中…</>
            ) : (
              <><Sparkles size={15} /> 生成专属阶梯</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDirectionModal;
