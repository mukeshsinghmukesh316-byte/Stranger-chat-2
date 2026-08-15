import {
  ConnectionState,
  ChatMessage,
  WsEventPayload,
  WsClientMessageType,
  SocketConnectionStatus,
  ReportReason,
  UserProfile,
  OnlineStats,
} from '../types';
import { voiceService } from './voiceService';
import { videoService } from './videoService';

type StateChangeListener = (state: ConnectionState) => void;
type SocketStatusListener = (status: SocketConnectionStatus) => void;
type MessageListener = (message: ChatMessage) => void;
type NoticeListener = (notice: string) => void;
type StrangerFoundListener = (info: { strangerUsername: string | null; strangerLanguage?: string | null; sharedInterests: string[] }) => void;
type StrangerTypingListener = (isTyping: boolean) => void;
type MessageStatusListener = (update: { messageId: string; status: 'sent' | 'delivered' }) => void;
type OnlineStatsListener = (stats: OnlineStats) => void;
type MaintenanceListener = (isMaintenance: boolean, message?: string, estimatedTime?: string) => void;

export class ChatService {
  private socket: WebSocket | null = null;
  private connectionState: ConnectionState = 'idle';
  private socketStatus: SocketConnectionStatus = 'disconnected';
  private currentTopic: string = 'all';
  private currentProfile: UserProfile | null = null;
  private connectionId: string | null = null;
  private roomId: string | null = null;
  private strangerUsername: string | null = null;
  private strangerLanguage: string | null = null;
  private sharedInterests: string[] = [];
  private onlineStats: OnlineStats = { onlineCount: 0, waitingCount: 0 };
  private maintenanceMode: boolean = false;
  private maintenanceMessage: string = 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';
  private maintenanceEstimatedTime: string = '';

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isIntentionallyClosed = false;
  private isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  private stateChangeListeners: Set<StateChangeListener> = new Set();
  private socketStatusListeners: Set<SocketStatusListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private noticeListeners: Set<NoticeListener> = new Set();
  private strangerFoundListeners: Set<StrangerFoundListener> = new Set();
  private strangerTypingListeners: Set<StrangerTypingListener> = new Set();
  private messageStatusListeners: Set<MessageStatusListener> = new Set();
  private onlineStatsListeners: Set<OnlineStatsListener> = new Set();
  private maintenanceListeners: Set<MaintenanceListener> = new Set();

  constructor() {
    this.initBrowserListeners();
  }

  public getIsOffline(): boolean {
    return this.isOffline;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  private initBrowserListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOffline = false;
      this.notifyNotice('Internet connection restored.');
      if (this.socketStatus !== 'connected') {
        this.retryConnection();
      }
    });

    window.addEventListener('offline', () => {
      this.isOffline = true;
      this.setSocketStatus('disconnected');
      this.handleSocketDrop();
      this.notifyNotice('Internet connection lost. You are offline.');
    });

    window.addEventListener('beforeunload', () => {
      this.destroy();
    });
  }

  private startPingTimer() {
    this.stopPingTimer();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendClientEvent('ping');
      }
    }, 15000);
  }

  private stopPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleSocketDrop() {
    this.stopPingTimer();
    voiceService.endVoice();
    videoService.endVideo();
    if (this.connectionState === 'connected' || this.connectionState === 'searching') {
      this.setConnectionState('disconnected');
    }
    this.roomId = null;
    this.strangerUsername = null;
    this.sharedInterests = [];
    this.strangerTypingListeners.forEach((l) => l(false));
  }

  public getState(): ConnectionState {
    return this.connectionState;
  }

  public getSocketStatus(): SocketConnectionStatus {
    return this.socketStatus;
  }

  public getTopic(): string {
    return this.currentTopic;
  }

  public getConnectionId(): string | null {
    return this.connectionId;
  }

  public getStrangerUsername(): string | null {
    return this.strangerUsername;
  }

  public getStrangerLanguage(): string | null {
    return this.strangerLanguage;
  }

  public getSharedInterests(): string[] {
    return this.sharedInterests;
  }

  private setConnectionState(newState: ConnectionState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.stateChangeListeners.forEach((listener) => listener(this.connectionState));
    }
  }

  private setSocketStatus(newStatus: SocketConnectionStatus) {
    if (this.socketStatus !== newStatus) {
      this.socketStatus = newStatus;
      this.socketStatusListeners.forEach((listener) => listener(this.socketStatus));
    }
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.stateChangeListeners.add(listener);
    listener(this.connectionState);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  public onSocketStatusChange(listener: SocketStatusListener): () => void {
    this.socketStatusListeners.add(listener);
    listener(this.socketStatus);
    return () => {
      this.socketStatusListeners.delete(listener);
    };
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public onNotice(listener: NoticeListener): () => void {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  public onStrangerFound(listener: StrangerFoundListener): () => void {
    this.strangerFoundListeners.add(listener);
    // If already connected with a stranger, emit current info
    if (this.connectionState === 'connected' && this.strangerUsername) {
      listener({
        strangerUsername: this.strangerUsername,
        strangerLanguage: this.strangerLanguage,
        sharedInterests: this.sharedInterests,
      });
    }
    return () => {
      this.strangerFoundListeners.delete(listener);
    };
  }

  public onStrangerTyping(listener: StrangerTypingListener): () => void {
    this.strangerTypingListeners.add(listener);
    return () => {
      this.strangerTypingListeners.delete(listener);
    };
  }

  public onMessageStatusUpdate(listener: MessageStatusListener): () => void {
    this.messageStatusListeners.add(listener);
    return () => {
      this.messageStatusListeners.delete(listener);
    };
  }

  public getOnlineStats(): OnlineStats {
    return this.onlineStats;
  }

  public onOnlineStatsChange(listener: OnlineStatsListener): () => void {
    this.onlineStatsListeners.add(listener);
    listener(this.onlineStats);
    return () => {
      this.onlineStatsListeners.delete(listener);
    };
  }

  public getMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  public getMaintenanceMessage(): string {
    return this.maintenanceMessage;
  }

  public getMaintenanceEstimatedTime(): string {
    return this.maintenanceEstimatedTime;
  }

  public onMaintenanceChange(listener: MaintenanceListener): () => void {
    this.maintenanceListeners.add(listener);
    listener(this.maintenanceMode, this.maintenanceMessage, this.maintenanceEstimatedTime);
    return () => {
      this.maintenanceListeners.delete(listener);
    };
  }

  public async fetchPublicStatus(): Promise<boolean> {
    try {
      const res = await fetch('/api/public/status');
      if (res.ok) {
        const data = await res.json();
        const isMaint = Boolean(data.maintenanceMode);
        this.maintenanceMode = isMaint;
        if (data.maintenanceMessage) {
          this.maintenanceMessage = data.maintenanceMessage;
        } else if (data.message) {
          this.maintenanceMessage = data.message;
        }
        this.maintenanceEstimatedTime = data.maintenanceEstimatedTime || '';
        this.maintenanceListeners.forEach((listener) =>
          listener(isMaint, this.maintenanceMessage, this.maintenanceEstimatedTime)
        );
        return isMaint;
      }
    } catch (e) {
      // ignore
    }
    return this.maintenanceMode;
  }

  /**
   * Connects to the real WebSocket server using environment configuration
   * or auto-detected window location protocol.
   */
  public connectWebSocket(customUrl?: string) {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.setSocketStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const envWsUrl = import.meta.env.VITE_WS_URL;
      const defaultUrl = `${wsProtocol}//${window.location.host}/ws/chat`;
      const targetUrl = customUrl || envWsUrl || defaultUrl;

      this.socket = new WebSocket(targetUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setSocketStatus('connected');
        this.sendClientEvent('connect');
        this.startPingTimer();
      };

      this.socket.onmessage = (event) => {
        try {
          const payload: WsEventPayload = JSON.parse(event.data);
          this.handleServerEvent(payload);
        } catch (err) {
          console.error('[ChatService] Error parsing incoming WS message:', err);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        this.handleSocketDrop();

        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect(customUrl);
        } else {
          this.setSocketStatus('disconnected');
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[ChatService] WebSocket connection error');
        this.handleSocketDrop();
      };
    } catch (e) {
      this.handleSocketDrop();
      this.scheduleReconnect(customUrl);
    }
  }

  private scheduleReconnect(url?: string) {
    if (this.isOffline) {
      this.setSocketStatus('disconnected');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.setSocketStatus('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connectWebSocket(url);
      }, delay);
    } else {
      this.setSocketStatus('error');
    }
  }

  public retryConnection(url?: string) {
    this.reconnectAttempts = 0;
    this.isIntentionallyClosed = false;
    clearTimeout(this.reconnectTimer);
    this.connectWebSocket(url);
  }

  private handleServerEvent(payload: WsEventPayload) {
    switch (payload.type) {
      case 'connected':
        if (payload.connectionId) {
          this.connectionId = payload.connectionId;
        }
        break;

      case 'searching':
        this.strangerUsername = null;
        this.strangerLanguage = null;
        this.sharedInterests = [];
        this.strangerTypingListeners.forEach((l) => l(false));
        this.setConnectionState('searching');
        break;

      case 'stranger_found':
        this.roomId = payload.roomId || null;
        this.strangerUsername = payload.strangerUsername || 'Stranger';
        this.strangerLanguage = payload.strangerLanguage || null;
        this.sharedInterests = Array.isArray(payload.sharedInterests) ? payload.sharedInterests : [];
        this.strangerTypingListeners.forEach((l) => l(false));
        this.setConnectionState('connected');
        this.strangerFoundListeners.forEach((listener) =>
          listener({
            strangerUsername: this.strangerUsername,
            strangerLanguage: this.strangerLanguage,
            sharedInterests: this.sharedInterests,
          })
        );
        break;

      case 'message':
        if (payload.text) {
          const msgId = payload.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newMsg: ChatMessage = {
            id: msgId,
            sender: payload.sender === 'stranger' ? 'stranger' : 'you',
            text: payload.text,
            timestamp: payload.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered',
          };
          this.messageListeners.forEach((listener) => listener(newMsg));

          // Automatically send message_received confirmation back to server if messageId exists
          if (payload.messageId) {
            this.sendClientEvent('message_received', { messageId: payload.messageId });
          }
        }
        break;

      case 'message_sent':
        if (payload.messageId) {
          this.messageStatusListeners.forEach((listener) =>
            listener({ messageId: payload.messageId!, status: 'sent' })
          );
        }
        break;

      case 'message_delivered':
        if (payload.messageId) {
          this.messageStatusListeners.forEach((listener) =>
            listener({ messageId: payload.messageId!, status: 'delivered' })
          );
        }
        break;

      case 'stranger_typing':
        this.strangerTypingListeners.forEach((listener) => listener(Boolean(payload.isTyping)));
        break;

      case 'report_acknowledged':
        this.notifyNotice(payload.message || 'Report submitted.');
        break;

      case 'online_stats':
        if (typeof payload.onlineCount === 'number' && typeof payload.waitingCount === 'number') {
          this.onlineStats = {
            onlineCount: Math.max(0, payload.onlineCount),
            waitingCount: Math.max(0, payload.waitingCount),
          };
          this.onlineStatsListeners.forEach((listener) => listener(this.onlineStats));
        }
        break;

      case 'maintenance_status':
        this.maintenanceMode = Boolean(payload.maintenanceMode);
        if (payload.maintenanceMessage) {
          this.maintenanceMessage = payload.maintenanceMessage;
        } else if (payload.message) {
          this.maintenanceMessage = payload.message;
        }
        if (payload.maintenanceEstimatedTime !== undefined) {
          this.maintenanceEstimatedTime = payload.maintenanceEstimatedTime || '';
        }
        this.maintenanceListeners.forEach((listener) =>
          listener(this.maintenanceMode, this.maintenanceMessage, this.maintenanceEstimatedTime)
        );
        if (this.maintenanceMode && this.connectionState === 'searching') {
          this.setConnectionState('idle');
          this.notifyNotice(this.maintenanceMessage);
        }
        break;

      case 'stranger_disconnected':
        voiceService.endVoice();
        videoService.endVideo();
        this.roomId = null;
        this.strangerLanguage = null;
        this.strangerTypingListeners.forEach((l) => l(false));
        this.setConnectionState('disconnected');
        this.notifyNotice('Stranger has disconnected.');
        break;

      case 'cancelled':
        voiceService.endVoice();
        videoService.endVideo();
        this.roomId = null;
        this.strangerTypingListeners.forEach((l) => l(false));
        this.setConnectionState('idle');
        break;

      case 'voice_offer':
        if (payload.offer) {
          voiceService.handleVoiceOffer(payload.offer, (type, p) =>
            this.sendMediaSignaling(type, p)
          );
        }
        break;

      case 'voice_answer':
        if (payload.answer) {
          voiceService.handleVoiceAnswer(payload.answer);
        }
        break;

      case 'video_offer':
        if (payload.offer) {
          videoService.handleVideoOffer(payload.offer, (type, p) =>
            this.sendMediaSignaling(type, p)
          );
        }
        break;

      case 'video_answer':
        if (payload.answer) {
          videoService.handleVideoAnswer(payload.answer);
        }
        break;

      case 'ice_candidate':
        if (payload.candidate) {
          voiceService.handleIceCandidate(payload.candidate);
          videoService.handleIceCandidate(payload.candidate);
        }
        break;

      case 'voice_end':
        voiceService.handleVoiceEnd();
        break;

      case 'video_end':
        videoService.handleVideoEnd();
        break;

      case 'error':
        if (payload.message) {
          this.notifyNotice(payload.message);
        }
        break;

      default:
        break;
    }
  }

  public sendMediaSignaling(type: string, payload: any = {}) {
    this.sendClientEvent(type as WsClientMessageType, payload);
  }

  public sendVoiceSignaling(type: string, payload: any = {}) {
    this.sendMediaSignaling(type, payload);
  }

  public startSearch(topic: string = 'all', profile?: UserProfile) {
    if (this.maintenanceMode) {
      this.notifyNotice('StrangerChat is temporarily under maintenance. Please try again later.');
      return;
    }
    voiceService.endVoice();
    videoService.endVideo();
    this.currentTopic = topic;
    if (profile) this.currentProfile = profile;
    this.roomId = null;
    this.strangerUsername = null;
    this.strangerLanguage = null;
    this.sharedInterests = [];
    this.strangerTypingListeners.forEach((l) => l(false));
    this.setConnectionState('searching');

    this.sendClientEvent('find_stranger', {
      topic,
      profile: this.currentProfile || undefined,
    });
  }

  public cancelSearch() {
    voiceService.endVoice();
    videoService.endVideo();
    this.sendClientEvent('cancel_search');
    this.roomId = null;
    this.strangerUsername = null;
    this.strangerLanguage = null;
    this.sharedInterests = [];
    this.strangerTypingListeners.forEach((l) => l(false));
    this.setConnectionState('idle');
  }

  public sendTyping(isTyping: boolean) {
    if (this.connectionState === 'connected') {
      this.sendClientEvent('typing', { isTyping });
    }
  }

  public sendMessage(text: string): ChatMessage | null {
    const sanitized = text.trim();
    if (!sanitized) return null;
    if (sanitized.length > 1000) return null;

    if (this.connectionState !== 'connected') {
      return null;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userMsg: ChatMessage = {
      id: messageId,
      sender: 'you',
      text: sanitized,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
    };

    this.sendClientEvent('send_message', { messageId, text: sanitized, message: sanitized });

    return userMsg;
  }

  public next(profile?: UserProfile) {
    if (this.maintenanceMode) {
      this.notifyNotice('StrangerChat is temporarily under maintenance. Please try again later.');
      return;
    }
    voiceService.endVoice((t, p) => this.sendMediaSignaling(t, p));
    videoService.endVideo((t, p) => this.sendMediaSignaling(t, p));
    if (profile) this.currentProfile = profile;
    this.sendClientEvent('next', {
      topic: this.currentTopic,
      profile: this.currentProfile || undefined,
    });
    this.roomId = null;
    this.strangerUsername = null;
    this.strangerLanguage = null;
    this.sharedInterests = [];
    this.setConnectionState('searching');
  }

  public disconnect() {
    voiceService.endVoice((t, p) => this.sendMediaSignaling(t, p));
    videoService.endVideo((t, p) => this.sendMediaSignaling(t, p));
    this.sendClientEvent('disconnect');
    this.roomId = null;
    this.strangerUsername = null;
    this.strangerLanguage = null;
    this.sharedInterests = [];
    this.setConnectionState('disconnected');
  }

  public report(reason: ReportReason, details?: string) {
    if (this.connectionState === 'connected') {
      this.sendClientEvent('report_user', { reason });
    } else {
      this.notifyNotice('You must be in an active chat session to report.');
    }
  }

  public block() {
    if (this.connectionState === 'connected') {
      voiceService.endVoice((t, p) => this.sendMediaSignaling(t, p));
      videoService.endVideo((t, p) => this.sendMediaSignaling(t, p));
      this.sendClientEvent('block_user');
      this.roomId = null;
      this.strangerUsername = null;
      this.strangerLanguage = null;
      this.sharedInterests = [];
      this.strangerTypingListeners.forEach((l) => l(false));
      this.setConnectionState('searching');
    } else {
      this.notifyNotice('You must be in an active chat session to block.');
    }
  }

  private sendClientEvent(type: WsClientMessageType, extraPayload: Partial<WsEventPayload> = {}) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload: WsEventPayload = {
        type,
        connectionId: this.connectionId || undefined,
        roomId: this.roomId || undefined,
        ...extraPayload,
      };
      this.socket.send(JSON.stringify(payload));
    }
  }

  private notifyNotice(text: string) {
    this.noticeListeners.forEach((listener) => listener(text));
  }

  public destroy() {
    this.stopPingTimer();
    voiceService.destroy();
    videoService.destroy();
    this.isIntentionallyClosed = true;
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.stateChangeListeners.clear();
    this.socketStatusListeners.clear();
    this.messageListeners.clear();
    this.noticeListeners.clear();
  }
}

export const chatService = new ChatService();
