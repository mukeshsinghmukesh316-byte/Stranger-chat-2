import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SocketConnectionStatus } from '../types';

interface ConnectionBannerProps {
  socketStatus: SocketConnectionStatus;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  isOffline?: boolean;
  onRetry: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  socketStatus,
  reconnectAttempts,
  maxReconnectAttempts,
  isOffline = false,
  onRetry,
}) => {
  const [showConnectedNotice, setShowConnectedNotice] = useState(false);
  const [hasWasDisconnected, setHasWasDisconnected] = useState(false);

  useEffect(() => {
    if (socketStatus === 'reconnecting' || socketStatus === 'error' || isOffline) {
      setHasWasDisconnected(true);
    }
    if (socketStatus === 'connected' && hasWasDisconnected) {
      setShowConnectedNotice(true);
      const timer = setTimeout(() => {
        setShowConnectedNotice(false);
        setHasWasDisconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [socketStatus, isOffline, hasWasDisconnected]);

  if (socketStatus === 'connected' && !showConnectedNotice) {
    return null;
  }

  return (
    <div className="w-full transition-all z-30">
      {/* Reconnecting / Trying to reconnect */}
      {(socketStatus === 'reconnecting' || socketStatus === 'connecting') && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-3 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="font-semibold text-amber-300">Connection lost</span>
              <span className="text-amber-200/80">
                Trying to reconnect... {reconnectAttempts > 0 && `(Attempt ${reconnectAttempts} of ${maxReconnectAttempts})`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Connection error / Offline / Max attempts reached */}
      {(socketStatus === 'error' || (socketStatus === 'disconnected' && isOffline)) && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2.5 text-rose-200 text-xs sm:text-sm flex items-center justify-between gap-3 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="font-semibold text-rose-300">
                {isOffline ? 'You are offline' : 'Unable to connect'}
              </span>
              <span className="text-rose-200/80">
                {isOffline
                  ? 'Please check your internet connection.'
                  : 'Failed to establish connection to server. Please try again.'}
              </span>
            </div>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-md shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Reconnected Confirmation */}
      {socketStatus === 'connected' && showConnectedNotice && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-emerald-200 text-xs sm:text-sm flex items-center justify-center gap-2 backdrop-blur-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">Connected</span>
        </div>
      )}
    </div>
  );
};
