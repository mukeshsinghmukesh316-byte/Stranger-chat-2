import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Check,
  X,
  HeartHandshake,
  Ban,
  Lock,
  Flag,
  UserX,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface CommunityRulesModalProps {
  isOpen: boolean;
  mode?: 'acknowledge' | 'safety_view';
  onAcceptRules?: () => void;
  onClose?: () => void;
  onOpenReport?: () => void;
  onOpenBlock?: () => void;
  isInChat?: boolean;
}

export const CommunityRulesModal: React.FC<CommunityRulesModalProps> = ({
  isOpen,
  mode = 'acknowledge',
  onAcceptRules,
  onClose,
  onOpenReport,
  onOpenBlock,
  isInChat = false,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const rulesList = [
    {
      icon: HeartHandshake,
      color: 'text-indigo-400',
      title: 'Be respectful',
      desc: 'Treat strangers with kindness, courtesy, and human dignity at all times.',
    },
    {
      icon: Ban,
      color: 'text-rose-400',
      title: 'No harassment or threats',
      desc: 'Zero tolerance for bullying, intimidation, threats, or aggressive behavior.',
    },
    {
      icon: AlertTriangle,
      color: 'text-amber-400',
      title: 'No sexual content or exploitation',
      desc: 'Explicit sexual content, nudity, and non-consensual material are strictly prohibited.',
    },
    {
      icon: ShieldCheck,
      color: 'text-violet-400',
      title: 'No hate or abusive content',
      desc: 'No discrimination based on race, gender, religion, orientation, or nationality.',
    },
    {
      icon: Ban,
      color: 'text-emerald-400',
      title: 'No scams or illegal activity',
      desc: 'Phishing, financial solicitation, spamming, and illegal offers will result in a ban.',
    },
    {
      icon: Lock,
      color: 'text-blue-400',
      title: 'Protect your privacy & financial data',
      desc: 'Do not share passwords, financial details, bank info, addresses, or private IDs.',
    },
    {
      icon: Flag,
      color: 'text-rose-400',
      title: 'Use Report and Block when necessary',
      desc: 'Report rule violations immediately and block toxic users to protect yourself and others.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 text-zinc-100 relative my-auto overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Community Safety Rules
              </h2>
              <p className="text-xs text-zinc-400">
                {mode === 'acknowledge'
                  ? 'Step 2: Review and agree to StrangerChat rules'
                  : 'Safety Center & Community Code of Conduct'}
              </p>
            </div>
          </div>

          {mode === 'safety_view' && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close safety rules"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Rules Grid / List */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          {rulesList.map((rule, idx) => {
            const IconComp = rule.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-left"
              >
                <div
                  className={`w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5 ${rule.color}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-200">
                    {rule.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
                    {rule.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer / Action Section */}
        {mode === 'acknowledge' ? (
          <div className="space-y-4 pt-2 border-t border-zinc-800/80">
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors group">
              <div className="relative flex items-center pt-0.5">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer transition-all"
                />
              </div>
              <span className="text-xs sm:text-sm text-zinc-200 font-medium leading-snug group-hover:text-white transition-colors">
                I agree to follow the community rules.
              </span>
            </label>

            <button
              type="button"
              onClick={onAcceptRules}
              disabled={!isChecked}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border disabled:border-zinc-700/50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Accept & Continue</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            {isInChat && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenReport?.();
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report Stranger</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenBlock?.();
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Block Stranger</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 transition-all"
            >
              Close Safety Rules
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
