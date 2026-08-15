import React from 'react';
import { motion } from 'motion/react';
import { ShieldX, AlertTriangle, RotateCcw, ExternalLink } from 'lucide-react';

interface RestrictedAccessModalProps {
  isOpen: boolean;
  onRetryAgeCheck: () => void;
}

export const RestrictedAccessModal: React.FC<RestrictedAccessModalProps> = ({
  isOpen,
  onRetryAgeCheck,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-zinc-900 border border-rose-500/30 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-100 relative text-center overflow-hidden"
      >
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-1">
          <ShieldX className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
            Access Restricted
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-1">
            StrangerChat is strictly for adults 18+.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
            You indicated that you are under 18 years old. To ensure user safety and compliance, random anonymous matchmaking is not permitted for minors.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-left text-xs text-zinc-400 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Matchmaking Connection Blocked</span>
          </div>
          <p className="leading-normal">
            No socket connection or chat sessions have been initiated for this browser session.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={onRetryAgeCheck}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>I am 18+ (Re-verify Age)</span>
          </button>

          <a
            href="https://www.google.com"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Exit StrangerChat</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </motion.div>
    </div>
  );
};
