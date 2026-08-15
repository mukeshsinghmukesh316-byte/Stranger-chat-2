import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScreen, ConnectionState, ChatMessage, ReportReason, UserProfile, SocketConnectionStatus, OnlineStats, VoiceStatus, VideoStatus } from './types';
import { Header } from './components/Header';
import { ConnectionBanner } from './components/ConnectionBanner';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { MaintenanceModal } from './components/MaintenanceModal';
import { LandingPage } from './components/LandingPage';
import { WaitingState } from './components/WaitingState';
import { ChatScreen } from './components/ChatScreen';
import { ReportModal } from './components/ReportModal';
import { BlockModal } from './components/BlockModal';
import { AgeGateModal } from './components/AgeGateModal';
import { CommunityRulesModal } from './components/CommunityRulesModal';
import { RestrictedAccessModal } from './components/RestrictedAccessModal';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { chatService } from './services/chatService';
import { voiceService } from './services/voiceService';
import { videoService } from './services/videoService';
import { adminFetch, clearAdminToken } from './utils/adminAuth';
import { CheckCircle2 } from 'lucide-react';
import { generateAnonymousUsername } from './utils/username';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [socketStatus, setSocketStatus] = useState<SocketConnectionStatus>(() => chatService.getSocketStatus());
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(() => voiceService.getStatus());
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(() => voiceService.getIsMuted());

  // Video State
  const [videoStatus, setVideoStatus] = useState<VideoStatus>(() => videoService.getStatus());
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(() => videoService.getIsMuted());
  const [isCameraOff, setIsCameraOff] = useState<boolean>(() => videoService.getIsCameraOff());
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => videoService.getFacingMode());
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(() => chatService.getIsOffline());
  const [onlineStats, setOnlineStats] = useState<OnlineStats>(() => chatService.getOnlineStats());
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => chatService.getMaintenanceMode());
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(() => chatService.getMaintenanceMessage());
  const [maintenanceEstimatedTime, setMaintenanceEstimatedTime] = useState<string>(() => chatService.getMaintenanceEstimatedTime());
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  // Temporary, session-only Safety & Age Confirmation State
  const [hasConfirmedAge, setHasConfirmedAge] = useState<boolean>(false);
  const [hasAcceptedRules, setHasAcceptedRules] = useState<boolean>(false);
  const [isUnder18Restricted, setIsUnder18Restricted] = useState<boolean>(false);
  const [activeSafetyModal, setActiveSafetyModal] = useState<'none' | 'age_gate' | 'community_rules' | 'restricted' | 'safety_info'>('none');

  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    username: generateAnonymousUsername(),
    interests: [],
    language: 'Any',
    country: 'Any country',
  }));
  const [strangerUsername, setStrangerUsername] = useState<string | null>(null);
  const [strangerLanguage, setStrangerLanguage] = useState<string | null>(null);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [isStrangerTyping, setIsStrangerTyping] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    const checkAdminSessionAndRoute = async () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const isAdminRoute = hash === '#admin' || path === '/admin' || path.startsWith('/admin');

      if (isAdminRoute) {
        try {
          const res = await adminFetch('/api/admin/me');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
              setIsAdminLoggedIn(true);
              setCurrentScreen('admin_dashboard');
              return;
            }
          }
        } catch (err) {
          // Network error or unauthenticated
        }
        clearAdminToken();
        setIsAdminLoggedIn(false);
        setCurrentScreen('admin_login');
      }
    };

    checkAdminSessionAndRoute();
    window.addEventListener('hashchange', checkAdminSessionAndRoute);
    window.addEventListener('popstate', checkAdminSessionAndRoute);
    return () => {
      window.removeEventListener('hashchange', checkAdminSessionAndRoute);
      window.removeEventListener('popstate', checkAdminSessionAndRoute);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    // Initialize WebSocket connection & fetch public server status
    chatService.connectWebSocket();
    chatService.fetchPublicStatus();

    // Subscribe to maintenance status updates
    const unsubMaintenance = chatService.onMaintenanceChange((isMaint, msg, estTime) => {
      setIsMaintenanceMode(isMaint);
      if (msg) setMaintenanceMessage(msg);
      if (estTime !== undefined) setMaintenanceEstimatedTime(estTime);
      if (isMaint) {
        setIsMaintenanceModalOpen(true);
        if (msg) showToast(msg);
      }
    });

    // Subscribe to socket connection status
    const unsubSocketStatus = chatService.onSocketStatusChange((status) => {
      setSocketStatus(status);
      setReconnectAttempts(chatService.getReconnectAttempts());
      setIsOffline(chatService.getIsOffline());
    });

    // Subscribe to connection state changes
    const unsubState = chatService.onStateChange((state) => {
      setConnectionState(state);

      if (state === 'searching') {
        setCurrentScreen('waiting');
        setStrangerUsername(null);
        setStrangerLanguage(null);
        setSharedInterests([]);
        setIsStrangerTyping(false);
      } else if (state === 'idle') {
        setCurrentScreen('landing');
        setStrangerUsername(null);
        setStrangerLanguage(null);
        setSharedInterests([]);
        setIsStrangerTyping(false);
      } else if (state === 'connected') {
        setCurrentScreen('chat');
        setIsStrangerTyping(false);
        setMessages([]); // Clear previous messages on new match
      } else if (state === 'disconnected') {
        setCurrentScreen('chat');
        setIsStrangerTyping(false);
      }
    });

    // Subscribe to stranger details when matched
    const unsubStranger = chatService.onStrangerFound((info) => {
      setStrangerUsername(info.strangerUsername);
      setStrangerLanguage(info.strangerLanguage || null);
      setSharedInterests(info.sharedInterests);
    });

    // Subscribe to stranger typing events
    const unsubTyping = chatService.onStrangerTyping((isTyping) => {
      setIsStrangerTyping(isTyping);
    });

    // Subscribe to message status updates (sent -> delivered)
    const unsubStatus = chatService.onMessageStatusUpdate(({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg))
      );
    });

    // Subscribe to real incoming chat messages
    const unsubMsg = chatService.onMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Subscribe to system notices
    const unsubNotice = chatService.onNotice((notice) => {
      showToast(notice);
    });

    // Subscribe to real-time aggregate online stats
    const unsubStats = chatService.onOnlineStatsChange((stats) => {
      setOnlineStats(stats);
    });

    // Subscribe to WebRTC Voice Service state changes
    const unsubVoiceStatus = voiceService.onStatusChange((status) => {
      setVoiceStatus(status);
    });

    const unsubVoiceMute = voiceService.onMuteChange((muted) => {
      setIsVoiceMuted(muted);
    });

    // Subscribe to WebRTC Video Service state changes
    const unsubVideoStatus = videoService.onStatusChange((status) => {
      setVideoStatus(status);
    });

    const unsubVideoMute = videoService.onMuteChange((muted) => {
      setIsVideoMuted(muted);
    });

    const unsubCamera = videoService.onCameraChange((cameraOff) => {
      setIsCameraOff(cameraOff);
    });

    const unsubFacing = videoService.onFacingModeChange((facing) => {
      setFacingMode(facing);
    });

    return () => {
      unsubMaintenance();
      unsubSocketStatus();
      unsubState();
      unsubStranger();
      unsubTyping();
      unsubStatus();
      unsubMsg();
      unsubNotice();
      unsubStats();
      unsubVoiceStatus();
      unsubVoiceMute();
      unsubVideoStatus();
      unsubVideoMute();
      unsubCamera();
      unsubFacing();
      chatService.destroy();
    };
  }, []);

  const handleStartVoice = () => {
    voiceService.startVoice((type, payload) =>
      chatService.sendVoiceSignaling(type, payload)
    );
  };

  const handleToggleVoiceMute = () => {
    voiceService.toggleMute();
  };

  const handleEndVoice = () => {
    voiceService.endVoice((type, payload) =>
      chatService.sendVoiceSignaling(type, payload)
    );
  };

  const handleStartVideo = () => {
    videoService.startVideo((type, payload) =>
      chatService.sendMediaSignaling(type, payload)
    );
  };

  const handleToggleVideoMute = () => {
    videoService.toggleMute();
  };

  const handleToggleCamera = () => {
    videoService.toggleCamera();
  };

  const handleSwitchCamera = () => {
    videoService.switchCamera();
  };

  const handleEndVideo = () => {
    videoService.endVideo((type, payload) =>
      chatService.sendMediaSignaling(type, payload)
    );
  };

  const handleRetryConnection = () => {
    chatService.retryConnection();
  };

  const handleStartChat = (topic?: string, profile?: UserProfile) => {
    if (isMaintenanceMode) {
      setIsMaintenanceModalOpen(true);
      return;
    }
    if (isUnder18Restricted) {
      setActiveSafetyModal('restricted');
      return;
    }
    if (!hasConfirmedAge) {
      setActiveSafetyModal('age_gate');
      return;
    }
    if (!hasAcceptedRules) {
      setActiveSafetyModal('community_rules');
      return;
    }

    const activeTopic = topic || selectedTopic;
    const activeProfile = profile || userProfile;
    if (topic) setSelectedTopic(topic);
    chatService.startSearch(activeTopic, activeProfile);
  };

  const handleConfirmAge = () => {
    setHasConfirmedAge(true);
    setActiveSafetyModal('community_rules');
  };

  const handleUnder18 = () => {
    setIsUnder18Restricted(true);
    setActiveSafetyModal('restricted');
  };

  const handleAcceptRules = () => {
    setHasAcceptedRules(true);
    setActiveSafetyModal('none');
    // Proceed directly to start chat
    handleStartChat();
  };

  const handleRetryAgeCheck = () => {
    setIsUnder18Restricted(false);
    setHasConfirmedAge(false);
    setActiveSafetyModal('age_gate');
  };

  const handleCancelWaiting = () => {
    chatService.cancelSearch();
  };

  const handleNext = () => {
    setMessages([]);
    chatService.next(userProfile);
  };

  const handleSendMessage = (text: string) => {
    const sentMsg = chatService.sendMessage(text);
    if (sentMsg) {
      setMessages((prev) => [...prev, sentMsg]);
    }
  };

  const handleNavigateToChat = () => {
    setCurrentScreen('chat');
  };

  const handleReportSubmit = (reason: ReportReason, details: string) => {
    chatService.report(reason, details);
    showToast(`Report submitted (${reason}). Thank you for keeping StrangerChat safe!`);
  };

  const handleBlockConfirm = () => {
    chatService.block();
    showToast('Stranger blocked. You will not be matched with this user again.');
  };

  if (currentScreen === 'admin_login') {
    return (
      <AdminLogin
        onLogin={() => {
          setIsAdminLoggedIn(true);
          setCurrentScreen('admin_dashboard');
        }}
        onReturnToPublic={() => {
          window.location.hash = '';
          setCurrentScreen('landing');
        }}
      />
    );
  }

  if (currentScreen === 'admin_dashboard') {
    return (
      <AdminDashboard
        onlineStats={socketStatus === 'connected' ? onlineStats : undefined}
        socketStatus={socketStatus}
        isMaintenanceMode={isMaintenanceMode}
        onLogout={() => {
          setIsAdminLoggedIn(false);
          setCurrentScreen('admin_login');
        }}
        onReturnToPublic={() => {
          window.location.hash = '';
          setCurrentScreen('landing');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Main Header */}
      <Header
        currentScreen={currentScreen}
        connectionState={connectionState}
        socketStatus={socketStatus}
        isMaintenanceMode={isMaintenanceMode}
        onNavigate={(screen) => {
          setCurrentScreen(screen);
          if (screen === 'landing') chatService.cancelSearch();
        }}
        onStartChat={() => handleStartChat()}
        onNext={handleNext}
        onCancelWaiting={handleCancelWaiting}
        onOpenReport={() => setIsReportModalOpen(true)}
        onOpenBlock={() => setIsBlockModalOpen(true)}
        onOpenSafety={() => setActiveSafetyModal('safety_info')}
        onOpenAbout={() => {
          setCurrentScreen('landing');
          setTimeout(() => {
            const elem = document.getElementById('about-section');
            if (elem) elem.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
        onRetryConnection={handleRetryConnection}
      />

      {/* Network & Reconnection Status Banner */}
      <ConnectionBanner
        socketStatus={socketStatus}
        reconnectAttempts={reconnectAttempts}
        maxReconnectAttempts={chatService.getMaxReconnectAttempts()}
        isOffline={isOffline}
        onRetry={handleRetryConnection}
      />

      {/* Public Maintenance Mode Banner */}
      {currentScreen !== 'admin_dashboard' && (
        <MaintenanceBanner
          isMaintenanceMode={isMaintenanceMode}
          message={maintenanceMessage}
          estimatedTime={maintenanceEstimatedTime}
        />
      )}

      {/* Dynamic Screen Viewport */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {currentScreen === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full flex-1 flex flex-col"
            >
              <LandingPage
                profile={userProfile}
                onlineStats={socketStatus === 'connected' ? onlineStats : undefined}
                hasConfirmedAge={hasConfirmedAge}
                hasAcceptedRules={hasAcceptedRules}
                isMaintenanceMode={isMaintenanceMode}
                maintenanceMessage={maintenanceMessage}
                maintenanceEstimatedTime={maintenanceEstimatedTime}
                onOpenSafetyRules={() => {
                  if (!hasConfirmedAge) setActiveSafetyModal('age_gate');
                  else if (!hasAcceptedRules) setActiveSafetyModal('community_rules');
                  else setActiveSafetyModal('safety_info');
                }}
                onOpenAdmin={() => {
                  window.location.hash = 'admin';
                  setCurrentScreen(isAdminLoggedIn ? 'admin_dashboard' : 'admin_login');
                }}
                onUpdateProfile={(p) => setUserProfile(p)}
                onStartChat={handleStartChat}
                onNavigateToChat={handleNavigateToChat}
              />
            </motion.div>
          )}

          {currentScreen === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="w-full flex-1 flex flex-col"
            >
              <WaitingState
                selectedTopic={selectedTopic}
                interests={userProfile.interests}
                language={userProfile.language}
                country={userProfile.country}
                onlineStats={socketStatus === 'connected' ? onlineStats : undefined}
                onCancel={handleCancelWaiting}
              />
            </motion.div>
          )}

          {currentScreen === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full flex-1 flex flex-col"
            >
              <ChatScreen
                connectionState={connectionState}
                messages={messages}
                strangerUsername={strangerUsername}
                strangerLanguage={strangerLanguage}
                sharedInterests={sharedInterests}
                isStrangerTyping={isStrangerTyping}
                voiceStatus={voiceStatus}
                isVoiceMuted={isVoiceMuted}
                videoStatus={videoStatus}
                isVideoMuted={isVideoMuted}
                isCameraOff={isCameraOff}
                facingMode={facingMode}
                onStartVoice={handleStartVoice}
                onToggleVoiceMute={handleToggleVoiceMute}
                onEndVoice={handleEndVoice}
                onStartVideo={handleStartVideo}
                onToggleVideoMute={handleToggleVideoMute}
                onToggleCamera={handleToggleCamera}
                onSwitchCamera={handleSwitchCamera}
                onEndVideo={handleEndVideo}
                onTypingChange={(isTyping) => chatService.sendTyping(isTyping)}
                onSendMessage={handleSendMessage}
                onStartChat={() => handleStartChat()}
                onNext={handleNext}
                onOpenReport={() => setIsReportModalOpen(true)}
                onOpenBlock={() => setIsBlockModalOpen(true)}
                onOpenSafety={() => setActiveSafetyModal('safety_info')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReportSubmit}
      />

      <BlockModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={handleBlockConfirm}
      />

      {/* Safety & Gate Modals */}
      <AgeGateModal
        isOpen={activeSafetyModal === 'age_gate'}
        onConfirmAge={handleConfirmAge}
        onUnder18={handleUnder18}
      />

      <CommunityRulesModal
        isOpen={activeSafetyModal === 'community_rules' || activeSafetyModal === 'safety_info'}
        mode={activeSafetyModal === 'community_rules' ? 'acknowledge' : 'safety_view'}
        isInChat={currentScreen === 'chat'}
        onAcceptRules={handleAcceptRules}
        onClose={() => setActiveSafetyModal('none')}
        onOpenReport={() => setIsReportModalOpen(true)}
        onOpenBlock={() => setIsBlockModalOpen(true)}
      />

      <RestrictedAccessModal
        isOpen={activeSafetyModal === 'restricted' || (isUnder18Restricted && activeSafetyModal !== 'none')}
        onRetryAgeCheck={handleRetryAgeCheck}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900 border border-indigo-500/30 text-xs font-semibold text-zinc-100 shadow-2xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

