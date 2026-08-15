import React, { useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  SwitchCamera,
  Loader2,
  AlertCircle,
  UserCheck,
  UserX,
} from 'lucide-react';
import { VideoStatus, ConnectionState } from '../types';
import { videoService } from '../services/videoService';

interface VideoCanvasProps {
  connectionState: ConnectionState;
  videoStatus: VideoStatus;
  isMuted: boolean;
  isCameraOff: boolean;
  facingMode: 'user' | 'environment';
  strangerUsername?: string | null;
  onStartVideo: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onEndVideo: () => void;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  connectionState,
  videoStatus,
  isMuted,
  isCameraOff,
  facingMode,
  strangerUsername,
  onStartVideo,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onEndVideo,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      videoService.attachLocalVideo(localVideoRef.current);
    }
  }, [localVideoRef.current, videoStatus]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      videoService.attachRemoteVideo(remoteVideoRef.current);
    }
  }, [remoteVideoRef.current, videoStatus]);

  if (connectionState !== 'connected') {
    return null;
  }

  // Active call view
  const isActiveCall =
    videoStatus === 'requesting' ||
    videoStatus === 'calling' ||
    videoStatus === 'connecting' ||
    videoStatus === 'connected';

  return (
    <div className="w-full mb-3 transition-all duration-300">
      {/* 1. OFF CALL BANNER OR BUTTON */}
      {!isActiveCall && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 text-xs text-zinc-300">
            <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Video className="w-4 h-4" />
            </span>
            <div>
              <div className="font-semibold text-zinc-200">1-on-1 Video Chat</div>
              <div className="text-[11px] text-zinc-400">P2P video • No video recorded or stored</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {videoStatus === 'permission_denied' && (
              <span className="text-xs text-rose-400 flex items-center gap-1 font-medium bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Mic/Camera denied
              </span>
            )}
            {videoStatus === 'failed' && (
              <span className="text-xs text-amber-400 flex items-center gap-1 font-medium bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Call failed
              </span>
            )}

            <button
              onClick={onStartVideo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none shadow-md shadow-indigo-600/20 transition-all"
              aria-label="Start Video Chat"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Start Video</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE VIDEO CONTAINER */}
      {isActiveCall && (
        <div className="relative w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/90 shadow-2xl">
          {/* Main Remote Video Screen */}
          <div className="relative w-full aspect-video sm:aspect-[16/9] max-h-[380px] min-h-[220px] bg-zinc-950 flex items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Remote Video Loading / Status Overlays */}
            {videoStatus === 'requesting' && (
              <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                <p className="text-sm font-semibold text-zinc-200">Requesting Camera & Microphone Access...</p>
                <p className="text-xs text-zinc-400 mt-1">Please allow browser media permissions when prompted.</p>
              </div>
            )}

            {videoStatus === 'calling' && (
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                <div className="p-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-3 animate-pulse">
                  <Video className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-zinc-200">
                  Calling {strangerUsername || 'Stranger'}...
                </p>
                <p className="text-xs text-zinc-400 mt-1">Waiting for stranger to accept video feed.</p>
              </div>
            )}

            {videoStatus === 'connecting' && (
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                <p className="text-sm font-semibold text-zinc-200">Connecting WebRTC Video Feed...</p>
                <p className="text-xs text-zinc-400 mt-1">Establishing encrypted peer-to-peer connection.</p>
              </div>
            )}

            {/* Stranger Name Badge */}
            <div className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-zinc-800/80 flex items-center gap-1.5 text-xs text-zinc-200 shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium">{strangerUsername || 'Stranger'}</span>
            </div>

            {/* Local Inset Video Preview (Picture-in-Picture) */}
            <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video bg-zinc-900 rounded-xl overflow-hidden border-2 border-zinc-700/80 shadow-2xl z-10 group">
              {isCameraOff ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-1 text-center">
                  <VideoOff className="w-5 h-5 mb-0.5 text-zinc-400" />
                  <span className="text-[10px] font-medium text-zinc-400">Cam Off</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
              )}
              <div className="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-zinc-300 font-medium">
                You
              </div>
            </div>
          </div>

          {/* Video Controls Bar */}
          <div className="bg-zinc-900/95 border-t border-zinc-800/80 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Mute Mic */}
              <button
                onClick={onToggleMute}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
                  isMuted
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Toggle Camera */}
              <button
                onClick={onToggleCamera}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
                  isCameraOff
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                aria-label={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isCameraOff ? <VideoOff className="w-4 h-4 text-rose-400" /> : <Video className="w-4 h-4 text-indigo-400" />}
              </button>

              {/* Switch Camera (Front/Back) */}
              <button
                onClick={onSwitchCamera}
                className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                title="Switch Camera (Front/Back)"
                aria-label="Switch Camera (Front/Back)"
              >
                <SwitchCamera className="w-4 h-4 text-zinc-300" />
              </button>
            </div>

            {/* End Video Call */}
            <button
              onClick={onEndVideo}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none shadow-md shadow-rose-600/20 transition-all"
              aria-label="End Video Call"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Video</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
