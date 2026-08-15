import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Check, X, AlertOctagon } from 'lucide-react';

interface AgeGateModalProps {
  isOpen: boolean;
  onConfirmAge: () => void;
  onUnder18: () => void;
}

export const AgeGateModal: React.FC<AgeGateModalProps> = ({
  isOpen,
  onConfirmAge,
  onUnder18,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-100 relative overflow-hidden"
      >
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-violet-500" />

        {/* Header Badge & Title */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            Age Verification Required
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            StrangerChat is for adults 18+.
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
            StrangerChat enables anonymous 1-on-1 text messaging with adults globally.
            You must be at least 18 years old to access this platform.
          </p>
        </div>

        {/* Checkbox Section */}
        <div className="space-y-4 pt-1">
          <label className="flex items-start gap-3 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors group">
            <div className="relative flex items-center pt-0.5">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500/40 focus:ring-offset-zinc-900 cursor-pointer transition-all"
              />
            </div>
            <span className="text-xs sm:text-sm text-zinc-200 font-medium leading-snug group-hover:text-white transition-colors">
              I confirm that I am 18 years old or older.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={onConfirmAge}
              disabled={!isChecked}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border disabled:border-zinc-700/50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Continue</span>
            </button>

            <button
              type="button"
              onClick={onUnder18}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>I am under 18 / Exit</span>
            </button>
          </div>
        </div>

        {/* Privacy Note */}
        <p className="text-[11px] text-center text-zinc-500 leading-tight">
          No personal identity or location data is collected or saved. Age status exists strictly for active connection safety.
        </p>
      </motion.div>
    </div>
  );
};
