
export enum AppView {
  DASHBOARD = 'dashboard',
  TTS = 'tts',
  VIDEO_GEN = 'video_gen',
  IMAGE_GEN = 'image_gen',
  MEDIA_UNDERSTANDING = 'media_understanding',
  LIVE_CHAT = 'live_chat'
}

export interface VoiceSettings {
  pitch: number; // 0.5 to 1.5
  rate: number;  // 0.5 to 2.0
  volume: number; // 0 to 1.0
  style: 'neutral' | 'expressive' | 'calm' | 'authoritative' | 'whisper' | 'dramatic' | 'storyteller';
  accent: 'natural' | 'american' | 'british' | 'australian' | 'soft' | 'strong';
}

export interface VoiceProfile {
  id: string;
  name: string;
  geminiVoice: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  traits?: string[];
  settings: VoiceSettings;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
  style: 'neutral',
  accent: 'natural'
};

export const ELEVEN_LABS_VOICES: VoiceProfile[] = [
  { id: 'tnSpp4vdxKPjI9w0GnoV', name: 'Rachel', geminiVoice: 'Kore', description: 'Professional & Calm', gender: 'female', traits: ['Soft', 'Professional'], settings: { ...DEFAULT_SETTINGS, style: 'calm' } },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brain', geminiVoice: 'Puck', description: 'Youthful & Energetic', gender: 'male', traits: ['Dynamic', 'Bright'], settings: { ...DEFAULT_SETTINGS, style: 'expressive' } },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Marcus', geminiVoice: 'Charon', description: 'Deep & Authoritative', gender: 'male', traits: ['Deep', 'Commanding'], settings: { ...DEFAULT_SETTINGS, style: 'authoritative' } },
  { id: '56AoDkrOh6qfVPDXZ7Pt', name: 'Sam', geminiVoice: 'Zephyr', description: 'Friendly & Neutral', gender: 'male', traits: ['Balanced', 'Kind'], settings: DEFAULT_SETTINGS },
  { id: 'EXAV8jWIBdvW6thmb2mb', name: 'Bella', geminiVoice: 'Aoide', description: 'Bright & Expressive', gender: 'female', traits: ['Melodic', 'Warm'], settings: { ...DEFAULT_SETTINGS, style: 'expressive' } },
  { id: 'MF3mGyEYCl7XYW7LdxpP', name: 'Arnold', geminiVoice: 'Fenrir', description: 'Gravelly & Intense', gender: 'male', traits: ['Gritty', 'Strong'], settings: { ...DEFAULT_SETTINGS, style: 'dramatic' } },
];

export interface AnalysisResult {
  transcript: string;
  summary: string;
  type: 'audio' | 'video';
}
