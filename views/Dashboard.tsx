
import React from 'react';
import { AppView } from '../types';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const cards = [
    { view: AppView.TTS, title: 'Voice Synthesis', desc: 'Convert text to ultra-realistic AI voices.', color: 'from-blue-500/20 to-cyan-500/20', icon: '🎙️' },
    { view: AppView.VIDEO_GEN, title: 'Veo Video', desc: 'Create cinematic landscape or portrait videos.', color: 'from-purple-500/20 to-indigo-500/20', icon: '🎬' },
    { view: AppView.IMAGE_GEN, title: 'Image Forge', desc: 'High-res image generation up to 4K.', color: 'from-orange-500/20 to-red-500/20', icon: '🎨' },
    { view: AppView.MEDIA_UNDERSTANDING, title: 'Analyzer', desc: 'Deep transcription and video understanding.', color: 'from-emerald-500/20 to-teal-500/20', icon: '🧠' },
    { view: AppView.LIVE_CHAT, title: 'Live Converse', desc: 'Low-latency conversational voice agent.', color: 'from-pink-500/20 to-rose-500/20', icon: '💬' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <h2 className="text-4xl font-outfit font-bold">Welcome to the <span className="text-gradient">Multimodal Studio</span></h2>
        <p className="text-xl text-gray-400 max-w-2xl">
          Harness the power of Gemini 3.0 and Veo to build, generate, and analyze digital content like never before.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <button
            key={card.view}
            onClick={() => onNavigate(card.view)}
            className={`p-8 rounded-3xl text-left border border-white/5 bg-gradient-to-br ${card.color} hover:scale-[1.02] transition-transform duration-300 group`}
          >
            <div className="text-4xl mb-6 group-hover:scale-110 transition-transform">{card.icon}</div>
            <h3 className="text-2xl font-outfit font-bold mb-2 text-white">{card.title}</h3>
            <p className="text-gray-400 mb-6">{card.desc}</p>
            <div className="flex items-center gap-2 text-indigo-400 font-bold group-hover:gap-4 transition-all">
              Launch Tool
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
