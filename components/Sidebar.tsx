
import React from 'react';
import { AppView } from '../types';

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const items = [
    { view: AppView.DASHBOARD, label: 'Dashboard', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    )},
    { view: AppView.TTS, label: 'Voice Synthesis', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    )},
    { view: AppView.VIDEO_GEN, label: 'Veo Video', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
    )},
    { view: AppView.IMAGE_GEN, label: 'Image Forge', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    )},
    { view: AppView.MEDIA_UNDERSTANDING, label: 'Analyzer', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    )},
    { view: AppView.LIVE_CHAT, label: 'Live Converse', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    )},
  ];

  const handleManualKeySwitch = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <aside className="w-64 border-r border-white/10 flex flex-col glass-panel">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center font-bold">G</div>
          <span className="text-xl font-outfit font-bold tracking-tight">Studio</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        {items.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeView === item.view 
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}

        <div className="pt-8 pb-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-4 mb-4">Project Quota Hub</p>
          <div className="space-y-2 px-2">
            <button 
              onClick={handleManualKeySwitch}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold text-gray-300">Neural Slot 1</span>
              </div>
              <span className="text-[9px] text-emerald-500 font-bold group-hover:underline">ACTIVE</span>
            </button>
            <button 
              onClick={handleManualKeySwitch}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                <span className="text-xs font-bold text-gray-500">Neural Slot 2</span>
              </div>
              <span className="text-[9px] text-indigo-400 font-bold opacity-0 group-hover:opacity-100 uppercase">Switch</span>
            </button>
            <button 
              onClick={handleManualKeySwitch}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/10 hover:border-indigo-500/30 transition-all group"
            >
              <svg className="w-3 h-3 text-gray-500 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              <span className="text-[10px] font-bold text-gray-500 group-hover:text-indigo-400">Add Project Key</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="p-6 mt-auto">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-2">Engine Priority</p>
          <p className="text-sm font-semibold text-white">Gemini 3.0 Ultra</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
