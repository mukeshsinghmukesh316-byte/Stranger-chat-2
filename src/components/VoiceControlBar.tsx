import React from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Loader2,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { VoiceStatus, ConnectionState } from '../types';

interface VoiceControlBarProps {
  connectionState: ConnectionState;
  voiceStatus: VoiceStatus;
  isMuted: boolean;
  onStartVoice: () => void;
  onToggleMute: () => void;
  onEndVoice: () => void;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  connectionState,
  voiceStatus,
  isMuted,
  onStartVoice,
  onToggleMute,
  onEndVoice,
}) => {
  // Voice is strictly available only during active chat sessions
  if (connectionState !== 'connected') {
    return null;
  }

  return (
    <div
      className="bg-zinc-900/95 border border-zinc-800/90 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg"
      role="region"
      aria-label="WebRTC Voice Chat Controls"
    >
      {/* Status Description */}
      <div className="flex items-center gap-2.5 text-xs font-medium">
        {voiceStatus === 'idle' && (
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Mic className="w-4 h-4" />
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-200">Voice Chat Available</span>
              <span className="text-[11px] text-zinc-400">P2P audio • No audio recorded or stored</span>
            </div>
          </div>
        )}

        {voiceStatus === 'calling' && (
          <div className="flex items-center gap-2 text-amber-300" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <div className="flex flex-col">
              <span className="font-semibold">Calling stranger...</span>
              <span className="text-[11px] text-amber-400/80">Waiting for stranger to connect...</span>
            </div>
          </div>
        )}

        {voiceStatus === 'connecting' && (
          <div className="flex items-center gap-2 text-indigo-300" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <div className="flex flex-col">
              <span className="font-semibold">Connecting WebRTC voice...</span>
              <span className="text-[11px] text-indigo-400/80">Establishing peer-to-peer audio link...</span>
            </div>
          </div>
        )}

        {voiceStatus === 'connected' && (
          <div className="flex items-center gap-2.5 text-emerald-300" role="status" aria-live="polite">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Voice Connected</span>
              </div>
              <span className="text-[11px] text-emerald-400/80">
                {isMuted ? 'Microphone Muted' : 'Microphone Live'} • Peer-to-Peer Audio
              </span>
            </div>
          </div>
        )}

        {voiceStatus === 'permission_denied' && (
          <div className="flex items-center gap-2 text-rose-300" role="alert">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-rose-300">Microphone permission denied</span>
              <span className="text-[11px] text-rose-400/80">
                Please allow microphone access in your browser site permissions.
              </span>
            </div>
          </div>
        )}

        {voiceStatus === 'failed' && (
          <div className="flex items-center gap-2 text-amber-300" role="alert">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">Voice connection failed</span>
              <span className="text-[11px] text-amber-400/80">NAT/firewall traversal issue or call declined.</span>
            </div>
          </div>
        )}

        {voiceStatus === 'disconnected' && (
          <div className="flex items-center gap-2 text-zinc-400">
            <PhoneOff className="w-4 h-4 text-zinc-500" />
            <span className="font-medium text-zinc-300">Voice call ended.</span>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2 ml-auto">
        {(voiceStatus === 'idle' || voiceStatus === 'disconnected' || voiceStatus === 'failed' || voiceStatus === 'permission_denied') && (
          <button
            onClick={onStartVoice}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none shadow-md shadow-indigo-600/20 transition-all"
            aria-label="Start Voice Chat"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Voice</span>
          </button>
        )}

        {voiceStatus === 'connected' && (
          <>
            <button
              onClick={onToggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
                isMuted
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-amber-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              onClick={onEndVoice}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none shadow-md shadow-rose-600/20 transition-all"
              title="End Voice Call"
              aria-label="End Voice Call"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Voice</span>
            </button>
          </>
        )}

        {(voiceStatus === 'calling' || voiceStatus === 'connecting') && (
          <button
            onClick={onEndVoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none transition-all"
            aria-label="Cancel Voice Call"
          >
            <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};
