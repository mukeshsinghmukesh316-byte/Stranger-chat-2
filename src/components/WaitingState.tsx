import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { XCircle, Search, Sparkles, Languages, Globe2, Users, Lightbulb } from 'lucide-react';
import { OnlineStats } from '../types';

interface WaitingStateProps {
  selectedTopic?: string;
  interests?: string[];
  language?: string;
  country?: string;
  onlineStats?: OnlineStats;
  onCancel: () => void;
}

export const WaitingState: React.FC<WaitingStateProps> = ({
  interests = [],
  language,
  country,
  onlineStats,
  onCancel,
}) => {
  const [tipIndex, setTipIndex] = useState(0);

  const tips = [
    "Say 'Hi!' or ask a fun question to break the ice.",
    "Click 'Next' anytime if you want to speak with someone else.",
    "Never share personal information, passwords, or financial details.",
    "Be kind, respectful, and keep the community friendly.",
    "Use Report or Block controls immediately if someone makes you uncomfortable.",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const onlineCount = onlineStats?.onlineCount;
  const waitingCount = onlineStats?.waitingCount;

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-center items-center px-4 py-8 max-w-2xl mx-auto text-center overflow-hidden">
      
      {/* Central Radar Visualizer */}
      <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center my-4 sm:my-6">
        {/* Concentric Pulse Rings */}
        <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-radar" />
        <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-radar-delayed" />
        <div className="absolute w-40 h-40 sm:w-52 sm:h-52 rounded-full border border-zinc-800 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center" />
        <div className="absolute w-24 h-24 sm:w-36 sm:h-36 rounded-full border border-indigo-500/40 bg-indigo-950/20" />

        {/* Center Glowing Particle & Search Icon */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 border border-indigo-400/30"
        >
          <Search className="w-8 h-8 sm:w-9 sm:h-9 animate-pulse text-indigo-100" />
        </motion.div>
      </div>

      {/* Main Waiting Title with Animated Dots */}
      <div className="space-y-4 z-10 w-full">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Looking for a stranger
          </h2>
          <div className="flex items-center gap-1 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>

        {/* Real Live Stats Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200">
            {onlineCount !== undefined ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>
                  <strong className="text-white font-bold">{onlineCount}</strong> {onlineCount === 1 ? 'person' : 'people'} online
                </span>
              </>
            ) : (
              <span className="text-zinc-400">Online count unavailable</span>
            )}
          </div>

          {waitingCount !== undefined && waitingCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
              <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                <strong className="text-white font-bold">{waitingCount}</strong> {waitingCount === 1 ? 'person' : 'people'} looking
              </span>
            </div>
          )}
        </div>

        {/* Preferences Badges */}
        <div className="flex flex-wrap justify-center items-center gap-2 max-w-md mx-auto pt-1">
          {language && language !== 'Any' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-indigo-300 text-xs font-medium">
              <Languages className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Language: <strong className="text-white">{language}</strong></span>
            </div>
          )}

          {country && country !== 'Any country' && country !== 'Any' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-indigo-300 text-xs font-medium">
              <Globe2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Country: <strong className="text-white">{country}</strong></span>
            </div>
          )}

          {interests.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-indigo-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Interests: <span className="text-white">{interests.join(', ')}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Safety / Etiquette Tip Box */}
      <div className="mt-6 mb-5 p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left max-w-md w-full space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
          <Lightbulb className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>StrangerChat Tip</span>
        </div>
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-xs text-zinc-300 leading-relaxed"
        >
          {tips[tipIndex]}
        </motion.p>
      </div>

      {/* Cancel Search Button */}
      <button
        onClick={onCancel}
        className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-zinc-200 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 active:scale-95 transition-all shadow-md min-h-[44px]"
      >
        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <span>Cancel Search</span>
      </button>
    </div>
  );
};
