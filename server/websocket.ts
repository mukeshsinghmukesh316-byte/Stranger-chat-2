import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import crypto from 'crypto';

function getSharedInterests(interestsA?: string[], interestsB?: string[]): string[] {
  if (!interestsA || !interestsB || !interestsA.length || !interestsB.length) return [];
  const setB = new Set(interestsB.map((i) => i.toLowerCase()));
  return interestsA.filter((item) => setB.has(item.toLowerCase()));
}

// Helper to check sliding-window rate limits
function checkRateLimit(timestamps: number[], windowMs: number, maxAllowed: number): boolean {
  const now = Date.now();
  while (timestamps.length > 0 && now - timestamps[0] > windowMs) {
    timestamps.shift();
  }
  if (timestamps.length >= maxAllowed) {
    return false;
  }
  timestamps.push(now);
  return true;
}

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  connectedAt: number;
  isAlive: boolean;
  missedPings?: number;
  status: 'idle' | 'searching' | 'connected';
  topic?: string;
  partnerId?: string;
  lastPartnerId?: string;
  roomId?: string;
  searchStartedAt?: number;
  profile?: {
    username: string;
    interests: string[];
    language?: string;
    country?: string;
  };
  blockedUserIds: Set<string>;
  hasReportedCurrentPartner?: boolean;

  // Temporary in-memory anti-spam & rate limit tracking
  eventTimestamps: number[];
  messageTimestamps: number[];
  matchmakingTimestamps: number[];
  reportCount: number;
  lastMessageText?: string;
  lastMessageTime?: number;
  repeatMessageCount?: number;
}

export interface ChatSession {
  id: string;
  clientAId: string;
  clientBId: string;
  createdAt: number;
  topic?: string;
  mediaType?: 'text' | 'voice' | 'video';
}

export interface TemporaryReport {
  id: string;
  reporterConnectionId: string;
  reporterUsername?: string;
  reportedConnectionId: string;
  reportedUsername?: string;
  reason: string;
  timestamp: number;
  status: 'New' | 'Reviewed' | 'Resolved';
  roomId?: string;
}

export interface BannedUserRecord {
  id: string;
  username: string;
  reason: string;
  bannedAt: number;
  expiresAt: number;
  durationMinutes: number;
  bannedBy: string;
}

export interface ModerationAuditEntry {
  id: string;
  action: 'ban' | 'unban' | 'disconnect';
  targetId: string;
  targetUsername: string;
  reason: string;
  timestamp: number;
  performedBy: string;
  banDurationMinutes?: number;
}

export interface WsServerMessage {
  type:
    | 'connected'
    | 'searching'
    | 'stranger_found'
    | 'stranger_disconnected'
    | 'message'
    | 'message_sent'
    | 'message_delivered'
    | 'stranger_typing'
    | 'report_acknowledged'
    | 'cancelled'
    | 'error'
    | 'online_stats'
    | 'maintenance_status'
    | 'ping'
    | 'pong'
    | 'voice_offer'
    | 'voice_answer'
    | 'ice_candidate'
    | 'voice_end'
    | 'video_offer'
    | 'video_answer'
    | 'video_end';
  connectionId?: string;
  topic?: string;
  roomId?: string;
  strangerUsername?: string;
  strangerLanguage?: string;
  sharedInterests?: string[];
  sender?: 'stranger' | 'you' | 'system';
  text?: string;
  timestamp?: string;
  message?: string;
  messageId?: string;
  isTyping?: boolean;
  onlineCount?: number;
  waitingCount?: number;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceEstimatedTime?: string;
  offer?: any;
  answer?: any;
  candidate?: any;
}

export interface WsClientMessage {
  type:
    | 'connect'
    | 'disconnect'
    | 'find_stranger'
    | 'cancel_search'
    | 'send_message'
    | 'message_received'
    | 'typing'
    | 'report_user'
    | 'block_user'
    | 'next'
    | 'ping'
    | 'pong'
    | 'voice_offer'
    | 'voice_answer'
    | 'ice_candidate'
    | 'voice_end'
    | 'video_offer'
    | 'video_answer'
    | 'video_end';
  topic?: string;
  text?: string;
  message?: string;
  messageId?: string;
  isTyping?: boolean;
  roomId?: string;
  reason?: string;
  profile?: {
    username?: string;
    interests?: string[];
  };
  offer?: any;
  answer?: any;
  candidate?: any;
}

export interface ServerSettings {
  maxMessageLength: number;
  messageRateLimit: number;
  matchmakingTimeout: number;
  defaultLanguage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceEstimatedTime: string;

  enableVoiceChat: boolean;
  enableVideoChat: boolean;
  enableNewUserMatching: boolean;
}

export class ChatWebSocketServer {
  private wss: WebSocketServer | null = null;
  // Active client connections stored strictly in memory
  private clients: Map<string, ClientConnection> = new Map();
  // In-memory waiting queue of client IDs
  private waitingQueue: string[] = [];
  // Active chat sessions in memory
  private chatSessions: Map<string, ChatSession> = new Map();
  // Temporary reports stored strictly in memory for active sessions
  private temporaryReports: TemporaryReport[] = [];
  // Temporary in-memory user bans
  private temporaryBans: Map<string, BannedUserRecord> = new Map();
  // Server-side moderation audit log entries
  private moderationAuditLogs: ModerationAuditEntry[] = [];

  // Server settings stored in memory
  private serverSettings: ServerSettings = {
    maxMessageLength: 1000,
    messageRateLimit: 5,
    matchmakingTimeout: 30,
    defaultLanguage: 'English',
    maintenanceMode: false,
    maintenanceMessage: 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.',
    maintenanceEstimatedTime: '',

    enableVoiceChat: true,
    enableVideoChat: true,
    enableNewUserMatching: true,
  };

  public getServerSettings(): ServerSettings {
    return { ...this.serverSettings };
  }

  public broadcastToAll(payload: WsServerMessage): void {
    const messageStr = JSON.stringify(payload);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(messageStr);
        } catch (e) {
          // ignore send error
        }
      }
    }
  }

  public updateServerSettings(newSettings: Partial<ServerSettings>): ServerSettings {
    const prevMaint = this.serverSettings.maintenanceMode;
    this.serverSettings = {
      ...this.serverSettings,
      ...newSettings,
    };

    const isMaint = Boolean(this.serverSettings.maintenanceMode);
    const maintMsg = this.serverSettings.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';
    const estTime = this.serverSettings.maintenanceEstimatedTime || '';

    // Broadcast maintenance status update to all connected clients
    this.broadcastToAll({
      type: 'maintenance_status',
      maintenanceMode: isMaint,
      message: isMaint ? maintMsg : 'StrangerChat is operating normally.',
      maintenanceMessage: maintMsg,
      maintenanceEstimatedTime: estTime,
    });

    if (isMaint) {
      // Clear waiting matchmaking queue when maintenance is enabled or updated
      const waitingIds = [...this.waitingQueue];
      this.waitingQueue = [];
      for (const clientId of waitingIds) {
        const client = this.clients.get(clientId);
        if (client) {
          client.status = 'idle';
          client.topic = undefined;
          this.sendToClient(client.socket, { type: 'cancelled' });
          this.sendToClient(client.socket, {
            type: 'error',
            message: maintMsg,
          });
        }
      }
      this.notifyStatsChange();
    }

    return { ...this.serverSettings };
  }

  // Online Stats throttling & tracking
  private lastStatsBroadcastTime = 0;
  private statsBroadcastTimer: NodeJS.Timeout | null = null;
  private lastSentOnlineCount = -1;
  private lastSentWaitingCount = -1;
  private pingInterval: NodeJS.Timeout | null = null;

  private checkHeartbeats(): void {
    for (const client of Array.from(this.clients.values())) {
      if (client.isAlive === false) {
        client.missedPings = (client.missedPings || 0) + 1;
        if (client.missedPings >= 2) {
          console.log(`[Ping Timeout] Client ${client.id} failed 2 consecutive heartbeats, terminating connection.`);
          try {
            client.socket.terminate();
          } catch (e) {
            // ignore error
          }
          this.cleanupConnection(client);
        } else {
          try {
            if (client.socket.readyState === WebSocket.OPEN) {
              client.socket.ping();
            } else {
              this.cleanupConnection(client);
            }
          } catch (e) {
            this.cleanupConnection(client);
          }
        }
      } else {
        client.isAlive = false;
        client.missedPings = 0;
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.ping();
          } else {
            this.cleanupConnection(client);
          }
        } catch (e) {
          this.cleanupConnection(client);
        }
      }
    }
  }

  public notifyStatsChange(): void {
    const currentOnline = Math.max(0, this.clients.size);
    const currentWaiting = Math.max(0, this.waitingQueue.length);

    if (currentOnline === this.lastSentOnlineCount && currentWaiting === this.lastSentWaitingCount) {
      return;
    }

    const now = Date.now();
    const minInterval = 300; // max ~3 broadcasts per second

    if (now - this.lastStatsBroadcastTime >= minInterval) {
      if (this.statsBroadcastTimer) {
        clearTimeout(this.statsBroadcastTimer);
        this.statsBroadcastTimer = null;
      }
      this.broadcastStatsNow(currentOnline, currentWaiting);
    } else {
      if (!this.statsBroadcastTimer) {
        const delay = minInterval - (now - this.lastStatsBroadcastTime);
        this.statsBroadcastTimer = setTimeout(() => {
          this.statsBroadcastTimer = null;
          this.broadcastStatsNow(Math.max(0, this.clients.size), Math.max(0, this.waitingQueue.length));
        }, delay);
      }
    }
  }

  private broadcastStatsNow(onlineCount: number, waitingCount: number): void {
    this.lastStatsBroadcastTime = Date.now();
    this.lastSentOnlineCount = onlineCount;
    this.lastSentWaitingCount = waitingCount;

    const payload: WsServerMessage = {
      type: 'online_stats',
      onlineCount,
      waitingCount,
    };

    const messageStr = JSON.stringify(payload);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(messageStr);
      }
    }
  }

  public init(server: HttpServer) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 25000);

    this.wss = new WebSocketServer({
      server,
      path: '/ws/chat',
      maxPayload: 64 * 1024,
      verifyClient: (info, callback) => {
        if (allowedOrigins.length === 0) {
          return callback(true);
        }
        const origin = info.origin || info.req.headers.origin;
        if (!origin) {
          return callback(true);
        }
        const isAllowed = allowedOrigins.some((allowed) => {
          try {
            return new URL(allowed).origin === new URL(origin).origin;
          } catch (e) {
            return allowed === origin;
          }
        });
        if (isAllowed) {
          callback(true);
        } else {
          callback(false, 403, 'Forbidden: Origin not allowed');
        }
      },
    });

    this.wss.on('connection', (socket: WebSocket) => {
      // Assign temporary unique connection ID
      const connectionId = crypto.randomUUID();
      const client: ClientConnection = {
        id: connectionId,
        socket,
        connectedAt: Date.now(),
        isAlive: true,
        status: 'idle',
        blockedUserIds: new Set(),
        eventTimestamps: [],
        messageTimestamps: [],
        matchmakingTimestamps: [],
        reportCount: 0,
      };

      this.clients.set(connectionId, client);

      socket.on('pong', () => {
        client.isAlive = true;
        client.missedPings = 0;
      });

      // Send initial 'connected' message to client with assigned connectionId
      this.sendToClient(socket, {
        type: 'connected',
        connectionId,
      });

      // Send initial maintenance status
      const activeMaintMsg = this.serverSettings.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';
      const activeEstTime = this.serverSettings.maintenanceEstimatedTime || '';
      this.sendToClient(socket, {
        type: 'maintenance_status',
        maintenanceMode: this.serverSettings.maintenanceMode,
        message: this.serverSettings.maintenanceMode
          ? activeMaintMsg
          : 'StrangerChat is operating normally.',
        maintenanceMessage: activeMaintMsg,
        maintenanceEstimatedTime: activeEstTime,
      });

      // Send initial stats immediately to newly connected client
      this.sendToClient(socket, {
        type: 'online_stats',
        onlineCount: Math.max(0, this.clients.size),
        waitingCount: Math.max(0, this.waitingQueue.length),
      });

      this.notifyStatsChange();

      // Listen for client messages with payload & rate limit protection
      socket.on('message', (rawMessage: Buffer) => {
        client.isAlive = true;
        client.missedPings = 0;

        // Check if user is currently banned
        const activeBan = this.isUserBanned(client.id, client.profile?.username);
        if (activeBan) {
          const remainingMins = Math.max(1, Math.ceil((activeBan.expiresAt - Date.now()) / 60000));
          this.sendToClient(socket, {
            type: 'error',
            message: `Your account is temporarily banned from StrangerChat. Reason: ${activeBan.reason}. Ban expires in ~${remainingMins} minute(s).`,
          });
          try {
            socket.close(4001, 'Temporarily banned');
          } catch (e) {}
          this.cleanupConnection(client);
          return;
        }

        // 1. Connection protection: Payload size check (max 32KB)
        if (rawMessage.length > 32768) {
          this.sendToClient(socket, {
            type: 'error',
            message: 'Payload exceeds maximum allowed size.',
          });
          return;
        }

        // 2. Connection protection: Rapid event frequency check (max 20 events per 2s)
        if (!checkRateLimit(client.eventTimestamps, 2000, 20)) {
          this.sendToClient(socket, {
            type: 'error',
            message: 'Too many requests. Please slow down.',
          });
          return;
        }

        // 3. Safe JSON parsing & structural validation
        let parsed: WsClientMessage;
        try {
          parsed = JSON.parse(rawMessage.toString());
        } catch (err) {
          this.sendToClient(socket, {
            type: 'error',
            message: 'Invalid message payload JSON format.',
          });
          return;
        }

        if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
          this.sendToClient(socket, {
            type: 'error',
            message: 'Invalid message payload structure.',
          });
          return;
        }

        this.handleClientMessage(client, parsed);
      });

      // Handle socket close / client disconnect
      socket.on('close', () => {
        this.cleanupConnection(client);
      });

      socket.on('error', (err) => {
        console.error(`[WS Error] Client ${connectionId}:`, err.message);
        this.cleanupConnection(client);
      });
    });

    console.log('[WebSocket] Chat server initialized on path /ws/chat');
  }

  private handleClientMessage(client: ClientConnection, msg: WsClientMessage) {
    // 1. Enforce Maintenance Mode
    if (this.serverSettings.maintenanceMode && msg.type !== 'disconnect' && msg.type !== 'ping' && msg.type !== 'pong') {
      const activeNotice = this.serverSettings.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';
      const activeEst = this.serverSettings.maintenanceEstimatedTime || '';

      // Reject new matchmaking or new voice/video calls immediately
      if (msg.type === 'find_stranger' || msg.type === 'voice_offer' || msg.type === 'video_offer') {
        this.sendToClient(client.socket, {
          type: 'error',
          message: activeNotice,
        });
        this.sendToClient(client.socket, {
          type: 'maintenance_status',
          maintenanceMode: true,
          message: activeNotice,
          maintenanceMessage: activeNotice,
          maintenanceEstimatedTime: activeEst,
        });
        return;
      }

      // Prevent new chat sessions from starting. Existing active chat sessions may continue.
      if (client.status !== 'connected' || !client.roomId) {
        this.sendToClient(client.socket, {
          type: 'error',
          message: activeNotice,
        });
        this.sendToClient(client.socket, {
          type: 'maintenance_status',
          maintenanceMode: true,
          message: activeNotice,
          maintenanceMessage: activeNotice,
          maintenanceEstimatedTime: activeEst,
        });
        return;
      }
    }

    switch (msg.type) {
      case 'ping':
        this.sendToClient(client.socket, { type: 'pong' });
        break;

      case 'connect':
        this.sendToClient(client.socket, {
          type: 'connected',
          connectionId: client.id,
        });
        break;

      case 'find_stranger':
        if (!this.serverSettings.enableNewUserMatching) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'New user matchmaking is currently paused by administrators.',
          });
          return;
        }

        if (!checkRateLimit(client.matchmakingTimestamps, 5000, 4)) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You are switching matches too quickly. Please wait a moment.',
          });
          return;
        }
        // If client is already in a session, terminate existing session first
        if (client.roomId) {
          this.endChatSession(client.roomId, 'next', client.id);
        }
        this.addToWaitingQueue(client, msg.topic, msg.profile);
        break;

      case 'cancel_search':
        if (!checkRateLimit(client.matchmakingTimestamps, 5000, 4)) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You are switching matches too quickly. Please wait a moment.',
          });
          return;
        }
        this.removeFromWaitingQueue(client.id);
        client.status = 'idle';
        client.topic = undefined;
        this.sendToClient(client.socket, {
          type: 'cancelled',
        });
        break;

      case 'typing':
        if (client.status === 'connected' && client.partnerId) {
          const partner = this.clients.get(client.partnerId);
          if (partner && partner.socket.readyState === WebSocket.OPEN) {
            this.sendToClient(partner.socket, {
              type: 'stranger_typing',
              isTyping: Boolean(msg.isTyping),
            });
          }
        }
        break;

      case 'send_message':
        if (client.status !== 'connected' || !client.partnerId || !client.roomId) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You are not connected to an active stranger session.',
          });
          return;
        }

        // 1. Rate limit message sending based on configured platform rate limit
        if (!checkRateLimit(client.messageTimestamps, 3000, this.serverSettings.messageRateLimit)) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: "You're sending messages too quickly. Please wait a moment.",
          });
          return;
        }

        // 2. Validate and sanitize message content
        const rawContent = msg.text || msg.message || '';
        if (typeof rawContent !== 'string') {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'Invalid message data format.',
          });
          return;
        }

        const sanitizedText = rawContent.trim();

        if (sanitizedText.length === 0) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'Cannot send empty message.',
          });
          return;
        }

        // 3. Message length limit based on configured platform setting
        if (sanitizedText.length > this.serverSettings.maxMessageLength) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: `Message exceeds maximum length limit of ${this.serverSettings.maxMessageLength} characters.`,
          });
          return;
        }


        // 4. Repeated message protection
        const now = Date.now();
        if (client.lastMessageText === sanitizedText && (now - (client.lastMessageTime || 0)) < 3000) {
          client.repeatMessageCount = (client.repeatMessageCount || 0) + 1;
          if (client.repeatMessageCount >= 3) {
            this.sendToClient(client.socket, {
              type: 'error',
              message: 'Please avoid sending identical messages repeatedly.',
            });
            return;
          }
        } else {
          client.lastMessageText = sanitizedText;
          client.lastMessageTime = now;
          client.repeatMessageCount = 1;
        }

        const messageId =
          typeof msg.messageId === 'string' && msg.messageId.trim()
            ? msg.messageId.trim()
            : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // 1. Send immediate 'sent' acknowledgment back to sender
        this.sendToClient(client.socket, {
          type: 'message_sent',
          messageId,
        });

        // 2. SECURITY: Recipient is derived STRICTLY from server memory (client.partnerId).
        // Any client-provided room or recipient overrides are ignored completely.
        const partner = this.clients.get(client.partnerId);
        if (partner && partner.socket.readyState === WebSocket.OPEN) {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          this.sendToClient(partner.socket, {
            type: 'message',
            messageId,
            sender: 'stranger',
            text: sanitizedText,
            message: sanitizedText,
            timestamp,
          });
        } else {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'Stranger has disconnected or is unavailable.',
          });
        }
        break;

      case 'message_received':
        if (client.status === 'connected' && client.partnerId && msg.messageId) {
          const receivingPartner = this.clients.get(client.partnerId);
          if (receivingPartner && receivingPartner.socket.readyState === WebSocket.OPEN) {
            this.sendToClient(receivingPartner.socket, {
              type: 'message_delivered',
              messageId: msg.messageId,
            });
          }
        }
        break;

      case 'report_user':
        if (client.status !== 'connected' || !client.partnerId || !client.roomId) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You are not in an active chat session to report.',
          });
          return;
        }

        // Report rate limit
        if ((client.reportCount || 0) >= 3) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You have reached the maximum number of report attempts.',
          });
          return;
        }

        // Validate reason
        const rawReason = typeof msg.reason === 'string' ? msg.reason.trim() : '';
        const validReasons = ['harassment', 'spam', 'sexual_content', 'hate_speech', 'scam_fraud', 'other'];
        const sanitizedReason = validReasons.includes(rawReason) ? rawReason : 'other';

        // Check if already reported in this session to prevent duplicate submissions
        if (client.hasReportedCurrentPartner) {
          this.sendToClient(client.socket, {
            type: 'report_acknowledged',
            message: 'Report already submitted for this chat session.',
          });
          return;
        }

        // Store temporary report strictly in server memory
        const reportedPartnerId = client.partnerId; // Derived STRICTLY from server memory
        const reportedPartner = this.clients.get(reportedPartnerId);

        const report: TemporaryReport = {
          id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          reporterConnectionId: client.id,
          reporterUsername: client.profile?.username || 'Stranger',
          reportedConnectionId: reportedPartnerId,
          reportedUsername: reportedPartner?.profile?.username || 'Stranger',
          reason: sanitizedReason,
          timestamp: Date.now(),
          status: 'New',
          roomId: client.roomId,
        };

        this.temporaryReports.push(report);
        client.hasReportedCurrentPartner = true;
        client.reportCount = (client.reportCount || 0) + 1;

        // Send acknowledgment ONLY to reporter
        this.sendToClient(client.socket, {
          type: 'report_acknowledged',
          message: 'Report submitted. Thank you for keeping StrangerChat safe.',
        });

        console.log(`[Report] Connection ${client.id} reported ${reportedPartnerId} for '${sanitizedReason}'`);
        break;

      case 'block_user':
        if (client.status !== 'connected' || !client.partnerId || !client.roomId) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You are not in an active chat session to block.',
          });
          return;
        }

        // Get target strictly from server memory (client.partnerId)
        const targetToBlock = client.partnerId;
        const currentRoom = client.roomId;

        // Add to blocker's temporary in-memory blocklist
        client.blockedUserIds.add(targetToBlock);

        // End current chat session - notifying the blocked partner ONLY that conversation ended
        this.endChatSession(currentRoom, 'block', client.id);

        // Automatically put the blocking user into a fresh matchmaking search
        this.addToWaitingQueue(client, client.topic, client.profile);

        console.log(`[Block] Connection ${client.id} blocked ${targetToBlock} and returned to search.`);
        break;

      case 'next':
        if (!checkRateLimit(client.matchmakingTimestamps, 5000, 4)) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'You are switching matches too quickly. Please wait a moment.',
          });
          return;
        }
        // Terminate active chat session if any
        if (client.roomId) {
          this.endChatSession(client.roomId, 'next', client.id);
        }
        // Remove from waiting queue if already in it
        this.removeFromWaitingQueue(client.id);
        // Put into new search
        this.addToWaitingQueue(client, msg.topic || client.topic, msg.profile);
        break;

      case 'voice_offer':
      case 'voice_answer':
      case 'ice_candidate':
      case 'voice_end':
      case 'video_offer':
      case 'video_answer':
      case 'video_end':
        // Check safety settings for voice & video
        if ((msg.type === 'voice_offer' || msg.type === 'voice_answer') && !this.serverSettings.enableVoiceChat) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'Voice chat is currently disabled by administrators.',
          });
          return;
        }

        if ((msg.type === 'video_offer' || msg.type === 'video_answer') && !this.serverSettings.enableVideoChat) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'Video chat is currently disabled by administrators.',
          });
          return;
        }

        // SECURITY CHECK: User MUST be connected in an active room with a valid partner.
        if (client.status !== 'connected' || !client.partnerId || !client.roomId) {
          this.sendToClient(client.socket, {
            type: 'error',
            message: 'Media signaling is only allowed during an active chat session.',
          });
          return;
        }


        // Track media state on current session
        const currentSession = this.chatSessions.get(client.roomId);
        if (currentSession) {
          if (msg.type === 'voice_offer' || msg.type === 'voice_answer') {
            currentSession.mediaType = 'voice';
          } else if (msg.type === 'video_offer' || msg.type === 'video_answer') {
            currentSession.mediaType = 'video';
          } else if (msg.type === 'voice_end' && currentSession.mediaType === 'voice') {
            currentSession.mediaType = 'text';
          } else if (msg.type === 'video_end' && currentSession.mediaType === 'video') {
            currentSession.mediaType = 'text';
          }
        }

        // Target partner is derived STRICTLY from server memory (client.partnerId).
        // Any client-provided recipient IDs are completely ignored.
        const targetPartner = this.clients.get(client.partnerId);
        if (
          targetPartner &&
          targetPartner.roomId === client.roomId &&
          targetPartner.socket.readyState === WebSocket.OPEN
        ) {
          this.sendToClient(targetPartner.socket, {
            type: msg.type,
            offer: msg.offer,
            answer: msg.answer,
            candidate: msg.candidate,
          });
        } else {
          // If partner is missing or disconnected, signal termination back to client
          const fallbackEndType = msg.type.startsWith('video_') ? 'video_end' : 'voice_end';
          this.sendToClient(client.socket, {
            type: fallbackEndType,
          });
        }
        break;

      case 'disconnect':
        this.cleanupConnection(client);
        break;

      default:
        this.sendToClient(client.socket, {
          type: 'error',
          message: `Unknown event type '${(msg as any).type}'`,
        });
        break;
    }
  }

  // --- SERVER-SIDE MATCHMAKING CORE FUNCTIONS ---

  public addToWaitingQueue(
    client: ClientConnection,
    topic?: string,
    profile?: { username?: string; interests?: string[]; language?: string; country?: string }
  ): void {
    // Process and store temporary anonymous profile if provided
    if (profile) {
      const rawUsername = typeof profile.username === 'string' ? profile.username.trim() : '';
      const sanitizedUsername = rawUsername.length >= 2 ? rawUsername.slice(0, 20) : `Stranger_${client.id.slice(0, 4)}`;
      const sanitizedInterests = Array.isArray(profile.interests)
        ? profile.interests.filter((i) => typeof i === 'string').slice(0, 10)
        : [];
      const rawLang = typeof profile.language === 'string' ? profile.language.trim() : 'Any';
      const sanitizedLanguage = rawLang && rawLang.length <= 30 ? rawLang : 'Any';
      const rawCountry = typeof profile.country === 'string' ? profile.country.trim() : 'Any country';
      const sanitizedCountry = rawCountry && rawCountry.length <= 40 ? rawCountry : 'Any country';

      client.profile = {
        username: sanitizedUsername,
        interests: sanitizedInterests,
        language: sanitizedLanguage,
        country: sanitizedCountry,
      };
    }

    client.searchStartedAt = Date.now();

    // Edge Case: Do not allow if already connected in a chat session
    if (client.status === 'connected' && client.roomId) {
      this.sendToClient(client.socket, {
        type: 'error',
        message: 'You are currently in an active chat session. Disconnect first.',
      });
      return;
    }

    // Edge Case: Prevent entering waiting queue twice
    if (!this.waitingQueue.includes(client.id)) {
      this.waitingQueue.push(client.id);
    }

    client.status = 'searching';
    client.topic = topic || 'all';

    this.sendToClient(client.socket, {
      type: 'searching',
      topic: client.topic,
    });

    this.notifyStatsChange();

    // Attempt to match with waiting partner
    this.findMatch(client);
  }

  public removeFromWaitingQueue(clientId: string): boolean {
    const index = this.waitingQueue.indexOf(clientId);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
      this.notifyStatsChange();
      return true;
    }
    return false;
  }

  public findMatch(client: ClientConnection): void {
    // If client was removed from queue or closed socket, stop
    if (!this.waitingQueue.includes(client.id) || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Gather all valid candidates currently in the waiting queue
    const eligibleCandidates: ClientConnection[] = [];
    for (const id of this.waitingQueue) {
      if (id === client.id) continue;
      const cand = this.clients.get(id);
      if (cand && cand.socket.readyState === WebSocket.OPEN && cand.status === 'searching') {
        // TEMPORARY BLOCKLIST CHECK: Do not match if either user blocked the other during this connection
        if (client.blockedUserIds?.has(cand.id) || cand.blockedUserIds?.has(client.id)) {
          continue;
        }
        eligibleCandidates.push(cand);
      }
    }

    if (eligibleCandidates.length === 0) return;

    // Filter out immediate previous partner if other candidates exist
    let candidates = eligibleCandidates;
    if (client.lastPartnerId) {
      const nonPrevious = eligibleCandidates.filter((c) => c.id !== client.lastPartnerId);
      if (nonPrevious.length > 0) {
        candidates = nonPrevious;
      }
    }

    // Calculate score for each candidate based on language, interests, and country preferences
    const clientLang = client.profile?.language || 'Any';
    const clientCountry = client.profile?.country || 'Any country';
    const clientInterests = client.profile?.interests || [];
    const waitingDuration = Date.now() - (client.searchStartedAt || Date.now());

    let bestCandidate: ClientConnection | null = null;
    let highestScore = -1;

    for (const candidate of candidates) {
      const candLang = candidate.profile?.language || 'Any';
      const candCountry = candidate.profile?.country || 'Any country';
      const candInterests = candidate.profile?.interests || [];

      let score = 0;

      // 1. Language preference check
      const isLangCompatible =
        clientLang === 'Any' || candLang === 'Any' || clientLang.toLowerCase() === candLang.toLowerCase();

      if (isLangCompatible) {
        score += 20;
      } else if (waitingDuration < 4000) {
        // Prioritize language compatibility for the first 4 seconds; skip incompatible candidates initially
        continue;
      } else {
        // Fallback after 4 seconds: allow matching regardless of language preference
        score += 1;
      }

      // 2. Shared interests matching
      const shared = getSharedInterests(clientInterests, candInterests);
      score += shared.length * 5;

      // 3. Country preference matching
      const isCountryCompatible =
        clientCountry === 'Any country' ||
        clientCountry === 'Any' ||
        candCountry === 'Any country' ||
        candCountry === 'Any' ||
        clientCountry.toLowerCase() === candCountry.toLowerCase();

      if (isCountryCompatible) {
        score += 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = candidate;
      }
    }

    // Fallback if strict filters yielded no candidate after waiting time
    if (!bestCandidate && candidates.length > 0 && waitingDuration >= 4000) {
      bestCandidate = candidates[0];
    }

    if (bestCandidate) {
      // Remove both from queue
      this.removeFromWaitingQueue(client.id);
      this.removeFromWaitingQueue(bestCandidate.id);

      // Create session
      this.createChatSession(client, bestCandidate);
    }
  }

  public createChatSession(clientA: ClientConnection, clientB: ClientConnection): ChatSession {
    const roomId = crypto.randomUUID();

    const session: ChatSession = {
      id: roomId,
      clientAId: clientA.id,
      clientBId: clientB.id,
      createdAt: Date.now(),
      topic: clientA.topic || clientB.topic || 'all',
      mediaType: 'text',
    };

    // Update clients' in-memory status
    clientA.status = 'connected';
    clientA.roomId = roomId;
    clientA.partnerId = clientB.id;
    clientA.hasReportedCurrentPartner = false;

    clientB.status = 'connected';
    clientB.roomId = roomId;
    clientB.partnerId = clientA.id;
    clientB.hasReportedCurrentPartner = false;

    this.chatSessions.set(roomId, session);

    // Calculate shared interests
    const sharedInterests = getSharedInterests(
      clientA.profile?.interests,
      clientB.profile?.interests
    );

    // Notify BOTH users with ONLY safe UI info (stranger username, optional stranger language, shared interests)
    this.sendToClient(clientA.socket, {
      type: 'stranger_found',
      roomId,
      topic: session.topic,
      strangerUsername: clientB.profile?.username || 'Stranger',
      strangerLanguage: clientB.profile?.language && clientB.profile.language !== 'Any' ? clientB.profile.language : undefined,
      sharedInterests,
    });

    this.sendToClient(clientB.socket, {
      type: 'stranger_found',
      roomId,
      topic: session.topic,
      strangerUsername: clientA.profile?.username || 'Stranger',
      strangerLanguage: clientA.profile?.language && clientA.profile.language !== 'Any' ? clientA.profile.language : undefined,
      sharedInterests,
    });

    console.log(
      `[Matchmaker] Paired ${clientA.id} (${clientA.profile?.username}) <-> ${clientB.id} (${clientB.profile?.username}) in room ${roomId}. Shared interests: [${sharedInterests.join(', ')}]`
    );
    return session;
  }

  public endChatSession(roomId: string, reason: string = 'disconnected', initiatorId?: string): void {
    const session = this.chatSessions.get(roomId);
    if (!session) return;

    this.chatSessions.delete(roomId);

    const clientA = this.clients.get(session.clientAId);
    const clientB = this.clients.get(session.clientBId);

    // Save lastPartnerId for both clients to avoid immediate re-matching
    if (clientA && clientB) {
      clientA.lastPartnerId = clientB.id;
      clientB.lastPartnerId = clientA.id;
    }

    // Reset client A
    if (clientA) {
      clientA.roomId = undefined;
      clientA.partnerId = undefined;
      if (clientA.id !== initiatorId) {
        clientA.status = 'idle';
        this.sendToClient(clientA.socket, { type: 'stranger_disconnected' });
      }
    }

    // Reset client B
    if (clientB) {
      clientB.roomId = undefined;
      clientB.partnerId = undefined;
      if (clientB.id !== initiatorId) {
        clientB.status = 'idle';
        this.sendToClient(clientB.socket, { type: 'stranger_disconnected' });
      }
    }

    console.log(`[Matchmaker] Ended room ${roomId} (Initiator: ${initiatorId || 'system'}, Reason: ${reason})`);
  }

  public cleanupConnection(client: ClientConnection): void {
    if (!this.clients.has(client.id)) {
      return;
    }

    // 1. Remove client from memory map FIRST
    this.clients.delete(client.id);

    // 2. Remove from waiting queue if present
    this.removeFromWaitingQueue(client.id);

    // 3. End session if currently matched
    if (client.roomId) {
      this.endChatSession(client.roomId, 'disconnect', client.id);
    }

    // 4. Remove temporary reports involving this connection
    this.temporaryReports = this.temporaryReports.filter(
      (r) => r.reporterConnectionId !== client.id && r.reportedConnectionId !== client.id
    );

    // 5. Clear temporary blocklist & rate limit state
    if (client.blockedUserIds) {
      client.blockedUserIds.clear();
    }
    client.eventTimestamps = [];
    client.messageTimestamps = [];
    client.matchmakingTimestamps = [];
    client.lastMessageText = undefined;
    client.lastMessageTime = undefined;
    client.repeatMessageCount = 0;
    client.reportCount = 0;

    // 6. Notify active stats change
    this.notifyStatsChange();
    console.log(`[WS] Connection ${client.id} cleaned up.`);
  }

  private sendToClient(socket: WebSocket, message: WsServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  public getActiveCount(): number {
    return this.clients.size;
  }

  public getWaitingCount(): number {
    return this.waitingQueue.length;
  }

  public getSessionCount(): number {
    return this.chatSessions.size;
  }

  public getSystemStats() {
    const onlineUsers = Math.max(0, this.clients.size);
    const searchingUsers = Math.max(0, this.waitingQueue.length);

    let activeVoiceChats = 0;
    let activeVideoChats = 0;
    let activeTextChats = 0;

    for (const session of this.chatSessions.values()) {
      if (session.mediaType === 'video') {
        activeVideoChats++;
      } else if (session.mediaType === 'voice') {
        activeVoiceChats++;
      } else {
        activeTextChats++;
      }
    }

    return {
      onlineUsers,
      searchingUsers,
      activeTextChats,
      activeVoiceChats,
      activeVideoChats,
      totalActiveSessions: this.chatSessions.size,
    };
  }

  public getLiveUsersList() {
    const users = [];
    for (const client of this.clients.values()) {
      let mediaType: 'text' | 'voice' | 'video' | undefined = undefined;
      if (client.roomId) {
        const session = this.chatSessions.get(client.roomId);
        if (session) {
          mediaType = session.mediaType || 'text';
        }
      }

      users.push({
        id: client.id,
        username: client.profile?.username || 'Stranger',
        status: client.status,
        language: client.profile?.language || 'Any',
        country: client.profile?.country || 'Global',
        interests: client.profile?.interests || [],
        connectedAt: client.connectedAt,
        topic: client.topic,
        roomId: client.roomId,
        mediaType,
      });
    }
    return users;
  }

  public getLiveUserDetail(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (!client) return null;

    let partnerUsername: string | undefined = undefined;
    let mediaType: 'text' | 'voice' | 'video' | undefined = undefined;
    let sessionCreatedAt: number | undefined = undefined;

    if (client.roomId) {
      const session = this.chatSessions.get(client.roomId);
      if (session) {
        mediaType = session.mediaType || 'text';
        sessionCreatedAt = session.createdAt;
        if (client.partnerId) {
          const partner = this.clients.get(client.partnerId);
          if (partner) {
            partnerUsername = partner.profile?.username || 'Stranger';
          }
        }
      }
    }

    return {
      id: client.id,
      username: client.profile?.username || 'Stranger',
      status: client.status,
      language: client.profile?.language || 'Any',
      country: client.profile?.country || 'Global',
      interests: client.profile?.interests || [],
      connectedAt: client.connectedAt,
      topic: client.topic,
      roomId: client.roomId,
      mediaType,
      partnerUsername,
      sessionCreatedAt,
      reportCount: client.reportCount || 0,
    };
  }

  public disconnectUser(connectionId: string): boolean {
    const client = this.clients.get(connectionId);
    if (!client) return false;

    try {
      this.sendToClient(client.socket, {
        type: 'error',
        text: 'Your session was disconnected by an administrator.',
      });
      client.socket.close(4000, 'Disconnected by administrator');
    } catch (e) {
      // ignore socket errors
    }

    this.cleanupConnection(client);
    return true;
  }

  public getReportsList() {
    return this.temporaryReports.map((report) => {
      const reporter = this.clients.get(report.reporterConnectionId);
      const reported = this.clients.get(report.reportedConnectionId);

      return {
        id: report.id,
        reporterConnectionId: report.reporterConnectionId,
        reporterUsername: report.reporterUsername || reporter?.profile?.username || 'Stranger',
        reportedConnectionId: report.reportedConnectionId,
        reportedUsername: report.reportedUsername || reported?.profile?.username || 'Stranger',
        reason: report.reason,
        timestamp: report.timestamp,
        status: report.status || 'New',
        roomId: report.roomId,
        isReportedUserOnline: Boolean(reported && reported.socket.readyState === WebSocket.OPEN),
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getReportDetail(reportId: string) {
    const report = this.temporaryReports.find((r) => r.id === reportId);
    if (!report) return null;

    const reporter = this.clients.get(report.reporterConnectionId);
    const reported = this.clients.get(report.reportedConnectionId);

    return {
      id: report.id,
      reporterConnectionId: report.reporterConnectionId,
      reporterUsername: report.reporterUsername || reporter?.profile?.username || 'Stranger',
      reportedConnectionId: report.reportedConnectionId,
      reportedUsername: report.reportedUsername || reported?.profile?.username || 'Stranger',
      reason: report.reason,
      timestamp: report.timestamp,
      status: report.status || 'New',
      roomId: report.roomId,
      isReportedUserOnline: Boolean(reported && reported.socket.readyState === WebSocket.OPEN),
      reportedUserStatus: reported ? reported.status : 'disconnected',
    };
  }

  public updateReportStatus(reportId: string, status: 'New' | 'Reviewed' | 'Resolved'): boolean {
    const report = this.temporaryReports.find((r) => r.id === reportId);
    if (!report) return false;

    report.status = status;
    return true;
  }

  public disconnectReportedUserByReportId(reportId: string): { success: boolean; message: string } {
    const report = this.temporaryReports.find((r) => r.id === reportId);
    if (!report) {
      return { success: false, message: 'Report not found' };
    }

    const disconnectSuccess = this.disconnectUser(report.reportedConnectionId);
    report.status = 'Resolved';

    if (disconnectSuccess) {
      return { success: true, message: 'Reported user disconnected and report marked as Resolved.' };
    } else {
      return { success: true, message: 'Report marked as Resolved. (User was already offline).' };
    }
  }

  public getActiveSessionsList() {
    const sessionsList = [];
    for (const [roomId, session] of this.chatSessions.entries()) {
      const clientA = this.clients.get(session.clientAId);
      const clientB = this.clients.get(session.clientBId);

      const user1Username = clientA?.profile?.username || 'Stranger 1';
      const user2Username = clientB?.profile?.username || 'Stranger 2';

      const sharedInterests = getSharedInterests(
        clientA?.profile?.interests,
        clientB?.profile?.interests
      );

      const mediaType = session.mediaType || (
        (clientA?.topic === 'voice' || clientB?.topic === 'voice')
          ? 'voice'
          : (clientA?.topic === 'video' || clientB?.topic === 'video')
          ? 'video'
          : 'text'
      );

      sessionsList.push({
        id: session.id,
        user1Username,
        user2Username,
        user1ConnectionId: session.clientAId,
        user2ConnectionId: session.clientBId,
        sessionType: (mediaType.charAt(0).toUpperCase() + mediaType.slice(1)) as 'Text' | 'Voice' | 'Video',
        sharedInterests,
        createdAt: session.createdAt,
        durationSeconds: Math.floor((Date.now() - session.createdAt) / 1000),
        topic: session.topic || 'all',
        status: 'Active' as const,
        isUser1Online: Boolean(clientA && clientA.socket.readyState === WebSocket.OPEN),
        isUser2Online: Boolean(clientB && clientB.socket.readyState === WebSocket.OPEN),
      });
    }
    return sessionsList.sort((a, b) => b.createdAt - a.createdAt);
  }

  public getActiveSessionDetail(roomId: string) {
    const session = this.chatSessions.get(roomId);
    if (!session) return null;

    const clientA = this.clients.get(session.clientAId);
    const clientB = this.clients.get(session.clientBId);

    const user1Username = clientA?.profile?.username || 'Stranger 1';
    const user2Username = clientB?.profile?.username || 'Stranger 2';

    const sharedInterests = getSharedInterests(
      clientA?.profile?.interests,
      clientB?.profile?.interests
    );

    const mediaType = session.mediaType || (
      (clientA?.topic === 'voice' || clientB?.topic === 'voice')
        ? 'voice'
        : (clientA?.topic === 'video' || clientB?.topic === 'video')
        ? 'video'
        : 'text'
    );

    return {
      id: session.id,
      user1Username,
      user2Username,
      user1ConnectionId: session.clientAId,
      user2ConnectionId: session.clientBId,
      user1Language: clientA?.profile?.language || 'Any',
      user2Language: clientB?.profile?.language || 'Any',
      user1Country: clientA?.profile?.country || 'Any country',
      user2Country: clientB?.profile?.country || 'Any country',
      sessionType: (mediaType.charAt(0).toUpperCase() + mediaType.slice(1)) as 'Text' | 'Voice' | 'Video',
      sharedInterests,
      createdAt: session.createdAt,
      durationSeconds: Math.floor((Date.now() - session.createdAt) / 1000),
      topic: session.topic || 'all',
      status: 'Active' as const,
      isUser1Online: Boolean(clientA && clientA.socket.readyState === WebSocket.OPEN),
      isUser2Online: Boolean(clientB && clientB.socket.readyState === WebSocket.OPEN),
    };
  }

  public endSessionByAdmin(roomId: string): { success: boolean; message: string } {
    const session = this.chatSessions.get(roomId);
    if (!session) {
      return { success: false, message: 'Active session not found or already ended.' };
    }

    const clientA = this.clients.get(session.clientAId);
    const clientB = this.clients.get(session.clientBId);

    // End chat session in memory & reset statuses
    this.endChatSession(roomId, 'admin_terminated');

    // Notify both users explicitly
    if (clientA && clientA.socket.readyState === WebSocket.OPEN) {
      this.sendToClient(clientA.socket, {
        type: 'stranger_disconnected',
      });
    }

    if (clientB && clientB.socket.readyState === WebSocket.OPEN) {
      this.sendToClient(clientB.socket, {
        type: 'stranger_disconnected',
      });
    }

    return { success: true, message: 'Session terminated immediately for both users.' };
  }

  public isUserBanned(connectionId: string, username?: string): BannedUserRecord | null {
    let ban = this.temporaryBans.get(connectionId);
    if (!ban && username) {
      for (const b of this.temporaryBans.values()) {
        if (b.username && b.username.toLowerCase() === username.toLowerCase()) {
          ban = b;
          break;
        }
      }
    }

    if (!ban) return null;

    if (Date.now() > ban.expiresAt) {
      this.temporaryBans.delete(ban.id);
      return null;
    }

    return ban;
  }

  public banUser(
    targetId: string,
    durationMinutes: number,
    reason: string,
    adminUsername: string
  ): { success: boolean; message: string } {
    if (!targetId) {
      return { success: false, message: 'Target user ID is required.' };
    }

    const duration = Math.max(1, durationMinutes || 30);
    const durationMs = duration * 60 * 1000;
    const now = Date.now();
    const expiresAt = now + durationMs;

    const client = this.clients.get(targetId);
    const username = client?.profile?.username || `User_${targetId.substring(0, 6)}`;

    const banRecord: BannedUserRecord = {
      id: targetId,
      username,
      reason: reason || 'Violation of community guidelines',
      bannedAt: now,
      expiresAt,
      durationMinutes: duration,
      bannedBy: adminUsername || 'admin',
    };

    this.temporaryBans.set(targetId, banRecord);

    // Immediately terminate session & disconnect if online
    if (client) {
      if (client.roomId) {
        this.endChatSession(client.roomId, 'admin_terminated');
      }

      try {
        this.sendToClient(client.socket, {
          type: 'error',
          message: `Your account has been temporarily banned for ${duration} minutes. Reason: ${reason || 'Violation of guidelines'}.`,
        });
        client.socket.close(4001, 'Banned by administrator');
      } catch (e) {
        // ignore socket errors
      }

      this.cleanupConnection(client);
    }

    // Add audit entry
    this.moderationAuditLogs.unshift({
      id: crypto.randomUUID(),
      action: 'ban',
      targetId,
      targetUsername: username,
      reason: reason || 'Violation of guidelines',
      timestamp: now,
      performedBy: adminUsername || 'admin',
      banDurationMinutes: duration,
    });

    return {
      success: true,
      message: `User ${username} was banned for ${duration} minutes.`,
    };
  }

  public unbanUser(
    targetId: string,
    adminUsername: string,
    reason?: string
  ): { success: boolean; message: string } {
    let ban = this.temporaryBans.get(targetId);
    if (!ban) {
      for (const [id, b] of this.temporaryBans.entries()) {
        if (id === targetId || b.username.toLowerCase() === targetId.toLowerCase()) {
          ban = b;
          break;
        }
      }
    }

    if (!ban) {
      return { success: false, message: 'No active ban found for this user.' };
    }

    this.temporaryBans.delete(ban.id);
    const username = ban.username || targetId;

    this.moderationAuditLogs.unshift({
      id: crypto.randomUUID(),
      action: 'unban',
      targetId: ban.id,
      targetUsername: username,
      reason: reason || 'Unbanned by administrator',
      timestamp: Date.now(),
      performedBy: adminUsername || 'admin',
    });

    return {
      success: true,
      message: `User ${username} unbanned successfully.`,
    };
  }

  public disconnectUserWithAudit(
    targetId: string,
    adminUsername: string,
    reason?: string
  ): { success: boolean; message: string } {
    const client = this.clients.get(targetId);
    const username = client?.profile?.username || `User_${targetId.substring(0, 6)}`;

    const disconnected = this.disconnectUser(targetId);

    this.moderationAuditLogs.unshift({
      id: crypto.randomUUID(),
      action: 'disconnect',
      targetId,
      targetUsername: username,
      reason: reason || 'Disconnected by administrator',
      timestamp: Date.now(),
      performedBy: adminUsername || 'admin',
    });

    if (!disconnected) {
      return { success: true, message: `Disconnect recorded for ${username} (user was already offline).` };
    }

    return { success: true, message: `User ${username} disconnected successfully.` };
  }

  public getModerationStatusList() {
    const now = Date.now();
    const moderationUsers: Array<{
      targetId: string;
      username: string;
      currentStatus: 'Searching' | 'In Chat' | 'Idle' | 'Disconnected' | 'Banned';
      isOnline: boolean;
      banStatus: 'Active Ban' | 'Not Banned' | 'Ban Expired';
      bannedAt: number | null;
      expiresAt: number | null;
      banExpiryMs: number;
      durationMinutes: number | null;
      reason: string;
      bannedBy: string | null;
    }> = [];

    const activeUserIds = new Set<string>();

    for (const client of this.clients.values()) {
      activeUserIds.add(client.id);
      const activeBan = this.isUserBanned(client.id, client.profile?.username);

      let currentStatus: 'Searching' | 'In Chat' | 'Idle' | 'Banned' = 'Idle';
      if (client.status === 'searching') currentStatus = 'Searching';
      if (client.status === 'connected') currentStatus = 'In Chat';
      if (activeBan) currentStatus = 'Banned';

      const username = client.profile?.username || `Stranger_${client.id.substring(0, 6)}`;

      moderationUsers.push({
        targetId: client.id,
        username,
        currentStatus,
        isOnline: true,
        banStatus: activeBan ? 'Active Ban' : 'Not Banned',
        bannedAt: activeBan ? activeBan.bannedAt : null,
        expiresAt: activeBan ? activeBan.expiresAt : null,
        banExpiryMs: activeBan ? Math.max(0, activeBan.expiresAt - now) : 0,
        durationMinutes: activeBan ? activeBan.durationMinutes : null,
        reason: activeBan ? activeBan.reason : 'None',
        bannedBy: activeBan ? activeBan.bannedBy : null,
      });
    }

    for (const [banId, ban] of this.temporaryBans.entries()) {
      if (now > ban.expiresAt) {
        this.temporaryBans.delete(banId);
        continue;
      }

      if (!activeUserIds.has(banId)) {
        moderationUsers.push({
          targetId: ban.id,
          username: ban.username,
          currentStatus: 'Banned',
          isOnline: false,
          banStatus: 'Active Ban',
          bannedAt: ban.bannedAt,
          expiresAt: ban.expiresAt,
          banExpiryMs: Math.max(0, ban.expiresAt - now),
          durationMinutes: ban.durationMinutes,
          reason: ban.reason,
          bannedBy: ban.bannedBy,
        });
      }
    }

    return {
      users: moderationUsers,
      auditLogs: this.moderationAuditLogs.slice(0, 100),
      activeBansCount: this.temporaryBans.size,
    };
  }

  public shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.statsBroadcastTimer) {
      clearTimeout(this.statsBroadcastTimer);
      this.statsBroadcastTimer = null;
    }

    for (const client of this.clients.values()) {
      try {
        client.socket.close(1001, 'Server shutting down');
      } catch (e) {}
    }

    this.clients.clear();
    this.waitingQueue = [];
    this.chatSessions.clear();
    this.temporaryReports = [];

    if (this.wss) {
      try {
        this.wss.close();
      } catch (e) {}
      this.wss = null;
    }
  }
}

export const chatWsServer = new ChatWebSocketServer();

