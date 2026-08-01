
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, CEFRLevel, AssessmentResult, TypingContent, WritingFeedback, WritingNode, NodeType, ReadingReflection, RPGScenario, RPGTurnResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FAST = "gemini-2.5-flash";
const MODEL_TTS = "gemini-2.5-flash-preview-tts";

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
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
    });

    return parseAIJSON<AssessmentResult>(response.text, {
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
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
    });

    const parsed = parseAIJSON<TypingContent>(response.text, {
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
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
    });

    return parseAIJSON<WritingFeedback>(response.text, {
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        return response.text || "Definition not found.";
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
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
    });
    return parseAIJSON(response.text, { 
        definition: "Auto-generation failed", 
        example: "", 
        partOfSpeech: "Unknown" 
    });
  } catch (error) {
    console.error("Word details error:", error);
    return { definition: "Auto-generation failed", example: "", partOfSpeech: "Unknown" };
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
    if (!text || !text.trim()) return undefined;
    try {
        // Ensure text isn't too long for a single pass or contains invalid chars
        const safeText = text.substring(0, 1000); 

        const response = await ai.models.generateContent({
            model: MODEL_TTS,
            contents: [{ parts: [{ text: safeText }] }],
            config: {
                // Use string literal 'AUDIO' to be robust against enum serialization issues in some environments
                responseModalities: ['AUDIO'] as any,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, 
                    },
                },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
        console.error("TTS generation error:", error);
        return undefined;
    }
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        return parseAIJSON(response.text, {
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        return parseAIJSON(response.text, []);
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
         const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        const result = parseAIJSON(response.text, { 
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        
        // Cleanup response: Remove "Here is...", remove quotes, remove ```
        let refined = response.text?.trim() || text;
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        return response.text || "No feedback available.";
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        return parseAIJSON(response.text, {
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
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        return parseAIJSON(response.text, {
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
