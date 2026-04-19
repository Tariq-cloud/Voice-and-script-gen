
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
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', geminiVoice: 'Puck', description: 'Youthful & Energetic', gender: 'male', traits: ['Dynamic', 'Bright'], settings: { ...DEFAULT_SETTINGS, style: 'expressive' } },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Marcus', geminiVoice: 'Charon', description: 'Deep & Authoritative', gender: 'male', traits: ['Deep', 'Commanding'], settings: { ...DEFAULT_SETTINGS, style: 'authoritative' } },
  { id: '56AoDkrOh6qfVPDXZ7Pt', name: 'Sam', geminiVoice: 'Zephyr', description: 'Friendly & Neutral', gender: 'male', traits: ['Balanced', 'Kind'], settings: DEFAULT_SETTINGS },
  { id: 'EXAV8jWIBdvW6thmb2mb', name: 'Bella', geminiVoice: 'Aoide', description: 'Bright & Expressive', gender: 'female', traits: ['Melodic', 'Warm'], settings: { ...DEFAULT_SETTINGS, style: 'expressive' } },
  { id: 'MF3mGyEYCl7XYW7LdxpP', name: 'Arnold', geminiVoice: 'Fenrir', description: 'Gravelly & Intense', gender: 'male', traits: ['Gritty', 'Strong'], settings: { ...DEFAULT_SETTINGS, style: 'dramatic' } },
  { id: 'ErXw931tS9C0D34Ld6Z', name: 'Antoni', geminiVoice: 'Charon', description: 'Smooth & Confident', gender: 'male', traits: ['Well-rounded', 'Stable'], settings: { ...DEFAULT_SETTINGS, style: 'neutral' } },
  { id: 'MF3mGyE123XYW7LdxpP', name: 'Elli', geminiVoice: 'Kore', description: 'Sweet & Youthful', gender: 'female', traits: ['Crisp', 'Emotional'], settings: { ...DEFAULT_SETTINGS, style: 'expressive' } },
  { id: '9BWTSo8zSjNo74d6M4D', name: 'Josh', geminiVoice: 'Zephyr', description: 'Deep & Narrative', gender: 'male', traits: ['Storyteller', 'Husky'], settings: { ...DEFAULT_SETTINGS, style: 'storyteller' } },
  { id: 'AZnzp1L63E0VzHps5D4', name: 'Mimi', geminiVoice: 'Aoide', description: 'Animated & Playful', gender: 'female', traits: ['High-pitch', 'Excited'], settings: { ...DEFAULT_SETTINGS, style: 'expressive', pitch: 1.1 } },
  { id: 'bVMe3A9aZ7R4M8S4F3G', name: 'Clyde', geminiVoice: 'Fenrir', description: 'Quirky & Characterful', gender: 'male', traits: ['Warby', 'Vintage'], settings: { ...DEFAULT_SETTINGS, style: 'dramatic', rate: 0.9 } },
  { id: 'onw9fc0o76rV4d5XPt9', name: 'Nicole', geminiVoice: 'Kore', description: 'Professional & Clear', gender: 'female', traits: ['Corporate', 'Direct'], settings: { ...DEFAULT_SETTINGS, style: 'authoritative' } },
];

export interface AnalysisResult {
  transcript: string;
  summary: string;
  type: 'audio' | 'video';
}
