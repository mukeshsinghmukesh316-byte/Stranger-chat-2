import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Wrench, Clock, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  estimatedTime?: string;
  onRefreshStatus?: () => void;
  onOpenAdmin?: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  message = 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.',
  estimatedTime,
  onRefreshStatus,
  onOpenAdmin,
}) => {
  if (!isOpen) return null;

  const displayNotice = message.trim() || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        {/* Backdrop Click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-950/50 overflow-hidden z-10 text-slate-100"
        >
          {/* Top Decorative Amber Bar */}
          <div className="h-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-20"
            aria-label="Close maintenance notice"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header Icon & Title */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/30">
                  <Wrench className="w-8 h-8 animate-bounce" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Maintenance Active</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight pt-1">
                  System Under Maintenance
                </h2>
              </div>
            </div>

            {/* Custom Admin Announcement Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-100 space-y-2.5">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                Announcement from Admin:
              </span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                &quot;{displayNotice}&quot;
              </p>

              {estimatedTime && (
                <div className="pt-2 border-t border-amber-500/20 flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Estimated Return: <strong className="text-white">{estimatedTime}</strong></span>
                </div>
              )}
            </div>

            {/* What is Paused Checklist */}
            <div className="space-y-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300">
              <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                Current Service Status:
              </span>
              <ul className="space-y-1.5 pt-0.5">
                <li className="flex items-center gap-2 text-amber-200/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>Public matchmaking & chat queueing are paused</span>
                </li>
                <li className="flex items-center gap-2 text-amber-200/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>Voice and Video calls are temporarily offline</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Admin tools and system diagnostics remain active</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all text-center"
              >
                Understood
              </button>

              {onRefreshStatus && (
                <button
                  onClick={onRefreshStatus}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span>Check Status</span>
                </button>
              )}

              {onOpenAdmin && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="w-full sm:w-auto py-3 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  title="Admin Portal Login"
                >
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
