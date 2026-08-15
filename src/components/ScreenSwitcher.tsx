import React from 'react';
import { Home, Loader2, MessageSquare, Radio } from 'lucide-react';
import { AppScreen, ConnectionState } from '../types';

interface ScreenSwitcherProps {
  currentScreen: AppScreen;
  connectionState: ConnectionState;
  onSelectScreen: (screen: AppScreen) => void;
  onSetConnectionState: (state: ConnectionState) => void;
}

export const ScreenSwitcher: React.FC<ScreenSwitcherProps> = ({
  currentScreen,
  connectionState,
  onSelectScreen,
  onSetConnectionState,
}) => {
  return (
    <div className="bg-zinc-900/90 border-b border-zinc-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      
      {/* Screen View Controls */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] hidden sm:inline">
          Screen:
        </span>
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => onSelectScreen('landing')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentScreen === 'landing'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Landing</span>
          </button>

          <button
            onClick={() => onSelectScreen('waiting')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentScreen === 'waiting'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Loader2 className="w-3.5 h-3.5" />
            <span>Waiting</span>
          </button>

          <button
            onClick={() => onSelectScreen('chat')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentScreen === 'chat'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Connection State Selector */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] hidden md:inline flex items-center gap-1">
          <Radio className="w-3 h-3 text-indigo-400" />
          <span>State:</span>
        </span>
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {(['idle', 'searching', 'connected', 'disconnected'] as ConnectionState[]).map((st) => (
            <button
              key={st}
              onClick={() => onSetConnectionState(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                connectionState === st
                  ? st === 'connected'
                    ? 'bg-emerald-600 text-white'
                    : st === 'searching'
                    ? 'bg-amber-600 text-white'
                    : st === 'disconnected'
                    ? 'bg-rose-600 text-white'
                    : 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

