
import { Language, CEFRLevel, AssessmentResult, TypingContent, WritingFeedback, WritingNode, NodeType, ReadingReflection, RPGScenario, RPGTurnResult } from '../types';

// --- Qwen (DashScope) + OpenRouter configuration ---
// Primary LLM provider: Alibaba Cloud DashScope "Qwen" via its OpenAI-compatible
// chat completions endpoint. TTS uses sambert-zhide-v1; STT uses paraformer-v2.
// When Qwen's quota/rate-limit is exhausted, requests fall back to OpenRouter.
const QWEN_BASE_URL =
  (typeof process !== "undefined" && process.env && process.env.QWEN_BASE_URL) ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_API_KEY =
  (typeof process !== "undefined" && process.env && process.env.QWEN_API_KEY) || "";
if (!QWEN_API_KEY) {
  console.warn("[LinguaFlow] QWEN_API_KEY is not set. Copy .env.example to .env and add your DashScope API key.");
}
const QWEN_LLM_MODEL = "qwen3.7-flash-2026-07-15";

// Derive the DashScope host for TTS/STT endpoints (which live outside /compatible-mode).
const QWEN_HOST = QWEN_BASE_URL.replace(/\/compatible-mode\/v1\/?$/, "");

// Fallback provider (used when Qwen quota/rate-limit is hit).
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_API_KEY =
  (typeof process !== "undefined" && process.env && process.env.API_KEY) || "";
const OPENROUTER_LLM_MODEL = "google/gemini-2.5-flash";

interface LLMProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
  { name: "qwen", baseUrl: QWEN_BASE_URL, apiKey: QWEN_API_KEY, model: QWEN_LLM_MODEL },
  { name: "openrouter", baseUrl: OPENROUTER_BASE_URL, apiKey: OPENROUTER_API_KEY, model: OPENROUTER_LLM_MODEL },
];

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

const callProvider = async (p: LLMProvider, prompt: string): Promise<string> => {
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
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
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

const chatCompletion = async (prompt: string): Promise<string> => {
    let lastErr: unknown;
    for (const p of LLM_PROVIDERS) {
        try {
            return await callProvider(p, prompt);
        } catch (e: any) {
            lastErr = e;
            // Only fall through to the next provider on quota/limit or network failure.
            if (e?.quota || e?.network) continue;
            throw e; // hard error (e.g. bad request) — don't retry
        }
    }
    throw lastErr;
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
    const responseText = await chatCompletion(prompt);

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

export const generateTypingContent = async (targetLang: Language, nativeLang: Language, level: CEFRLevel, topic?: string, instructions?: string): Promise<TypingContent> => {
  const safeTopic = topic || "a random interesting daily life topic";
  const extraInstructions = instructions || "";
  
  const prompt = `
    Generate a short practice text (approx 50-80 words) for typing practice in ${targetLang} at CEFR level ${level}.
    The topic is: ${safeTopic}.
    ${extraInstructions}
    
    For languages like Japanese (Kanji), Chinese (Hanzi), or Korean, provide a phonetic guide (Romaji/Pinyin/Romanization) for the ENTIRE text.
    
    Return ONLY valid JSON. No Markdown. No code blocks.
    Structure:
    {
      "text": "The practice text itself",
      "topic": "A 2-3 word title",
      "phoneticGuide": "The full phonetic transliteration (or empty string if not applicable)",
      "translation": "${nativeLang} translation of the text",
      "keyVocabulary": [
         { "word": "string", "meaning": "string", "partOfSpeech": "string" }
      ]
    }
  `;

  try {
    const responseText = await chatCompletion(prompt);

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
    
    return parsed;
  } catch (error) {
    console.error("Content generation error:", error);
    throw new Error("Failed to generate typing content.");
  }
};

export const analyzeWriting = async (text: string, targetLanguage: Language, nativeLanguage: Language): Promise<WritingFeedback> => {
  const prompt = `
    Act as a strict but helpful language tutor. Review the following ${targetLanguage} writing sample.
    Identify errors, suggest improvements, and estimate the CEFR level.
    
    Text: "${text}"

    IMPORTANT: Explain all feedback, reasons for corrections, and the general comment in ${nativeLanguage}, so the student understands clearly.

    Return ONLY valid JSON. No Markdown.
    Structure:
    {
      "correctedText": "string (The corrected version in ${targetLanguage})",
      "suggestions": [ { "original": "string", "suggestion": "string", "reason": "string (in ${nativeLanguage})" } ],
      "generalComment": "string (in ${nativeLanguage})",
      "cefrEstimation": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
    }
  `;

  try {
    const responseText = await chatCompletion(prompt);

    return parseAIJSON<WritingFeedback>(responseText, {
        correctedText: text,
        suggestions: [],
        generalComment: "Analysis failed.",
        cefrEstimation: CEFRLevel.A1
    });
  } catch (error) {
    console.error("Writing analysis error:", error);
    throw new Error("Failed to analyze writing.");
  }
};

export const getWordDefinition = async (word: string, context: string, targetLang: Language): Promise<string> => {
     const prompt = `Provide a concise definition and one example sentence for the word "${word}" in ${targetLang}. 
     Context: "${context}". 
     Output format: Definition (Native Language). Example: [Target Lang Sentence]`;
     
     try {
        const responseText = await chatCompletion(prompt);
        return responseText || "Definition not found.";
     } catch (e) {
        return "Definition unavailable.";
     }
}

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
    const responseText = await chatCompletion(prompt);
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

// --- Text-to-Speech (Qwen sambert-zhide-v1 + Web Speech fallback) ---
// sambert-zhide-v1 is a Chinese voice served by DashScope. For Chinese content we
// stream it from Qwen; for other languages (or if the cloud call fails) we fall
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

async function fetchQwenTtsUrl(text: string): Promise<string> {
  const res = await fetch(`${QWEN_HOST}/api/v1/services/audio/tts/SpeechSynthesizer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${QWEN_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sambert-zhide-v1",
      input: { text },
      parameters: { format: "wav", sample_rate: 48000 },
    }),
  });
  if (!res.ok) throw new Error(`Qwen TTS failed (${res.status})`);
  const data = await res.json();
  const url = data?.output?.audio?.url;
  const b64 = data?.output?.audio?.data;
  if (url) return url;
  if (b64) return `data:audio/wav;base64,${b64}`;
  throw new Error("No audio returned from Qwen TTS");
}

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

    // sambert-zhide-v1 is a Chinese voice; use Qwen TTS only for Chinese content.
    if (opts?.lang === Language.Chinese) {
      fetchQwenTtsUrl(text)
        .then((url) => playQwenAudio(url, opts))
        .catch((e) => {
          console.warn("Qwen TTS failed, falling back to Web Speech:", e);
          playWebSpeech(text, opts);
        });
      return;
    }
    playWebSpeech(text, opts);
};

// --- Speech-to-Text (Qwen paraformer-v2) ---
// DashScope paraformer-v2 is an async file-transcription service. A browser recording
// is a Blob with no public URL, so we upload it to DashScope's temporary OSS bucket
// (uploads sign API), submit a transcription task referencing the OSS key, then poll.
export const transcribeAudio = async (blob: Blob, lang: Language): Promise<string> => {
  const wav = await blobToWav(blob);
  const { uploadUrl, ossObjectKey } = await getUploadSign();
  await uploadToOss(uploadUrl, wav);
  const taskId = await submitTranscription(ossObjectKey, lang);
  return pollTranscription(taskId);
};

function blobToWav(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const Ctx: any = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx({ sampleRate: 16000 });
        const decoded = await ctx.decodeAudioData((reader.result as ArrayBuffer).slice(0));
        resolve(encodeWav(decoded, 16000));
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function encodeWav(buffer: AudioBuffer, sampleRate: number): Blob {
  const numCh = 1;
  const samples = buffer.getChannelData(0);
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

async function getUploadSign(): Promise<{ uploadUrl: string; ossObjectKey: string }> {
  const res = await fetch(`${QWEN_HOST}/api/v1/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${QWEN_API_KEY}`,
      "Content-Type": "application/json",
      "X-DashScope-OssResourceResolve": "enable",
    },
    body: JSON.stringify({ model: "paraformer-v2" }),
  });
  if (!res.ok) throw new Error(`upload sign failed (${res.status})`);
  const data = await res.json();
  const out: any = data?.output || data?.data || {};
  const uploadUrl = out.uploadUrl || out.upload_url;
  const ossObjectKey = out.ossObjectKey || out.oss_object_key;
  if (!uploadUrl || !ossObjectKey) throw new Error("Invalid upload sign response");
  return { uploadUrl, ossObjectKey };
}

async function uploadToOss(uploadUrl: string, wav: Blob): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", body: wav, headers: { "Content-Type": "audio/wav" } });
  if (res.status !== 200 && res.status !== 201) throw new Error(`OSS upload failed (${res.status})`);
}

async function submitTranscription(ossObjectKey: string, lang: Language): Promise<string> {
  const hints = lang === Language.Chinese ? ["zh"] : ["en"];
  const res = await fetch(`${QWEN_HOST}/api/v1/services/audio/asr/transcription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${QWEN_API_KEY}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: "paraformer-v2",
      input: { file_urls: [ossObjectKey] },
      parameters: { channel_id: [0], language_hints: hints },
    }),
  });
  if (!res.ok) throw new Error(`transcription submit failed (${res.status})`);
  const data = await res.json();
  const taskId = data?.output?.task_id;
  if (!taskId) throw new Error("No task_id returned");
  return taskId;
}

async function pollTranscription(taskId: string, maxAttempts = 60): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${QWEN_HOST}/api/v1/tasks/${taskId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QWEN_API_KEY}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
    });
    if (!res.ok) throw new Error(`task query failed (${res.status})`);
    const data = await res.json();
    const status = data?.output?.task_status;
    if (status === "SUCCEEDED") return extractTranscript(data?.output?.results);
    if (status === "FAILED") throw new Error("transcription failed");
  }
  throw new Error("transcription timed out");
}

function extractTranscript(results: any): string {
  if (!results) return "";
  const arr = Array.isArray(results) ? results : [results];
  for (const item of arr) {
    const transcripts = item?.transcripts || item?.output?.transcripts;
    if (Array.isArray(transcripts) && transcripts.length) {
      const texts = transcripts.map((t: any) => t?.text || "").filter(Boolean);
      if (texts.length) return texts.join(" ");
    }
    if (item?.text) return item.text;
  }
  return "";
}

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
        const responseText = await chatCompletion(prompt);
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
        const responseText = await chatCompletion(prompt);
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
         const responseText = await chatCompletion(prompt);
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
        const responseText = await chatCompletion(prompt);
        
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
        const responseText = await chatCompletion(prompt);
        return responseText || "No feedback available.";
    } catch (error) {
        return "Coach is currently unavailable.";
    }
};

// --- RPG System AI ---

export const startRPGScenario = async (theme: string, level: CEFRLevel, language: Language, nativeLanguage: Language): Promise<RPGScenario> => {
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
        const responseText = await chatCompletion(prompt);
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
    nativeLanguage: Language
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
          "feedback": "string or null"
        }
    `;

    try {
        const responseText = await chatCompletion(prompt);
        return parseAIJSON(responseText, {
            aiReply: "...",
            translation: "...",
            completedObjectives: [],
            vocabulary: [],
            isScenarioComplete: false,
            feedback: null
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
