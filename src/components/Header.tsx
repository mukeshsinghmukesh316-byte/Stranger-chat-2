import React, { useState } from 'react';
import {
  MessageSquareText,
  ShieldAlert,
  UserX,
  RotateCw,
  Play,
  RefreshCw,
  ShieldCheck,
  Menu,
  X,
  Home,
  Info,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { AppScreen, ConnectionState, SocketConnectionStatus } from '../types';

interface HeaderProps {
  currentScreen: AppScreen;
  connectionState: ConnectionState;
  socketStatus?: SocketConnectionStatus;
  isMaintenanceMode?: boolean;
  onNavigate: (screen: AppScreen) => void;
  onStartChat: () => void;
  onNext: () => void;
  onCancelWaiting?: () => void;
  onOpenReport: () => void;
  onOpenBlock: () => void;
  onOpenSafety?: () => void;
  onOpenAbout?: () => void;
  onRetryConnection?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  connectionState,
  socketStatus = 'connected',
  isMaintenanceMode = false,
  onNavigate,
  onStartChat,
  onNext,
  onCancelWaiting,
  onOpenReport,
  onOpenBlock,
  onOpenSafety,
  onOpenAbout,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (screen: AppScreen) => {
    setIsMobileMenuOpen(false);
    onNavigate(screen);
  };

  const handleSafetyClick = () => {
    setIsMobileMenuOpen(false);
    if (onOpenSafety) onOpenSafety();
  };

  const handleAboutClick = () => {
    setIsMobileMenuOpen(false);
    if (onOpenAbout) {
      onOpenAbout();
    } else {
      onNavigate('landing');
      setTimeout(() => {
        const elem = document.getElementById('about-section');
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand Logo & Desktop Nav Links */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button
            onClick={() => handleNavClick('landing')}
            className="flex items-center gap-2 text-left group focus:outline-none shrink-0"
            aria-label="StrangerChat Home"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <MessageSquareText className="w-4 h-4 sm:w-5 sm:h-5 fill-white/10" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-zinc-100 group-hover:text-white transition-colors">
                Stranger<span className="text-indigo-400">Chat</span>
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-4" aria-label="Main Navigation">
            <button
              onClick={() => handleNavClick('landing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                currentScreen === 'landing'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={handleSafetyClick}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Safety</span>
            </button>

            <button
              onClick={handleAboutClick}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
            >
              <Info className="w-3.5 h-3.5 text-violet-400" />
              <span>About</span>
            </button>
          </nav>
        </div>

        {/* Right Section: Status Indicator, Action CTA, Mobile Menu Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Connection Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] sm:text-xs font-medium shrink-0"
            role="status"
            aria-live="polite"
          >
            {socketStatus === 'reconnecting' || socketStatus === 'connecting' ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" aria-hidden="true" />
                <span className="text-amber-300 hidden xs:inline">Reconnecting...</span>
              </>
            ) : socketStatus === 'error' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />
                <span className="text-rose-400 hidden xs:inline">Error</span>
              </>
            ) : connectionState === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
                <span className="text-emerald-400 hidden xs:inline">Connected</span>
              </>
            ) : connectionState === 'searching' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" aria-hidden="true" />
                <span className="text-amber-300 hidden xs:inline">Searching...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                <span className="text-zinc-300 hidden xs:inline">Online</span>
              </>
            )}
          </div>

          {/* Primary Action Button based on Current State */}
          {currentScreen === 'waiting' && (
            <button
              onClick={onCancelWaiting || (() => onNavigate('landing'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors min-h-[36px]"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Cancel</span>
            </button>
          )}

          {currentScreen === 'chat' && (
            <div className="flex items-center gap-1.5">
              {connectionState === 'idle' || connectionState === 'disconnected' ? (
                <button
                  onClick={onStartChat}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] ${
                    isMaintenanceMode
                      ? 'text-amber-300 bg-amber-950/80 hover:bg-amber-900/90 border border-amber-500/50 shadow-sm active:scale-95'
                      : 'text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95'
                  }`}
                  aria-label="Start Chat"
                  title={isMaintenanceMode ? 'StrangerChat is under maintenance - Click for details' : 'Start Chat'}
                >
                  {isMaintenanceMode ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isMaintenanceMode ? 'Maintenance' : 'Start Chat'}</span>
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 transition-all min-h-[36px]"
                  title="Find next stranger"
                  aria-label="Next stranger"
                >
                  <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Next</span>
                </button>
              )}
            </div>
          )}

          {/* Compact Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            aria-label="Toggle Navigation Menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-2 pt-2 border-t border-zinc-800/80 flex flex-col gap-1 pb-1 animate-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => handleNavClick('landing')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
              currentScreen === 'landing' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={handleSafetyClick}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 flex items-center gap-2.5"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Safety Guidelines & Rules</span>
          </button>

          <button
            onClick={handleAboutClick}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 flex items-center gap-2.5"
          >
            <Info className="w-4 h-4 text-violet-400" />
            <span>About StrangerChat</span>
          </button>

          {currentScreen === 'chat' && (
            <div className="pt-2 mt-1 border-t border-zinc-800/80 flex items-center justify-around">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenReport();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Report</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenBlock();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Block</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
