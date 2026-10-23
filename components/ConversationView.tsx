import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatCard, DailyTask } from '../types';
import { streamChatCompletion, buildTutorSystemPrompt, generateDailyTasks, hasUsableProvider } from '../services/aiService';
import { addActivity, getLevelInfo } from '../services/storageService';
import { Send, Sparkles, ArrowRight, CheckCircle2, Flame, Gift, Share2 } from 'lucide-react';
import { GlassCard, NeonButton, NeonBadge } from './ui';
import { Markdown } from './ui/Markdown';
import AchievementCard from './AchievementCard';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cards?: ChatCard[];
}

interface ConversationViewProps {
  user: UserProfile;
  onStartTask: (module: DailyTask['module']) => void;
  onUpdateUser: (u: UserProfile) => void;
  /** 一键跳到「我的资料 → 模型设置」（新用户未配 API Key 时的引导） */
  onGoToModelSettings?: () => void;
}

// 欢迎区快捷提示：点击填入输入框，降低「不知道该问什么」的门槛
const SUGGESTIONS = [
  '今天该练什么？',
  '给我一套雅思听力高频场景题',
  '帮我改一篇作文',
  '陪我练一段口语',
];

// 星级任务模块 → 活动记录类型（错题重做归类为词汇复习）
const MODULE_TO_ACTIVITY: Record<DailyTask['module'], 'vocabulary' | 'typing' | 'writing'> = {
  vocabulary: 'vocabulary',
  typing: 'typing',
  writing: 'writing',
  errorbook: 'vocabulary',
};

const TASKS_KEY = 'linguaflow_daily_tasks';
const DONE_KEY = 'linguaflow_daily_tasks_done';
const CHEST_KEY = 'linguaflow_daily_chest';
const todayStr = () => new Date().toISOString().slice(0, 10);

// 通关评价：自评完成质量 1–3 星，XP 按倍率加成
const QUALITY_MULT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2 };
const qualityXp = (task: DailyTask, q: number) => Math.round(task.xp * QUALITY_MULT[q]);
const QUALITY_LABEL: Record<number, string> = { 1: '已完成', 2: '认真完成', 3: '完美通关' };

const loadCachedTasks = (): DailyTask[] | null => {
  try {
    const data = JSON.parse(localStorage.getItem(TASKS_KEY) || 'null');
    if (data?.date === todayStr() && Array.isArray(data.tasks)) return data.tasks;
  } catch {}
  return null;
};

const loadDone = (): Record<string, number> => {
  try {
    const data = JSON.parse(localStorage.getItem(DONE_KEY) || 'null');
    if (data?.date === todayStr()) {
      if (data.done && typeof data.done === 'object' && !Array.isArray(data.done)) return data.done;
      // 旧格式（仅 doneIds，无质量）→ 记为 1 星通关
      if (Array.isArray(data.doneIds)) {
        const map: Record<string, number> = {};
        data.doneIds.forEach((id: string) => { map[id] = 1; });
        return map;
      }
    }
  } catch {}
  return {};
};

const loadChest = (): { opened: boolean; reward: number | null } => {
  try {
    const data = JSON.parse(localStorage.getItem(CHEST_KEY) || 'null');
    if (data?.date === todayStr() && data.opened) return { opened: true, reward: data.reward ?? null };
  } catch {}
  return { opened: false, reward: null };
};

const ConversationView: React.FC<ConversationViewProps> = ({ user, onStartTask, onUpdateUser, onGoToModelSettings }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [doneMap, setDoneMap] = useState<Record<string, number>>(() => loadDone());
  const [ratingFor, setRatingFor] = useState<string | null>(null);
  const [chest, setChest] = useState<{ opened: boolean; reward: number | null }>(() => loadChest());
  const [showAchievement, setShowAchievement] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming]);

  // 今日任务：当天缓存优先，避免每次进入重新生成（保证完成态 id 稳定）
  useEffect(() => {
    const cached = loadCachedTasks();
    if (cached) {
      setDailyTasks(cached);
      setTasksLoading(false);
      return;
    }
    let cancelled = false;
    setTasksLoading(true);
    generateDailyTasks(user)
      .then((tasks) => {
        if (cancelled) return;
        setDailyTasks(tasks);
        try { localStorage.setItem(TASKS_KEY, JSON.stringify({ date: todayStr(), tasks })); } catch {}
      })
      .catch(() => { if (!cancelled) setDailyTasks([]); })
      .finally(() => { if (!cancelled) setTasksLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  // 完成任务（带通关质量）：+XP 按质量加成计入现有等级，持久化完成态
  const completeTask = (task: DailyTask, quality: 1 | 2 | 3) => {
    if (doneMap[task.id]) return;
    const xp = qualityXp(task, quality);
    const { user: updated } = addActivity(
      user,
      MODULE_TO_ACTIVITY[task.module],
      user.learningLanguage,
      xp,
      `完成对话台任务：${task.title}（${quality} 星通关）`,
      {}
    );
    const nextDone = { ...doneMap, [task.id]: quality };
    // 连胜口径统一：只由「完成今日产出飞轮」触发（见 storageService.commitDailyStreak），
    // 对话台星任务全清仅给 XP + 宝箱，不再旁路续连胜。
    onUpdateUser(updated);
    setDoneMap(nextDone);
    setRatingFor(null);
    try { localStorage.setItem(DONE_KEY, JSON.stringify({ date: todayStr(), done: nextDone })); } catch {}
  };

  // 开今日宝箱：随机 50–150 XP 额外奖励，当天仅一次
  const openChest = () => {
    if (chest.opened) return;
    const reward = 50 + Math.floor(Math.random() * 101);
    const lang = user.learningLanguage;
    const lp = user.progress[lang];
    const newXp = (lp?.xp || 0) + reward;
    const updated: UserProfile = {
      ...user,
      progress: {
        ...user.progress,
        [lang]: {
          ...lp,
          xp: newXp,
          level: getLevelInfo(newXp).level,
        },
      },
    };
    onUpdateUser(updated);
    setChest({ opened: true, reward });
    try { localStorage.setItem(CHEST_KEY, JSON.stringify({ date: todayStr(), opened: true, reward })); } catch {}
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput('');
    setStreaming(true);

    // 追加空的 assistant 消息占位，流式往里追加
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const system = buildTutorSystemPrompt(user);
    const history = withUser
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await streamChatCompletion(system, history, (delta) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });
      });
    } catch (e) {
      // 无 key / 网络失败：把占位消息替换为可读提示，不白屏
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          next[next.length - 1] = {
            ...last,
            content: '抱歉，AI 暂时不可用。本站不内置 API Key —— 请先到「我的资料 → 模型设置」填写你自己的密钥，或稍后重试。',
          };
        }
        return next;
      });
    } finally {
      // 流式结束仍无内容（空响应）→ 兜底文案，避免用户消息孤零零挂着
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          const next = [...prev];
          next[next.length - 1] = { ...last, content: '（AI 没有返回内容，请重试或换个问法。）' };
          return next;
        }
        return prev;
      });
      setStreaming(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const pickSuggestion = (s: string) => {
    setInput(s);
    textareaRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-4xl flex flex-col">
      {/* 欢迎区：仅无历史时展示 */}
      {messages.length === 0 && (
        <div className="mb-6 space-y-4">
          {/* 新用户引导：本站不内置 API Key，先带用户去申请免费的 */}
          {!hasUsableProvider() && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-xl">🔑</div>
                <div className="flex-1">
                  <p className="font-semibold text-white">先填一个你自己的 API Key，才能开始对话</p>
                  <p className="mt-1 text-sm text-muted leading-relaxed">
                    本站不内置任何密钥。下面几家都有免费额度，注册两分钟就能拿到：
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {[
                      { name: '智谱 GLM', desc: '注册即送免费额度 · 推荐先用', url: 'https://open.bigmodel.cn' },
                      { name: '阿里云百炼（Qwen）', desc: '有免费 token 额度', url: 'https://bailian.console.aliyun.com' },
                      { name: 'OpenRouter', desc: '部分模型免费', url: 'https://openrouter.ai/keys' },
                    ].map((p) => (
                      <a
                        key={p.name}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:border-amber-300/40 hover:bg-amber-400/10"
                      >
                        <span className="text-sm font-semibold text-white">{p.name}</span>
                        <span className="text-[11px] text-muted">{p.desc} ↗</span>
                      </a>
                    ))}
                  </div>
                  {onGoToModelSettings && (
                    <button
                      onClick={onGoToModelSettings}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neon px-3 py-2 text-sm font-bold text-white transition-all hover:brightness-110"
                    >
                      去填写 Key <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.07] bg-surface-2/60 backdrop-blur-sm p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon/15 text-violet-300">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">我是你的学习向导</p>
                  <button
                    onClick={() => setShowAchievement(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neon/25 bg-neon/10 px-2.5 py-1 text-xs font-semibold text-violet-300 transition-colors hover:border-neon/60 hover:text-white"
                  >
                    <Share2 size={14} /> 分享成就
                  </button>
                </div>
                <p className="mt-1 text-sm text-muted leading-relaxed">
                  不用想「现在该练哪个」。告诉我你的目标或状态，我判断你该练什么、带你去练。
                  可以出题、改作文、陪练口语，也可以直接问「今天该练什么」。
                </p>
              </div>
            </div>
          </div>

          {/* 今日星级任务 */}
          {tasksLoading && (
            <div className="space-y-2">
              <p className="text-xs text-faint">正在为你规划今日任务…</p>
            </div>
          )}
          {!tasksLoading && dailyTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">今日任务 · 按你的等级推荐</p>
                <span className="text-xs font-semibold text-muted">{Object.keys(doneMap).length}/{dailyTasks.length} 完成</span>
              </div>
              {dailyTasks.map((t) => (
                <StarTaskCard
                  key={t.id}
                  task={t}
                  done={t.id in doneMap}
                  quality={doneMap[t.id] || 0}
                  ratingOpen={ratingFor === t.id}
                  onStart={() => onStartTask(t.module)}
                  onOpenRating={() => setRatingFor(t.id)}
                  onRate={(q) => completeTask(t, q)}
                  onCancelRating={() => setRatingFor(null)}
                />
              ))}
              {Object.keys(doneMap).length >= dailyTasks.length && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
                    <Flame size={16} /> 今日任务全部完成！去「今日」完成产出飞轮，点亮今日连胜 🔥
                  </div>
                  {chest.opened ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                      <Gift size={16} /> 宝箱已开启：+{chest.reward} XP
                    </div>
                  ) : (
                    <button
                      onClick={openChest}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-400/20"
                    >
                      <Gift size={16} /> 开启今日宝箱
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => pickSuggestion(s)}
                className="rounded-full border border-neon/25 bg-surface-2/60 px-4 py-2 text-sm text-muted transition-colors hover:border-neon/60 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 消息流 */}
      <div className="space-y-4">
        {messages.map((m, i) =>
          // 流式占位消息（content 为空的 assistant）由下方打字指示器呈现，
          // 不重复渲染成空气泡，避免出现「头像+空泡」和「头像+…」两行
          m.role === 'assistant' && m.content === '' ? null : (
            <MessageBubble key={i} msg={m} />
          )
        )}

        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-3">
            <AIAvatar />
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-white/[0.07] bg-surface-2/70 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-neon/60" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-neon/60" style={{ animationDelay: '0.15s' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-neon/60" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />

      {/* 输入区 */}
      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-surface-2/70 backdrop-blur-sm p-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="问 AI 教练任何事，或让它调出练习…"
            className="flex-1 resize-none bg-transparent text-body placeholder:text-faint outline-none text-sm leading-relaxed"
          />
          <NeonButton onClick={() => send(input)} disabled={!input.trim() || streaming} size="md">
            <Send size={16} />
            发送
          </NeonButton>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[11px] text-faint">Enter 发送 · Shift+Enter 换行</p>
          <button
            onClick={() => setShowAchievement(true)}
            className="flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-white"
          >
            <Share2 size={12} /> 分享成就
          </button>
        </div>
      </div>

      {showAchievement && <AchievementCard user={user} onClose={() => setShowAchievement(false)} />}
    </div>
  );
};

const AIAvatar = () => (
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neon/15 text-violet-300">
    <Sparkles size={16} />
  </div>
);

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-neon via-primary to-neon-2 px-4 py-3 text-sm text-white leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <AIAvatar />
      <div className="max-w-[85%] space-y-3">
        <div className="rounded-2xl rounded-tl-sm border border-white/[0.07] bg-surface-2/70 px-4 py-3 text-sm text-body leading-relaxed">
          <Markdown>{msg.content}</Markdown>
        </div>
        {msg.cards && msg.cards.length > 0 && (
          <div className="space-y-2">
            {msg.cards.map((c) => <CardBlock key={c.id} card={c} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// 通用结果卡片（未来 AI 结构化产出复用）
const CardBlock: React.FC<{ card: ChatCard }> = ({ card }) => (
  <GlassCard subtle className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
      <span className="text-sm font-semibold text-white">{card.title}</span>
      {card.actionMode && <NeonBadge tone="neon">可操作</NeonBadge>}
    </div>
    <ul className="space-y-2 px-4 py-3">
      {card.items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-body">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neon" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
    {card.actionLabel && (
      <div className="border-t border-white/5 px-4 py-2.5">
        <button className="flex items-center gap-1 text-sm font-semibold text-violet-300 transition-colors hover:text-white">
          {card.actionLabel} <ArrowRight size={14} />
        </button>
      </div>
    )}
  </GlassCard>
);

const MODULE_LABEL: Record<DailyTask['module'], string> = {
  vocabulary: '词汇',
  typing: '打字',
  writing: '写作',
  errorbook: '错题',
};

const StarTaskCard: React.FC<{
  task: DailyTask;
  done: boolean;
  quality: number;
  ratingOpen: boolean;
  onStart: () => void;
  onOpenRating: () => void;
  onRate: (q: 1 | 2 | 3) => void;
  onCancelRating: () => void;
}> = ({ task, done, quality, ratingOpen, onStart, onOpenRating, onRate, onCancelRating }) => (
  <GlassCard subtle className={`p-4 ${done ? 'opacity-70' : ''}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm tracking-wide text-amber-300">{'★'.repeat(task.star)}{'☆'.repeat(5 - task.star)}</span>
          <span className="text-[11px] text-faint">{MODULE_LABEL[task.module]}</span>
        </div>
        <p className={`mt-1 text-sm font-semibold text-white ${done ? 'line-through text-muted' : ''}`}>{task.title}</p>
        {task.detail && <p className="mt-0.5 text-xs text-muted">{task.detail}</p>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold text-white">{task.durationMin} min</div>
        <div className="text-[11px] text-faint">+{task.xp} XP</div>
      </div>
    </div>

    {/* 通关评价：完成后自评质量 1–3 星，XP 按倍率加成 */}
    {ratingOpen && (
      <div className="mt-3 rounded-lg border border-neon/20 bg-surface-2/70 p-3">
        <p className="text-xs text-muted">这次练得怎么样？</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((q) => (
            <button
              key={q}
              onClick={() => onRate(q)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center transition-colors hover:border-amber-300/50 hover:bg-amber-400/10"
            >
              <div className="text-sm text-amber-300">{'★'.repeat(q)}</div>
              <div className="mt-0.5 text-[11px] text-muted">+{qualityXp(task, q)} XP</div>
            </button>
          ))}
        </div>
        <button onClick={onCancelRating} className="mt-2 text-[11px] text-faint transition-colors hover:text-muted">取消</button>
      </div>
    )}

    <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 pt-3">
      {done ? (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
          <CheckCircle2 size={16} />
          <span className="text-xs tracking-wide text-amber-300">{'★'.repeat(quality || 1)}</span>
          {QUALITY_LABEL[quality] || '已完成'}
        </span>
      ) : (
        <>
          <button
            onClick={onOpenRating}
            className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
          >
            完成
          </button>
          <button
            onClick={onStart}
            className="rounded-lg bg-gradient-to-r from-neon via-primary to-neon-2 px-3 py-1.5 text-xs font-bold text-white transition-all hover:brightness-110"
          >
            开始
          </button>
        </>
      )}
    </div>
  </GlassCard>
);

export default ConversationView;
