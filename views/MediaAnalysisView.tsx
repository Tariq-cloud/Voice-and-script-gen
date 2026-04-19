
import React, { useState } from 'react';
import { analyzeMedia, analyzeUrl, PermissionError } from '../services/geminiService';
import { AnalysisResult } from '../types';

interface SequencedSegment {
  type: string;
  timestamp?: string;
  text: string;
}

interface EnhancedAnalysisResult extends AnalysisResult {
  sequencedScript?: SequencedSegment[];
  grounding?: any[];
}

const MediaAnalysisView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [result, setResult] = useState<EnhancedAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const url = URL.createObjectURL(f);
      setPreview(url);
      setResult(null);
      setError(null);
      setUrlInput('');
    }
  };

  const downloadScript = () => {
    if (!result) return;
    let content = `GEMINI MULTIMODAL STUDIO - ANALYSIS REPORT\n\nSUMMARY & TRANSCRIPT:\n${result.summary}\n\n`;
    
    if (result.sequencedScript && result.sequencedScript.length > 0) {
      content += `SEQUENCED SCRIPT:\n`;
      result.sequencedScript.forEach(s => {
        content += `[${s.type.toUpperCase()}] ${s.timestamp ? `(${s.timestamp})` : ''}\n${s.text}\n\n`;
      });
    }

    if (result.transcript && result.transcript !== "See full analysis text above for the verbatim transcript.") {
      content += `\nFULL VERBATIM TRANSCRIPT:\n${result.transcript}`;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${new Date().getTime()}.txt`;
    a.click();
  };

  const handleSwitchKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setError(null);
      setIsPermissionError(false);
    }
  };

  const processUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setIsPermissionError(false);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const analysis = await analyzeMedia(base64, file.type);
          setResult(analysis);
        } catch (err: any) {
          if (err instanceof PermissionError) {
            setIsPermissionError(true);
            setError(err.message);
          } else {
            setError(err.message || 'Media extraction failed. Ensure the clip is under 50MB.');
          }
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Failed to read media file.');
      setLoading(false);
    }
  };

  const processUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setIsPermissionError(false);
    try {
      const analysis = await analyzeUrl(urlInput);
      setResult(analysis);
    } catch (err: any) {
      if (err instanceof PermissionError) {
        setIsPermissionError(true);
        setError(err.message);
      } else {
        setError(err.message || 'Could not analyze URL. Verify the source is publicly accessible.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to detect Urdu/Arabic characters for RTL support
  const isRTL = (text: string) => {
    const ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF';
    const rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC';
    const rtlDirCheck = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']');
    return rtlDirCheck.test(text);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Inputs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-3xl overflow-hidden border-white/5 shadow-2xl">
            <div className="flex border-b border-white/10">
              <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-4 font-bold text-sm transition-all ${activeTab === 'upload' ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Upload File
              </button>
              <button 
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-4 font-bold text-sm transition-all ${activeTab === 'url' ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Video URL (Urdu/Eng)
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'upload' ? (
                <div className="space-y-6">
                  <div className="p-12 glass-panel rounded-2xl border-dashed border-white/10 flex flex-col items-center justify-center gap-6 relative overflow-hidden h-72 group hover:border-indigo-500/30 transition-all">
                    {preview ? (
                      file?.type.startsWith('video') ? (
                        <video src={preview} controls className="w-full h-full object-contain" />
                      ) : (
                        <audio src={preview} controls className="w-full" />
                      )
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📁</div>
                        <div className="text-center">
                          <p className="font-bold">Select Local Media</p>
                          <p className="text-gray-500 text-xs">Full extraction support</p>
                        </div>
                      </>
                    )}
                    <input type="file" accept="video/*,audio/*" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" title="Upload media" />
                  </div>
                  <button
                    onClick={processUpload}
                    disabled={loading || !file}
                    className="w-full py-4 accent-gradient rounded-2xl font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-indigo-500/10"
                  >
                    {loading ? 'Analyzing Content...' : 'Begin Deep Extraction'}
                  </button>
                </div>
              ) : (
                <form onSubmit={processUrl} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Video URL</label>
                    <input 
                      type="url" 
                      value={urlInput || ''}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste link (YouTube, Social, etc.)"
                      className="w-full p-4 glass-panel rounded-xl border-white/10 focus:border-indigo-500/50 outline-none text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">Gemini will use Google Search to find the full transcript and analyze all video content in its original language.</p>
                  
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                      <p className="text-red-400 text-xs font-medium">{error}</p>
                      {isPermissionError && (
                        <button 
                          onClick={handleSwitchKey}
                          className="w-full py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-[10px] font-bold text-red-300 hover:bg-red-500/40 transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                          Rotate Project Key
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !urlInput}
                    className="w-full py-4 accent-gradient rounded-2xl font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-indigo-500/10"
                  >
                    {loading ? 'Retrieving Transcript...' : 'Analyze URL Content'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {result && (
             <div className="glass-panel rounded-3xl p-8 border-white/5 space-y-6 animate-in slide-in-from-left-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-[0.2em]">Comprehensive Analysis</h3>
                  <button onClick={downloadScript} className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>
                <div 
                  className={`text-gray-200 text-base leading-relaxed whitespace-pre-wrap ${isRTL(result.summary) ? 'text-right' : 'text-left'}`}
                  dir={isRTL(result.summary) ? 'rtl' : 'ltr'}
                >
                  {result.summary}
                </div>
                
                {result.grounding && result.grounding.length > 0 && (
                  <div className="pt-6 space-y-3 border-t border-white/10">
                    <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Verification Sources</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.grounding.map((chunk, i) => (
                        chunk.web && (
                          <a 
                            key={i} 
                            href={chunk.web.uri} 
                            target="_blank" 
                            className="text-[10px] bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all truncate max-w-[200px]"
                          >
                            {chunk.web.title || "View Reference"}
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}
             </div>
          )}
        </div>

        {/* Right: Sequenced Script / Transcripts */}
        <div className="lg:col-span-7 space-y-6">
          <div className="h-full flex flex-col glass-panel rounded-[2rem] border-white/5 overflow-hidden shadow-2xl bg-black/20 min-h-[600px]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-bold font-outfit text-xl flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${loading ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`}></span>
                Verbatim Media Transcript
              </h3>
              {loading && <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest animate-pulse">Neural Extraction in progress...</div>}
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-8 py-20">
                  <div className="w-24 h-24 rounded-[2rem] border border-white/10 flex items-center justify-center text-6xl shadow-inner">📜</div>
                  <div className="space-y-3">
                    <p className="text-3xl font-bold font-outfit">Waiting for Input</p>
                    <p className="text-sm max-w-xs mx-auto">Upload or link a video to extract exact content, scripts, and multi-language transcripts.</p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center space-y-8 py-20">
                  <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-xl"></div>
                  <div className="text-center space-y-2">
                    <p className="text-indigo-400 text-xl font-bold animate-pulse">Mapping Neural Audio Frequencies...</p>
                    <p className="text-gray-500 text-xs">Identifying language and generating verbatim script.</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-8">
                  {result.sequencedScript && result.sequencedScript.length > 0 ? (
                    result.sequencedScript.map((segment, idx) => (
                      <div key={idx} className="relative pl-12 group">
                        {/* Vertical line */}
                        {idx !== result.sequencedScript!.length - 1 && (
                          <div className="absolute left-[23px] top-12 bottom-[-40px] w-0.5 bg-white/5 group-hover:bg-indigo-500/20 transition-colors"></div>
                        )}
                        
                        {/* Dot */}
                        <div className="absolute left-0 top-1 w-12 h-12 flex items-center justify-center">
                          <div className={`w-4 h-4 rounded-full ring-8 ring-black shadow-2xl transition-all group-hover:scale-125 ${
                            segment.type.toLowerCase().includes('hook') ? 'bg-rose-500 shadow-rose-500/20' :
                            segment.type.toLowerCase().includes('intro') ? 'bg-amber-500 shadow-amber-500/20' :
                            segment.type.toLowerCase().includes('outro') ? 'bg-indigo-500 shadow-indigo-500/20' : 'bg-emerald-500 shadow-emerald-500/20'
                          }`}></div>
                        </div>

                        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.05] transition-all hover:translate-x-1 shadow-lg">
                          <div className="flex items-center justify-between mb-4">
                            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] px-3 py-1 rounded-lg ${
                              segment.type.toLowerCase().includes('hook') ? 'bg-rose-500/10 text-rose-400' :
                              segment.type.toLowerCase().includes('intro') ? 'bg-amber-500/10 text-amber-400' :
                              segment.type.toLowerCase().includes('outro') ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {segment.type}
                            </span>
                            {segment.timestamp && (
                              <span className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-0.5 rounded-md">{segment.timestamp}</span>
                            )}
                          </div>
                          <p 
                            className={`text-gray-300 text-base leading-relaxed whitespace-pre-wrap ${isRTL(segment.text) ? 'text-right' : 'text-left'}`}
                            dir={isRTL(segment.text) ? 'rtl' : 'ltr'}
                          >
                            {segment.text}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Verbatim Script Extraction</h4>
                        <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded-md">Neural Capture: 100%</span>
                       </div>
                       <div 
                        className={`bg-black/40 p-10 rounded-[2.5rem] border border-white/5 text-gray-300 text-lg font-outfit whitespace-pre-wrap leading-loose shadow-inner ${isRTL(result.transcript) ? 'text-right' : 'text-left'}`}
                        dir={isRTL(result.transcript) ? 'rtl' : 'ltr'}
                       >
                        {result.transcript === "See full analysis text above for the verbatim transcript." 
                          ? <div className="opacity-50 italic">The transcript is included in the full analysis block on the left.</div>
                          : result.transcript
                        }
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaAnalysisView;
