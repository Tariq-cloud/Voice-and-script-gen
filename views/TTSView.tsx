
import React, { useState, useRef } from 'react';
import { ELEVEN_LABS_VOICES, VoiceProfile, VoiceSettings, DEFAULT_SETTINGS } from '../types';
import { generateTTS, classifyVoice, enhanceTextForSpeech, summarizeForVisuals, generateImage } from '../services/geminiService';

const TTSView: React.FC = () => {
  const [text, setText] = useState('');
  const [vocalPrompt, setVocalPrompt] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(ELEVEN_LABS_VOICES.find(v => v.name === 'Rachel') || ELEVEN_LABS_VOICES[0]);
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloningStatus, setCloningStatus] = useState('');
  const [pendingClone, setPendingClone] = useState<VoiceProfile | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [visualUrl, setVisualUrl] = useState<string | null>(null);
  const [shouldEnhance, setShouldEnhance] = useState(true);
  const [shouldGenerateVisual, setShouldGenerateVisual] = useState(true);
  const [clonedVoices, setClonedVoices] = useState<VoiceProfile[]>(ELEVEN_LABS_VOICES);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const encodeWAV = (samples: Float32Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (v: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) v.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 32 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  const processAudioData = (base64Audio: string) => {
    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bufferLen = Math.floor(len / 2) * 2;
      const bytes = new Uint8Array(bufferLen);
      for (let i = 0; i < bufferLen; i++) bytes[i] = binaryString.charCodeAt(i);
      const int16Data = new Int16Array(bytes.buffer, 0, bufferLen / 2);
      const floatData = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) floatData[i] = int16Data[i] / 32768.0;
      const wavBuffer = encodeWAV(floatData, 24000);
      return URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' }));
    } catch (e) {
      console.error("Audio decode error:", e);
      return null;
    }
  };

  const updateSelectedVoiceSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    const updated = { ...selectedVoice, settings: { ...selectedVoice.settings, [key]: value } };
    setSelectedVoice(updated);
    setClonedVoices(prev => prev.map(v => v.id === updated.id ? updated : v));
  };

  const handleGenerate = async () => {
    if (!text || text.trim().length < 2) {
      setErrorMsg("Please provide a script.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setAudioUrl(null);
    setVisualUrl(null);
    
    try {
      let processingText = text;
      if (shouldEnhance) {
        try {
          processingText = await enhanceTextForSpeech(text);
        } catch (e) {
          console.warn("Enhancement failed, using raw script.");
        }
      }

      const base64Audio = await generateTTS(processingText, selectedVoice.geminiVoice, selectedVoice.settings, vocalPrompt);

      if (base64Audio) {
        const url = processAudioData(base64Audio);
        if (url) {
          setAudioUrl(url);
          // Auto-play the audio when ready
          const audio = new Audio(url);
          audio.play().catch(e => console.warn("Auto-play blocked", e));
        } else {
          setErrorMsg("Generated audio data is corrupted.");
        }
      }

      if (shouldGenerateVisual) {
        summarizeForVisuals(text).then(prompt => generateImage(prompt, '1K', false)).then(img => {
          if (img) setVisualUrl(img);
        }).catch(e => console.error("Visual sync error:", e));
      }

    } catch (err: any) {
      setErrorMsg(err.message || "Synthesis failed. Please try a simpler script.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloneVoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCloning(true);
    setErrorMsg(null);
    setCloningStatus('Mapping Vocal DNA...');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const analysis = await classifyVoice(base64, file.type);
        
        const newVoice: VoiceProfile = {
          id: `clone-${Date.now()}`,
          name: `Clone: ${file.name.split('.')[0]}`,
          geminiVoice: analysis.id,
          description: analysis.summary,
          gender: analysis.gender as any,
          traits: analysis.traits,
          settings: { ...DEFAULT_SETTINGS }
        };
        setPendingClone(newVoice);
        setCloning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setErrorMsg("Vocal analysis failed. Audio must be clear speech.");
      setCloning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Clone Confirmation Modal */}
      {pendingClone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/95 backdrop-blur-2xl p-4">
          <div className="max-w-2xl w-full glass-panel rounded-[3rem] p-12 space-y-8 border-indigo-500/30 animate-in zoom-in-95">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl accent-gradient mx-auto flex items-center justify-center text-4xl shadow-2xl">🧬</div>
              <h2 className="text-3xl font-bold font-outfit text-white">Neural Mapping Complete</h2>
              <p className="text-gray-400">Identity established for <span className="text-indigo-400 font-bold">{pendingClone.geminiVoice}</span> substrate.</p>
            </div>

            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Biological Gender</span>
                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${pendingClone.gender === 'female' ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {pendingClone.gender}
                    </span>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Custom Alias</label>
                    <input 
                      type="text" 
                      value={pendingClone.name} 
                      onChange={(e) => setPendingClone({...pendingClone, name: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500/50"
                    />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {pendingClone.traits?.map(trait => (
                    <span key={trait} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] text-indigo-300 font-bold uppercase">{trait}</span>
                  ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setClonedVoices([pendingClone, ...clonedVoices]); setSelectedVoice(pendingClone); setPendingClone(null); }}
                className="py-5 accent-gradient rounded-3xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
              >
                Finalize Identity
              </button>
              <button onClick={() => setPendingClone(null)} className="py-5 bg-white/5 border border-white/10 rounded-3xl text-xs text-gray-500 font-bold uppercase tracking-widest hover:text-white transition-colors">Discard</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        <div className="lg:col-span-8 space-y-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-[0.3em]">Master Narrator Engine</label>
              <div className="flex gap-4">
                 <button 
                  onClick={() => setShouldEnhance(!shouldEnhance)}
                  className={`flex items-center gap-2 text-[10px] font-bold px-4 py-2 rounded-full border transition-all ${shouldEnhance ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 shadow-lg' : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'}`}
                 >
                   {shouldEnhance ? '✨ ENHANCE ACTIVE' : 'RAW SCRIPT'}
                 </button>
                 <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`flex items-center gap-2 text-[10px] font-bold px-4 py-2 rounded-full border transition-all ${isSettingsOpen ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-lg' : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'}`}
                 >
                   ⚙️ FINE-TUNING
                 </button>
              </div>
            </div>

            {isSettingsOpen && (
              <div className="p-10 glass-panel rounded-[2.5rem] border-purple-500/20 animate-in slide-in-from-top-4 space-y-10 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest">
                      <span>Neural Pitch</span>
                      <span className="text-purple-400">{selectedVoice.settings.pitch}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="1.5" step="0.05" 
                      value={selectedVoice.settings.pitch}
                      onChange={(e) => updateSelectedVoiceSetting('pitch', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/5 rounded-full"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest">
                      <span>Cadence</span>
                      <span className="text-purple-400">{selectedVoice.settings.rate}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.05" 
                      value={selectedVoice.settings.rate}
                      onChange={(e) => updateSelectedVoiceSetting('rate', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/5 rounded-full"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest">
                      <span>Master Volume</span>
                      <span className="text-purple-400">{Math.round(selectedVoice.settings.volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" 
                      value={selectedVoice.settings.volume}
                      onChange={(e) => updateSelectedVoiceSetting('volume', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/5 rounded-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-white/5">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Prosody style</label>
                    <div className="flex flex-wrap gap-2">
                      {(['neutral', 'expressive', 'calm', 'authoritative', 'whisper', 'dramatic', 'storyteller'] as const).map(style => (
                        <button
                          key={style}
                          onClick={() => updateSelectedVoiceSetting('style', style)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${selectedVoice.settings.style === style ? 'bg-purple-500 border-purple-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'}`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Vocal Accent</label>
                    <div className="flex flex-wrap gap-2">
                      {(['natural', 'american', 'british', 'australian', 'soft', 'strong'] as const).map(accent => (
                        <button
                          key={accent}
                          onClick={() => updateSelectedVoiceSetting('accent', accent)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${selectedVoice.settings.accent === accent ? 'bg-purple-500 border-purple-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'}`}
                        >
                          {accent}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="relative group">
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); if (errorMsg) setErrorMsg(null); }}
                placeholder="The narrative flows from here. Enter your script for high-fidelity synthesis..."
                className="w-full h-80 p-12 glass-panel rounded-[3rem] border-white/10 focus:border-indigo-500/50 outline-none resize-none transition-all text-xl leading-relaxed shadow-2xl font-light placeholder:text-gray-700"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] pl-6">Neural Direction (Prompt-Based)</label>
              <input 
                type="text"
                value={vocalPrompt}
                onChange={(e) => setVocalPrompt(e.target.value)}
                placeholder="Describe the mood: 'Speak with a slow, mysterious whisper' or 'High-energy excited announcer'..."
                className="w-full p-6 glass-panel rounded-2xl border-white/10 focus:border-indigo-500/50 outline-none shadow-2xl text-sm font-medium"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center gap-4 text-rose-400 text-sm animate-in zoom-in-95">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0 text-lg">⚠️</div>
              <p className="font-bold">{errorMsg}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !text}
            className={`w-full py-8 accent-gradient rounded-[2rem] font-bold flex items-center justify-center gap-4 transition-all text-2xl shadow-[0_20px_60px_rgba(99,102,241,0.3)] group ${loading ? 'opacity-50 cursor-wait' : 'hover:scale-[1.01] active:scale-[0.99] hover:shadow-indigo-500/30'}`}
          >
            {loading ? (
              <><div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" /> SYNTHESIZING NEURAL AUDIO...</>
            ) : (
              <><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg> RENDER VOCAL MASTER</>
            )}
          </button>

          {(audioUrl || visualUrl) && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in slide-in-from-top-12 duration-700">
              {visualUrl && (
                <div className="md:col-span-5 aspect-square glass-panel rounded-[3rem] border-emerald-500/20 overflow-hidden shadow-2xl group relative">
                  <img src={visualUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-2000" alt="Script Visual" />
                </div>
              )}
              <div className={`${visualUrl ? 'md:col-span-7' : 'md:col-span-12'} p-12 glass-panel rounded-[3rem] border-indigo-500/30 flex flex-col justify-between shadow-2xl bg-indigo-500/5`}>
                <div className="space-y-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center font-bold text-4xl shadow-2xl transition-all ${selectedVoice.gender === 'female' ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {selectedVoice.name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-3xl font-outfit tracking-tight">{selectedVoice.name}</h4>
                        <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em]">Neural Output • Active Sync</p>
                      </div>
                    </div>
                    {audioUrl && (
                      <a href={audioUrl} download={`${selectedVoice.name}-render.wav`} className="p-6 bg-indigo-500 rounded-[2rem] hover:bg-indigo-600 transition-all text-white shadow-2xl hover:scale-105 active:scale-95 group">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </a>
                    )}
                  </div>
                  
                  <div className="bg-black/60 p-10 rounded-[2.5rem] border border-white/5 shadow-inner">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="flex gap-1.5 h-6">
                          <div className="w-1.5 h-full bg-indigo-500/40 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-4/5 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                          <div className="w-1.5 h-full bg-indigo-500/60 rounded-full animate-bounce delay-150"></div>
                       </div>
                       <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Neural Audio Playback Ready</span>
                    </div>
                    {audioUrl && <audio ref={audioRef} src={audioUrl} controls className="w-full accent-indigo-500" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="glass-panel rounded-[2.5rem] p-10 border-white/5 space-y-10 shadow-2xl sticky top-24">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Voice Identities</label>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={cloning}
                className="text-[10px] px-6 py-3 rounded-full font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                {cloning ? 'DNA SCANNING...' : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg> CLONE VOICE</>
                )}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleCloneVoice} accept="audio/*" className="hidden" />
            </div>

            <div className="space-y-5 max-h-[640px] overflow-y-auto pr-3 custom-scrollbar">
              {clonedVoices.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => { setSelectedVoice(voice); setAudioUrl(null); setErrorMsg(null); }}
                  className={`w-full p-6 rounded-[2rem] text-left border transition-all flex items-center gap-6 group relative overflow-hidden ${
                    selectedVoice.id === voice.id ? 'bg-indigo-500/20 border-indigo-500/50 shadow-2xl' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold shrink-0 transition-all text-2xl ${
                    selectedVoice.id === voice.id ? 'bg-indigo-500 text-white shadow-xl scale-110' : 'bg-white/10'
                  }`}>
                    {voice.name.charAt(0)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-3 mb-1.5">
                       <p className={`font-bold truncate text-base transition-colors ${selectedVoice.id === voice.id ? 'text-white' : 'text-gray-300'}`}>{voice.name}</p>
                       <span className={`text-[8px] px-2 py-0.5 rounded-md font-bold uppercase border ${voice.gender === 'female' ? 'bg-pink-500/10 text-pink-500/80 border-pink-500/20' : 'bg-blue-500/10 text-blue-500/80 border-blue-500/20'}`}>
                         {voice.gender === 'female' ? 'FEM' : 'MALE'}
                       </span>
                    </div>
                    <p className="text-[10px] opacity-60 truncate tracking-tight font-medium leading-tight">{voice.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TTSView;
