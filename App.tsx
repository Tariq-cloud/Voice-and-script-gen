
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import TTSView from './views/TTSView';
import VideoGenView from './views/VideoGenView';
import ImageGenView from './views/ImageGenView';
import MediaAnalysisView from './views/MediaAnalysisView';
import LiveView from './views/LiveView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [keyState, setKeyState] = useState<'Active' | 'Limited' | 'None'>('None');

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
        setKeyState(selected ? 'Active' : 'None');
      } else {
        setHasApiKey(true);
        setKeyState('Active');
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setKeyState('Active');
    }
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard onNavigate={setCurrentView} />;
      case AppView.TTS:
        return <TTSView />;
      case AppView.VIDEO_GEN:
        return <VideoGenView />;
      case AppView.IMAGE_GEN:
        return <ImageGenView />;
      case AppView.MEDIA_UNDERSTANDING:
        return <MediaAnalysisView />;
      case AppView.LIVE_CHAT:
        return <LiveView />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Sidebar activeView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 flex flex-col relative overflow-y-auto">
        {!hasApiKey && (currentView === AppView.VIDEO_GEN || currentView === AppView.IMAGE_GEN) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-md">
            <div className="max-w-md p-8 glass-panel rounded-2xl text-center space-y-6 shadow-2xl">
              <div className="text-5xl">🔑</div>
              <h2 className="text-2xl font-bold font-outfit">Unlock Creative Studio</h2>
              <p className="text-gray-400">
                To use high-fidelity features like Veo Video and Pro Image Gen, you must select a valid Gemini API key from a paid project.
              </p>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                className="block text-indigo-400 hover:text-indigo-300 text-sm underline"
              >
                Learn about API Billing
              </a>
              <button 
                onClick={handleSelectKey}
                className="w-full py-4 accent-gradient rounded-xl font-bold hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all"
              >
                Select API Key
              </button>
            </div>
          </div>
        )}

        <header className="h-16 flex items-center justify-between px-8 border-b border-white/10 shrink-0 sticky top-0 bg-gray-950/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-outfit font-bold text-gradient">
              {currentView.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <span className={`w-2 h-2 rounded-full ${keyState === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {keyState === 'Active' ? 'Primary Engine: Active' : 'Engine Limited'}
              </span>
            </div>
            
            <button 
              onClick={handleSelectKey}
              className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-xl hover:bg-indigo-500/20 transition-all border border-indigo-500/20 flex items-center gap-2"
              title="Add or Switch Project"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              Rotate Key
            </button>
          </div>
        </header>

        <div className="p-8 flex-1">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
