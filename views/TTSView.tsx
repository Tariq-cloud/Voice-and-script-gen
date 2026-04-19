
import React, { useState, useRef } from 'react';
import { ELEVEN_LABS_VOICES, VoiceProfile, VoiceSettings, DEFAULT_SETTINGS } from '../types';
import { generateTTS, classifyVoice, enhanceTextForSpeech, summarizeForVisuals, generateImage, PermissionError } from '../services/geminiService';

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
  const [isCloningExpanded, setIsCloningExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
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

  const handleSwitchKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setErrorMsg(null);
      setIsPermissionError(false);
    }
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
    setIsPermissionError(false);
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
      if (err instanceof PermissionError) {
        setIsPermissionError(true);
      }
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
          name: file.name.split('.')[0],
          geminiVoice: analysis.id,
          description: analysis.summary,
          gender: analysis.gender as any,
          traits: analysis.traits,
          settings: { 
            ...DEFAULT_SETTINGS,
            pitch: analysis.pitch === 'low' ? 0.8 : analysis.pitch === 'high' ? 1.2 : 1.0,
            rate: analysis.rate === 'slow' ? 0.8 : analysis.rate === 'fast' ? 1.2 : 1.0,
            style: (['neutral', 'expressive', 'calm', 'authoritative', 'whisper', 'dramatic', 'storyteller'] as const).includes(analysis.style as any) 
              ? (analysis.style as any) 
              : 'neutral'
          }
        };
        setPendingClone(newVoice);
        setIsCloningExpanded(true);
        setCloning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setErrorMsg("Vocal analysis failed. Audio must be clear speech.");
      setCloning(false);
    }
  };

  const updatePendingCloneSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    if (!pendingClone) return;
    setPendingClone({
      ...pendingClone,
      settings: { ...pendingClone.settings, [key]: value }
    });
  };

  const handlePreviewClone = async () => {
    if (!pendingClone) return;
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const sampleText = "This is a neural preview of my synthesized vocal mapping. Checking resonance and cadence.";
      const base64Audio = await generateTTS(sampleText, pendingClone.geminiVoice, pendingClone.settings, "Speak naturally and clearly to test settings.");
      if (base64Audio) {
        const url = processAudioData(base64Audio);
        if (url) {
          setPreviewUrl(url);
          const audio = new Audio(url);
          audio.play();
        }
      }
    } catch (e: any) {
      setErrorMsg("Preview failed: " + (e.message || "Neural engine busy"));
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Modal removed to use the sidebar section instead */}

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
                      <span className="text-purple-400">{selectedVoice.settings.pitch < 0.9 ? 'Low' : selectedVoice.settings.pitch > 1.1 ? 'High' : 'Normal'} ({selectedVoice.settings.pitch}x)</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="1.5" step="0.05" 
                      value={selectedVoice.settings.pitch ?? 1.0}
                      onChange={(e) => updateSelectedVoiceSetting('pitch', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/5 rounded-full cursor-pointer hover:accent-purple-400 transition-all"
                    />
                    <div className="flex justify-between text-[8px] font-bold text-gray-700 uppercase tracking-widest px-1">
                      <span>Depths</span>
                      <span>Altos</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest">
                      <span>Cadence</span>
                      <span className="text-purple-400">{selectedVoice.settings.rate < 0.8 ? 'Steady' : selectedVoice.settings.rate > 1.2 ? 'Rapid' : 'Normal'} ({selectedVoice.settings.rate}x)</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.05" 
                      value={selectedVoice.settings.rate ?? 1.0}
                      onChange={(e) => updateSelectedVoiceSetting('rate', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/5 rounded-full cursor-pointer hover:accent-purple-400 transition-all"
                    />
                    <div className="flex justify-between text-[8px] font-bold text-gray-700 uppercase tracking-widest px-1">
                      <span>Slow</span>
                      <span>Fast</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest">
                      <span>Master Volume</span>
                      <span className="text-purple-400">{Math.round((selectedVoice.settings.volume ?? 1) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" 
                      value={selectedVoice.settings.volume ?? 1.0}
                      onChange={(e) => updateSelectedVoiceSetting('volume', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/5 rounded-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-white/5">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Vocal Style & Emotion</label>
                    <div className="flex flex-wrap gap-2">
                      {(['neutral', 'expressive', 'calm', 'authoritative', 'whisper', 'dramatic', 'storyteller'] as const).map(style => (
                        <button
                          key={style}
                          onClick={() => updateSelectedVoiceSetting('style', style)}
                          className={`px-5 py-3 rounded-2xl text-[10px] font-bold uppercase border transition-all ${selectedVoice.settings.style === style ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/10'}`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Vocal Accent</label>
                    <div className="relative">
                      <select 
                        value={selectedVoice.settings.accent || 'natural'}
                        onChange={(e) => updateSelectedVoiceSetting('accent', e.target.value as any)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-gray-300 outline-none appearance-none focus:border-purple-500/50 transition-all cursor-pointer pr-10 hover:bg-white/10"
                      >
                        <option value="natural" className="bg-gray-900">Natural (Default)</option>
                        <option value="american" className="bg-gray-900">American Accent</option>
                        <option value="british" className="bg-gray-900">British Accent</option>
                        <option value="australian" className="bg-gray-900">Australian Accent</option>
                        <option value="indian" className="bg-gray-900">Indian Accent</option>
                        <option value="french" className="bg-gray-900">French Accent</option>
                        <option value="spanish" className="bg-gray-900">Spanish Accent</option>
                        <option value="soft" className="bg-gray-900">Soft / Mellow</option>
                        <option value="strong" className="bg-gray-900">Strong / Deep</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="relative group">
              <textarea
                value={text || ''}
                onChange={(e) => { setText(e.target.value); if (errorMsg) setErrorMsg(null); }}
                placeholder="The narrative flows from here. Enter your script for high-fidelity synthesis..."
                className="w-full h-80 p-12 glass-panel rounded-[3rem] border-white/10 focus:border-indigo-500/50 outline-none resize-none transition-all text-xl leading-relaxed shadow-2xl font-light placeholder:text-gray-700"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] pl-6">Neural Direction (Prompt-Based)</label>
              <input 
                type="text"
                value={vocalPrompt || ''}
                onChange={(e) => setVocalPrompt(e.target.value)}
                placeholder="Describe the mood: 'Speak with a slow, mysterious whisper' or 'High-energy excited announcer'..."
                className="w-full p-6 glass-panel rounded-2xl border-white/10 focus:border-indigo-500/50 outline-none shadow-2xl text-sm font-medium"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex flex-col gap-4 text-rose-400 text-sm animate-in zoom-in-95">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0 text-lg">⚠️</div>
                <p className="font-bold">{errorMsg}</p>
              </div>
              {isPermissionError && (
                <button 
                  onClick={handleSwitchKey}
                  className="w-full py-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-500/40 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  Rotate Project Key
                </button>
              )}
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
            
            {/* Cloning Settings Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Neural DNA Laboratory</label>
                <button 
                  onClick={() => setIsCloningExpanded(!isCloningExpanded)}
                  className={`p-2 rounded-full transition-all ${isCloningExpanded ? 'bg-indigo-500/20 text-indigo-400 rotate-180' : 'text-gray-600 hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              {isCloningExpanded && (
                <div className="space-y-6 pt-2 animate-in slide-in-from-top-4">
                  {!pendingClone ? (
                    <div 
                      onClick={() => !cloning && fileInputRef.current?.click()}
                      className={`group cursor-pointer border-2 border-dashed border-white/10 rounded-3xl p-8 text-center space-y-4 transition-all ${cloning ? 'opacity-50 cursor-wait' : 'hover:border-indigo-500/50 hover:bg-indigo-500/5'}`}
                    >
                      <div className={`w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-3xl transition-transform ${cloning ? 'animate-pulse' : 'group-hover:scale-110'}`}>
                        {cloning ? '💫' : '🧬'}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-200">{cloning ? 'Mapping Neural Pathways...' : 'Start Vocal Mapping'}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{cloning ? 'Capturing Vocal DNA Signature' : 'Upload source audio (.wav, .mp3)'}</p>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleCloneVoice} accept="audio/*" className="hidden" />
                    </div>
                  ) : (
                    <div className="space-y-6 bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/20 shadow-inner">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Clone Alias</label>
                        <input 
                          type="text" 
                          value={pendingClone.name || ''} 
                          onChange={(e) => setPendingClone({...pendingClone, name: e.target.value})}
                          placeholder="Character or Voice Name"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-indigo-500/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Source Gender</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['male', 'female', 'neutral'] as const).map(g => (
                            <button
                              key={g}
                              onClick={() => setPendingClone({...pendingClone, gender: g})}
                              className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${pendingClone.gender === g ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'}`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest px-2">
                            <span>Detected Pitch</span>
                            <span className="text-indigo-400">{pendingClone.settings.pitch}x</span>
                          </div>
                          <input 
                            type="range" min="0.5" max="1.5" step="0.05" 
                            value={pendingClone.settings.pitch ?? 1.0}
                            onChange={(e) => updatePendingCloneSetting('pitch', parseFloat(e.target.value))}
                            className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase text-gray-500 tracking-widest px-2">
                            <span>Detected Rate</span>
                            <span className="text-indigo-400">{pendingClone.settings.rate}x</span>
                          </div>
                          <input 
                            type="range" min="0.5" max="2.0" step="0.05" 
                            value={pendingClone.settings.rate ?? 1.0}
                            onChange={(e) => updatePendingCloneSetting('rate', parseFloat(e.target.value))}
                            className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Detected Style</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['neutral', 'expressive', 'calm', 'authoritative', 'whisper', 'dramatic', 'storyteller'] as const).map(style => (
                              <button
                                key={style}
                                onClick={() => updatePendingCloneSetting('style', style)}
                                className={`py-1.5 rounded-lg text-[8px] font-bold uppercase border transition-all ${pendingClone.settings.style === style ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'}`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Assigned Accent</label>
                          <div className="relative">
                            <select 
                              value={pendingClone.settings.accent || 'natural'}
                              onChange={(e) => updatePendingCloneSetting('accent', e.target.value as any)}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold text-gray-400 outline-none appearance-none focus:border-indigo-500/50 cursor-pointer pr-10"
                            >
                              <option value="natural" className="bg-gray-900">Natural</option>
                              <option value="american" className="bg-gray-900">American</option>
                              <option value="british" className="bg-gray-900">British</option>
                              <option value="australian" className="bg-gray-900">Australian</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-white/5">
                        <button
                          onClick={handlePreviewClone}
                          disabled={previewLoading}
                          className={`w-full py-3 rounded-xl font-bold text-[10px] tracking-widest border transition-all flex items-center justify-center gap-2 ${previewLoading ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 opacity-50' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500 text-white shadow-lg shadow-indigo-500/10'}`}
                        >
                          {previewLoading ? (
                            <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                              <span>PREVIEW CLONE</span>
                            </div>
                          )}
                        </button>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => { 
                              setClonedVoices([pendingClone, ...clonedVoices]); 
                              setSelectedVoice(pendingClone); 
                              setPendingClone(null); 
                              setPreviewUrl(null); 
                            }}
                            className="flex-1 py-3 accent-gradient rounded-xl font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                          >
                            SAVE IDENTITY
                          </button>
                          <button 
                            onClick={() => { setPendingClone(null); setPreviewUrl(null); }}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-gray-500 font-bold uppercase hover:text-white transition-colors"
                            title="Discard"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/5 pt-10 space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Voice Identities</label>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">{clonedVoices.length} Total</span>
              </div>
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
