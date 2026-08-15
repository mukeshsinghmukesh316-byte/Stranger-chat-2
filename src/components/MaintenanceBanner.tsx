import React from 'react';
import { AlertTriangle, Wrench, ShieldAlert, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface MaintenanceBannerProps {
  isMaintenanceMode: boolean;
  message?: string;
  estimatedTime?: string;
}

export const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({
  isMaintenanceMode,
  message = 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.',
  estimatedTime,
}) => {
  if (!isMaintenanceMode) return null;

  const displayMessage = message.trim() || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="w-full bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/40 text-amber-100 px-4 py-3 shadow-lg shadow-amber-950/30 backdrop-blur-md z-40 relative"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center sm:text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 shrink-0 relative">
            <Wrench className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-bold text-xs sm:text-sm text-amber-300 uppercase tracking-wider bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 shrink-0 w-fit mx-auto sm:mx-0">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Maintenance Active
            </span>
            <p className="text-xs sm:text-sm text-amber-100 font-medium leading-tight">
              {displayMessage}
            </p>
          </div>
        </div>

        {estimatedTime ? (
          <div className="shrink-0 text-[11px] font-semibold text-amber-200 bg-amber-950/80 border border-amber-500/40 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Return: {estimatedTime}</span>
          </div>
        ) : (
          <div className="shrink-0 text-[11px] font-semibold text-amber-300/90 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-lg flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Please try again later</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
