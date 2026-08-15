import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, X, Check, ShieldAlert } from 'lucide-react';
import { ReportReason } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const reasons: { id: ReportReason; label: string; desc: string }[] = [
    { id: 'harassment', label: 'Harassment', desc: 'Abusive comments or persistent unwanted messaging' },
    { id: 'spam', label: 'Spam', desc: 'Bots, promotional links, or repetitive messages' },
    { id: 'sexual_content', label: 'Sexual content', desc: 'NSFW, nudity, or explicit sexual content' },
    { id: 'hate_speech', label: 'Hate/abusive content', desc: 'Hate speech, slurs, or abusive harassment' },
    { id: 'scam_fraud', label: 'Scam/fraud', desc: 'Phishing, financial scams, or deceptive links' },
    { id: 'other', label: 'Other', desc: 'Any other safety or community guidelines violation' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;
    onSubmit(selectedReason, details);
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setSelectedReason(null);
      setDetails('');
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center gap-2.5 text-rose-400">
                <Flag className="w-5 h-5" />
                <h3 className="font-semibold text-zinc-100">Report Stranger</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {isSubmitted ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-100">Report Submitted</h4>
                <p className="text-sm text-zinc-400">
                  Thank you for keeping StrangerChat safe. Our moderation team will review this report immediately.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <p className="text-sm text-zinc-400">
                  Please select a reason for reporting this user. Reports are confidential and anonymous.
                </p>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {reasons.map((r) => (
                    <label
                      key={r.id}
                      onClick={() => setSelectedReason(r.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedReason === r.id
                          ? 'bg-rose-500/10 border-rose-500/50 text-zinc-100'
                          : 'bg-zinc-950/50 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        checked={selectedReason === r.id}
                        onChange={() => setSelectedReason(r.id)}
                        className="mt-1 accent-rose-500"
                      />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{r.label}</div>
                        <div className="text-xs text-zinc-400">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Provide any context that helps us understand..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedReason}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600 rounded-xl shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
