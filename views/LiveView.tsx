
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioUrl?: string | null;
  timestamp: Date;
}

const AudioPlayer: React.FC<{ url: string; id: string }> = ({ url, id }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = (parseFloat(e.target.value) / 100) * duration;
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  return (
    <div className="w-full bg-black/40 rounded-2xl p-4 border border-white/5 space-y-3">
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={onTimeUpdate} 
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
      
      <div className="flex items-center gap-4">
        <button 
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white hover:bg-indigo-600 transition-all shrink-0 shadow-lg shadow-indigo-500/20"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        <div className="flex-1 space-y-1">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={progress || 0} 
            onChange={handleSeek}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>{Math.floor((audioRef.current?.currentTime || 0) / 60)}:{(Math.floor((audioRef.current?.currentTime || 0) % 60)).toString().padStart(2, '0')}</span>
            <span>{Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}</span>
          </div>
        </div>

        <a 
          href={url} 
          download={`response-${id}.wav`}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Download Audio"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </a>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{isPlaying ? 'Playing Neural Audio' : 'Ready to Play'}</span>
      </div>
    </div>
  );
};

const LiveView: React.FC = () => {
  const [active, setActive] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [responses, setResponses] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTurnAudioChunks, setCurrentTurnAudioChunks] = useState<Uint8Array[]>([]);
  const [currentOutputText, setCurrentOutputText] = useState('');
  const [currentInputText, setCurrentInputText] = useState('');

  const handleSwitchKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setErrorMsg(null);
      setConnStatus('idle');
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [responses, currentInputText, currentOutputText]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  // Buffer REFS to avoid stale closures in onmessage
  const currentOutputTextRef = useRef('');
  const currentInputTextRef = useRef('');
  const currentTurnAudioChunksRef = useRef<Uint8Array[]>([]);
  const responsesRef = useRef<ChatMessage[]>([]);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const encodeWAV = (chunks: Uint8Array[], sampleRate: number) => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length / 2, 0);
    const floatData = new Float32Array(totalLength);
    let floatOffset = 0;
    chunks.forEach(chunk => {
      const int16 = new Int16Array(chunk.buffer);
      for (let i = 0; i < int16.length; i++) floatData[floatOffset++] = int16[i] / 32768.0;
    });
    const buffer = new ArrayBuffer(44 + floatData.length * 2);
    const view = new DataView(buffer);
    const writeString = (v: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) v.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 32 + floatData.length * 2, true);
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
    view.setUint32(40, floatData.length * 2, true);
    let offset = 44;
    for (let i = 0; i < floatData.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, floatData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  const stopConversation = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setActive(false);
    setErrorMsg(null);
  };

  const finalizeTurn = (transcript: string, chunks: Uint8Array[], role: 'user' | 'model' = 'model') => {
    if (!transcript.trim() && chunks.length === 0) return;
    let audioUrl = null;
    if (chunks.length > 0) {
      const wav = encodeWAV(chunks, 24000);
      audioUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    }

    const streamingId = role === 'user' ? 'streaming-user' : 'streaming-model';
    const permanentId = Math.random().toString(36).substr(2, 9);

    setResponses(prev => {
      const updated = [...prev];
      const index = updated.findIndex(m => m.id === streamingId);
      
      const newMessage: ChatMessage = {
        id: permanentId,
        role,
        text: transcript.trim() || (role === 'model' ? '(Neural audio output)' : '(User audio input)'),
        audioUrl,
        timestamp: new Date()
      };

      if (index !== -1) {
        updated[index] = newMessage;
      } else {
        updated.push(newMessage);
      }
      responsesRef.current = updated;
      return updated;
    });

    if (role === 'model') {
      setCurrentTurnAudioChunks([]);
      currentTurnAudioChunksRef.current = [];
      setCurrentOutputText('');
      currentOutputTextRef.current = '';
    } else {
      setCurrentInputText('');
      currentInputTextRef.current = '';
    }
  };

  const exportTranscript = () => {
    const content = responses.map(r => `[${r.timestamp.toLocaleTimeString()}] ${r.role === 'user' ? 'User' : 'Gemini'}: ${r.text}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-transcript-${new Date().getTime()}.txt`;
    a.click();
  };

  const startConversation = async () => {
    setErrorMsg(null);
    setConnStatus('connecting');
    try {
      // Priority: process.env.API_KEY (selected) > process.env.GEMINI_API_KEY (default)
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outputNode = audioContextRef.current.createGain();
      outputNode.connect(audioContextRef.current.destination);
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        console.error("Media Device Permission Error:", err);
        setConnStatus('error');
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMsg("Microphone hardware was not found. Please connect a recording device.");
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg("Microphone access was denied. Please allow permissions in your browser settings.");
        } else {
          setErrorMsg("Could not access microphone. Please check your connection.");
        }
        return;
      }
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            setActive(true);
            setConnStatus('connected');
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const encodedData = encode(new Uint8Array(int16.buffer));
              sessionPromise.then(s => s.sendRealtimeInput({ 
                audio: { data: encodedData, mimeType: 'audio/pcm;rate=16000' } 
              }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (m: any) => {
            const serverContent = m.serverContent;
            if (!serverContent) return;

            // 1. Model Transcript Discovery (check all possible paths)
            let modelDelta = "";
            if (serverContent.modelTurn?.parts) {
              serverContent.modelTurn.parts.forEach((p: any) => { if (p.text) modelDelta += p.text; });
            }
            if (serverContent.outputTranscription?.text) {
              modelDelta += serverContent.outputTranscription.text;
            }

            if (modelDelta) {
              currentOutputTextRef.current += modelDelta;
              setCurrentOutputText(currentOutputTextRef.current);
              setResponses(prev => {
                const index = prev.findIndex(msg => msg.id === 'streaming-model');
                if (index !== -1) {
                  const updated = [...prev];
                  updated[index] = { ...updated[index], text: currentOutputTextRef.current };
                  responsesRef.current = updated;
                  return updated;
                }
                const updated = [...prev, { id: 'streaming-model', role: 'model', text: currentOutputTextRef.current, timestamp: new Date() }];
                responsesRef.current = updated;
                return updated;
              });
            }

            // 2. User Transcript Discovery
            const userText = serverContent.inputTranscription?.text || "";
            if (userText) {
              currentInputTextRef.current = userText;
              setCurrentInputText(userText);
              setResponses(prev => {
                const index = prev.findIndex(msg => msg.id === 'streaming-user');
                if (index !== -1) {
                  const updated = [...prev];
                  updated[index] = { ...updated[index], text: userText };
                  responsesRef.current = updated;
                  return updated;
                }
                const updated = [...prev, { id: 'streaming-user', role: 'user', text: userText, timestamp: new Date() }];
                responsesRef.current = updated;
                return updated;
              });
            }

            // 3. Audio handling
            const audioPart = serverContent.modelTurn?.parts?.find((p: any) => p.inlineData);
            const audioData = audioPart?.inlineData?.data;
            if (audioData) {
              if (currentInputTextRef.current) {
                finalizeTurn(currentInputTextRef.current, [], 'user');
              }
              if (audioContextRef.current) {
                const bytes = decode(audioData);
                currentTurnAudioChunksRef.current.push(bytes);
                setCurrentTurnAudioChunks([...currentTurnAudioChunksRef.current]);
                const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(outputNode);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }
            }

            if (serverContent.turnComplete) {
              finalizeTurn(currentOutputTextRef.current, currentTurnAudioChunksRef.current, 'model');
            }
            if (serverContent.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (err: any) => {
            console.error("Live Session Error:", err);
            const msg = (err?.message || String(err)).toLowerCase();
            if (msg.includes("unavailable")) {
              setErrorMsg("The Neural Engine is currently unavailable in your region or at capacity. Please try again in a few moments or click 'Rotate Key' to use a different project.");
            } else if (msg.includes("403") || msg.includes("permission") || msg.includes("permission_denied")) {
              setErrorMsg("PERMISSION_DENIED: The specified API key does not have permission for the Live API. Ensure billing is enabled on your Cloud Project and click 'Rotate Key' to try another project.");
            } else if (msg.includes("api key") || msg.includes("401")) {
              setErrorMsg("API Key issue detected. Please click 'Rotate Key' to refresh your connection.");
            } else {
              setErrorMsg("Neural link lost. Checking connection parameters... (" + msg + ")");
            }
            setConnStatus('error');
            setActive(false);
          },
          onclose: () => {
            setActive(false);
            setConnStatus('idle');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: "You are a professional Neural Creative Director. Priority: SPEED, ACCURACY, and NATURAL DIALOGUE.\n\nCRITICAL PROTOCOLS:\n1. Speak like a human. Use natural, concise language. No corporate jargon.\n2. AS THE USER SPEAKS, generate your thoughts instantly. \n3. If asked for a 'PROMPT' or 'SCRIPT', deliver it IMMEDIATELY as the very first thing. Skip acknowledgments like 'Okay' or 'Wait' if a deliverable is requested.\n4. Ensure the transcript output is perfectly synced with your speech.\n5. Respond in the same natural style the user uses (e.g., Urdu, English, or mix)."
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Session Initialization Error:", err);
      setErrorMsg("Failed to initiate neural connection. Verify your API key is active.");
      setActive(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-160px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="glass-panel rounded-3xl border-white/5 p-8 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-indigo-500/5 to-transparent shadow-2xl">
        <div className={`w-64 h-64 rounded-full border-4 flex items-center justify-center transition-all duration-1000 ${active ? 'border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.5)] scale-110' : 'border-white/10 grayscale opacity-20'}`}>
           <div className={`w-48 h-48 rounded-full accent-gradient ${active ? 'animate-pulse' : ''} flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]`}>
              <svg className="w-24 h-24 text-white drop-shadow-2xl" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
           </div>
        </div>

        <div className="mt-16 text-center space-y-4 px-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${connStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : connStatus === 'connecting' ? 'bg-amber-500 animate-bounce' : 'bg-red-500'}`}></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {connStatus === 'idle' ? 'Ready' : connStatus === 'connecting' ? 'Calibrating...' : connStatus === 'connected' ? 'Neural Link Online' : 'Link Offline'}
            </span>
          </div>
          <h3 className="text-4xl font-bold font-outfit text-white">{active ? 'Neural Link Active' : 'Voice Interface'}</h3>
          <p className="text-gray-400 max-w-sm mx-auto leading-relaxed">Engage in seamless conversation. Transcription now streams in real-time with ultra-low latency.</p>
          
          {errorMsg && (
            <div className="mt-6 p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] animate-in fade-in zoom-in duration-300 space-y-4">
              <p className="text-red-400 text-sm font-medium leading-relaxed">{errorMsg}</p>
              <button 
                onClick={handleSwitchKey}
                className="w-full py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold text-red-300 hover:bg-red-500/40 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Rotate Project Key
              </button>
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full px-8">
            <button
                onClick={active ? stopConversation : startConversation}
                disabled={connStatus === 'connecting'}
                className={`flex-1 py-5 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-3 text-lg ${active ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30' : 'accent-gradient text-white hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50'}`}
            >
                {active ? 'Terminate Session' : connStatus === 'connecting' ? 'Calibrating...' : 'Initiate Session'}
            </button>
            {errorMsg && !active && (
               <button 
                onClick={startConversation}
                className="px-8 py-5 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all text-indigo-300 flex items-center justify-center gap-2"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 Retry Link
               </button>
            )}
            {active && (
               <button 
                onClick={() => finalizeTurn(currentOutputText, currentTurnAudioChunks)}
                className="px-8 py-5 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all text-indigo-300 flex items-center justify-center gap-2"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                 Capture Turn
               </button>
            )}
        </div>
      </div>

      <div className="flex flex-col space-y-6 h-full overflow-hidden">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Neural Transcript</h4>
          {responses.length > 0 && (
            <button onClick={exportTranscript} className="text-[10px] text-indigo-400 font-bold uppercase hover:text-indigo-300 transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export session
            </button>
          )}
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 glass-panel rounded-[2.5rem] border-white/5 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-black/20 shadow-inner"
        >
          {responses.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center p-12 space-y-6">
               <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
               <p className="text-2xl font-bold font-outfit text-white">Neural sync enabled...</p>
            </div>
          )}
          
          {responses.map((resp) => (
            <div 
              key={resp.id} 
              className={`flex flex-col space-y-2 animate-in slide-in-from-bottom-4 duration-500 ${resp.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[90%] p-6 rounded-3xl shadow-xl transition-all hover:scale-[1.01] ${
                resp.role === 'user' 
                  ? 'bg-white/5 border border-white/10 rounded-tr-none' 
                  : 'bg-indigo-500/10 border border-indigo-500/20 rounded-tl-none'
              } ${resp.id.startsWith('streaming') ? 'opacity-70 border-dashed border-indigo-400/30' : ''}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${resp.role === 'user' ? 'bg-gray-500' : 'bg-indigo-500'} ${resp.id.startsWith('streaming') ? 'animate-pulse' : ''}`}></span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${resp.role === 'user' ? 'text-gray-500' : 'text-indigo-400'}`}>
                    {resp.role === 'user' ? (resp.id.startsWith('streaming') ? 'Listening...' : 'Your input') : (resp.id.startsWith('streaming') ? 'Neural Processing...' : 'Neural output')}
                  </span>
                  {!resp.id.startsWith('streaming') && (
                    <span className="text-[8px] text-gray-600 font-mono bg-black/40 px-1.5 py-0.5 rounded-md ml-auto">
                      {resp.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className={`leading-relaxed font-medium ${resp.role === 'user' ? 'text-gray-300' : 'text-gray-100'}`}>
                  {resp.text}{resp.id.startsWith('streaming') ? '...' : ''}
                </p>
                {resp.audioUrl && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <AudioPlayer url={resp.audioUrl} id={resp.id} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveView;
