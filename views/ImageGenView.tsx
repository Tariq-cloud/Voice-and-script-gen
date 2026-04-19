
import React, { useState } from 'react';
import { generateImage, QuotaError, PermissionError } from '../services/geminiService';

const ImageGenView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [useNanoPro, setUseNanoPro] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'pollinations'>('gemini');
  const [loading, setLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<'none' | 'quota' | 'permission'>('none');

  const handleSwitchKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setErrorState('none');
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setErrorState('none');
    try {
      const url = await generateImage(prompt, size, useNanoPro, provider);
      setImgUrl(url);
    } catch (err) {
      if (err instanceof QuotaError) {
        setErrorState('quota');
      } else if (err instanceof PermissionError) {
        setErrorState('permission');
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Error Overlay */}
      {errorState !== 'none' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10">
          <div className="max-w-md p-8 glass-panel rounded-3xl text-center space-y-6 shadow-2xl border-indigo-500/20">
            <div className="text-5xl">{errorState === 'quota' ? '🔋' : '🚫'}</div>
            <h2 className="text-2xl font-bold font-outfit">
              {errorState === 'quota' ? 'Project Quota Reached' : 'Access Denied'}
            </h2>
            <p className="text-gray-400">
              {errorState === 'quota' 
                ? "Generation has consumed the current project's allocation. Switch to a secondary API project to continue."
                : "The current key doesn't have permission for this model. Ensure billing is active and you've selected a paid project key."}
            </p>
            <div className="space-y-3">
              <button 
                onClick={handleSwitchKey}
                className="w-full py-4 accent-gradient rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Rotate Project Key
              </button>
              <button 
                onClick={() => {
                  setProvider('pollinations');
                  setErrorState('none');
                  handleGenerate();
                }}
                className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:bg-white/10 transition-all"
              >
                Try Public Core Fallback (Free)
              </button>
            </div>
            <button onClick={() => setErrorState('none')} className="text-xs text-gray-500 uppercase tracking-widest font-bold">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-start bg-white/5 p-6 rounded-3xl border border-white/10 shadow-xl">
        <div className="flex-1 space-y-4 w-full">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Image Concept</label>
            <input
              type="text"
              value={prompt || ''}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A futuristic cyber-punk cityscape at night..."
              className="w-full p-4 glass-panel rounded-xl border-white/10 focus:border-indigo-500/50 outline-none shadow-inner text-sm"
            />
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Engine Selection</label>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setProvider('gemini')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${provider === 'gemini' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Neural Core (Gemini)
                </button>
                <button
                  onClick={() => setProvider('pollinations')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${provider === 'pollinations' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-gray-500 hover:text-gray-300 home-pulse'}`}
                >
                  Public Core (Free)
                </button>
              </div>
            </div>

            {provider === 'gemini' && (
              <div className="flex gap-4 animate-in fade-in slide-in-from-left-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Gemini Model</label>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => {
                        setUseNanoPro(false);
                        setSize('1K');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${!useNanoPro ? 'bg-indigo-500/30 text-indigo-300' : 'text-gray-500'}`}
                    >
                      Banana (Flash)
                    </button>
                    <button
                      onClick={() => setUseNanoPro(true)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${useNanoPro ? 'bg-indigo-500/30 text-indigo-300' : 'text-gray-500'}`}
                    >
                      Nano Pro
                    </button>
                  </div>
                </div>

                {useNanoPro && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Resolution</label>
                    <select 
                      value={size || '1K'}
                      onChange={(e) => setSize(e.target.value as any)}
                      className="p-2 bg-gray-900 border border-white/10 rounded-xl outline-none text-white focus:border-indigo-500/50 shadow-inner text-xs font-bold h-[35px]"
                    >
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0 pt-6">
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt || errorState !== 'none'}
            className="px-10 py-4 accent-gradient rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Forging...</>
            ) : 'Generate Forge'}
          </button>
          <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-widest">
            {useNanoPro ? 'Using Gemini 3 Pro' : 'Using Nano Banana'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 place-items-center">
        <div className="w-full max-w-3xl aspect-square glass-panel rounded-[2.5rem] border-white/5 overflow-hidden flex items-center justify-center group relative shadow-2xl">
          {imgUrl ? (
            <>
              <img src={imgUrl} className="w-full h-full object-cover" alt="Generated" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-8">
                <a 
                  href={imgUrl} 
                  download="gemini-forge-gen.png" 
                  className="p-4 bg-indigo-500 rounded-2xl shadow-lg hover:bg-indigo-600 transition-all hover:scale-110 flex items-center gap-2 font-bold"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Save Creation
                </a>
              </div>
            </>
          ) : (
            <div className="text-center space-y-6 opacity-20 group-hover:opacity-40 transition-opacity">
              {loading ? (
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <>
                  <div className="text-8xl animate-bounce">🍌</div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold font-outfit">Banana Engine Idle</p>
                    <p className="text-sm max-w-xs mx-auto">Select Nano Banana for speed or Nano Pro for high-resolution masterpieces.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageGenView;
