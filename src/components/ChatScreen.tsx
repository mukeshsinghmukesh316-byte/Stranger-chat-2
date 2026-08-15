import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  RotateCw,
  Flag,
  UserX,
  MessageSquareDashed,
  Play,
  Unplug,
  Sparkles,
  UserCheck,
  Check,
  CheckCheck,
  Clock,
  Languages,
  ShieldCheck,
  ArrowDown,
  AlertCircle,
  CornerDownLeft,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
} from 'lucide-react';
import { ChatMessage, ConnectionState, VoiceStatus, VideoStatus } from '../types';
import { VoiceControlBar } from './VoiceControlBar';
import { VideoCanvas } from './VideoCanvas';

interface ChatScreenProps {
  connectionState: ConnectionState;
  messages: ChatMessage[];
  strangerUsername?: string | null;
  strangerLanguage?: string | null;
  sharedInterests?: string[];
  isStrangerTyping?: boolean;
  voiceStatus: VoiceStatus;
  isVoiceMuted: boolean;
  videoStatus: VideoStatus;
  isVideoMuted: boolean;
  isCameraOff: boolean;
  facingMode: 'user' | 'environment';
  onStartVoice: () => void;
  onToggleVoiceMute: () => void;
  onEndVoice: () => void;
  onStartVideo: () => void;
  onToggleVideoMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onEndVideo: () => void;
  onTypingChange?: (isTyping: boolean) => void;
  onSendMessage: (text: string) => void;
  onStartChat: () => void;
  onNext: () => void;
  onOpenReport: () => void;
  onOpenBlock: () => void;
  onOpenSafety?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  connectionState,
  messages,
  strangerUsername,
  strangerLanguage,
  sharedInterests = [],
  isStrangerTyping = false,
  voiceStatus,
  isVoiceMuted,
  videoStatus,
  isVideoMuted,
  isCameraOff,
  facingMode,
  onStartVoice,
  onToggleVoiceMute,
  onEndVoice,
  onStartVideo,
  onToggleVideoMute,
  onToggleCamera,
  onSwitchCamera,
  onEndVideo,
  onTypingChange,
  onSendMessage,
  onStartChat,
  onNext,
  onOpenReport,
  onOpenBlock,
  onOpenSafety,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const [showUnreadBadge, setShowUnreadBadge] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTypingRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowUnreadBadge(false);
  }, []);

  // Monitor scroll position for smart scroll lock
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 90;
    setIsUserNearBottom(nearBottom);
    if (nearBottom) {
      setShowUnreadBadge(false);
    }
  };

  // Scroll behavior on message update
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage?.sender === 'you';

    if (isOwnMessage || isUserNearBottom) {
      scrollToBottom('smooth');
    } else {
      setShowUnreadBadge(true);
    }
  }, [messages, isStrangerTyping, scrollToBottom]);

  // Reset typing state on disconnection / state change
  useEffect(() => {
    if (connectionState !== 'connected') {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingChange?.(false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [connectionState, onTypingChange]);

  const stopTyping = () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange?.(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    if (connectionState !== 'connected') return;

    if (val.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingChange?.(true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTypingChange?.(false);
      }, 1500);
    } else {
      stopTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    if (connectionState === 'idle' || connectionState === 'disconnected') {
      onStartChat();
      return;
    }

    if (connectionState !== 'connected') return;

    stopTyping();
    onSendMessage(trimmed);
    setInputMessage('');

    // Re-focus input after send
    textareaRef.current?.focus();
  };

  const displayName = strangerUsername || 'Stranger';
  const charLimit = 1000;
  const isNearLimit = inputMessage.length > charLimit * 0.85;

  return (
    <main
      className="flex flex-col h-[calc(100dvh-65px)] w-full max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-3 space-y-2.5 text-zinc-100"
      aria-label="StrangerChat Messaging Window"
    >
      {/* 1. CHAT HEADER BAR */}
      <header
        className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-md shrink-0"
        aria-label="Chat Header and Stranger Information"
      >
        {/* Status Badge & Stranger Metadata */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold"
            role="status"
            aria-live="polite"
          >
            {connectionState === 'connected' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                <span className="text-emerald-400">Connected to stranger</span>
              </>
            ) : connectionState === 'searching' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" aria-hidden="true" />
                <span className="text-amber-300">Looking for a stranger...</span>
              </>
            ) : connectionState === 'disconnected' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" aria-hidden="true" />
                <span className="text-rose-400">Stranger Disconnected</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" aria-hidden="true" />
                <span className="text-zinc-400">Idle • Press Start Chat</span>
              </>
            )}
          </div>

          {/* Stranger Display Name, Language, & Shared Interests */}
          {connectionState === 'connected' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className="flex items-center gap-1 font-bold text-zinc-100 bg-zinc-800/90 border border-zinc-700/60 px-2.5 py-1 rounded-xl shadow-xs"
                title={`Chatting with ${displayName}`}
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>{displayName}</span>
              </span>

              {strangerLanguage && strangerLanguage !== 'Any' && (
                <span className="flex items-center gap-1 font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-xl">
                  <Languages className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span>{strangerLanguage}</span>
                </span>
              )}

              {sharedInterests.length > 0 ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Shared: {sharedInterests.join(', ')}</span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500 hidden lg:inline">
                  (No overlapping interests)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-1.5 ml-auto">
          {onOpenSafety && (
            <button
              onClick={onOpenSafety}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-all"
              title="Community Safety Rules & Center"
              aria-label="Safety Rules"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Safety</span>
            </button>
          )}

          <button
            onClick={onOpenReport}
            disabled={connectionState !== 'connected'}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none transition-all"
            title="Report this stranger"
            aria-label="Report stranger"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report</span>
          </button>

          <button
            onClick={onOpenBlock}
            disabled={connectionState !== 'connected'}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none transition-all"
            title="Block stranger and end chat"
            aria-label="Block stranger"
          >
            <UserX className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Block</span>
          </button>

          {connectionState === 'idle' || connectionState === 'disconnected' ? (
            <button
              onClick={onStartChat}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              aria-label="Start Chat with a stranger"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Chat</span>
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none active:scale-95 transition-all"
              title="Disconnect & search for next stranger"
              aria-label="Next stranger"
            >
              <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Next</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. WEBRTC VIDEO CANVAS */}
      <VideoCanvas
        connectionState={connectionState}
        videoStatus={videoStatus}
        isMuted={isVideoMuted}
        isCameraOff={isCameraOff}
        facingMode={facingMode}
        strangerUsername={strangerUsername}
        onStartVideo={onStartVideo}
        onToggleMute={onToggleVideoMute}
        onToggleCamera={onToggleCamera}
        onSwitchCamera={onSwitchCamera}
        onEndVideo={onEndVideo}
      />

      {/* 3. WEBRTC VOICE CONTROL BAR */}
      <VoiceControlBar
        connectionState={connectionState}
        voiceStatus={voiceStatus}
        isMuted={isVoiceMuted}
        onStartVoice={onStartVoice}
        onToggleMute={onToggleVoiceMute}
        onEndVoice={onEndVoice}
      />

      {/* 3. MAIN MESSAGE VIEWPORT */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="Message History"
        className="flex-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 sm:p-5 overflow-y-auto flex flex-col shadow-inner relative focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:outline-none custom-scrollbar"
      >
        {/* Floating Unread Scroll-to-Bottom Pill */}
        {showUnreadBadge && !isUserNearBottom && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="sticky top-2 self-center z-20 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xl border border-indigo-400/40 flex items-center gap-1.5 animate-bounce transition-all focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Scroll down to newest messages"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>New messages below</span>
          </button>
        )}

        {/* Disconnected Notice Banner */}
        {connectionState === 'disconnected' && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Unplug className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Stranger has disconnected. Conversation ended.</span>
            </div>
            <button
              onClick={onNext}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              Find New Stranger
            </button>
          </div>
        )}

        {/* EMPTY & STATES DISPLAY */}
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-indigo-400 shadow-xl">
              {connectionState === 'disconnected' ? (
                <Unplug className="w-8 h-8 text-rose-400" />
              ) : connectionState === 'searching' ? (
                <RotateCw className="w-8 h-8 text-amber-400 animate-spin" />
              ) : (
                <MessageSquareDashed className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-100 tracking-tight">
                {connectionState === 'disconnected'
                  ? 'Connection Ended.'
                  : connectionState === 'connected'
                  ? `Connected with ${displayName}!`
                  : connectionState === 'searching'
                  ? 'Searching for a stranger...'
                  : 'Ready to Chat'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {connectionState === 'disconnected'
                  ? 'Your session with this stranger has ended. Click Next or Start Chat to meet someone new.'
                  : connectionState === 'connected'
                  ? 'Say hello! You are connected to a real online stranger.'
                  : connectionState === 'searching'
                  ? 'Searching global queues to find a stranger matching your topic or language preferences...'
                  : 'Click Start Chat below to match with a random stranger.'}
              </p>
            </div>

            {(connectionState === 'idle' || connectionState === 'disconnected') && (
              <button
                onClick={onStartChat}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all mt-2 focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Chat</span>
              </button>
            )}
          </div>
        ) : (
          /* MESSAGES LISTING */
          <div className="space-y-3 w-full max-w-3xl mx-auto my-auto py-2">
            <div className="text-center py-1">
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-950/80 border border-zinc-800/80 px-3 py-1 rounded-full uppercase tracking-wider">
                Chat Session Active
              </span>
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'you'
                    ? 'items-end'
                    : msg.sender === 'system'
                    ? 'items-center my-2'
                    : 'items-start'
                }`}
              >
                {msg.sender === 'system' ? (
                  <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-3 py-1 rounded-full text-center">
                    {msg.text}
                  </span>
                ) : (
                  <>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === 'you'
                          ? 'bg-indigo-600 text-white rounded-br-xs shadow-md shadow-indigo-600/10'
                          : 'bg-zinc-800 text-zinc-100 rounded-bl-xs border border-zinc-700/60'
                      }`}
                    >
                      <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    {/* Metadata & Status Flags */}
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1 px-1">
                      <span>{msg.sender === 'you' ? 'You' : displayName} • {msg.timestamp}</span>
                      {msg.sender === 'you' && (
                        <span className="inline-flex items-center ml-0.5">
                          {msg.status === 'sending' && (
                            <span className="flex items-center gap-0.5 text-zinc-400" title="Sending...">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span className="sr-only">sending</span>
                            </span>
                          )}
                          {msg.status === 'sent' && (
                            <span className="flex items-center text-zinc-400" title="Sent to server">
                              <Check className="w-3.5 h-3.5" />
                              <span className="sr-only">sent</span>
                            </span>
                          )}
                          {msg.status === 'delivered' && (
                            <span className="flex items-center text-indigo-400 font-bold" title="Delivered to stranger">
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="sr-only">delivered</span>
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* REAL-TIME STRANGER TYPING INDICATOR */}
            {isStrangerTyping && connectionState === 'connected' && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-800/90 border border-zinc-700/60 text-xs font-medium text-zinc-300 w-fit shadow-md my-1"
              >
                <span>{displayName} is typing</span>
                <div className="flex items-center gap-1" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 3. MESSAGE INPUT COMPOSER */}
      <footer className="shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-xl focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/40 transition-all flex flex-col gap-1.5"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={connectionState !== 'connected'}
              maxLength={charLimit}
              rows={1}
              placeholder={
                connectionState === 'connected'
                  ? 'Type a message... (Enter to send, Shift+Enter for new line)'
                  : connectionState === 'searching'
                  ? 'Searching for a stranger...'
                  : 'Press Start Chat to begin'
              }
              aria-label="Message input"
              className="flex-1 px-3 py-2 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none min-h-[38px] max-h-24 custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
            />

            <div className="flex items-center gap-1.5 pb-0.5">
              {/* Next Button */}
              <button
                type="button"
                onClick={onNext}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-colors"
                title="Find Next Stranger"
                aria-label="Next stranger"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={connectionState !== 'connected' || !inputMessage.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 shadow-md shadow-indigo-600/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none transition-all"
                aria-label="Send Message"
              >
                <span className="hidden sm:inline">Send</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Footer Subtext & Character Counter */}
          <div className="flex items-center justify-between px-2 text-[10px] text-zinc-500">
            <span className="hidden sm:inline">Press Enter to send • Shift + Enter for line break</span>
            <span
              className={`ml-auto font-mono ${
                isNearLimit ? 'text-amber-400 font-semibold' : 'text-zinc-500'
              }`}
            >
              {inputMessage.length}/{charLimit}
            </span>
          </div>
        </form>
      </footer>
    </main>
  );
};
