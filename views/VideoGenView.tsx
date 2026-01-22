
import React, { useState } from 'react';
import { generateVideo, QuotaError, PermissionError } from '../services/geminiService';

const VideoGenView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [startImage, setStartImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [errorState, setErrorState] = useState<'none' | 'quota' | 'permission'>('none');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setStartImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSwitchKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setErrorState('none');
      setStatus('Key manually rotated. Ready to retry generation.');
    }
  };

  const handleGenerate = async () => {
    if (!prompt && !startImage) return;
    setLoading(true);
    setErrorState('none');
    setStatus('Contacting Veo servers...');
    try {
      const url = await generateVideo(prompt, aspectRatio, startImage || undefined);
      setVideoUrl(url);
    } catch (err) {
      if (err instanceof QuotaError) {
        setErrorState('quota');
        setStatus('Quota limit reached. Switch to a manual backup key.');
      } else if (err instanceof PermissionError) {
        setErrorState('permission');
        setStatus('Permission Denied. Project rotation required.');
      } else {
        console.error(err);
        setStatus('Generation failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Error Overlays */}
      {errorState !== 'none' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-lg rounded-[2.5rem] p-8 border border-red-500/20 shadow-2xl">
          <div className="max-w-md text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-4xl mb-4">
              {errorState === 'quota' ? '⚠️' : '🚫'}
            </div>
            <h2 className="text-3xl font-bold font-outfit text-white">
              {errorState === 'quota' ? 'Veo Project Limited' : 'Access Restricted'}
            </h2>
            <p className="text-gray-400">
              {errorState === 'quota' 
                ? "The current API project has reached its quota. Use the button below to manually switch to your backup Veo project."
                : "The current key doesn't have permissions. Ensure billing is enabled and switch projects manually."}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSwitchKey}
                className="w-full py-4 accent-gradient rounded-2xl font-bold hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Manually Switch Project Key
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase font-bold tracking-widest mt-2"
              >
                Gemini API Billing Docs
              </a>
              <button 
                onClick={() => setErrorState('none')}
                className="text-gray-600 hover:text-white text-xs py-2 font-medium"
              >
                Dismiss Error
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:col-span-4 space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Creative Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your cinematic vision..."
            className="w-full h-32 p-4 glass-panel rounded-xl border-white/10 focus:border-indigo-500/50 outline-none resize-none"
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Aspect Ratio</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`flex-1 py-3 rounded-xl border transition-all ${aspectRatio === '16:9' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
              Landscape
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`flex-1 py-3 rounded-xl border transition-all ${aspectRatio === '9:16' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
              Portrait
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-white/5 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Project Key Health</p>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
            <button 
                onClick={handleSwitchKey}
                className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Switch Veo Key
            </button>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || errorState !== 'none'}
          className="w-full py-4 accent-gradient rounded-2xl font-bold transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-indigo-500/20"
        >
          {loading ? 'Processing Video...' : 'Generate with Veo'}
        </button>
      </div>

      <div className="lg:col-span-8 space-y-4">
        <div className="aspect-video w-full glass-panel rounded-3xl border-white/5 overflow-hidden relative flex items-center justify-center group shadow-2xl">
          {videoUrl ? (
            <>
              <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={videoUrl} 
                  download="veo-video.mp4" 
                  className="p-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 hover:bg-black/80 flex items-center gap-2 font-bold text-sm"
                >
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Video
                </a>
              </div>
            </>
          ) : (
            <div className="text-center p-8">
              {loading ? (
                <div className="space-y-6">
                  <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto shadow-[0_0_20px_rgba(99,102,241,0.3)]" />
                  <p className="text-indigo-300 font-medium animate-pulse">{status}</p>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">Generation is currently using your primary active project key.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-6xl opacity-20">🎬</div>
                  <p className="text-gray-500 font-medium">Create a cinematic video with Veo Engine.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenView;
