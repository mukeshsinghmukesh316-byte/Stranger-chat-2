export type AppScreen = 'landing' | 'waiting' | 'chat' | 'admin_login' | 'admin_dashboard';

export type ConnectionState = 'idle' | 'searching' | 'connected' | 'disconnected';

export type VoiceStatus =
  | 'idle'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'permission_denied'
  | 'failed';

export type VideoStatus =
  | 'idle'
  | 'requesting'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'permission_denied'
  | 'failed'
  | 'ended';

export interface ChatMessage {
  id: string;
  sender: 'you' | 'stranger' | 'system';
  text: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'delivered';
}

export type ReportStatus = 'New' | 'Reviewed' | 'Resolved';

export type ReportReason = 'harassment' | 'spam' | 'sexual_content' | 'hate_speech' | 'scam_fraud' | 'other';

export interface ReportItem {
  id: string;
  reporterConnectionId: string;
  reporterUsername: string;
  reportedConnectionId: string;
  reportedUsername: string;
  reason: string;
  timestamp: number;
  status: ReportStatus;
  roomId?: string;
  isReportedUserOnline?: boolean;
}

export interface ReportDetail extends ReportItem {
  reportedUserStatus?: string;
}

export interface SessionItem {
  id: string; // roomId
  user1Username: string;
  user2Username: string;
  user1ConnectionId: string;
  user2ConnectionId: string;
  sessionType: 'Text' | 'Voice' | 'Video';
  sharedInterests: string[];
  createdAt: number;
  durationSeconds: number;
  topic: string;
  status: 'Active' | 'Ended';
  isUser1Online?: boolean;
  isUser2Online?: boolean;
}

export interface SessionDetail extends SessionItem {
  user1Language?: string;
  user2Language?: string;
  user1Country?: string;
  user2Country?: string;
}

export interface InterestTag {
  id: string;
  label: string;
  icon?: string;
}

export type WsClientMessageType =
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

export type WsServerMessageType =
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

export type SocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface OnlineStats {
  onlineCount: number;
  waitingCount: number;
}

export interface UserProfile {
  username: string;
  interests: string[];
  language?: string;
  country?: string;
}

export interface WsEventPayload {
  type: string;
  connectionId?: string;
  roomId?: string;
  peerId?: string;
  topic?: string;
  strangerUsername?: string;
  strangerLanguage?: string;
  sharedInterests?: string[];
  sender?: 'stranger' | 'you' | 'system';
  text?: string;
  timestamp?: string;
  reason?: string;
  message?: string;
  messageId?: string;
  isTyping?: boolean;
  profile?: UserProfile;
  onlineCount?: number;
  waitingCount?: number;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceEstimatedTime?: string;
  offer?: any;
  answer?: any;
  candidate?: any;
}

export interface ModerationUserItem {
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

export interface ModerationStatusResponse {
  users: ModerationUserItem[];
  auditLogs: ModerationAuditEntry[];
  activeBansCount: number;
}

export interface AdminAuditLogItem {
  id: string;
  action: 'Admin Login' | 'Admin Logout' | 'User Disconnect' | 'User Ban' | 'User Unban' | 'Report Reviewed' | 'Report Resolved' | 'Session Ended' | 'Logs Cleared' | string;
  performedBy: string;
  target?: string;
  reason?: string;
  timestamp: number;
  details?: string;
}

export interface AdminProfileSettings {
  username: string;
  email: string;
}

export interface PlatformSettings {
  maxMessageLength: number;
  messageRateLimit: number;
  matchmakingTimeout: number;
  defaultLanguage: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  maintenanceEstimatedTime?: string;
}

export interface SafetySettings {
  enableVoiceChat: boolean;
  enableVideoChat: boolean;
  enableNewUserMatching: boolean;
}

export interface AdminSettingsResponse {
  profile: AdminProfileSettings;
  platform: PlatformSettings;
  safety: SafetySettings;
}


