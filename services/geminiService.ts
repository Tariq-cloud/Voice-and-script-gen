
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { VoiceSettings } from "../types";

// Priority selection for API keys: 
// 1. process.env.API_KEY (Selected from dialog)
// 2. process.env.GEMINI_API_KEY (System default)
const getApiKey = () => {
  return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
};

const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("No Gemini API key found in environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

const handleApiError = (error: any) => {
  console.error("Gemini API Error Context:", error);
  const errorMessage = error?.message || String(error);
  
  // 403 usually means the key doesn't have the API enabled or the model is restricted
  if (errorMessage.includes("403") || errorMessage.toLowerCase().includes("permission denied") || errorMessage.toLowerCase().includes("permission_denied")) {
    throw new PermissionError("PERMISSION_DENIED: The caller does not have permission. Please ensure you have selected a valid API key from a project with the Generative AI API enabled and billing attached.");
  }

  if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota exceeded") || errorMessage.toLowerCase().includes("too many requests")) {
    throw new QuotaError("API Quota Exceeded. Please switch to a different API key or wait for the limit to reset.");
  }
  
  if (errorMessage.includes("500") || errorMessage.includes("Internal error")) {
    throw new Error("SERVER_ERROR: The neural engine encountered an internal error. This often happens with very long text or complex styling in the preview model. Try shortening the text.");
  }

  if (errorMessage.includes("non-audio response") || errorMessage.includes("400")) {
    throw new Error("VOICE_REFUSAL: The model attempted to reply with text instead of audio.");
  }
  
  throw new Error(errorMessage || "Failed to call the Gemini API. Please try again.");
};

const sanitizeForTTS = (text: string): string => {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .replace(/[`]/g, '')
    .replace(/_{2,}/g, '')
    .replace(/\[|\]|\(|\)/g, '')
    .replace(/(\r\n|\n|\r)/gm, " ")
    .trim();
};

export const enhanceTextForSpeech = async (text: string) => {
  if (!text || text.trim().length < 2) return text;
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Rewrite this script for natural TTS flow. Use '...' for brief pauses. Keep the original language. Output ONLY the new script: "${text}"`,
    });
    return sanitizeForTTS(response.text || text);
  } catch (e) {
    return sanitizeForTTS(text);
  }
};

/**
 * Generate Neural Audio. 
 * Simplified to the most basic prompt structure to avoid 500 errors.
 */
export const generateTTS = async (text: string, voiceName: string, settings?: VoiceSettings, customVocalPrompt?: string) => {
  const sanitizedText = sanitizeForTTS(text);
  if (!sanitizedText || sanitizedText.length < 2) return null;

  // The 500 error is often triggered by complex prompt instructions combined with voiceConfig.
  // We use the most stable format: "Say [style/emotion]: [text]"
  const style = settings?.style || 'expressive';
  const accent = settings?.accent && settings.accent !== 'natural' ? `${settings.accent} accent` : '';
  
  // Transform numerical pitch/rate into verbal descriptions for the prompt instruction
  const pitchDesc = settings?.pitch ? (settings.pitch > 1.1 ? 'with a high pitch' : settings.pitch < 0.9 ? 'with a low pitch' : '') : '';
  const rateDesc = settings?.rate ? (settings.rate > 1.2 ? 'speaking quickly' : settings.rate < 0.8 ? 'speaking slowly' : '') : '';
  
  let instructions: string[] = [style];
  if (accent) instructions.push(accent);
  if (pitchDesc) instructions.push(pitchDesc);
  if (rateDesc) instructions.push(rateDesc);
  if (customVocalPrompt) instructions.push(customVocalPrompt);

  const prefix = instructions.filter(Boolean).join(', ');
  const prompt = `Speak this ${prefix}: ${sanitizedText}`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        // Removing systemInstruction as it can cause 500s in the current preview build
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    
    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!audioPart || !audioPart.inlineData) throw new Error("VOICE_REFUSAL");
    return audioPart.inlineData.data;
  } catch (e: any) {
    return handleApiError(e);
  }
};

export const classifyVoice = async (base64Audio: string, mimeType: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Audio.split(',')[1], mimeType } },
          { text: "Analyze this voice for cloning. Identify the speaker's core personality. Estimate their average pitch (low, medium, high), speech rate (slow, normal, fast), and general style (e.g., calm, energetic, clinical). Match to one of: Puck, Charon, Zephyr, Fenrir, Kore, Aoide. Return JSON: {id, gender, pitch, rate, style, traits:[], summary}" }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    const result = JSON.parse(response.text || '{}');
    return { 
      id: result.id || 'Zephyr', 
      gender: result.gender || 'male', 
      pitch: result.pitch || 'medium',
      rate: result.rate || 'normal',
      style: result.style || 'expressive',
      traits: result.traits || ["Standard"], 
      summary: result.summary || "Neural identity mapped."
    };
  } catch (e) { 
    return { 
      id: 'Zephyr', 
      gender: 'male', 
      pitch: 'medium', 
      rate: 'normal', 
      style: 'expressive', 
      traits: ["Standard"], 
      summary: "Default profile assigned." 
    };
  }
};

export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', startImage?: string) => {
  try {
    const ai = getAI();
    const payload: any = {
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt || 'A cinematic scene',
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    };
    if (startImage) payload.image = { imageBytes: startImage.split(',')[1], mimeType: 'image/png' };
    let operation = await ai.models.generateVideos(payload);
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation completed but no URI returned.");

    const response = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': getApiKey(),
      },
    });
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e) { return handleApiError(e); }
};

export const generateImage = async (prompt: string, size: '1K' | '2K' | '4K', useNanoPro: boolean = false, provider: 'gemini' | 'pollinations' = 'gemini') => {
  if (provider === 'pollinations') {
    const width = size === '1K' ? 1024 : 2048;
    const height = size === '1K' ? 1024 : 2048;
    return `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
  }

  try {
    const ai = getAI();
    const model = (useNanoPro || size !== '1K') ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image';
    const imageConfig: any = { aspectRatio: "1:1" };
    if (model === 'gemini-3.1-flash-image-preview') imageConfig.imageSize = size;
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (e) { return handleApiError(e); }
};

export const analyzeMedia = async (fileBase64: string, mimeType: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: fileBase64.split(',')[1], mimeType } },
          { text: "Analyze this content. Provide FULL verbatim transcript and a detailed summary in JSON format." }
        ]
      },
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  transcript: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  sequencedScript: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING },
                        text: { type: Type.STRING }
                      },
                      required: ["type", "text"]
                    }
                  }
              },
              required: ["transcript", "summary", "sequencedScript"]
          }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) { return handleApiError(e); }
};

/**
 * Analyzes content via URL with specific instructions for full transcript extraction.
 * Correctly identifies the original language (Urdu/English).
 */
export const analyzeUrl = async (url: string) => {
  try {
    const ai = getAI();
    const prompt = `Find and analyze the video content at this URL: ${url}. 
    1. Identify the primary language of the video (e.g., Urdu or English).
    2. Provide the FULL VERBATIM TRANSCRIPT of the entire video content in its original language (if Urdu, provide Urdu; if English, provide English).
    3. Provide a comprehensive summary of all topics discussed.
    4. Breakdown the content into segments (Hook, Intro, Main Content, Outro).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // We attempt to structure the text response since search grounded results don't support JSON mode.
    return {
      summary: response.text || "Analysis complete.",
      transcript: "See full analysis text above for the verbatim transcript.",
      sequencedScript: [],
      grounding: groundingChunks
    };
  } catch (e) {
    return handleApiError(e);
  }
};

export const summarizeForVisuals = async (text: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Cinematic 1:1 image prompt for: "${text}"`,
    });
    return response.text || "Professional studio lighting";
  } catch (e) { return "Professional studio lighting"; }
};
