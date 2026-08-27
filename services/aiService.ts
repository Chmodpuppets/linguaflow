
import { Language, CEFRLevel, AssessmentResult, TypingContent, WritingFeedback, WritingRevisionFeedback, GuidedWritingFeedback, GuidedMode, WritingNode, NodeType, ReadingReflection, RPGScenario, RPGTurnResult, UserProfile, ScenarioDef, TargetExam, WritingRegister, CompositionGenre, GENRE_LABELS, ReferenceEssay } from '../types';
import { MENTOR_PERSONAS } from '../constants';
import { getAIConfig, AIConfig, TaskCategory, TaskTier, DEFAULT_TASK_ROUTES } from './storageService';

// --- Qwen (DashScope) + OpenRouter configuration ---
// Primary LLM provider: Alibaba Cloud DashScope "Qwen" via its OpenAI-compatible
// chat completions endpoint. TTS uses qwen3-tts-flash (multilingual); STT uses paraformer-v2.
// When Qwen's quota/rate-limit is exhausted, requests fall back to OpenRouter.
const QWEN_BASE_URL =
  process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_API_KEY = process.env.QWEN_API_KEY || "";
if (!QWEN_API_KEY) {
  console.warn("[LinguaFlow] QWEN_API_KEY is not set. Copy .env.example to .env and add your DashScope API key.");
}
// Model used for the Qwen provider. Override via QWEN_MODEL in .env.
// (e.g. qwen-turbo, qwen-plus, qwen-max, qwen3.7-flash-2026-07-15, ...)
const QWEN_LLM_MODEL = process.env.QWEN_MODEL || "qwen3.7-flash-2026-07-15";

// Derive the DashScope host for TTS/STT endpoints (which live outside /compatible-mode).
const QWEN_HOST = QWEN_BASE_URL.replace(/\/compatible-mode\/v1\/?$/, "");

// OpenRouter provider（Settings -> 模型设置 可切换为主用；Qwen 限流时亦作兜底）。
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_API_KEY = process.env.API_KEY || "";
// Model used for the OpenRouter provider. Override via OPENROUTER_MODEL in .env.
// 默认 stealth/ox-alpha（OpenRouter 2026-08-20 上线的免费推理模型，1M 上下文，擅长长程推理与 Agent 工作流）。
const OPENROUTER_LLM_MODEL = process.env.OPENROUTER_MODEL || "stealth/ox-alpha";

// Zhipu GLM provider (switchable in Settings -> 模型设置). Base/model/key can be
// overridden at runtime via the UI; the key falls back to .env when left blank.
// Uses import.meta.env (VITE_ prefixed) so the value is injected in BOTH dev and build.
const GLM_API_KEY = import.meta.env.VITE_GLM_API_KEY || "";
export const GLM_ENV_API_KEY = GLM_API_KEY;
const GLM_BASE_URL = import.meta.env.VITE_GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const GLM_MODEL = import.meta.env.VITE_GLM_MODEL || "GLM-4.7-Flash";

// Speech models (DashScope). Override via .env.
// TTS: qwen3-tts-flash —— Qwen3-TTS 系列，一个模型覆盖中/英/日/韩/俄等多语种，
//   必须走 multimodal-generation 端点并在 input 里传 voice（音色 id）。
//   ⚠️ 旧的 sambert-* / cosyvoice-* 走 /SpeechSynthesizer 同步端点，实测普通账号
//   会返回 "current user api does not support http call"（仅支持 WebSocket），
//   浏览器端无法直接用，故全部弃用。
const QWEN_TTS_MODEL = process.env.QWEN_TTS_MODEL || "qwen3-tts-flash";

/** qwen3-tts-flash 可选音色（已实测全部可用；任一音色都能朗读多语种）。 */
export const TTS_VOICES: { id: string; label: string; desc: string }[] = [
  { id: "Cherry", label: "芊悦 Cherry", desc: "阳光积极女声・通用推荐" },
  { id: "Ethan", label: "晨煦 Ethan", desc: "温暖清亮男声" },
  { id: "Jennifer", label: "詹妮弗 Jennifer", desc: "品牌级英音女声・练英语首选" },
  { id: "Ryan", label: "甜茶 Ryan", desc: "节奏感强男声" },
  { id: "Elias", label: "墨讲师 Elias", desc: "慢速讲解男声・适合跟读" },
  { id: "Katerina", label: "卡捷琳娜 Katerina", desc: "俄语系女声" },
  { id: "Nofish", label: "不吃鱼 Nofish", desc: "松弛口语男声" },
  { id: "Jada", label: "阿珍 Jada", desc: "上海腔女声" },
  { id: "Dylan", label: "晓东 Dylan", desc: "北京腔男声" },
  { id: "Sunny", label: "晴儿 Sunny", desc: "四川话女声" },
  { id: "Kiki", label: "阿清 Kiki", desc: "粤语女声" },
  { id: "Rocky", label: "阿强 Rocky", desc: "粤语男声" },
];

interface LLMProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Build the active provider list at call time from the runtime AI config
// (Settings -> 模型设置) plus the env-based Qwen/OpenRouter providers.
// The user's selected provider is tried first; if it has no key configured,
// we gracefully fall back to the first available provider (rather than erroring).
const buildProviders = (override?: AIConfig): LLMProvider[] => {
  const cfg = override || getAIConfig();

  // Env-based providers (key present => available).
  const envProviders: LLMProvider[] = [];
  if (QWEN_API_KEY) envProviders.push({ name: "qwen", baseUrl: QWEN_BASE_URL, apiKey: QWEN_API_KEY, model: QWEN_LLM_MODEL });
  if (OPENROUTER_API_KEY) envProviders.push({ name: "openrouter", baseUrl: OPENROUTER_BASE_URL, apiKey: OPENROUTER_API_KEY, model: OPENROUTER_LLM_MODEL });

  // Runtime-config providers (Settings -> 模型设置).
  const glmKey = cfg.glm.apiKey || GLM_API_KEY;
  const glmProvider: LLMProvider | null = glmKey
    ? { name: "glm", baseUrl: cfg.glm.baseUrl || GLM_BASE_URL, apiKey: glmKey, model: cfg.glm.model || GLM_MODEL }
    : null;
  const customProvider: LLMProvider | null = cfg.custom.apiKey
    ? { name: "custom", baseUrl: cfg.custom.baseUrl, apiKey: cfg.custom.apiKey, model: cfg.custom.model }
    : null;

  // Resolve the user's chosen active provider; null if its key is missing.
  let active: LLMProvider | null = null;
  if (cfg.active === "glm") active = glmProvider;
  else if (cfg.active === "custom") active = customProvider;
  else if (cfg.active === "qwen") active = envProviders.find((p) => p.name === "qwen") ?? null;
  else if (cfg.active === "openrouter") active = envProviders.find((p) => p.name === "openrouter") ?? null;

  // All providers that actually have a key, in a stable order.
  const all = [glmProvider, customProvider, ...envProviders].filter(Boolean) as LLMProvider[];

  // Active first; if it's unavailable (no key), fall back to the first working provider.
  const ordered = active ? [active, ...all.filter((p) => p.name !== active!.name)] : all;
  return ordered;
};

// Surface the active configuration so users always know which model is in use.
console.info(
  `[LinguaFlow] LLM providers (env): qwen → ${QWEN_LLM_MODEL}` +
  `${OPENROUTER_API_KEY ? `  |  openrouter → ${OPENROUTER_LLM_MODEL}` : ""}` +
  `; 运行时模型可在 Settings -> 模型设置 切换（GLM / Qwen / OpenRouter / 自定义）`
);
console.info(`[LinguaFlow] Speech models — TTS: ${QWEN_TTS_MODEL} (multilingual)`);

// Build a tutor system prompt that makes the AI "remember" the user (Phase 3)
export const buildTutorSystemPrompt = (user: UserProfile): string => {
    const persona = MENTOR_PERSONAS.find((m) => m.id === user.mentorPersona) || MENTOR_PERSONAS[0];
    const parts: string[] = [persona.system];
    const lp = user.progress[user.learningLanguage];
    parts.push(`学生母语是 ${user.nativeLanguage}，正在学习 ${user.learningLanguage}（当前 CEFR ${lp?.cefrLevel || 'A1'}）。`);
    if (user.preferredTopics.length) parts.push(`学生的兴趣主题：${user.preferredTopics.join('、')}。尽量结合这些主题展开。`);
    if (user.aiMemory.goals.length) parts.push(`学生的学习目标：${user.aiMemory.goals.join('；')}。`);
    if (user.aiMemory.weakPoints.length) parts.push(`学生常犯的薄弱点（请重点留意、温和纠正）：${user.aiMemory.weakPoints.join('；')}。`);
    parts.push('请始终用学生的目标语言进行对话，必要时用母语解释。');
    return parts.join('\n');
};

// Helper to safely parse JSON from AI text response
const parseAIJSON = <T>(text: string | undefined, fallback: T): T => {
    if (!text) return fallback;
    try {
        // Remove markdown code blocks if present (e.g. ```json ... ```)
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText) as T;
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw Text:", text);
        return fallback;
    }
};

// --- Low-level chat completion with provider fallback ---
interface ChatError extends Error { quota?: boolean; network?: boolean; }

const isQuotaOrLimit = (status: number, text: string): boolean =>
  status === 429 || status === 402 ||
  /quota|exceeded|insufficient|额度|余额|rate.?limit|limit reached/i.test(text);

const callProvider = async (p: LLMProvider, messages: { role: string; content: string }[], temperature?: number): Promise<string> => {
    let res: Response;
    try {
        res = await fetch(`${p.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${p.apiKey}`,
                "Content-Type": "application/json",
                ...(p.name === "openrouter"
                    ? { "HTTP-Referer": "https://linguaflow.app", "X-Title": "LinguaFlow" }
                    : {}),
            },
            body: JSON.stringify({
                model: p.model,
                messages,
                temperature: temperature ?? 0.7,
            }),
        });
    } catch (e) {
        const err = new Error(`Network error (${p.name})`) as ChatError;
        err.network = true;
        throw err;
    }

    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (isQuotaOrLimit(res.status, errText)) {
            const err = new Error(`Quota/limit reached (${p.name} ${res.status})`) as ChatError;
            err.quota = true;
            throw err;
        }
        throw new Error(`LLM request failed (${p.name} ${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
};

const chatCompletion = async (prompt: string, temperature?: number): Promise<string> => {
    let lastErr: unknown;
    for (const p of buildProviders()) {
        try {
            return await callProvider(p, [{ role: "user", content: prompt }], temperature);
        } catch (e: any) {
            lastErr = e;
            // Only fall through to the next provider on quota/limit or network failure.
            if (e?.quota || e?.network) continue;
            throw e; // hard error (e.g. bad request) — don't retry
        }
    }
    throw lastErr;
};

// 带 system 指令的对话（用于注入 AI 导师人设与"记住你"的上下文）
export const chatCompletionWithSystem = async (system: string, prompt: string, temperature?: number): Promise<string> => {
    let lastErr: unknown;
    for (const p of buildProviders()) {
        try {
            return await callProvider(p, [
                { role: "system", content: system },
                { role: "user", content: prompt },
            ], temperature);
        } catch (e: any) {
            lastErr = e;
            if (e?.quota || e?.network) continue;
            throw e;
        }
    }
    throw lastErr;
};

// --- 按任务类别路由模型（fast=快模型 / reason=高推理 / auto=跟随全局）---
// 把"活儿"分配到对的模型：高频小调用走快模型，深推理活走高推理模型。
// env key 缺失时优雅回落到其它可用 provider，不会直接报错。
const resolveTier = (tier: TaskTier): LLMProvider | null => {
  const envProviders: LLMProvider[] = [];
  if (QWEN_API_KEY) envProviders.push({ name: "qwen", baseUrl: QWEN_BASE_URL, apiKey: QWEN_API_KEY, model: QWEN_LLM_MODEL });
  if (OPENROUTER_API_KEY) envProviders.push({ name: "openrouter", baseUrl: OPENROUTER_BASE_URL, apiKey: OPENROUTER_API_KEY, model: OPENROUTER_LLM_MODEL });
  const glmKey = getAIConfig().glm.apiKey || GLM_API_KEY;
  const glmProvider: LLMProvider | null = glmKey
    ? { name: "glm", baseUrl: GLM_BASE_URL, apiKey: glmKey, model: GLM_MODEL }
    : null;

  if (tier === "auto") return buildProviders()[0] ?? null;
  if (tier === "fast") {
    // 高频小活：优先快模型，避开慢推理模型；仅当别无选择才回落 openrouter。
    return envProviders.find((p) => p.name === "qwen") ?? glmProvider ?? envProviders.find((p) => p.name === "openrouter") ?? null;
  }
  // reason：深推理活：优先 OpenRouter（ox-alpha）。
  return envProviders.find((p) => p.name === "openrouter") ?? envProviders.find((p) => p.name === "qwen") ?? glmProvider ?? null;
};

export const getProviderForTask = (category: TaskCategory): LLMProvider | null => {
  const cfg = getAIConfig();
  const tier = (cfg.taskRoutes && cfg.taskRoutes[category]) || DEFAULT_TASK_ROUTES[category] || "auto";
  return resolveTier(tier) ?? buildProviders()[0] ?? null;
};

// 按任务类别选模型：先走路由到的 provider，失败（限流/网络）再回落全局 provider 链。
const chatCompletionForTask = async (category: TaskCategory, prompt: string, temperature?: number): Promise<string> => {
  const primary = getProviderForTask(category);
  const rest = buildProviders().filter((p) => p.name !== primary?.name);
  const chain = primary ? [primary, ...rest] : buildProviders();
  let lastErr: unknown;
  for (const p of chain) {
    try {
      return await callProvider(p, [{ role: "user", content: prompt }], temperature);
    } catch (e: any) {
      lastErr = e;
      if (e?.quota || e?.network) continue;
      throw e;
    }
  }
  throw lastErr;
};

const chatCompletionWithSystemForTask = async (category: TaskCategory, system: string, prompt: string, temperature?: number): Promise<string> => {
  const primary = getProviderForTask(category);
  const rest = buildProviders().filter((p) => p.name !== primary?.name);
  const chain = primary ? [primary, ...rest] : buildProviders();
  let lastErr: unknown;
  for (const p of chain) {
    try {
      return await callProvider(p, [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ], temperature);
    } catch (e: any) {
      lastErr = e;
      if (e?.quota || e?.network) continue;
      throw e;
    }
  }
  throw lastErr;
};

// --- 翻译：复用通用 chat 接口，把源语言文本译为母语。失败时抛出，由调用方降级（留空）。 ---
export const translateText = async (text: string, srcLang: Language, dstLang: Language): Promise<string> => {
  if (!text.trim()) return '';
  const system = `You are a precise subtitle/lyric translator. Translate the user's ${srcLang} text into ${dstLang}. Output ONLY the translation itself — no quotes, no explanation, no extra lines. Preserve meaning and tone.`;
  try {
    const r = await chatCompletionWithSystemForTask('typing', system, text, 0.3);
    return r.trim();
  } catch (e) {
    console.error('[LinguaFlow] translateText failed', e);
    throw e;
  }
};

// --- 注音/罗马音：调用 AI 把歌词（含汉字/拼音体系）正确读出拉丁字母读音 ---
// 日语 → Hepburn romaji（含汉字读音）；中文 → 带声调 Hanyu Pinyin；韩文 → 罗马字；其他 → 自然拉丁转写。
// 失败时抛出，由调用方降级（留空或回退本地查表）。
export const generatePhonetic = async (text: string, lang: Language): Promise<string> => {
  if (!text.trim()) return '';
  if (buildProviders().length === 0) throw new Error('未配置 AI 模型，请先在「我的资料 / 设置」里配置模型与 API Key');
  const system = `You are a precise phonetic transliteration engine for ${lang} lyrics.
Given one line of ${lang} text (which may contain kanji/汉字 or native script), output ONLY its phonetic reading in Latin letters:
- Japanese: Hepburn romaji, reading kanji correctly (e.g. 恋 → koi, 空 → sora), with long-vowel marks (ā, ī, ū, ē, ō).
- Chinese: Hanyu Pinyin with tone marks (e.g. 你好 → nǐ hǎo).
- Korean: Revised Romanization (e.g. 사랑 → sarang).
- Other languages: a natural Latin romanization of the script.
Output ONLY the transliteration — no quotes, no explanation, no extra lines.`;
  try {
    const r = await chatCompletionWithSystemForTask('typing', system, text, 0.2);
    return r.trim();
  } catch (e) {
    console.error('[LinguaFlow] generatePhonetic failed', e);
    throw e;
  }
};

// --- 批量注音/罗马音：一次调用返回整首所有行的读音数组，避免逐句发请求 ---
export const generatePhoneticsBatch = async (texts: string[], lang: Language): Promise<string[]> => {
  const indexed = texts.map((t, i) => ({ i, t })).filter((x) => x.t && x.t.trim());
  if (indexed.length === 0) return texts.map(() => '');
  if (buildProviders().length === 0) throw new Error('未配置 AI 模型，请先在「设置」里配置模型与 API Key');
  const numbered = indexed.map((x, k) => `${k + 1}. ${x.t}`).join('\n');
  const system = `You are a precise phonetic transliteration engine for ${lang} lyrics.
The user gives several numbered lyric lines. Return a JSON array of strings — one phonetic reading per input line, in the SAME order and SAME length.
Rules per entry:
- Japanese: Hepburn romaji, reading kanji correctly (恋→koi, 空→sora), with long-vowel marks (ā, ī, ū, ē, ō).
- Chinese: Hanyu Pinyin with tone marks (你好→nǐ hǎo).
- Korean: Revised Romanization (사랑→sarang).
- Others: natural Latin romanization.
Output ONLY the JSON array. No explanation, no Markdown code block.`;
  try {
    const r = await chatCompletionWithSystemForTask('typing', system, numbered, 0.2);
    const arr = parseAIJSON<string[]>(r, []);
    if (!Array.isArray(arr)) throw new Error('AI 返回格式异常');
    const out = texts.map(() => '');
    indexed.forEach((x, k) => {
      out[x.i] = typeof arr[k] === 'string' ? arr[k] : '';
    });
    return out;
  } catch (e) {
    console.error('[LinguaFlow] generatePhoneticsBatch failed', e);
    throw e;
  }
};

// --- 批量翻译：一次调用返回整首所有行的译文数组 ---
export const translateTextsBatch = async (texts: string[], srcLang: Language, dstLang: Language): Promise<string[]> => {
  const indexed = texts.map((t, i) => ({ i, t })).filter((x) => x.t && x.t.trim());
  if (indexed.length === 0) return texts.map(() => '');
  if (buildProviders().length === 0) throw new Error('未配置 AI 模型，请先在「设置」里配置模型与 API Key');
  const numbered = indexed.map((x, k) => `${k + 1}. ${x.t}`).join('\n');
  const system = `You are a precise subtitle/lyric translator. The user gives several numbered ${srcLang} lines. Return a JSON array of strings — the ${dstLang} translation of each line, in the SAME order and SAME length. Output ONLY the JSON array, no explanation, no Markdown code block.`;
  try {
    const r = await chatCompletionWithSystemForTask('typing', system, numbered, 0.3);
    const arr = parseAIJSON<string[]>(r, []);
    if (!Array.isArray(arr)) throw new Error('AI 返回格式异常');
    const out = texts.map(() => '');
    indexed.forEach((x, k) => {
      out[x.i] = typeof arr[k] === 'string' ? arr[k] : '';
    });
    return out;
  } catch (e) {
    console.error('[LinguaFlow] translateTextsBatch failed', e);
    throw e;
  }
};

// One-off connectivity test using the given (or currently stored) config's
// primary provider. Returns the raw model reply (e.g. "OK") on success.
export const testModelConnection = async (config?: AIConfig): Promise<string> => {
  const providers = buildProviders(config);
  if (!providers.length) throw new Error("没有可用的模型配置");
  return await callProvider(providers[0], [
    { role: "system", content: "You are a helpful test assistant." },
    { role: "user", content: "Reply with exactly the word: OK" },
  ]);
};

// --- 墨程 InkQuest：轻量微写作教练（三件套 + 四维度小分） ---
export interface InkQuestCoachFeedback {
  highlight: string;
  fix: string;
  fixReasonZh: string;
  rewrite: string;
  scores: { grammar: number; fluency: number; vocabulary: number; task: number };
  comment: string;
  // 结构化的错误模式标签，用于驱动「个人错误模式引擎」后续出题优先级。
  // tag 限定枚举：tense/particle/word_order/collocation/spelling/register/agreement/kana_dakuon/kana_youon/kana_confusion/other
  errorTags?: Array<{ tag: string; original: string; correction: string; reasonZh: string }>;
}

const INKQUEST_COACH_FALLBACK: InkQuestCoachFeedback = {
  highlight: '',
  fix: '',
  fixReasonZh: '暂时无法连接 AI 教练，稍后再试～',
  rewrite: '',
  scores: { grammar: 3, fluency: 3, vocabulary: 3, task: 3 },
  comment: '已收到你的练习，继续加油！',
  errorTags: [],
};

export const getInkQuestCoachFeedback = async (
  user: UserProfile,
  userText: string,
  theme: string,
  targetLanguage: Language,
  nativeLanguage: Language,
  cefrLevel: CEFRLevel
): Promise<InkQuestCoachFeedback> => {
  const system =
    `${buildTutorSystemPrompt(user)}\n` +
    `你同时也是一位「微写作教练」，擅长鼓励初学者。\n` +
    `学生刚用 ${targetLanguage} 写了一小段（主题：${theme}；CEFR ${cefrLevel}；学生母语 ${nativeLanguage}）。\n` +
    `请严格用 JSON 回复，不要有任何额外文字。JSON 字段：\n` +
    `{\n` +
    `  "highlight": "学生写得最好的一句（尽量引用原文原句）",\n` +
    `  "fix": "最值得改的一处（指出原文中有问题的那句/词）",\n` +
    `  "fixReasonZh": "用中文解释为什么不够好，并给一个更地道/正确的说法",\n` +
    `  "rewrite": "把学生整段改写成更自然的一版（保留原意与当前难度）",\n` +
    `  "scores": { "grammar": 0到5的整数, "fluency": 0到5的整数, "vocabulary": 0到5的整数, "task": 0到5的整数 },\n` +
    `  "errorTags": [ { "tag": "错误类型枚举(tense/particle/word_order/collocation/spelling/register/agreement/kana_dakuon/kana_youon/kana_confusion/other)", "original": "学生原句中写错的那一小段", "correction": "正确写法", "reasonZh": "一句中文说明为什么错" } ],\n` +
    `  "comment": "一句鼓励向的中文总评"\n` +
    `}\n` +
    `评分满分 5 分，对初学者请宽松善意；若 fix 确实没有大问题，可写"整体很棒，挑不出毛病"。`;
  const prompt = `这是学生写的内容：\n"""\n${userText}\n"""\n请给教练反馈。`;
  try {
    const raw = await chatCompletionWithSystemForTask('typing', system, prompt, 0.3);
    return parseAIJSON<InkQuestCoachFeedback>(raw, INKQUEST_COACH_FALLBACK);
  } catch (e) {
    console.warn('InkQuest coach failed:', e);
    return INKQUEST_COACH_FALLBACK;
  }
};

// 给微写作卡生成 3 个目标语「脚手架词汇/短语」，降低空白页焦虑（按需点击）
export const getInkQuestScaffold = async (
  theme: string,
  targetLanguage: Language,
  cefrLevel: CEFRLevel
): Promise<string[]> => {
  const system =
    `你是语言学习素材生成器。` +
    `请直接输出一个 **JSON 字符串数组**（数组长度正好 3，每个元素都是一段纯文本字符串）。` +
    `适合 CEFR ${cefrLevel} 学习者在写「${theme}」主题时可以用到的 ${targetLanguage} 词汇或短句。` +
    `严禁输出对象、严禁输出对象数组、严禁加解释或前后缀文字，**只输出形如 ["词1","词2","词3"] 的纯 JSON 字符串数组**。`;
  try {
    const raw = await chatCompletionWithSystemForTask('typing', system, `生成 3 个 ${targetLanguage} 词汇/短语，主题：${theme}`, 0.6);
    const arr = parseAIJSON<unknown[]>(raw, []);
    if (!Array.isArray(arr)) return [];
    // 防御式归一：模型偶尔还是会返回对象（{word:'…', translation:'…'} 或 {term:'…', example:'…'} 等），落到字符串再过滤
    return arr
      .slice(0, 3)
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          const cand =
            o.word ?? o.term ?? o.text ?? o.vocab ?? o.phrase ?? o.example ??
            o.value ?? o.translation_zh;
          if (typeof cand === 'string' && cand.trim()) return cand.trim();
        }
        return '';
      })
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
};

// 听写模式：为某主题生成一句适合 CEFR 等级、长度适中、便于听写的短句（目标语）
export const getInkQuestDictationSentence = async (
  theme: string,
  targetLanguage: Language,
  cefrLevel: CEFRLevel
): Promise<string> => {
  const system =
    `你是语言学习素材生成器。请生成一句适合 CEFR ${cefrLevel} 学习者、主题「${theme}」的 ${targetLanguage} 短句` +
    `（1–2 句，尽量自然、口语化、长度适中，便于听写复述）。只输出句子本身，不要解释、不要引号、不要额外文字。`;
  try {
    const raw = await chatCompletionWithSystemForTask('typing', system, `生成一句 ${targetLanguage} 听写句，主题：${theme}`, 0.5);
    const cleaned = (raw || '').trim().replace(/^["'「」『』\s]+|["'「」『』\s]+$/g, '').trim();
    return cleaned;
  } catch {
    return '';
  }
};

// 故事线（叙事成长）：把用户手帐里的亮点句，由 AI 织成一段第一人称旅程日记续篇（目标语）
export const getInkQuestStoryContinuation = async (
  user: UserProfile,
  lang: Language,
  level: CEFRLevel,
  pastStory: string,
  newHighlights: string[]
): Promise<string> => {
  const system =
    `你是「微写作旅程日记」的执笔人。学生正在用 ${lang} 写一本第一人称的旅程手帐（CEFR ${level}）。` +
    `请用 ${lang} 写一段新的日记续篇（3–5 句，难度贴合 ${level}），自然地把下面这些"今日亮点句"织进情节里。` +
    `保持第一人称、温暖、有画面感。只输出续写段落本身，不要标题、不要额外解释、不要用引号包裹。`;
  const prompt =
    (pastStory
      ? `这是已有的故事：\n"""\n${pastStory}\n"""\n\n`
      : `（这是故事的开头，还没有前情。）\n\n`) +
    `今日要织进来的亮点句：\n- ${newHighlights.join('\n- ')}\n\n请续写下一小段。`;
  try {
    const raw = await chatCompletionWithSystem(system, prompt, 0.7);
    return (raw || '').trim();
  } catch {
    return '';
  }
};

export const assessUserLevel = async (text: string, language: Language): Promise<AssessmentResult> => {
  const prompt = `
    Analyze the following ${language} text to determine the CEFR language proficiency level of the author.
    Text: "${text}"
    
    Return ONLY valid JSON. No Markdown. No code blocks.
    Structure:
    {
      "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "reasoning": "string (max 2 sentences)",
      "vocabularyScore": number (0-100),
      "grammarScore": number (0-100)
    }
  `;

  try {
    const responseText = await chatCompletionForTask('typing', prompt);

    return parseAIJSON<AssessmentResult>(responseText, {
        level: CEFRLevel.A1,
        reasoning: "Analysis failed.",
        vocabularyScore: 0,
        grammarScore: 0
    });
  } catch (error) {
    console.error("Assessment error:", error);
    throw new Error("Failed to assess language level.");
  }
};

// --- 轻量脚本检测：用于纠正常见的 text/translation 字段反向问题 ---
const SCRIPT_PATTERNS: Partial<Record<Language, RegExp>> = {
  [Language.Chinese]: /[\u4e00-\u9fff]/,
  [Language.Japanese]: /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/,
  [Language.Korean]: /[\uac00-\ud7af]/,
  [Language.Russian]: /[\u0400-\u04ff]/,
  [Language.Greek]: /[\u0370-\u03ff]/,
  [Language.Arabic]: /[\u0600-\u06ff]/,
};

function scriptLikely(text: string, lang: Language): boolean {
  const re = SCRIPT_PATTERNS[lang];
  if (!re) {
    // 拉丁字母类目标语言：判断文本里是否出现明显拉丁字母
    return /[a-zA-Z]/.test(text);
  }
  return re.test(text);
}

/**
 * 兜底校正：如果模型把 text/translation 写反了（例如目标语言是中文，
 * 但 text 是英文、translation 是中文），自动交换两者，避免用户练错内容。
 * keyVocabulary 保持原样（模型通常已经把 word=目标语言、meaning=母语写对）。
 */
function normalizeTypingContent(
  content: TypingContent,
  targetLang: Language
): TypingContent {
  // 去除首尾空白，避免光标停留在换行/空格等不可见字符上导致「光标没对齐」
  const normalized = {
    ...content,
    text: (content.text ?? '').trim(),
    translation: (content.translation ?? '').trim(),
  };

  const textMatchesTarget = scriptLikely(normalized.text, targetLang);
  const translationMatchesTarget = scriptLikely(normalized.translation, targetLang);

  if (!textMatchesTarget && translationMatchesTarget && normalized.translation) {
    return {
      ...normalized,
      text: normalized.translation,
      translation: normalized.text,
      // phoneticGuide 原本就是目标语言文本的注音，交换后仍然对应新的 text
      phoneticGuide: normalized.phoneticGuide,
    };
  }
  return normalized;
}

export const generateTypingContent = async (targetLang: Language, nativeLang: Language, level: CEFRLevel, topic?: string, instructions?: string): Promise<TypingContent> => {
  const safeTopic = topic || "a random interesting daily life topic";
  const extraInstructions = instructions || "";

  const system = `You generate short typing-practice passages for language learners. Follow these rules absolutely:
1. The "text" field MUST be written ONLY in ${targetLang} — this is the passage the student will type.
2. The "translation" field MUST be the ${nativeLang} translation of "text" — this is the student's native language reference.
3. For Chinese (Hanzi), Japanese (Kanji/Kana), or Korean (Hangul): "phoneticGuide" MUST be the full Pinyin/Romaji/Romanization of "text".
4. Each "keyVocabulary.word" MUST be in ${targetLang}; "keyVocabulary.meaning" MUST be in ${nativeLang}.
5. Return ONLY valid JSON. No Markdown. No code blocks. No extra commentary.`;

  const prompt = `
Generate a short practice text (approx 50-80 words) for typing practice at CEFR level ${level}.
The topic is: ${safeTopic}.
${extraInstructions}

Return ONLY valid JSON with this exact structure:
{
  "text": "The practice passage in ${targetLang} ONLY",
  "topic": "A 2-3 word title in ${targetLang}",
  "phoneticGuide": "Full phonetic transliteration of 'text' (Pinyin/Romaji/Romanization), or empty string if not applicable",
  "translation": "The ${nativeLang} translation of 'text'",
  "keyVocabulary": [
     { "word": "a key word in ${targetLang}", "meaning": "its meaning in ${nativeLang}", "partOfSpeech": "noun/verb/adjective/etc" }
  ]
}
  `;

  try {
    const responseText = await chatCompletionWithSystemForTask('typing', system, prompt, 0.5);

    const parsed = parseAIJSON<TypingContent>(responseText, {
        text: "Error generating content. Please try again.",
        topic: safeTopic,
        phoneticGuide: "",
        translation: "Translation unavailable.",
        keyVocabulary: []
    });

    // Robust defaults
    if (!parsed.keyVocabulary) parsed.keyVocabulary = [];
    if (!parsed.text) parsed.text = "Error generating content.";

    return normalizeTypingContent(parsed, targetLang);
  } catch (error) {
    console.error("Content generation error:", error);
    throw new Error("Failed to generate typing content.");
  }
};

// 考试 ↔ 语言 映射（严格门控：写作考试评分只对匹配语言启用）
const EXAM_LANGUAGE: Partial<Record<TargetExam, Language>> = {
  IELTS: Language.English,
  TOEFL: Language.English,
  JLPT: Language.Japanese,
  TOPIK: Language.Korean,
  DELE: Language.Spanish,
};

// 该考试是否对当前学习语言启用评分
const isExamApplicable = (exam: TargetExam | undefined, lang: Language): boolean => {
  if (!exam || exam === 'none') return false;
  return EXAM_LANGUAGE[exam] === lang;
};

// 构建考试评分的 prompt 指令块与 JSON 字段。未启用时返回空。
const buildExamScoring = (
  targetLanguage: Language,
  nativeLanguage: Language,
  targetExam: TargetExam | undefined,
  topic?: string
): { applies: boolean; block: string; json: string } => {
  if (!isExamApplicable(targetExam, targetLanguage)) return { applies: false, block: '', json: '' };

  // 响应相关性维度：考试评分中「是否回应任务」对应的维度名。
  // TR / Development / 내용 구성 / adecuación a la tarea 考的都是同一件事——切题。
  const responseDimByExam: Partial<Record<TargetExam, string>> = {
    IELTS: 'taskResponse',
    TOEFL: 'development',
    TOPIK: 'contentOrganization',
    DELE: 'taskAdequacy',
    JLPT: 'composition',
  };

  let applies = false;
  let block = '';
  let json = '';
  switch (targetExam) {
    case 'IELTS':
      applies = true;
      block = `
    IMPORTANT — IELTS Academic Writing scoring:
    The student is preparing for the IELTS Academic Writing test. In addition to the above, score this essay using the official IELTS 9-band criteria (bands can be whole or half: e.g. 5.0, 6.5, 7.0).
    - "taskResponse": Task Response / Task Achievement (TR) — how fully and relevantly the task is addressed.
    - "coherenceCohesion": Coherence & Cohesion (CC) — organization, linking, flow.
    - "lexicalResource": Lexical Resource (LR) — vocabulary range, accuracy, appropriacy.
    - "grammaticalRange": Grammatical Range & Accuracy (GRA) — grammar structures and correctness.
    - "overall": the average of the four band scores, rounded to ONE decimal place.
    In "feedback", give a SHORT (1 sentence) comment per criterion, in ${nativeLanguage}.
    `;
      json = `,
      "examScores": {
        "taskResponse": number (0-9, may be .5),
        "coherenceCohesion": number (0-9, may be .5),
        "lexicalResource": number (0-9, may be .5),
        "grammaticalRange": number (0-9, may be .5),
        "overall": number (0-9, average of the four, one decimal),
        "feedback": {
          "taskResponse": "string (in ${nativeLanguage})",
          "coherenceCohesion": "string (in ${nativeLanguage})",
          "lexicalResource": "string (in ${nativeLanguage})",
          "grammaticalRange": "string (in ${nativeLanguage})"
        }
      }`;
      break;
    case 'JLPT':
      applies = true;
      block = `
    IMPORTANT — JLPT 写作能力映射（日语）:
    JLPT 官方为选择题考试（文字・語彙 / 文法 / 読解 / 聴解），此处将学生的日语「写作」能力映射到 N 级量表作为估算。
    按以下三维各以 0-100 评分：
    - "vocabularyKanji": 文字・語彙 — 汉字读音/写法、词汇选择与搭配准确度。
    - "grammar": 文法 — 助词、活用、句型、敬体/简体使用是否正确。
    - "composition": 構成・表現 — 文章组织、连贯性、语体是否得体。
    - "estimatedLevel": 估算对应的 N 级（"N5" 最容易 ~ "N1" 最难）。
    在 "feedback" 中每个维度给一句简短说明（用 ${nativeLanguage}）。
    `;
      json = `,
      "examScores": {
        "estimatedLevel": "N5" | "N4" | "N3" | "N2" | "N1",
        "vocabularyKanji": number (0-100),
        "grammar": number (0-100),
        "composition": number (0-100),
        "feedback": {
          "vocabularyKanji": "string (in ${nativeLanguage})",
          "grammar": "string (in ${nativeLanguage})",
          "composition": "string (in ${nativeLanguage})"
        }
      }`;
      break;
    case 'TOPIK':
      applies = true;
      block = `
    IMPORTANT — TOPIK 写作评分（韩语）:
    学生备考 TOPIK（韩国语能力考试）。按以下三维各以 0-100 评分：
    - "vocabGrammar": 어휘・문법 — 词汇与语法准确度。
    - "contentOrganization": 내용 구성 — 内容展开与结构组织。
    - "expression": 표현 — 表达是否自然、拼写是否正确。
    - "estimatedLevel": 估算对应的 TOPIK 等级（数字 1 最低 ~ 6 最高；TOPIK I = 1-2，TOPIK II = 3-6）。
    在 "feedback" 中每个维度给一句简短说明（用 ${nativeLanguage}）。
    `;
      json = `,
      "examScores": {
        "estimatedLevel": number (1-6),
        "vocabGrammar": number (0-100),
        "contentOrganization": number (0-100),
        "expression": number (0-100),
        "feedback": {
          "vocabGrammar": "string (in ${nativeLanguage})",
          "contentOrganization": "string (in ${nativeLanguage})",
          "expression": "string (in ${nativeLanguage})"
        }
      }`;
      break;
    case 'DELE':
      applies = true;
      block = `
    IMPORTANT — DELE 写作评分（西班牙语）:
    学生备考 DELE（西班牙语水平文凭）。按 CEFR 维度各以 0-100 评分：
    - "grammar": gramática — 词法句法准确度。
    - "vocabulary": léxico — 词汇范围与精确度。
    - "coherence": coherencia y cohesión — 语篇连贯与衔接。
    - "taskAdequacy": adecuación a la tarea — 体裁与语域是否得当。
    - "estimatedLevel": 估算对应的 CEFR 等级（"A1" ~ "C2"）。
    在 "feedback" 中每个维度给一句简短说明（用 ${nativeLanguage}）。
    `;
      json = `,
      "examScores": {
        "estimatedLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
        "grammar": number (0-100),
        "vocabulary": number (0-100),
        "coherence": number (0-100),
        "taskAdequacy": number (0-100),
        "feedback": {
          "grammar": "string (in ${nativeLanguage})",
          "vocabulary": "string (in ${nativeLanguage})",
          "coherence": "string (in ${nativeLanguage})",
          "taskAdequacy": "string (in ${nativeLanguage})"
        }
      }`;
      break;
    case 'TOEFL':
      applies = true;
      block = `
    IMPORTANT — TOEFL iBT Writing scoring (English):
    The student is preparing for the TOEFL iBT Writing section. Score this essay using the official TOEFL writing rubric. Each criterion is scored 0-5:
    - "development": Development — ideas are elaborated with appropriate detail, examples, and explanation; the task is addressed fully.
    - "organization": Organization — unity, logical progression, and coherence of ideas; clear structure.
    - "languageUse": Language Use — grammar, vocabulary range, and mechanics (accuracy and appropriacy).
    - "scaled": estimate the overall TOEFL Writing scaled score (0-30), derived from the three 0-5 criteria above (approx. (development+organization+languageUse)/15 * 30).
    In "feedback", give a SHORT (1 sentence) comment per criterion, in ${nativeLanguage}.
    `;
      json = `,
      "examScores": {
        "development": number (0-5),
        "organization": number (0-5),
        "languageUse": number (0-5),
        "scaled": number (0-30, estimated overall),
        "feedback": {
          "development": "string (in ${nativeLanguage})",
          "organization": "string (in ${nativeLanguage})",
          "languageUse": "string (in ${nativeLanguage})"
        }
      }`;
      break;
    default:
      return { applies: false, block: '', json: '' };
  }

  // 关键：把真实考题写进考试评分指令，并显式绑定「响应相关性维度」到这道题。
  // 否则 TR/Development 等指标在结构上无法判断「是否回应任务」。
  if (applies && topic) {
    const dim = responseDimByExam[targetExam as TargetExam] ?? 'taskResponse';
    block += `\n    TASK / 题目（评分依据）：学生被要求回应以下任务 ——「${topic}」。\n    请将 "${dim}" 维度严格对照这道任务评分：切题、充分展开并支撑论点者给高分；跑题、偏题、与题目无关的内容必须扣分。`;
  }

  return { applies, block, json };
};

export const analyzeWriting = async (
  text: string,
  targetLanguage: Language,
  nativeLanguage: Language,
  cefrLevel: CEFRLevel = CEFRLevel.A1,
  targetExam?: TargetExam,
  register?: WritingRegister,
  topic?: string
): Promise<WritingFeedback> => {
  // 考试评分：仅当 (目标考试 ↔ 学习语言) 匹配且已实现对才启用，绝不污染其他语言。
  // 传入 topic，让 TR/Development 等维度对照真实任务评分（而非盲评）。
  const exam = buildExamScoring(targetLanguage, nativeLanguage, targetExam, topic);
  const examBlock = exam.applies ? exam.block : '';
  const examJson = exam.applies ? exam.json : '';

  // 语体（口气）要求：题目标注了 register 才注入，避免污染无语体要求的自由写作。
  const registerBlock = register
    ? `- REGISTER / 语气要求：本题要求用 "${register}" register 写作（casual=口语随意 / neutral=中性日常 / polite=礼貌客气 / formal=正式书面 / business=商务专业）。请判断学生使用的口气是否得当：若该正式却太口语、或该商务却太随意，请在 suggestions 中给出语体修正建议，并在 registerNote 点评。若语体合适，registerNote 简短肯定即可。`
    : '';

  // 题目上下文：让 AI 知道学生被要求写什么，这对 Task Response / Development 等维度至关重要。
  const topicBlock = topic
    ? `\n    TOPIC / 题目：学生被要求围绕以下主题/题目写作 ——「${topic}」。\n    请在评分时重点评估学生是否回应了题目要求（Task Response / Task Achievement），内容是否切题、有无跑题或偏题。`
    : '';

  const prompt = `
    Act as a strict but encouraging language tutor. The student is learning ${targetLanguage} at CEFR level ${cefrLevel} (native language: ${nativeLanguage}).
    Review their writing sample. Identify errors and suggest improvements.
    ${topicBlock}

    IMPORTANT grading rules:
    - Evaluate at the student's declared level (${cefrLevel}). Do NOT penalize the absence of grammar/vocabulary above that level — a ${cefrLevel} learner is not expected to use advanced structures.
    - Focus feedback on errors typical of ${cefrLevel}: particles, polite form, basic word order, script orthography (kana/kanji spelling), agreement.
    - Be encouraging: in "generalComment", first state what they did well, then the single most important thing to improve.
    - Estimate the CEFR level of THIS sample honestly (it may differ from their declared level).
    ${examBlock}
    ${registerBlock}
    Text: "${text}"

    Explain all feedback, reasons for corrections, the general comment, and registerNote in ${nativeLanguage}.

    Return ONLY valid JSON. No Markdown.
    Structure:
    {
      "correctedText": "string (The corrected version in ${targetLanguage})",
      "suggestions": [ { "original": "string", "suggestion": "string", "reason": "string (in ${nativeLanguage})" } ],
      "generalComment": "string (in ${nativeLanguage})",
      "cefrEstimation": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"${examJson},
      "registerNote": "string (in ${nativeLanguage}: comment on whether the register/tone was appropriate for the task; if fine, affirm briefly)"
    }
  `;

  try {
    const responseText = await chatCompletionForTask('writingCritique', prompt, 0.2);
    const parsed = parseAIJSON<WritingFeedback>(responseText, {
        correctedText: text,
        suggestions: [],
        generalComment: "Analysis failed.",
        cefrEstimation: CEFRLevel.A1,
        examScores: null,
        registerNote: ''
    });
    // 兜底：非匹配/未实现考试强制清空 examScores（避免 AI 误带）
    if (!isExamApplicable(targetExam, targetLanguage)) parsed.examScores = null;
    return parsed;
  } catch (error) {
    console.error("Writing analysis error:", error);
    throw new Error("批改失败（AI 返回格式异常或网络问题）。请重试——不会扣除 XP 或记录趋势。");
  }
};

// 作文（长文）参考范文 / 提纲生成。长文允许范文（iron-rule 仅限手写特训模块），
// 故与微写作批改不同，这里按体裁/等级/语体产出一篇参考结构与范文，供学生搭建框架。
export const generateReferenceEssay = async (params: {
  topic: string;
  language: Language;
  nativeLanguage: Language;
  cefrLevel: CEFRLevel;
  genre: CompositionGenre;
  register?: WritingRegister;
  exam?: TargetExam;
}): Promise<ReferenceEssay> => {
  const { topic, language, nativeLanguage, cefrLevel, genre, register, exam } = params;
  const genreLabel = GENRE_LABELS[genre] ?? genre;
  const registerNote = register
    ? `请用 "${register}" 语体（口语/中性/礼貌/正式/商务）撰写。`
    : '';
  const examNote = exam && exam !== 'none' ? `（参考评分框架：${exam}）` : '';

  const system = `You are a model essay writer and writing coach for students learning ${language}. ` +
    `You write at CEFR level ${cefrLevel} and follow the requested genre and tone precisely.`;

  const prompt = `
    Write a MODEL ${genreLabel} in ${language} on the topic "${topic}".
    Target CEFR level: ${cefrLevel}. ${registerNote} ${examNote}

    Requirements:
    - The essay must be appropriate for a ${cefrLevel} learner of ${language}: natural but not overly advanced; clear structure; correct for the genre.
    - Length: roughly ${cefrLevel === CEFRLevel.A1 || cefrLevel === CEFRLevel.A2 ? '60-120' : cefrLevel === CEFRLevel.B1 ? '120-180' : cefrLevel === CEFRLevel.B2 ? '180-260' : '260-350'} words.
    - Provide BOTH:
      1) outline: 3-5 bullet points (in ${nativeLanguage}) describing how to structure the essay for this genre/topic.
      2) essay: the full model essay in ${language}.

    Return ONLY valid JSON. No Markdown.
    Structure:
    {
      "outline": string[]  // 提纲要点，用 ${nativeLanguage} 写，帮学生搭结构
      "essay": string      // 参考范文全文，用 ${language} 写
    }
  `;

  try {
    const responseText = await chatCompletionWithSystem(system, prompt);
    return parseAIJSON<ReferenceEssay>(responseText, { outline: [], essay: '' });
  } catch (error) {
    console.error("Reference essay generation error:", error);
    throw new Error("生成参考范文失败，请检查网络 / API Key 后重试。");
  }
};

// 二稿改写闭环：学生拿到首稿批改后重写，本函数对比「首稿 + 上次建议 + 二稿」，
// 判断哪些问题已修复、哪些仍在，并给出二稿的 CEFR 估算与总评。语言无关。
export const analyzeWritingRevision = async (
  originalText: string,
  revisedText: string,
  previousFeedback: WritingFeedback,
  targetLanguage: Language,
  nativeLanguage: Language,
  cefrLevel: CEFRLevel = CEFRLevel.A1,
  targetExam?: TargetExam,
  topic?: string
): Promise<WritingRevisionFeedback> => {
  const prevSummary = previousFeedback.suggestions
    .map((s) => `- 「${s.original}」→「${s.suggestion}」(${s.reason})`)
    .join("\n");

  // 考试评分（与首稿一致门控）：针对二稿评分，传入同一 topic 保持评分口径一致
  const exam = buildExamScoring(targetLanguage, nativeLanguage, targetExam, topic);
  const examBlock = exam.applies ? `\n    Score the REVISED draft using the criteria below.\n${exam.block}` : '';
  const examJson = exam.applies ? exam.json : '';

  const prompt = `
    Act as a strict but encouraging language tutor. The student is learning ${targetLanguage} at CEFR ${cefrLevel} (native: ${nativeLanguage}).
    They wrote a FIRST draft, you gave feedback, and they have now submitted a REVISED draft trying to apply it.

    PREVIOUS FEEDBACK (on the first draft):
    ${prevSummary || "(no specific corrections were listed)"}
    Previous general comment: ${previousFeedback.generalComment}

    FIRST DRAFT:
    """${originalText}"""

    REVISED DRAFT:
    """${revisedText}"""

    Tasks:
    1. Compare the revised draft to the previous feedback. Did the student FIX the issues you raised?
       - fixedIssues: problems from the previous feedback that are now resolved (in ${nativeLanguage}).
       - remainingIssues: errors still present in the revised draft, or new mistakes introduced (in ${nativeLanguage}).
    2. Give the best corrected version of the REVISED draft (correctedText).
    3. Estimate the CEFR level of the REVISED draft honestly (cefrEstimation).
    4. generalComment (in ${nativeLanguage}): state whether it improved overall, then the single next most important fix.
    5. improved: true only if the revised draft is clearly better than the first draft.
    ${examBlock}
    Explain all feedback and reasons in ${nativeLanguage}.
    Return ONLY valid JSON. No Markdown.
    Structure:
    {
      "correctedText": "string",
      "suggestions": [ { "original": "string", "suggestion": "string", "reason": "string (in ${nativeLanguage})" } ],
      "generalComment": "string (in ${nativeLanguage})",
      "cefrEstimation": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "fixedIssues": ["string (in ${nativeLanguage})"],
      "remainingIssues": ["string (in ${nativeLanguage})"],
      "improved": boolean${examJson}
    }
  `;

  try {
    const responseText = await chatCompletionForTask('writingCritique', prompt, 0.2);
    const parsed = parseAIJSON<WritingRevisionFeedback>(responseText, {
      correctedText: revisedText,
      suggestions: [],
      generalComment: "分析失败。",
      cefrEstimation: CEFRLevel.A1,
      fixedIssues: [],
      remainingIssues: [],
      improved: false,
      examScores: null,
    });
    // 兜底：保证数组字段存在；非雅思场景强制清空 examScores
    parsed.fixedIssues = parsed.fixedIssues ?? [];
    parsed.remainingIssues = parsed.remainingIssues ?? [];
    if (!isExamApplicable(targetExam, targetLanguage)) parsed.examScores = null;
    return parsed;
  } catch (error) {
    console.error("Writing revision analysis error:", error);
    throw new Error("Failed to analyze revision.");
  }
};

export const generateWordDetails = async (word: string, targetLang: Language, nativeLang: Language): Promise<{ definition: string; example: string; partOfSpeech: string }> => {
  const prompt = `
    I am learning ${targetLang}. 
    Provide the details for the word "${word}".
    
    Return ONLY valid JSON. No Markdown.
    Structure:
    {
      "definition": "Explanation in ${nativeLang} (concise)",
      "example": "A good usage example in ${targetLang}",
      "partOfSpeech": "Noun, Verb, etc."
    }
  `;

  try {
    const responseText = await chatCompletionForTask('vocabExtract', prompt);
    return parseAIJSON(responseText, { 
        definition: "Auto-generation failed", 
        example: "", 
        partOfSpeech: "Unknown" 
    });
  } catch (error) {
    console.error("Word details error:", error);
    return { definition: "Auto-generation failed", example: "", partOfSpeech: "Unknown" };
  }
};

// 选词结果：AI 既挑「值得学的难点词/专业词」，又顺带给出释义例句，一次调用拿全部。
export interface SelectedWord {
  word: string;
  definition: string;
  example: string;
  partOfSpeech: string;
}

/**
 * 从一段正文里挑出「值得学」的词——而非最高频的词。
 * 偏好：难词/低频词、领域术语/专业词汇、含义微妙的高级词。
 * 排除：高频功能词（the/and/of…）、基础日常词、专有名词/品牌名、词缀碎屑。
 * 网络/JSON 异常时返回空数组，由调用方回落本地启发式。
 */
export const selectVocabularyWords = async (
  text: string,
  targetLang: Language,
  nativeLang: Language,
  cefrLevel?: string
): Promise<SelectedWord[]> => {
  const level = cefrLevel || "B1";
  const system =
    `You are a vocabulary curator for language learners. Given a passage, you pick the words most worth learning — NOT the most frequent ones.\n` +
    `Rules:\n` +
    `- PREFER: advanced or rare words, domain-specific jargon, professional/technical terms, words with subtle meaning, low-frequency academic vocabulary.\n` +
    `- AVOID: common high-frequency function words (the, and, of, to…), basic everyday words, proper nouns/names/brands, and affix fragments.\n` +
    `- Choose up to 12 words a ${level} learner would genuinely benefit from adding to their study deck.\n` +
    `- Each "word" must be a single clean token exactly as it appears in the text (use the base/lemma form if obvious); no multi-word phrases.\n` +
    `Return ONLY valid JSON. No Markdown. Structure:\n` +
    `[\n` +
    `  { "word": "string", "definition": "concise meaning in ${nativeLang}", "example": "a natural usage sentence in ${targetLang}", "partOfSpeech": "noun/verb/adjective/..." }\n` +
    `]`;
  const prompt = `Passage (${targetLang}):\n"""\n${text.slice(0, 4000)}\n"""\n\nSelect the best vocabulary words to learn from this passage.`;
  try {
    const raw = await chatCompletionWithSystemForTask('vocabExtract', system, prompt, 0.3);
    const arr = parseAIJSON<SelectedWord[]>(raw, []);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((w) => w && typeof w.word === "string" && w.word.trim())
      .map((w) => ({
        word: w.word.trim(),
        definition: w.definition || "",
        example: w.example || "",
        partOfSpeech: w.partOfSpeech || "",
      }));
  } catch (e) {
    console.warn("[LinguaFlow] selectVocabularyWords failed:", e);
    return [];
  }
};


// 引导式微写作：按模式上下文校验学习者的一句话/短文
// mode='scaffold': context = { template, hint }  句型填空
// mode='wordchain': context = { words: [{word,meaning}] }  看词造句
// mode='prompt': context = { situation }  情境一句
export interface GuidedContext {
  template?: string;
  hint?: string;
  words?: Array<{ word: string; meaning: string }>;
  situation?: string;
  register?: string; // 要求语体/口气（中文标签，如「正式」「商务」）
}

export const analyzeGuidedWriting = async (
  text: string,
  targetLanguage: Language,
  nativeLanguage: Language,
  cefrLevel: CEFRLevel,
  mode: GuidedMode,
  ctx: GuidedContext,
  targetExam?: TargetExam
): Promise<GuidedWritingFeedback> => {
  let modeDesc = '';
  if (mode === 'scaffold') {
    modeDesc = `句型填空模式。模板：「${ctx.template ?? ''}」（提示：${ctx.hint ?? ''}）。学生应把 ___ 替换成合理内容并写出完整句。判断填空是否合理、整句语法是否正确。`;
  } else if (mode === 'wordchain') {
    const ws = (ctx.words ?? []).map((w) => `${w.word}(${w.meaning})`).join('、');
    modeDesc = `看词造句模式。要求用以下词造一句话：${ws}。判断是否合理使用了这些词、语法是否正确。`;
  } else if (mode === 'prompt') {
    modeDesc = `情境一句模式。情境：「${ctx.situation ?? ''}」。学生用目标语言写 1-3 句回应。`;
  } else {
    modeDesc = `重写打磨模式。学生提交的是对某篇作品的「重写稿」，而非初次起草。重写任务目标：「${ctx.hint ?? ''}」。
请分两个层次评价，且两层必须分开：
(1) 重写层面（revision 字段）：只关注读者 / 目的 / 内容 / 结构——这次重写是否让文章更清楚、更贴合目标读者与写作目的、结构更合理？给出本次重写最核心的一个焦点（focus），以及 2–4 条具体可操作的重写建议（points，每条含 point 标题与 detail 说明）。不要在这里改语法。
  若某条建议能明确归到某一弱项维度，请在该条 point 上附带 type 字段，取值仅限："content"（内容/选材：偏题、缺细节、无例子）、"structure"（结构/组织：段落混乱、缺逻辑连接、顺序不当）、"reader_awareness"（读者意识/目的：语体错配、未考虑读者、开头/结尾抓不住人）。拿不准就省略 type。
(2) 语言精修层面（issues 字段）：仍要检查句子准确度、用词、语法、拼写，给出需要修正的具体问题（original/fix/reason）。这一层与重写建议必须分离。`;
  }

  // 语体/口气要求：若指定，让教练额外评估表达是否得体
  let registerDesc = '';
  if (ctx.register) {
    registerDesc = `要求语体/口气：${ctx.register}。请判断学生的表达是否符合该语体：本该正式/商务却过于口语，或本该口语却过于生硬，都算语体不当。若不当，请在 issues 中给出语体修正建议，并在 registerNote 中说明。`;
  }

  // 考试评分：复用 analyzeWriting 的 buildExamScoring（按语言严格门控）。
  // 仅当 targetExam 与学习语言匹配时注入评分指令与 JSON 字段；否则留空（回落通用反馈）。
  const exam = buildExamScoring(targetLanguage, nativeLanguage, targetExam);
  const examBlock = exam.applies ? exam.block : '';
  const examJson = exam.applies ? exam.json : '';

  // 重写模式：返回 JSON 中额外带 revision（读者/目的/内容/结构 层面的重写建议）
  const revisionStruct = mode === 'revision'
    ? `\n      "revision": { "focus": "string (重写核心焦点，in ${nativeLanguage})", "points": [ { "point": "string (建议标题)", "detail": "string (说明，in ${nativeLanguage})", "type"?: "content" | "structure" | "reader_awareness" } ] },`
    : '';

  const prompt = `
    Act as a strict but encouraging language tutor. The student is learning ${targetLanguage} at CEFR ${cefrLevel} (native: ${nativeLanguage}).
    ${modeDesc}
    ${registerDesc}
    ${examBlock}

    Student's writing: "${text}"

    Judge whether the writing is acceptable: meaning conveyed AND grammar mostly correct for CEFR ${cefrLevel}. Be lenient on structures above this level (do not require them). Focus on ${cefrLevel}-typical errors: particles, polite form, word order, script orthography.

    Return ONLY valid JSON. No Markdown.
    Structure:
    {
      "isCorrect": boolean,
      "correctedText": "string (corrected version in ${targetLanguage})",
      "issues": [ { "original": "string", "fix": "string (in ${targetLanguage})", "reason": "string (in ${nativeLanguage})" } ],
      "encouragement": "string (in ${nativeLanguage}: first praise what they did well, then state the single most important fix)",
      "cefrEstimation": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "registerNote": "string (in ${nativeLanguage}: 语体/口气是否得当的简短点评，无问题可为空字符串)"${revisionStruct}${examJson}
    }
  `;

  try {
    const responseText = await chatCompletionForTask('writingCritique', prompt, 0.2);
    const parsed = parseAIJSON<GuidedWritingFeedback>(responseText, {
      isCorrect: false,
      correctedText: text,
      issues: [],
      encouragement: '批改失败，请重试。',
      cefrEstimation: CEFRLevel.A1,
      registerNote: '',
      revision: undefined,
      examScores: null,
    });
    // 兜底：非匹配语言 / 未指定考试 时强制清空 examScores（避免 AI 误带）
    if (!isExamApplicable(targetExam, targetLanguage)) parsed.examScores = null;
    return parsed;
  } catch (error) {
    console.error('Guided writing analysis error:', error);
    throw new Error('Failed to analyze guided writing.');
  }
};

// 看词造句：AI 生成若干适合该等级的常用词（带母语释义），供学习者造句
export const generateSentenceWords = async (
  targetLanguage: Language,
  nativeLanguage: Language,
  cefrLevel: CEFRLevel
): Promise<Array<{ word: string; meaning: string }>> => {
  const prompt = `
    Give 3 common ${cefrLevel}-level ${targetLanguage} words that a learner could use to form a simple sentence.
    For each, provide the word in ${targetLanguage} and a concise meaning in ${nativeLanguage}.
    Pick concrete, everyday words (nouns/verbs/adjectives) that combine naturally into one sentence.

    Return ONLY valid JSON. No Markdown.
    Structure:
    { "words": [ { "word": "string", "meaning": "string" } ] }
  `;
  try {
    const responseText = await chatCompletionForTask('typing', prompt);
    const parsed = parseAIJSON<{ words: Array<{ word: string; meaning: string }> }>(responseText, { words: [] });
    return parsed.words ?? [];
  } catch (error) {
    console.error('Generate sentence words error:', error);
    return [];
  }
};

// --- Text-to-Speech (Qwen qwen3-tts-flash, multilingual + Web Speech fallback) ---
// qwen3-tts-flash is a single multilingual model covering zh/en/ja/ko/ru/etc.
// We stream it from Qwen; for any language (or if the cloud call fails) we fall
// back to the browser's built-in SpeechSynthesis (keyless, multilingual).
const SPEECH_LANG_MAP: Record<string, string> = {
  English: "en-US",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Chinese: "zh-CN",
  Italian: "it-IT",
  Russian: "ru-RU",
  Greek: "el-GR",
  Arabic: "ar-SA",
};

export const languageToSpeechLang = (lang: Language): string => SPEECH_LANG_MAP[lang] || "en-US";

let currentQwenAudio: HTMLAudioElement | null = null;

export const cancelSpeech = (): void => {
  if (currentQwenAudio) {
    currentQwenAudio.pause();
    currentQwenAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * 暂停当前朗读（保留音频位置，可 resumeSpeech 续播）。
 * 与 cancelSpeech 的区别：cancel 会丢弃 audio 元素，只能从头重播。
 * 返回 true 表示确实暂停了某个音源。
 */
export const pauseSpeech = (): boolean => {
  if (currentQwenAudio && !currentQwenAudio.paused) {
    currentQwenAudio.pause();
    return true;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      return true;
    }
  }
  return false;
};

/** 从暂停位置续播。返回 true 表示确实恢复了某个音源。 */
export const resumeSpeech = (): boolean => {
  if (currentQwenAudio && currentQwenAudio.paused) {
    currentQwenAudio.play().catch(() => { /* autoplay 限制等，忽略 */ });
    return true;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
      return true;
    }
  }
  return false;
};

/** 当前是否有「已暂停但尚未销毁」的音源（用于决定按钮是续播还是重播）。 */
export const hasPausedSpeech = (): boolean => {
  if (currentQwenAudio && currentQwenAudio.paused && currentQwenAudio.currentTime > 0) return true;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return window.speechSynthesis.paused;
  }
  return false;
};

/**
 * 调用 Qwen3-TTS（multimodal-generation 端点）。
 * 关键点：模型名 + voice 都在 input 里，端点不是老的 /SpeechSynthesizer。
 * 返回的 URL 是 DashScope OSS 上的预签名 URL（24h 内有效），可重复播放直到过期。
 * 错误抛异常；调用方负责缓存与回退。
 */
async function fetchQwenTtsUrl(text: string, voice: string): Promise<string> {
  const res = await fetch(`${QWEN_HOST}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${QWEN_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: QWEN_TTS_MODEL,
      input: { text, voice },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Qwen TTS failed (${res.status}): ${data?.message || ""}`);
  }
  const url = data?.output?.audio?.url;
  const b64 = data?.output?.audio?.data;
  if (url) return url;
  if (b64) return `data:audio/wav;base64,${b64}`;
  throw new Error(`No audio returned from Qwen TTS: ${data?.message || "unknown"}`);
}

/** 当前生效音色：用户在「模型设置」里选的，回落到 .env，再回落到 Cherry。 */
function currentTtsVoice(): string {
  try {
    return getAIConfig().ttsVoice || process.env.QWEN_TTS_VOICE || "Cherry";
  } catch {
    return process.env.QWEN_TTS_VOICE || "Cherry";
  }
}

/** 供设置页试听用：直接指定音色朗读一段样例。 */
export const previewVoice = (voice: string, text: string): Promise<void> => {
  cancelSpeech();
  return fetchQwenTtsUrl(text, voice).then((url) => {
    playQwenAudio(url);
  });
};

/**
 * 暴露给上层组件（如 TtsAudioPlayer）以便自己控制 <audio> 元素的播放器。
 * - 若有 Qwen key 且 TTS 返回成功 → 返回 CDN 上的 mp3 URL（24h 内可重复播放，无需再次调用接口）；
 * - 否则返回 null（调用方可降级到 Web Speech / 错误提示）。
 *
 * @param text 待合成文本
 * @param voice 指定音色；留空则用用户设置里的 ttsVoice
 */
export const fetchSpeechUrl = async (text: string, voice?: string): Promise<string | null> => {
  const t = (text || "").trim();
  if (!t) return null;
  if (!QWEN_API_KEY) return null;
  try {
    return await fetchQwenTtsUrl(t, voice || currentTtsVoice());
  } catch (e) {
    console.warn("Qwen TTS (fetchSpeechUrl) failed:", e);
    return null;
  }
};

function playQwenAudio(url: string, opts?: { rate?: number; onStart?: () => void; onEnd?: () => void }): void {
  const audio = new Audio();
  currentQwenAudio = audio;
  if (typeof opts?.rate === "number") audio.playbackRate = opts.rate;
  audio.onplay = () => opts?.onStart?.();
  audio.onended = () => { currentQwenAudio = null; opts?.onEnd?.(); };
  audio.onerror = () => { currentQwenAudio = null; opts?.onEnd?.(); };
  audio.src = url;
  audio.play().catch(() => { currentQwenAudio = null; opts?.onEnd?.(); });
}

// 按文本内容判定语言（而非依赖用户「学习语言」）。
// 这样学中文却练英文材料、或导入英文文章时，也能正确走 Qwen 英文 TTS。
function detectContentLanguage(text: string): Language | null {
  const s = text.trim();
  if (!s) return null;
  let latin = 0, han = 0, kana = 0, hangul = 0, cyrillic = 0, arabic = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) latin++;
    else if (cp >= 0x4e00 && cp <= 0x9fff) han++;        // CJK 统一表意（汉字）
    else if (cp >= 0x3040 && cp <= 0x30ff) kana++;          // 平假名 + 片假名
    else if (cp >= 0xac00 && cp <= 0xd7a3) hangul++;        // 谚文
    else if (cp >= 0x0400 && cp <= 0x04ff) cyrillic++;      // 西里尔
    else if (cp >= 0x0600 && cp <= 0x06ff) arabic++;        // 阿拉伯
  }
  // 优先按「出现的脚本」判定；混合文本取最强信号
  if (kana > 0) return Language.Japanese;
  if (hangul > 0) return Language.Korean;
  if (han > 0) return Language.Chinese;
  if (latin > 0) return Language.English;
  if (cyrillic > 0) return Language.Russian;
  if (arabic > 0) return Language.Arabic;
  return null;
}

function playWebSpeech(text: string, opts?: { lang?: Language; rate?: number; onStart?: () => void; onEnd?: () => void }): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("Web Speech API is not supported in this browser.");
    opts?.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.substring(0, 1000));
  if (opts?.lang) utterance.lang = languageToSpeechLang(opts.lang);
  if (typeof opts?.rate === "number") utterance.rate = opts.rate;
  utterance.onstart = () => opts?.onStart?.();
  utterance.onend = () => opts?.onEnd?.();
  synth.speak(utterance);
}

export const generateSpeech = (
  text: string,
  opts?: { lang?: Language; rate?: number; onStart?: () => void; onEnd?: () => void }
): void => {
    if (!text || !text.trim()) {
      opts?.onEnd?.();
      return;
    }
    cancelSpeech();

    // qwen3-tts-flash 一个模型覆盖中/英/日/韩/俄等多语种，无需按语言换模型。
    // 语种检测仅用于：Qwen 不可用时，给浏览器 Web Speech 兜底选对音色语言。
    const contentLang = detectContentLanguage(text) ?? opts?.lang ?? Language.English;

    if (!QWEN_API_KEY) {
      playWebSpeech(text, { ...opts, lang: contentLang });
      return;
    }

    fetchQwenTtsUrl(text, currentTtsVoice())
      .then((url) => playQwenAudio(url, opts))
      .catch((e) => {
        console.warn("Qwen TTS failed, falling back to Web Speech:", e);
        playWebSpeech(text, { ...opts, lang: contentLang });
      });
};

/**
 * 带缓存的语音播放：同一段文本第二次点播放 → 0 API 调用，秒播。
 *
 * 与 generateSpeech 区别：generateSpeech 每次都打 Qwen；playCachedSpeech 按
 * (text, voice) 命中本地缓存 → 直返 CDN URL。命中失败/Qwen 不可用 → Web Speech 兜底。
 */
export const playCachedSpeech = async (
  text: string,
  opts?: { lang?: Language; rate?: number; voice?: string; onStart?: () => void; onEnd?: () => void }
): Promise<void> => {
  if (!text || !text.trim()) {
    opts?.onEnd?.();
    return;
  }
  cancelSpeech();

  // 查缓存（动态 import 避免循环依赖加载顺序问题；运行时就是同步拿函数）
  const cacheMod = await import("./ttsCache");
  const hit = cacheMod.getCachedTtsUrl(text, opts?.voice);
  if (hit) {
    playQwenAudio(hit, opts);
    return;
  }

  const contentLang = detectContentLanguage(text) ?? opts?.lang ?? Language.English;

  if (!QWEN_API_KEY) {
    playWebSpeech(text, { ...opts, lang: contentLang });
    return;
  }

  fetchQwenTtsUrl(text, opts?.voice || currentTtsVoice())
    .then((url) => {
      if (!url) {
        playWebSpeech(text, { ...opts, lang: contentLang });
        return;
      }
      cacheMod.setCachedTtsUrl(text, opts?.voice, url);
      playQwenAudio(url, opts);
    })
    .catch((e) => {
      console.warn("Qwen TTS (cached) failed, falling back to Web Speech:", e);
      playWebSpeech(text, { ...opts, lang: contentLang });
    });
};

// --- 单单词发音（语种门控）---
// 设计目标：让「点一个词听发音」走最优音源，而非无脑打 Qwen（需 key、且句子级合成对单
// 词不一定最准）。实测有道 dictvoice 免费、无需鉴权、真人词典音质、跨设备一致，最适合补
// 英文单词发音；但它是英汉词典，对日语不可靠，故日语走 Web Speech ja-JP。
//   英 → 有道 dictvoice（type=2 英式 / type=1 美式，无需 API key）
//   中 → Qwen TTS（可控音色；无 key 自动回退 Web Speech）
//   日 → Web Speech ja-JP（有道不可靠）
//   其他语言 → 沿用既有策略（Qwen 若有 key，否则 Web Speech 选对语种）
const YOUDAO_DICTVOICE = "https://dict.youdao.com/dictvoice";

function playYoudaoWord(word: string, accent: "uk" | "us" = "uk"): void {
  const type = accent === "us" ? 1 : 2; // 1=美式 US，2=英式 UK（IELTS 默认英式）
  // 实测响应无 access-control-* 头，但 <audio> 直接播放不强制 CORS，无需额外处理。
  const url = `${YOUDAO_DICTVOICE}?audio=${encodeURIComponent(word)}&type=${type}`;
  const audio = new Audio();
  currentQwenAudio = audio; // 复用 cancelSpeech 的中断机制；speechSynthesis.cancel 对纯 audio 无副作用
  audio.onended = () => { if (currentQwenAudio === audio) currentQwenAudio = null; };
  const fallback = () => {
    if (currentQwenAudio === audio) currentQwenAudio = null;
    playWebSpeech(word, { lang: Language.English }); // 有道限频/网络抖动 → 浏览器兜底
  };
  audio.onerror = fallback;
  audio.src = url;
  audio.play().catch(fallback); // 自动播放限制 / 解码失败
}

/**
 * 播放单个单词/短语的发音，按语种选最优音源。
 * @param word 待发音词（可含空格的短语）
 * @param lang 该词的语种（决定走有道/Qwen/Web Speech）
 * @param accent 仅英文生效：'uk' 英式（默认）| 'us' 美式
 */
export const playWord = (
  word: string,
  lang: Language,
  accent: "uk" | "us" = "uk"
): void => {
  if (!word || !word.trim()) return;
  cancelSpeech();
  const w = word.trim();

  if (lang === Language.Chinese) {
    fetchSpeechUrl(w)
      .then((url) => (url ? playQwenAudio(url) : playWebSpeech(w, { lang })))
      .catch(() => playWebSpeech(w, { lang }));
    return;
  }

  if (lang === Language.Japanese) {
    playWebSpeech(w, { lang }); // 有道英汉词典对日语不靠谱
    return;
  }

  if (lang === Language.English) {
    playYoudaoWord(w, accent);
    return;
  }

  // 其他语言（韩/西/法/德/意/俄/希/阿）：沿用既有策略
  generateSpeech(w, { lang });
};

// --- Reading Reflection AI ---

export const analyzeReadingContent = async (text: string, language: Language, nativeLanguage: Language): Promise<Partial<ReadingReflection>> => {
    const prompt = `
      Analyze the following ${language} text.
      Identify:
      1. The Main Topic.
      2. Key Points / Most impressive point.
      3. Examples given in the text.
      4. A one-sentence summary.
      
      Respond in ${nativeLanguage} so the user can understand easily.

      Text: "${text.substring(0, 4000)}"

      Return ONLY valid JSON. No Markdown.
      Structure:
      {
        "topic": "string",
        "impressivePoint": "string",
        "examples": "string",
        "summary": "string"
      }
    `;

    try {
        const responseText = await chatCompletionForTask('articleGuide', prompt);
        return parseAIJSON(responseText, {
            topic: "",
            impressivePoint: "",
            examples: "",
            summary: ""
        });
    } catch (error) {
        console.error("Reflection analysis error:", error);
        return {};
    }
};

// --- Writing Tree AI Services ---

export const generateTreeStructure = async (rootTitle: string, language: Language): Promise<Array<{ title: string; type: string }>> => {
    const prompt = `
        I am writing a project titled "${rootTitle}" in ${language}.
        Generate a structural outline (chapters or main sections).
        
        Return ONLY valid JSON array of objects. No Markdown.
        Structure:
        [
          { "title": "string", "type": "chapter" | "section" }
        ]
    `;
    
    try {
        const responseText = await chatCompletionForTask('writingCritique', prompt);
        return parseAIJSON(responseText, []);
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const classifyInspiration = async (text: string, existingNodes: WritingNode[], language: Language): Promise<{ suggestedParentTitle: string; rationale: string; refinedTitle?: string; refinedContent?: string }> => {
    // Simplify tree for context token limit
    const simpleTree = existingNodes.map(n => ({ id: n.id, title: n.title, type: n.type }));
    
    const prompt = `
        I have a raw idea/snippet for my writing project in ${language}:
        "${text.substring(0, 3000)}"

        Here is my current writing tree structure: ${JSON.stringify(simpleTree)}.
        
        Task:
        1. Determine where this snippet belongs. Suggest the best existing parent Node Title.
        2. Generate a concise, descriptive Title for this new node.
        3. Refine the Content: Fix grammar, improve clarity, and format it nicely (e.g. use markdown lists if applicable), but preserve the original meaning.

        Return ONLY valid JSON. No Markdown.
        Structure:
        {
          "suggestedParentTitle": "string",
          "refinedTitle": "string",
          "refinedContent": "string",
          "rationale": "string"
        }
    `;
    
    try {
         const responseText = await chatCompletionForTask('writingCritique', prompt);
         const result = parseAIJSON(responseText, { 
            suggestedParentTitle: "Inspiration Box", 
            refinedTitle: "New Idea", 
            refinedContent: text, 
            rationale: "Could not classify." 
         });
        
        // Fallbacks if AI returns nulls
        if (!result.refinedContent) result.refinedContent = text;
        if (!result.refinedTitle) result.refinedTitle = "New Idea";
        
        return result;
    } catch (error) {
        return { 
            suggestedParentTitle: "Inspiration Box", 
            refinedTitle: "New Idea", 
            refinedContent: text, 
            rationale: "Error calling AI." 
        };
    }
};

export const polishText = async (text: string, language: Language): Promise<string> => {
    const prompt = `
        Act as a professional editor. 
        Refine the following ${language} text to be clearer, grammatically correct, and better formatted (e.g. use markdown if helpful), while preserving the original meaning.
        
        Text: "${text.substring(0, 3000)}"
        
        STRICT OUTPUT RULES:
        1. Return ONLY the refined text.
        2. DO NOT include introductory phrases like "Here is the refined text".
        3. DO NOT wrap the output in quotes.
        4. DO NOT wrap the output in markdown code blocks unless the text itself is code.
    `;
    
    try {
        const responseText = await chatCompletionForTask('writingCritique', prompt);
        
        // Cleanup response: Remove "Here is...", remove quotes, remove ```
        let refined = responseText?.trim() || text;
        refined = refined.replace(/^Here is the.*?:\s*/i, '');
        refined = refined.replace(/^Refined.*:\s*/i, '');
        // Remove surrounding quotes if they exist and cover the whole string
        if (refined.startsWith('"') && refined.endsWith('"')) {
            refined = refined.slice(1, -1);
        }
        // Remove markdown blocks if checking strict text
        refined = refined.replace(/```/g, '');
        
        return refined.trim();
    } catch (error) {
        console.error("Polish error:", error);
        return text;
    }
};

export const getWritingCoachFeedback = async (node: WritingNode, language: Language): Promise<string> => {
    const prompt = `
        Act as a professional editor and writing coach for ${language}.
        Analyze this specific section of the user's project.
        
        Title: ${node.title}
        Type: ${node.type}
        Content: "${node.content}"
        
        Provide:
        1. A brief critique of the structure and flow.
        2. Suggestions for expansion or refinement.
        3. A "Reader's Perspective" comment.
        
        Keep it concise and encouraging. Formatted in Markdown.
    `;
    
    try {
        const responseText = await chatCompletionForTask('writingCritique', prompt);
        return responseText || "No feedback available.";
    } catch (error) {
        return "Coach is currently unavailable.";
    }
};

// --- RPG System AI ---

export const startRPGScenario = async (
    theme: string,
    level: CEFRLevel,
    language: Language,
    nativeLanguage: Language,
    systemContext?: string,
    scenarioDef?: ScenarioDef
): Promise<RPGScenario> => {
    // 预置剧本：用结构化字段保证质量与人设稳定，只让 AI 生成开场白
    if (scenarioDef) {
        const characterNote = scenarioDef.character
            ? `\nYou are playing: ${scenarioDef.character.name} — ${scenarioDef.character.persona}`
            : '';
        const inspireNote = scenarioDef.inspiredBy
            ? `\nThis scene is inspired by ${scenarioDef.inspiredBy}. Do NOT reproduce any copyrighted lines; improvise original dialogue that fits the vibe and stays in character.`
            : '';
        const prompt = `
            Open this role-play scene in ${language} for a student at ${level} level.
            Scene description: ${scenarioDef.context}
            The user is playing: ${scenarioDef.userRole}
            ${characterNote}${inspireNote}
            User's objectives for this scene (in ${nativeLanguage}): ${scenarioDef.objectives.join('; ')}
            Stay in character and set the scene naturally.

            Return ONLY valid JSON.
            Structure:
            {
              "initialMessage": "Your first line of dialogue to open the scene (in ${language})",
              "initialPhonetic": "Phonetic guide/Romaji/Pinyin for the initial message",
              "initialSuggestedReply": "A simple suggested response for the user to start (in ${language})",
              "initialSuggestedReplyPhonetic": "Phonetic guide/Romaji/Pinyin for the initial suggested reply"
            }
        `;
        try {
            const responseText = systemContext
                ? await chatCompletionWithSystem(systemContext, prompt)
                : await chatCompletionForTask('typing', prompt);
            const generated = parseAIJSON(responseText, {
                initialMessage: '...',
                initialSuggestedReply: '你好！',
                initialPhonetic: undefined,
                initialSuggestedReplyPhonetic: undefined,
            });
            return {
                id: scenarioDef.id,
                theme: theme,
                title: scenarioDef.title,
                context: scenarioDef.context,
                userRole: scenarioDef.userRole,
                aiRole: scenarioDef.aiRole,
                initialMessage: generated.initialMessage || '...',
                initialPhonetic: generated.initialPhonetic,
                initialSuggestedReply: generated.initialSuggestedReply || '你好！',
                initialSuggestedReplyPhonetic: generated.initialSuggestedReplyPhonetic,
                objectives: scenarioDef.objectives,
                difficulty: level,
                universe: theme,
                inspiredBy: scenarioDef.inspiredBy,
                character: scenarioDef.character,
            };
        } catch (error) {
            console.error("RPG Start (def) error:", error);
            throw new Error("Failed to start RPG.");
        }
    }

    // 旧逻辑：仅给主题词，由 AI 自由生成
    const prompt = `
        Create a Role-Playing Game Scenario in ${language} for a student at ${level} level.
        Theme: ${theme}.
        
        The goal is to help the user practice natural conversation.
        
        Return ONLY valid JSON.
        Structure:
        {
          "title": "A catchy title",
          "context": "Set the scene in ${language} (1-2 sentences)",
          "userRole": "Who is the user playing as?",
          "aiRole": "Who are you playing as?",
          "initialMessage": "Your first line of dialogue to start the scene (in ${language})",
          "initialPhonetic": "Phonetic guide/Romaji/Pinyin for the initial message",
          "initialSuggestedReply": "A simple suggested response for the user to start (in ${language})",
          "initialSuggestedReplyPhonetic": "Phonetic guide/Romaji/Pinyin for the initial suggested reply",
          "objectives": ["Objective 1 (in ${nativeLanguage})", "Objective 2 (in ${nativeLanguage})"]
        }
    `;
    
  try {
        const responseText = systemContext
            ? await chatCompletionWithSystem(systemContext, prompt)
            : await chatCompletionForTask('typing', prompt);
        return parseAIJSON(responseText, {
            id: 'error',
        theme: theme,
        title: 'Generation Failed',
        context: 'Please try again.',
        userRole: 'Student',
        aiRole: 'Teacher',
        initialMessage: 'System Error.',
        objectives: [],
        difficulty: level
    });
  } catch (error) {
    console.error("RPG Start error:", error);
    throw new Error("Failed to start RPG.");
  }
};

export const continueRPGTurn = async (
    scenario: RPGScenario,
    chatHistory: { sender: 'user' | 'ai'; text: string }[],
    userInput: string,
    language: Language,
    nativeLanguage: Language,
    systemContext?: string
): Promise<RPGTurnResult> => {
    // Keep context manageable (last 10 turns)
    const recentHistory = chatHistory.slice(-10);
    
    const prompt = `
        You are playing the role of "${scenario.aiRole}" in a scenario titled "${scenario.title}".
        The user is "${scenario.userRole}".
        Language: ${language}. Level: ${scenario.difficulty}.
        
        Current Objectives: ${JSON.stringify(scenario.objectives)}.
        
        Conversation History:
        ${recentHistory.map(m => `${m.sender}: ${m.text}`).join('\n')}
        User: ${userInput}
        
        Task:
        1. Respond naturally as your character. Keep it concise (2-4 sentences).
        2. Check if the user's latest input completes any objectives.
        3. Identify 1-3 useful vocabulary words from YOUR response or the USER's input that are good for this level.
        4. Decide if the scenario has reached a logical conclusion.
        5. Provide brief feedback if the user made a major grammar mistake (in ${nativeLanguage}), otherwise leave empty.
        6. Provide a "suggestedUserReply": A simple, natural sentence the user could say next in ${language}.
        7. Provide "phonetic": The phonetic guide/Romaji/Pinyin for YOUR response.
        8. Provide "suggestedUserReplyPhonetic": The phonetic guide/Romaji/Pinyin for the suggested user reply.
        9. Provide "choices": 2-3 short, distinct next actions the user might take to advance the story (each under 8 words, in ${language}). These are optional decision points that branch the narrative.

        Return ONLY valid JSON.
        Structure:
        {
          "aiReply": "Your response in ${language}",
          "phonetic": "Phonetic guide for aiReply",
          "translation": "Translation of your response in ${nativeLanguage}",
          "suggestedUserReply": "A suggested next response for the user (in ${language})",
          "suggestedUserReplyPhonetic": "Phonetic guide for suggestedUserReply",
          "completedObjectives": ["Objective text exactly as in list if completed"],
          "vocabulary": [{ "word": "string", "meaning": "string in ${nativeLanguage}" }],
          "isScenarioComplete": boolean,
          "feedback": "string or null",
          "choices": ["option 1", "option 2"]
        }
    `;

  try {
    const responseText = systemContext
        ? await chatCompletionWithSystem(systemContext, prompt)
        : await chatCompletionForTask('typing', prompt);
    return parseAIJSON(responseText, {
        aiReply: "...",
        translation: "...",
        completedObjectives: [],
        vocabulary: [],
        isScenarioComplete: false,
        feedback: null,
        choices: []
    });
  } catch (error) {
    console.error("RPG Turn error:", error);
         return {
            aiReply: "I didn't catch that. Could you repeat?",
            translation: "Error",
            completedObjectives: [],
            vocabulary: [],
            isScenarioComplete: false
        };
    }
};
