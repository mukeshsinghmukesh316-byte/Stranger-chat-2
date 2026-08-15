import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Server,
  Activity,
  Globe,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Mic,
  Video,
  RotateCw,
  UserX,
  Eye,
  Clock,
  Search,
  Loader2,
  Tag,
  Lock,
  KeyRound,
  Check,
  CheckCircle,
  AlertTriangle,
  Filter,
  FileText,
  PhoneOff,
  Gavel,
  Ban,
  ShieldX,
  Trash2,
  RefreshCw,
  User,
  Mail,
  Save,
  ToggleLeft,
  ToggleRight,
  Shield,
  Wrench,
} from 'lucide-react';
import {
  OnlineStats,
  SocketConnectionStatus,
  ReportItem,
  ReportDetail,
  ReportStatus,
  SessionItem,
  SessionDetail,
  ModerationUserItem,
  ModerationAuditEntry,
  ModerationStatusResponse,
  AdminAuditLogItem,
  AdminSettingsResponse,
} from '../../types';
import { adminFetch, clearAdminToken } from '../../utils/adminAuth';

export type AdminTab = 'dashboard' | 'users' | 'reports' | 'sessions' | 'moderation' | 'audit' | 'settings';

interface RealSystemStats {
  onlineUsers: number;
  searchingUsers: number;
  activeTextChats: number;
  activeVoiceChats: number;
  activeVideoChats: number;
  totalActiveSessions: number;
}

export interface LiveUser {
  id: string;
  username: string;
  status: 'idle' | 'searching' | 'connected';
  language: string;
  country: string;
  interests: string[];
  connectedAt: number;
  topic?: string;
  roomId?: string;
  mediaType?: 'text' | 'voice' | 'video';
}

export interface LiveUserDetail extends LiveUser {
  partnerUsername?: string;
  sessionCreatedAt?: number;
  reportCount?: number;
}

function formatConnectedDuration(connectedAt: number): string {
  if (!connectedAt) return 'Just now';
  const diffMs = Date.now() - connectedAt;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 0) return 'Just now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

function formatReportTime(timestamp: number): string {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - timestamp;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBanExpiry(expiresAt: number | null, banExpiryMs: number): string {
  if (!expiresAt) return 'N/A';
  const remainingSeconds = Math.floor(banExpiryMs / 1000);
  if (remainingSeconds <= 0) return 'Expired';
  if (remainingSeconds < 60) return `In ${remainingSeconds}s`;
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  if (mins < 60) return `In ${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `In ${hours}h ${remainingMins}m`;
}

function formatReasonLabel(reason: string): string {
  switch (reason) {
    case 'harassment':
      return 'Harassment / Bullying';
    case 'spam':
      return 'Spam / Bot Behavior';
    case 'sexual_content':
      return 'Inappropriate / Sexual Content';
    case 'hate_speech':
      return 'Hate Speech';
    case 'scam_fraud':
      return 'Scam / Phishing';
    default:
      return reason ? reason.replace(/_/g, ' ').toUpperCase() : 'Other';
  }
}

interface AdminDashboardProps {
  onlineStats?: OnlineStats;
  socketStatus?: SocketConnectionStatus;
  isMaintenanceMode?: boolean;
  onLogout: () => void;
  onReturnToPublic: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onlineStats,
  socketStatus = 'connected',
  isMaintenanceMode = false,
  onLogout,
  onReturnToPublic,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [serverStats, setServerStats] = useState<RealSystemStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [selectedUserDetail, setSelectedUserDetail] = useState<LiveUserDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Reports Management State
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReportDetail, setSelectedReportDetail] = useState<ReportDetail | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'All' | 'New' | 'Reviewed' | 'Resolved'>('All');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [actionInProgressReportId, setActionInProgressReportId] = useState<string | null>(null);
  const [reportFeedbackMessage, setReportFeedbackMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active Sessions Management State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SessionDetail | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'All' | 'Text' | 'Voice' | 'Video'>('All');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [actionInProgressSessionId, setActionInProgressSessionId] = useState<string | null>(null);
  const [sessionFeedbackMessage, setSessionFeedbackMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Moderation Management State
  const [moderationUsers, setModerationUsers] = useState<ModerationUserItem[]>([]);
  const [moderationAuditLogs, setModerationAuditLogs] = useState<ModerationAuditEntry[]>([]);
  const [activeBansCount, setActiveBansCount] = useState<number>(0);
  const [isLoadingModeration, setIsLoadingModeration] = useState<boolean>(false);
  const [moderationSearchQuery, setModerationSearchQuery] = useState<string>('');
  const [moderationStatusFilter, setModerationStatusFilter] = useState<'All' | 'Banned' | 'Online'>('All');

  // Confirmation Modals State
  const [confirmDisconnectModal, setConfirmDisconnectModal] = useState<{ id: string; username: string } | null>(null);
  const [confirmEndSessionModal, setConfirmEndSessionModal] = useState<{ roomId: string; user1: string; user2: string } | null>(null);

  // Ban Modal State
  const [banTargetUser, setBanTargetUser] = useState<{ id: string; username: string } | null>(null);
  const [banDurationMinutes, setBanDurationMinutes] = useState<number>(30);
  const [banReasonSelect, setBanReasonSelect] = useState<string>('Violation of community guidelines');
  const [customBanReason, setCustomBanReason] = useState<string>('');
  const [isSubmittingBan, setIsSubmittingBan] = useState<boolean>(false);
  const [moderationFeedback, setModerationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Unban & Disconnect action tracking
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);

  // Admin Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState<boolean>(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('All');
  const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState<boolean>(false);
  const [isClearingLogs, setIsClearingLogs] = useState<boolean>(false);
  const [clearLogsFeedback, setClearLogsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAuditLogs = async () => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await adminFetch('/api/admin/audit-logs');
      if (res.ok) {
        const data: AdminAuditLogItem[] = await res.json();
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin audit logs:', err);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const handleClearAuditLogs = async () => {
    setIsClearingLogs(true);
    setClearLogsFeedback(null);
    try {
      const res = await adminFetch('/api/admin/audit-logs/clear', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClearLogsFeedback({ type: 'success', message: 'Admin audit logs cleared successfully.' });
        setIsClearLogsModalOpen(false);
        fetchAuditLogs();
      } else {
        setClearLogsFeedback({ type: 'error', message: data.error || 'Failed to clear audit logs' });
      }
    } catch (err: any) {
      setClearLogsFeedback({ type: 'error', message: err.message || 'Error clearing audit logs' });
    } finally {
      setIsClearingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
      const interval = setInterval(() => {
        fetchAuditLogs();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Admin Settings State
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Platform Form State
  const [platformForm, setPlatformForm] = useState<{
    maxMessageLength: number | string;
    messageRateLimit: number | string;
    matchmakingTimeout: number | string;
    defaultLanguage: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    maintenanceEstimatedTime: string;
  }>({
    maxMessageLength: 1000,
    messageRateLimit: 5,
    matchmakingTimeout: 30,
    defaultLanguage: 'English',
    maintenanceMode: false,
    maintenanceMessage: 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.',
    maintenanceEstimatedTime: '',
  });
  const [isSavingPlatform, setIsSavingPlatform] = useState<boolean>(false);
  const [platformFeedback, setPlatformFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Safety Form State
  const [safetyForm, setSafetyForm] = useState({
    enableVoiceChat: true,
    enableVideoChat: true,
    enableNewUserMatching: true,
  });
  const [isSavingSafety, setIsSavingSafety] = useState<boolean>(false);
  const [safetyFeedback, setSafetyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAdminSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const res = await adminFetch('/api/admin/settings');
      if (res.ok) {
        const data: AdminSettingsResponse = await res.json();
        if (data.profile) {
          setProfileForm((prev) => ({
            ...prev,
            username: data.profile.username || '',
            email: data.profile.email || '',
          }));
        }
        if (data.platform) {
          setPlatformForm({
            maxMessageLength: data.platform.maxMessageLength ?? 1000,
            messageRateLimit: data.platform.messageRateLimit ?? 5,
            matchmakingTimeout: data.platform.matchmakingTimeout ?? 30,
            defaultLanguage: data.platform.defaultLanguage || 'English',
            maintenanceMode: Boolean(data.platform.maintenanceMode),
            maintenanceMessage: data.platform.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.',
            maintenanceEstimatedTime: data.platform.maintenanceEstimatedTime || '',
          });
        }
        if (data.safety) {
          setSafetyForm({
            enableVoiceChat: Boolean(data.safety.enableVoiceChat),
            enableVideoChat: Boolean(data.safety.enableVideoChat),
            enableNewUserMatching: Boolean(data.safety.enableNewUserMatching),
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin settings:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileFeedback(null);

    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileFeedback({ type: 'error', message: 'New passwords do not match' });
      setIsSavingProfile(false);
      return;
    }

    try {
      const res = await adminFetch('/api/admin/settings/profile', {
        method: 'POST',
        body: JSON.stringify({
          username: profileForm.username,
          email: profileForm.email,
          currentPassword: profileForm.currentPassword || undefined,
          newPassword: profileForm.newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfileFeedback({ type: 'success', message: 'Admin profile updated successfully.' });
        setProfileForm((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      } else {
        setProfileFeedback({ type: 'error', message: data.error || 'Failed to update admin profile' });
      }
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Error updating profile' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlatformFeedback(null);

    const clampInt = (val: any, defaultVal: number, min: number, max: number): number => {
      if (val === null || val === undefined || val === '') return defaultVal;
      const num = Math.round(Number(val));
      if (isNaN(num)) return defaultVal;
      return Math.max(min, Math.min(max, num));
    };

    const maxLen = clampInt(platformForm.maxMessageLength, 1000, 1, 50000);
    const rateLimit = clampInt(platformForm.messageRateLimit, 5, 1, 1000);
    const mmTimeout = clampInt(platformForm.matchmakingTimeout, 30, 1, 600);
    const defaultLang = typeof platformForm.defaultLanguage === 'string' && platformForm.defaultLanguage.trim()
      ? platformForm.defaultLanguage.trim()
      : 'English';

    setIsSavingPlatform(true);

    try {
      const res = await adminFetch('/api/admin/settings/platform', {
        method: 'POST',
        body: JSON.stringify({
          maxMessageLength: maxLen,
          messageRateLimit: rateLimit,
          matchmakingTimeout: mmTimeout,
          defaultLanguage: defaultLang,
          maintenanceMode: Boolean(platformForm.maintenanceMode),
          maintenanceMessage: platformForm.maintenanceMessage,
          maintenanceEstimatedTime: platformForm.maintenanceEstimatedTime,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlatformFeedback({ type: 'success', message: 'Platform settings saved successfully. Maintenance configuration updated live!' });
        if (data.platform) {
          setPlatformForm({
            maxMessageLength: data.platform.maxMessageLength,
            messageRateLimit: data.platform.messageRateLimit,
            matchmakingTimeout: data.platform.matchmakingTimeout,
            defaultLanguage: data.platform.defaultLanguage,
            maintenanceMode: Boolean(data.platform.maintenanceMode),
            maintenanceMessage: data.platform.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.',
            maintenanceEstimatedTime: data.platform.maintenanceEstimatedTime || '',
          });
        } else {
          await fetchAdminSettings();
        }
      } else {
        setPlatformFeedback({ type: 'error', message: data.error || 'Failed to save platform settings' });
      }
    } catch (err: any) {
      setPlatformFeedback({ type: 'error', message: err.message || 'Error updating platform settings' });
    } finally {
      setIsSavingPlatform(false);
    }
  };

  const handleSaveSafety = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSafety(true);
    setSafetyFeedback(null);

    try {
      const res = await adminFetch('/api/admin/settings/safety', {
        method: 'POST',
        body: JSON.stringify(safetyForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSafetyFeedback({ type: 'success', message: 'Safety settings saved successfully.' });
      } else {
        setSafetyFeedback({ type: 'error', message: data.error || 'Failed to save safety settings' });
      }
    } catch (err: any) {
      setSafetyFeedback({ type: 'error', message: err.message || 'Error updating safety settings' });
    } finally {
      setIsSavingSafety(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchAdminSettings();
    }
  }, [activeTab]);

  const fetchModerationData = async () => {
    setIsLoadingModeration(true);
    try {
      const res = await adminFetch('/api/admin/moderation');
      if (res.ok) {
        const data: ModerationStatusResponse = await res.json();
        setModerationUsers(data.users || []);
        setModerationAuditLogs(data.auditLogs || []);
        setActiveBansCount(data.activeBansCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch moderation data:', err);
    } finally {
      setIsLoadingModeration(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'moderation') {
      fetchModerationData();
      const interval = setInterval(() => {
        fetchModerationData();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const openBanModal = (id: string, username: string) => {
    setBanTargetUser({ id, username });
    setBanDurationMinutes(30);
    setBanReasonSelect('Violation of community guidelines');
    setCustomBanReason('');
    setModerationFeedback(null);
  };

  const handleBanUser = async () => {
    if (!banTargetUser) return;

    const finalReason = banReasonSelect === 'Custom' ? customBanReason.trim() : banReasonSelect;
    if (!finalReason) {
      setModerationFeedback({ type: 'error', message: 'Please specify or select a reason for banning.' });
      return;
    }

    setIsSubmittingBan(true);
    setModerationFeedback(null);

    try {
      const res = await adminFetch('/api/admin/moderation/ban', {
        method: 'POST',
        body: JSON.stringify({
          targetId: banTargetUser.id,
          durationMinutes: banDurationMinutes,
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setModerationFeedback({ type: 'success', message: data.message });
        setBanTargetUser(null);
        fetchModerationData();
        fetchLiveUsers();
      } else {
        setModerationFeedback({ type: 'error', message: data.error || data.message || 'Failed to ban user' });
      }
    } catch (err: any) {
      setModerationFeedback({ type: 'error', message: err.message || 'Error executing ban action' });
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleUnbanUser = async (targetId: string) => {
    setActionTargetId(targetId);
    setModerationFeedback(null);
    try {
      const res = await adminFetch('/api/admin/moderation/unban', {
        method: 'POST',
        body: JSON.stringify({
          targetId,
          reason: 'Unbanned by administrator',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModerationFeedback({ type: 'success', message: data.message });
        fetchModerationData();
        fetchLiveUsers();
      } else {
        setModerationFeedback({ type: 'error', message: data.error || 'Failed to unban user' });
      }
    } catch (err: any) {
      setModerationFeedback({ type: 'error', message: err.message || 'Error executing unban' });
    } finally {
      setActionTargetId(null);
    }
  };

  const handleDisconnectModerationUser = async (targetId: string) => {
    setActionTargetId(targetId);
    setModerationFeedback(null);
    try {
      const res = await adminFetch('/api/admin/moderation/disconnect', {
        method: 'POST',
        body: JSON.stringify({
          targetId,
          reason: 'Disconnected by administrator',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModerationFeedback({ type: 'success', message: data.message });
        fetchModerationData();
        fetchLiveUsers();
      } else {
        setModerationFeedback({ type: 'error', message: data.error || 'Failed to disconnect user' });
      }
    } catch (err: any) {
      setModerationFeedback({ type: 'error', message: err.message || 'Error disconnecting user' });
    } finally {
      setActionTargetId(null);
    }
  };



  const fetchServerStats = async () => {
    setIsRefreshing(true);
    try {
      const response = await adminFetch('/api/admin/stats');
      if (response.status === 401) {
        clearAdminToken();
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setServerStats(data);
      }
    } catch (err) {
      // ignore transient polling errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchLiveUsers = async () => {
    try {
      const response = await adminFetch('/api/admin/users');
      if (response.status === 401) {
        clearAdminToken();
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setLiveUsers(data);
      }
    } catch (err) {
      // ignore transient polling errors
    }
  };

  const handleDisconnectUser = async (id: string) => {
    if (disconnectingId) return;
    setDisconnectingId(id);
    try {
      const res = await adminFetch(`/api/admin/users/${id}/disconnect`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchLiveUsers();
        fetchServerStats();
        if (selectedUserDetail?.id === id) {
          setSelectedUserDetail(null);
        }
      }
    } catch (err) {
      // ignore network errors
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleViewUserDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await adminFetch(`/api/admin/users/${id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedUserDetail(detail);
      }
    } catch (err) {
      // ignore network errors
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const response = await adminFetch('/api/admin/reports');
      if (response.status === 401) {
        clearAdminToken();
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (err) {
      // ignore transient polling errors
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleViewReport = async (reportId: string) => {
    try {
      const response = await adminFetch(`/api/admin/reports/${reportId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedReportDetail(data);
      }
    } catch (err) {
      // ignore network error
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'New' | 'Reviewed' | 'Resolved') => {
    setActionInProgressReportId(reportId);
    setReportFeedbackMessage(null);
    try {
      const response = await adminFetch(`/api/admin/reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        setReportFeedbackMessage({ type: 'success', message: `Report status marked as ${status}.` });
        fetchReports();
        if (selectedReportDetail && selectedReportDetail.id === reportId) {
          setSelectedReportDetail((prev) => prev ? { ...prev, status } : null);
        }
      } else {
        const data = await response.json();
        setReportFeedbackMessage({ type: 'error', message: data.error || 'Failed to update report status.' });
      }
    } catch (err) {
      setReportFeedbackMessage({ type: 'error', message: 'Network error updating report status.' });
    } finally {
      setActionInProgressReportId(null);
    }
  };

  const handleDisconnectReportedUser = async (reportId: string) => {
    setActionInProgressReportId(reportId);
    setReportFeedbackMessage(null);
    try {
      const response = await adminFetch(`/api/admin/reports/${reportId}/disconnect`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setReportFeedbackMessage({ type: 'success', message: data.message || 'Reported user disconnected and report resolved.' });
        fetchReports();
        fetchLiveUsers();
        fetchServerStats();
        if (selectedReportDetail && selectedReportDetail.id === reportId) {
          setSelectedReportDetail((prev) => prev ? { ...prev, status: 'Resolved', isReportedUserOnline: false } : null);
        }
      } else {
        const data = await response.json();
        setReportFeedbackMessage({ type: 'error', message: data.error || 'Failed to disconnect user.' });
      }
    } catch (err) {
      setReportFeedbackMessage({ type: 'error', message: 'Network error disconnecting user.' });
    } finally {
      setActionInProgressReportId(null);
    }
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await adminFetch('/api/admin/sessions');
      if (response.status === 401) {
        clearAdminToken();
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      // ignore transient polling errors
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleViewSession = async (roomId: string) => {
    try {
      const response = await adminFetch(`/api/admin/sessions/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSessionDetail(data);
      }
    } catch (err) {
      // ignore network error
    }
  };

  const handleEndSession = async (roomId: string) => {
    setActionInProgressSessionId(roomId);
    setSessionFeedbackMessage(null);
    try {
      const response = await adminFetch(`/api/admin/sessions/${roomId}/end`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setSessionFeedbackMessage({ type: 'success', message: data.message || 'Session terminated immediately for both users.' });
        fetchSessions();
        fetchLiveUsers();
        fetchServerStats();
        if (selectedSessionDetail && selectedSessionDetail.id === roomId) {
          setSelectedSessionDetail(null);
        }
      } else {
        const data = await response.json();
        setSessionFeedbackMessage({ type: 'error', message: data.error || 'Failed to end session.' });
      }
    } catch (err) {
      setSessionFeedbackMessage({ type: 'error', message: 'Network error ending session.' });
    } finally {
      setActionInProgressSessionId(null);
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      onLogout();
    };
    window.addEventListener('admin_unauthorized', handleUnauthorized);

    fetchServerStats();
    fetchLiveUsers();
    fetchReports();
    fetchSessions();
    const timer = setInterval(() => {
      fetchServerStats();
      fetchLiveUsers();
      fetchReports();
      fetchSessions();
    }, 2500);

    return () => {
      window.removeEventListener('admin_unauthorized', handleUnauthorized);
      clearInterval(timer);
    };
  }, [onLogout]);

  const filteredUsers = liveUsers.filter((user) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.id.toLowerCase().includes(q) ||
      user.language.toLowerCase().includes(q) ||
      user.country.toLowerCase().includes(q) ||
      (user.topic && user.topic.toLowerCase().includes(q)) ||
      user.interests.some((i) => i.toLowerCase().includes(q))
    );
  });

  const filteredReports = reports.filter((report) => {
    if (reportStatusFilter !== 'All' && report.status !== reportStatusFilter) {
      return false;
    }
    if (!reportSearchQuery.trim()) return true;
    const q = reportSearchQuery.toLowerCase();
    return (
      report.id.toLowerCase().includes(q) ||
      report.reason.toLowerCase().includes(q) ||
      report.reporterUsername.toLowerCase().includes(q) ||
      report.reportedUsername.toLowerCase().includes(q) ||
      report.reporterConnectionId.toLowerCase().includes(q) ||
      report.reportedConnectionId.toLowerCase().includes(q)
    );
  });

  const filteredSessions = sessions.filter((session) => {
    if (sessionTypeFilter !== 'All' && session.sessionType !== sessionTypeFilter) {
      return false;
    }
    if (!sessionSearchQuery.trim()) return true;
    const q = sessionSearchQuery.toLowerCase();
    return (
      session.id.toLowerCase().includes(q) ||
      session.user1Username.toLowerCase().includes(q) ||
      session.user2Username.toLowerCase().includes(q) ||
      session.user1ConnectionId.toLowerCase().includes(q) ||
      session.user2ConnectionId.toLowerCase().includes(q) ||
      session.topic.toLowerCase().includes(q) ||
      session.sharedInterests.some((i) => i.toLowerCase().includes(q))
    );
  });

  const pendingReportsCount = reports.filter((r) => r.status === 'New').length;

  const filteredModerationUsers = moderationUsers.filter((user) => {
    if (moderationStatusFilter === 'Banned' && user.banStatus !== 'Active Ban') return false;
    if (moderationStatusFilter === 'Online' && !user.isOnline) return false;

    if (!moderationSearchQuery.trim()) return true;
    const q = moderationSearchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.targetId.toLowerCase().includes(q) ||
      user.reason.toLowerCase().includes(q) ||
      user.currentStatus.toLowerCase().includes(q)
    );
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditActionFilter !== 'All' && log.action !== auditActionFilter) {
      return false;
    }
    if (!auditSearchQuery.trim()) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.performedBy.toLowerCase().includes(q) ||
      (log.target && log.target.toLowerCase().includes(q)) ||
      (log.reason && log.reason.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q))
    );
  });

  const sidebarItems: { id: AdminTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'reports', label: 'Reports', icon: ShieldAlert, badge: pendingReportsCount },
    { id: 'sessions', label: 'Sessions', icon: MessageSquare, badge: sessions.length },
    { id: 'moderation', label: 'Moderation', icon: Gavel, badge: activeBansCount },
    { id: 'audit', label: 'Audit Logs', icon: FileText, badge: auditLogs.length },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const activeCount = onlineStats?.onlineCount;
  const waitingCount = onlineStats?.waitingCount;
  const isMaintActive = isMaintenanceMode || Boolean(platformForm.maintenanceMode);

  const handleLogoutClick = async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      // ignore network errors on logout
    }
    clearAdminToken();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Navbar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">StrangerChat Admin</span>
          {isMaintActive && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse ml-1">
              MAINTENANCE
            </span>
          )}
        </div>
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 focus:outline-none"
          aria-label="Toggle Admin Sidebar"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800/90 flex flex-col justify-between transition-transform duration-200 transform ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Admin Brand Badge */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-white tracking-tight leading-tight">
                  StrangerChat
                </h2>
                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block">
                  Admin Portal
                </span>
              </div>
            </div>
            {isMaintActive && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold animate-pulse">
                <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Maintenance Mode ON</span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer / Controls */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          <button
            onClick={onReturnToPublic}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <Globe className="w-4 h-4 text-slate-500" />
            <span>Public Website</span>
          </button>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
        
        {/* Top Operational Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white capitalize tracking-tight">
              {activeTab}
            </h1>
            <p className="text-xs text-slate-400">
              System monitoring & administration workspace
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 font-medium text-slate-300">
              <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Auto-refreshing</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 font-medium text-slate-300">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>WS Status:</span>
              <span className={socketStatus === 'connected' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {socketStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Persistent Admin Maintenance Mode Warning */}
        {isMaintActive && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border border-amber-500/50 text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/30 backdrop-blur-md">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                <Wrench className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                    Maintenance Mode Active
                  </span>
                  <span className="text-xs font-bold text-amber-200">Public Access Suspended</span>
                </div>
                <p className="text-xs text-amber-100/90 leading-relaxed font-medium">
                  Active Notice: &quot;{platformForm.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance.'}&quot;
                  {platformForm.maintenanceEstimatedTime && (
                    <span className="ml-2 font-bold text-amber-300">(Est. Return: {platformForm.maintenanceEstimatedTime})</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Sliders className="w-4 h-4" />
              <span>Platform Settings</span>
            </button>
          </div>
        )}

        {/* TAB CONTENTS */}

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Real Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Card 1: Online Users */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Online Users</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {serverStats ? serverStats.onlineUsers : (activeCount ?? 0)}
                </div>
                <p className="text-[11px] text-slate-500">Live WebSocket connections</p>
              </div>

              {/* Card 2: Users Searching */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Users Searching</span>
                  <Radio className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {serverStats ? serverStats.searchingUsers : (waitingCount ?? 0)}
                </div>
                <p className="text-[11px] text-slate-500">In matchmaking queue</p>
              </div>

              {/* Card 3: Active Text Chats */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Active Text Chats</span>
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">
                  {serverStats ? serverStats.activeTextChats : 0}
                </div>
                <p className="text-[11px] text-slate-500">Live text sessions</p>
              </div>

              {/* Card 4: Active Voice Chats */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Active Voice Chats</span>
                  <Mic className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                  {serverStats ? serverStats.activeVoiceChats : 0}
                </div>
                <p className="text-[11px] text-slate-500">Live WebRTC audio calls</p>
              </div>

              {/* Card 5: Active Video Chats */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Active Video Chats</span>
                  <Video className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-purple-400">
                  {serverStats ? serverStats.activeVideoChats : 0}
                </div>
                <p className="text-[11px] text-slate-500">Live WebRTC video calls</p>
              </div>
            </div>

            {/* Operational System Summary */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Real-Time Operational Metrics</span>
              </h3>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span>Total Active Paired Sessions</span>
                  <span className="text-slate-200 font-bold">{serverStats ? serverStats.totalActiveSessions : 0} session(s)</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span>WebSocket Gateway Engine</span>
                  <span className="text-emerald-400 font-medium">Active (Heartbeat ping/pong 15s)</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span>Storage Engine</span>
                  <span className="text-slate-300 font-medium">Transient In-Memory Map</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span>Privacy Shield</span>
                  <span className="text-emerald-400 font-medium">Zero PII / IP / Payload Logged</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. USERS TAB */}
        {activeTab === 'users' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Live Connected Users
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold">
                  {liveUsers.length} live
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, language, topic..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <button
                  onClick={() => {
                    fetchLiveUsers();
                    fetchServerStats();
                  }}
                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors shrink-0"
                  title="Refresh users list"
                >
                  <RotateCw className={`w-4 h-4 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <UserX className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  {liveUsers.length === 0 ? 'No Active Users Connected' : 'No Users Found'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {liveUsers.length === 0
                    ? 'There are currently no real client sockets connected to the server memory map.'
                    : 'No connected users matched your search query.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Connection</th>
                        <th className="py-3 px-4">Chat Status</th>
                        <th className="py-3 px-4">Preferences</th>
                        <th className="py-3 px-4">Interests</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Username & ID */}
                          <td className="py-3 px-4 font-semibold text-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-cyan-400">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div>{user.username}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{user.id}</div>
                              </div>
                            </div>
                          </td>

                          {/* Connection Status */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Connected
                            </span>
                          </td>

                          {/* Chat Status */}
                          <td className="py-3 px-4">
                            {user.status === 'idle' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                                Idle
                              </span>
                            )}
                            {user.status === 'searching' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                                <Radio className="w-3 h-3 animate-pulse" />
                                Searching
                              </span>
                            )}
                            {user.status === 'connected' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 inline-flex items-center gap-1">
                                {user.mediaType === 'video' ? (
                                  <Video className="w-3 h-3 text-purple-400" />
                                ) : user.mediaType === 'voice' ? (
                                  <Mic className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <MessageSquare className="w-3 h-3 text-cyan-400" />
                                )}
                                Chatting ({user.mediaType || 'text'})
                              </span>
                            )}
                          </td>

                          {/* Preferences */}
                          <td className="py-3 px-4 text-slate-400">
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{user.language}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400">{user.country}</span>
                            </div>
                          </td>

                          {/* Interests */}
                          <td className="py-3 px-4">
                            {user.interests && user.interests.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {user.interests.slice(0, 2).map((interest, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                                    #{interest}
                                  </span>
                                ))}
                                {user.interests.length > 2 && (
                                  <span className="text-[10px] text-slate-500">+{user.interests.length - 2}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 italic text-[11px]">All topics</span>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{formatConnectedDuration(user.connectedAt)}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewUserDetail(user.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                title="View User Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="hidden sm:inline">View</span>
                              </button>
                              <button
                                onClick={() => openBanModal(user.id, user.username)}
                                className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1 text-[11px] font-semibold shadow-sm shadow-rose-600/20"
                                title="Ban User"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Ban</span>
                              </button>
                              <button
                                onClick={() => setConfirmDisconnectModal({ id: user.id, username: user.username })}
                                disabled={disconnectingId === user.id}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                                title="Disconnect User WebSocket"
                              >
                                {disconnectingId === user.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span className="hidden sm:inline">Disconnect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-100">{user.username}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{user.id}</div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Connected
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-y border-slate-800/60 py-2">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Chat Status</span>
                          <span className="font-semibold text-slate-200 capitalize">
                            {user.status} {user.mediaType ? `(${user.mediaType})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Duration</span>
                          <span className="font-mono text-slate-200">{formatConnectedDuration(user.connectedAt)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Language</span>
                          <span className="text-slate-200">{user.language}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Country</span>
                          <span className="text-slate-200">{user.country}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {user.interests && user.interests.length > 0 ? (
                            user.interests.slice(0, 2).map((interest, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300">
                                #{interest}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">All topics</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleViewUserDetail(user.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleDisconnectUser(user.id)}
                            disabled={disconnectingId === user.id}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            {disconnectingId === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                            <span>Drop</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            {/* Reports Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
                  <span>Reports Management Queue</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time user reports submitted during active chat sessions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>{pendingReportsCount} Pending</span>
                </span>

                <button
                  onClick={fetchReports}
                  disabled={isLoadingReports}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Refresh Reports"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingReports ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Feedback Message Banner */}
            {reportFeedbackMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                  reportFeedbackMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {reportFeedbackMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{reportFeedbackMessage.message}</span>
                </div>
                <button
                  onClick={() => setReportFeedbackMessage(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['All', 'New', 'Reviewed', 'Resolved'] as const).map((st) => {
                  const count = st === 'All' ? reports.length : reports.filter((r) => r.status === st).length;
                  const isActive = reportStatusFilter === st;
                  return (
                    <button
                      key={st}
                      onClick={() => setReportStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{st}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[200px] sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="Filter by user or reason..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
                {reportSearchQuery && (
                  <button
                    onClick={() => setReportSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Reports List / Table */}
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-950/50 rounded-xl border border-slate-800/60">
                <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  {reports.length === 0 ? 'No User Reports Received Yet' : 'No Reports Matching Filter'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {reports.length === 0
                    ? 'In-session reports submitted by users will appear in this moderation queue in real time.'
                    : 'Try selecting a different status filter or clearing your search query.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Report Reason</th>
                        <th className="py-3 px-4">Reported User</th>
                        <th className="py-3 px-4">Reporter</th>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-900/50 transition-colors">
                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider inline-flex items-center gap-1 ${
                                report.status === 'New'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                                  : report.status === 'Reviewed'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  report.status === 'New'
                                    ? 'bg-rose-400'
                                    : report.status === 'Reviewed'
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                                }`}
                              />
                              <span>{report.status}</span>
                            </span>
                          </td>

                          {/* Reason */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px]">
                              {formatReasonLabel(report.reason)}
                            </span>
                          </td>

                          {/* Reported User */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  report.isReportedUserOnline ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                title={report.isReportedUserOnline ? 'Online' : 'Offline / Disconnected'}
                              />
                              <div>
                                <div className="font-bold text-slate-100">{report.reportedUsername}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{report.reportedConnectionId}</div>
                              </div>
                            </div>
                          </td>

                          {/* Reporter */}
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-semibold text-slate-300">{report.reporterUsername}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{report.reporterConnectionId}</div>
                            </div>
                          </td>

                          {/* Time */}
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]" title={new Date(report.timestamp).toLocaleString()}>
                            {formatReportTime(report.timestamp)}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Report */}
                              <button
                                onClick={() => handleViewReport(report.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                title="View Report Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                <span>View</span>
                              </button>

                              {/* Mark Reviewed */}
                              {report.status !== 'Reviewed' && (
                                <button
                                  onClick={() => handleUpdateReportStatus(report.id, 'Reviewed')}
                                  disabled={actionInProgressReportId === report.id}
                                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                                  title="Mark as Reviewed"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="hidden lg:inline">Reviewed</span>
                                </button>
                              )}

                              {/* Mark Resolved */}
                              {report.status !== 'Resolved' && (
                                <button
                                  onClick={() => handleUpdateReportStatus(report.id, 'Resolved')}
                                  disabled={actionInProgressReportId === report.id}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                                  title="Mark as Resolved"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="hidden lg:inline">Resolve</span>
                                </button>
                              )}

                              {/* Disconnect Reported User */}
                              <button
                                onClick={() => handleDisconnectReportedUser(report.id)}
                                disabled={actionInProgressReportId === report.id}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                                title="Disconnect Reported User"
                              >
                                {actionInProgressReportId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span className="hidden lg:inline">Disconnect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {filteredReports.map((report) => (
                    <div key={report.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            report.status === 'New'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : report.status === 'Reviewed'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {report.status}
                        </span>

                        <span className="text-[10px] font-mono text-slate-500">
                          {formatReportTime(report.timestamp)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Reason</span>
                        <div className="text-xs font-semibold text-rose-300 mt-0.5">
                          {formatReasonLabel(report.reason)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Reported User</span>
                          <span className="font-bold text-slate-200">{report.reportedUsername}</span>
                          <span className="text-[9px] font-mono text-slate-500 block">{report.reportedConnectionId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Reporter</span>
                          <span className="font-bold text-slate-200">{report.reporterUsername}</span>
                          <span className="text-[9px] font-mono text-slate-500 block">{report.reporterConnectionId}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          onClick={() => handleViewReport(report.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>View</span>
                        </button>

                        {report.status !== 'Reviewed' && (
                          <button
                            onClick={() => handleUpdateReportStatus(report.id, 'Reviewed')}
                            disabled={actionInProgressReportId === report.id}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        )}

                        {report.status !== 'Resolved' && (
                          <button
                            onClick={() => handleUpdateReportStatus(report.id, 'Resolved')}
                            disabled={actionInProgressReportId === report.id}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDisconnectReportedUser(report.id)}
                          disabled={actionInProgressReportId === report.id}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionInProgressReportId === report.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4.5 h-4.5 text-cyan-400" />
                  <span>Active Sessions Management</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time active chat pairs running strictly in server memory.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{sessions.length} Live Sessions</span>
                </span>

                <button
                  onClick={fetchSessions}
                  disabled={isLoadingSessions}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Refresh Sessions"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Feedback Message Banner */}
            {sessionFeedbackMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                  sessionFeedbackMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {sessionFeedbackMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{sessionFeedbackMessage.message}</span>
                </div>
                <button
                  onClick={() => setSessionFeedbackMessage(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {/* Type Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['All', 'Text', 'Voice', 'Video'] as const).map((type) => {
                  const count = type === 'All' ? sessions.length : sessions.filter((s) => s.sessionType === type).length;
                  const isActive = sessionTypeFilter === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSessionTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{type}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[200px] sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  placeholder="Filter by user or room ID..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
                {sessionSearchQuery && (
                  <button
                    onClick={() => setSessionSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sessions Content */}
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-950/50 rounded-xl border border-slate-800/60">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  {sessions.length === 0 ? 'No Active Real-time Sessions' : 'No Sessions Matching Filter'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {sessions.length === 0
                    ? 'Active chat sessions will appear here as users match and begin chatting.'
                    : 'Try selecting a different session type or clearing your search term.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Session ID</th>
                        <th className="py-3 px-4">User 1</th>
                        <th className="py-3 px-4">User 2</th>
                        <th className="py-3 px-4">Shared Interests</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-900/50 transition-colors">
                          {/* Type */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 border ${
                                session.sessionType === 'Voice'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : session.sessionType === 'Video'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                              }`}
                            >
                              {session.sessionType === 'Voice' ? (
                                <Mic className="w-3 h-3" />
                              ) : session.sessionType === 'Video' ? (
                                <Video className="w-3 h-3" />
                              ) : (
                                <MessageSquare className="w-3 h-3" />
                              )}
                              <span>{session.sessionType}</span>
                            </span>
                          </td>

                          {/* Room ID */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400" title={session.id}>
                            {session.id.substring(0, 12)}...
                          </td>

                          {/* User 1 */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  session.isUser1Online ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                              />
                              <div>
                                <div className="font-bold text-slate-200">{session.user1Username}</div>
                                <div className="text-[10px] font-mono text-slate-500">{session.user1ConnectionId}</div>
                              </div>
                            </div>
                          </td>

                          {/* User 2 */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  session.isUser2Online ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                              />
                              <div>
                                <div className="font-bold text-slate-200">{session.user2Username}</div>
                                <div className="text-[10px] font-mono text-slate-500">{session.user2ConnectionId}</div>
                              </div>
                            </div>
                          </td>

                          {/* Shared Interests */}
                          <td className="py-3 px-4">
                            {session.sharedInterests.length === 0 ? (
                              <span className="text-slate-500 text-[11px]">None</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {session.sharedInterests.slice(0, 3).map((interest, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-cyan-300 font-medium border border-slate-700/60"
                                  >
                                    #{interest}
                                  </span>
                                ))}
                                {session.sharedInterests.length > 3 && (
                                  <span className="text-[10px] text-slate-500 font-bold">
                                    +{session.sharedInterests.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                            {formatConnectedDuration(session.createdAt)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewSession(session.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                title="View Session Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                <span>View</span>
                              </button>

                              <button
                                onClick={() => setConfirmEndSessionModal({ roomId: session.id, user1: session.user1Username, user2: session.user2Username })}
                                disabled={actionInProgressSessionId === session.id}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                                title="Terminate Session for Both Users"
                              >
                                {actionInProgressSessionId === session.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                ) : (
                                  <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span>End</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {filteredSessions.map((session) => (
                    <div key={session.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 border ${
                            session.sessionType === 'Voice'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : session.sessionType === 'Video'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          }`}
                        >
                          {session.sessionType}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400">
                          {formatConnectedDuration(session.createdAt)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-slate-500 block text-[10px]">User 1</span>
                          <span className="font-bold text-slate-200">{session.user1Username}</span>
                          <span className="text-[9px] font-mono text-slate-500 block">{session.user1ConnectionId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">User 2</span>
                          <span className="font-bold text-slate-200">{session.user2Username}</span>
                          <span className="text-[9px] font-mono text-slate-500 block">{session.user2ConnectionId}</span>
                        </div>
                      </div>

                      {session.sharedInterests.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Shared Interests</span>
                          <div className="flex flex-wrap gap-1">
                            {session.sharedInterests.map((interest, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-300">
                                #{interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                          {session.id}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleViewSession(session.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>View</span>
                          </button>

                          <button
                            onClick={() => setConfirmEndSessionModal({ roomId: session.id, user1: session.user1Username, user2: session.user2Username })}
                            disabled={actionInProgressSessionId === session.id}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            {actionInProgressSessionId === session.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PhoneOff className="w-3.5 h-3.5" />
                            )}
                            <span>End Session</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}



        {/* MODERATION TAB */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            {/* Header & Overview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-rose-400" />
                  <span>User Moderation & Enforcement</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enforce temporary in-memory bans, disconnect active users, and view server moderation audit history.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchModerationData}
                  disabled={isLoadingModeration}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoadingModeration ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Moderation Feedback Alert */}
            {moderationFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
                  moderationFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {moderationFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{moderationFeedback.message}</span>
                </div>
                <button
                  onClick={() => setModerationFeedback(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Active Temporary Bans</span>
                <div className="text-2xl font-black text-rose-400 flex items-center justify-between">
                  <span>{activeBansCount}</span>
                  <Ban className="w-5 h-5 text-rose-500/40" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Tracked Users</span>
                <div className="text-2xl font-black text-cyan-400 flex items-center justify-between">
                  <span>{moderationUsers.length}</span>
                  <Users className="w-5 h-5 text-cyan-500/40" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Audit Log Entries</span>
                <div className="text-2xl font-black text-slate-200 flex items-center justify-between">
                  <span>{moderationAuditLogs.length}</span>
                  <FileText className="w-5 h-5 text-slate-500/40" />
                </div>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['All', 'Banned', 'Online'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setModerationStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      moderationStatusFilter === filter
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                    }`}
                  >
                    {filter === 'All' ? 'All Monitored Users' : filter === 'Banned' ? 'Banned Users' : 'Online Users'}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={moderationSearchQuery}
                  onChange={(e) => setModerationSearchQuery(e.target.value)}
                  placeholder="Search by temporary username, ID, or reason..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {/* Moderation User Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>User Moderation Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {filteredModerationUsers.length}
                  </span>
                </h3>
              </div>

              {filteredModerationUsers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <UserX className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
                  <p className="text-xs font-medium">No users match the selected moderation filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        <th className="py-3 px-4">Temporary Username</th>
                        <th className="py-3 px-4">Current Status</th>
                        <th className="py-3 px-4">Ban Status</th>
                        <th className="py-3 px-4">Ban Expiry</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredModerationUsers.map((user) => (
                        <tr key={user.targetId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  user.isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'
                                }`}
                              />
                              <div>
                                <div>{user.username}</div>
                                <div className="text-[10px] font-mono text-slate-500 font-normal">
                                  ID: {user.targetId}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                user.currentStatus === 'In Chat'
                                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  : user.currentStatus === 'Searching'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : user.currentStatus === 'Banned'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {user.currentStatus}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                user.banStatus === 'Active Ban'
                                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {user.banStatus}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300">
                            {formatBanExpiry(user.expiresAt, user.banExpiryMs)}
                          </td>

                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                            {user.reason || 'None'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {user.banStatus === 'Active Ban' ? (
                                <button
                                  onClick={() => handleUnbanUser(user.targetId)}
                                  disabled={actionTargetId === user.targetId}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                  {actionTargetId === user.targetId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  )}
                                  <span>Unban</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openBanModal(user.targetId, user.username)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-all flex items-center gap-1 shadow-sm shadow-rose-600/20"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Ban</span>
                                </button>
                              )}

                              {user.isOnline && user.banStatus !== 'Active Ban' && (
                                <button
                                  onClick={() => handleDisconnectModerationUser(user.targetId)}
                                  disabled={actionTargetId === user.targetId}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20 text-[11px] font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                  {actionTargetId === user.targetId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <UserX className="w-3.5 h-3.5" />
                                  )}
                                  <span>Disconnect</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Moderation Audit Log Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Moderation Audit Trail</span>
                  <span className="text-xs text-slate-500 font-normal">(Temporary Server Memory)</span>
                </h3>
              </div>

              {moderationAuditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No moderation audit entries recorded in server memory yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Target User</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {moderationAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action === 'ban'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : log.action === 'unban'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {log.action.toUpperCase()}
                              {log.banDurationMinutes ? ` (${log.banDurationMinutes}m)` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">{log.targetUsername}</td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">{log.reason}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-cyan-400">{log.performedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === 'audit' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-cyan-400" />
                  <span>Admin Audit Logs</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Chronological record of administrative operations stored safely in server memory.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchAuditLogs}
                  disabled={isLoadingAuditLogs}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => setIsClearLogsModalOpen(true)}
                  disabled={auditLogs.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Logs</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  placeholder="Search by action, target, reason, or admin..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Action Filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Action:</span>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="All">All Actions ({auditLogs.length})</option>
                  <option value="Admin Login">Admin Login</option>
                  <option value="Admin Logout">Admin Logout</option>
                  <option value="User Disconnect">User Disconnect</option>
                  <option value="User Ban">User Ban</option>
                  <option value="User Unban">User Unban</option>
                  <option value="Report Reviewed">Report Reviewed</option>
                  <option value="Report Resolved">Report Resolved</option>
                  <option value="Session Ended">Session Ended</option>
                  <option value="Logs Cleared">Logs Cleared</option>
                </select>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Showing <strong className="text-slate-200">{filteredAuditLogs.length}</strong> of{' '}
                  <strong className="text-slate-200">{auditLogs.length}</strong> log entries (Newest first)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Memory Only — No Databases / No Private Data
                </span>
              </div>

              {isLoadingAuditLogs && auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <p className="text-xs">Loading admin audit logs...</p>
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-400">No audit logs found</p>
                  <p className="text-xs text-slate-500">
                    {auditSearchQuery || auditActionFilter !== 'All'
                      ? 'Try clearing your filters or search query.'
                      : 'No administrative actions have been logged yet.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Target (Username / Session)</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Performed By</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {filteredAuditLogs.map((log) => {
                        let actionBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                        if (log.action === 'Admin Login' || log.action === 'Admin Logout') {
                          actionBadgeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                        } else if (log.action === 'User Ban') {
                          actionBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                        } else if (log.action === 'User Unban') {
                          actionBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        } else if (log.action === 'User Disconnect') {
                          actionBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                        } else if (log.action.includes('Report')) {
                          actionBadgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                        } else if (log.action === 'Session Ended') {
                          actionBadgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                        } else if (log.action === 'Logs Cleared') {
                          actionBadgeClass = 'bg-rose-950/50 text-rose-300 border-rose-800/50';
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${actionBadgeClass}`}>
                                {log.action}
                              </span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300 text-[11px]">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>

                            <td className="py-3 px-4 font-semibold text-slate-200 max-w-xs truncate">
                              {log.target || <span className="text-slate-600 font-normal italic">N/A</span>}
                            </td>

                            <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                              {log.reason || <span className="text-slate-600 font-normal italic">None</span>}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap font-bold text-cyan-400">
                              {log.performedBy}
                            </td>

                            <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-mono text-[11px]">
                              {log.details || <span className="text-slate-600 font-normal italic">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Header & Reload */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings className="w-6 h-6 text-cyan-400" />
                  <span>Admin & Platform Settings</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure administrative credentials, server-side platform parameters, and safety feature controls.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchAdminSettings}
                disabled={isLoadingSettings}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingSettings ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Reload Settings</span>
              </button>
            </div>

            {/* Grid of Settings Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* SECTION 1: ADMIN PROFILE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Admin Profile</h3>
                        <p className="text-xs text-slate-400">Manage administrator username, email, and password</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Server Secured
                    </span>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    {profileFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                          profileFeedback.type === 'success'
                            ? 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-300'
                            : 'bg-rose-950/50 border border-rose-800/50 text-rose-300'
                        }`}
                      >
                        {profileFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{profileFeedback.message}</span>
                      </div>
                    )}

                    {/* Admin Username */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Admin Username</span>
                      </label>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))}
                        required
                        minLength={3}
                        placeholder="e.g. admin"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>

                    {/* Admin Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>Admin Email</span>
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                        required
                        placeholder="e.g. admin@strangerchat.app"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>

                    {/* Password Change Box */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Change Admin Password</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Leave new password blank if you only wish to update profile details. Passwords are securely hashed with scrypt.
                      </p>

                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="text-[11px] font-medium text-slate-400 block mb-1">Current Password</label>
                          <input
                            type="password"
                            value={profileForm.currentPassword}
                            onChange={(e) => setProfileForm((p) => ({ ...p, currentPassword: e.target.value }))}
                            placeholder="Required if changing password"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-medium text-slate-400 block mb-1">New Password</label>
                            <input
                              type="password"
                              value={profileForm.newPassword}
                              onChange={(e) => setProfileForm((p) => ({ ...p, newPassword: e.target.value }))}
                              placeholder="Min 6 characters"
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-400 block mb-1">Confirm New Password</label>
                            <input
                              type="password"
                              value={profileForm.confirmPassword}
                              onChange={(e) => setProfileForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                              placeholder="Repeat new password"
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSavingProfile ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>Update Admin Profile</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* SECTION 2: PLATFORM SETTINGS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Platform Settings</h3>
                        <p className="text-xs text-slate-400">Control server-side messaging thresholds and system state</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      WebSocket Server
                    </span>
                  </div>

                  <form onSubmit={handleSavePlatform} className="space-y-4">
                    {platformFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                          platformFeedback.type === 'success'
                            ? 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-300'
                            : 'bg-rose-950/50 border border-rose-800/50 text-rose-300'
                        }`}
                      >
                        {platformFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{platformFeedback.message}</span>
                      </div>
                    )}

                    {/* Max Message Length */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                          <span>Maximum Message Length</span>
                        </label>
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {platformForm.maxMessageLength} chars
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={50000}
                        value={platformForm.maxMessageLength}
                        onChange={(e) => {
                          setPlatformFeedback(null);
                          setPlatformForm((p) => ({ ...p, maxMessageLength: e.target.value }));
                        }}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                      />
                      <p className="text-[11px] text-slate-500">Messages exceeding this length will be rejected server-side.</p>
                    </div>

                    {/* Message Rate Limit */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-400" />
                          <span>Message Rate Limit</span>
                        </label>
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {platformForm.messageRateLimit} msg / 3s
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={platformForm.messageRateLimit}
                        onChange={(e) => {
                          setPlatformFeedback(null);
                          setPlatformForm((p) => ({ ...p, messageRateLimit: e.target.value }));
                        }}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                      />
                      <p className="text-[11px] text-slate-500">Maximum messages allowed per 3-second sliding window per connection.</p>
                    </div>

                    {/* Matchmaking Timeout & Default Language Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Matchmaking Timeout (s)</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={platformForm.matchmakingTimeout}
                          onChange={(e) => {
                            setPlatformFeedback(null);
                            setPlatformForm((p) => ({ ...p, matchmakingTimeout: e.target.value }));
                          }}
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>Default Language</span>
                        </label>
                        <input
                          type="text"
                          value={platformForm.defaultLanguage}
                          onChange={(e) => {
                            setPlatformFeedback(null);
                            setPlatformForm((p) => ({ ...p, defaultLanguage: e.target.value }));
                          }}
                          required
                          placeholder="e.g. English"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>

                    {/* Maintenance Mode Box & Custom Notice Configuration */}
                    <div className={`p-4 rounded-xl border transition-colors space-y-4 ${
                      platformForm.maintenanceMode
                        ? 'bg-amber-950/30 border-amber-500/50'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${platformForm.maintenanceMode ? 'text-amber-400' : 'text-slate-500'}`} />
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Maintenance Mode</span>
                            <span className="text-[10px] text-slate-400">
                              {platformForm.maintenanceMode ? 'Public chat features are currently PAUSED' : 'Public chat features are operational'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPlatformFeedback(null);
                            setPlatformForm((p) => ({ ...p, maintenanceMode: !p.maintenanceMode }));
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            platformForm.maintenanceMode ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              platformForm.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Custom Announcement Message Textarea */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                          <span>Custom Maintenance Message / Notice</span>
                          <span className="text-[10px] text-slate-500">Displayed on site & banner</span>
                        </label>
                        <textarea
                          rows={3}
                          value={platformForm.maintenanceMessage}
                          onChange={(e) => {
                            setPlatformFeedback(null);
                            setPlatformForm((p) => ({ ...p, maintenanceMessage: e.target.value }));
                          }}
                          placeholder="Type custom maintenance notice for public users..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                        />

                        {/* Quick Presets */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-semibold text-slate-400 block">Quick Message Presets:</span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPlatformFeedback(null);
                                setPlatformForm((p) => ({
                                  ...p,
                                  maintenanceMessage: 'StrangerChat is undergoing scheduled system updates to improve performance and stability.',
                                }));
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-amber-300/90 font-medium transition-colors"
                            >
                              🛠️ Scheduled Updates
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPlatformFeedback(null);
                                setPlatformForm((p) => ({
                                  ...p,
                                  maintenanceMessage: 'StrangerChat is performing brief database optimization. We will be back online shortly.',
                                }));
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-amber-300/90 font-medium transition-colors"
                            >
                              ⚡ Database Maintenance
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPlatformFeedback(null);
                                setPlatformForm((p) => ({
                                  ...p,
                                  maintenanceMessage: 'StrangerChat is applying essential security updates. Matching features are temporarily paused.',
                                }));
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-amber-300/90 font-medium transition-colors"
                            >
                              🛡️ Security Patch
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPlatformFeedback(null);
                                setPlatformForm((p) => ({
                                  ...p,
                                  maintenanceMessage: 'StrangerChat is deploying exciting new updates! Chat features will return in a few minutes.',
                                }));
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-amber-300/90 font-medium transition-colors"
                            >
                              🚀 New Feature Rollout
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Estimated Return Time Field */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                          <span>Estimated Return / Downtime (Optional)</span>
                          <span className="text-[10px] text-slate-500">e.g. 15 mins, 2:30 PM UTC</span>
                        </label>
                        <input
                          type="text"
                          value={platformForm.maintenanceEstimatedTime}
                          onChange={(e) => {
                            setPlatformFeedback(null);
                            setPlatformForm((p) => ({ ...p, maintenanceEstimatedTime: e.target.value }));
                          }}
                          placeholder="e.g. 15 minutes, or 3:00 PM UTC"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>

                      {/* Live Public Preview Box */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                          Live Public Banner Preview:
                        </span>
                        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border border-amber-500/40 text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Wrench className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                            <p className="text-[11px] text-amber-100 font-medium leading-tight">
                              {platformForm.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance.'}
                            </p>
                          </div>
                          {platformForm.maintenanceEstimatedTime && (
                            <span className="shrink-0 text-[10px] font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md">
                              Return: {platformForm.maintenanceEstimatedTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingPlatform}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSavingPlatform ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>Save Platform Settings</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>

            {/* SECTION 3: SAFETY & FEATURES (FULL WIDTH) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Safety & Feature Controls</h3>
                    <p className="text-xs text-slate-400">Server-side feature toggles for WebRTC audio/video and matchmaking queue entry</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Real-time Safety
                </span>
              </div>

              <form onSubmit={handleSaveSafety} className="space-y-5">
                {safetyFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      safetyFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/50 border border-rose-800/50 text-rose-300'
                    }`}
                  >
                    {safetyFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{safetyFeedback.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Enable Voice Chat Toggle */}
                  <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                    safetyForm.enableVoiceChat
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-rose-950/20 border-rose-800/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${safetyForm.enableVoiceChat ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                          <Mic className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-200">Voice Chat</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSafetyForm((s) => ({ ...s, enableVoiceChat: !s.enableVoiceChat }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          safetyForm.enableVoiceChat ? 'bg-cyan-600' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            safetyForm.enableVoiceChat ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Controls WebRTC audio streams between paired strangers. When disabled, voice calls are blocked.
                    </p>
                    <div className="text-[10px] font-bold">
                      {safetyForm.enableVoiceChat ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Enable Video Chat Toggle */}
                  <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                    safetyForm.enableVideoChat
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-rose-950/20 border-rose-800/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${safetyForm.enableVideoChat ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                          <Video className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-200">Video Chat</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSafetyForm((s) => ({ ...s, enableVideoChat: !s.enableVideoChat }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          safetyForm.enableVideoChat ? 'bg-purple-600' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            safetyForm.enableVideoChat ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Controls WebRTC video stream signals between paired strangers. When disabled, camera feeds are blocked.
                    </p>
                    <div className="text-[10px] font-bold">
                      {safetyForm.enableVideoChat ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Enable New User Matching Toggle */}
                  <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                    safetyForm.enableNewUserMatching
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-amber-950/20 border-amber-800/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${safetyForm.enableNewUserMatching ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-200">New User Matching</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSafetyForm((s) => ({ ...s, enableNewUserMatching: !s.enableNewUserMatching }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          safetyForm.enableNewUserMatching ? 'bg-emerald-600' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            safetyForm.enableNewUserMatching ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Controls whether users can start new stranger searches. Active ongoing conversations will remain connected.
                    </p>
                    <div className="text-[10px] font-bold">
                      {safetyForm.enableNewUserMatching ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active Matching Allowed
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Queue Entry Paused
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSafety}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSafety ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Safety Settings</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Session Detail Modal */}
        {selectedUserDetail && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-cyan-400" />
                    <span>Session Info — {selectedUserDetail.username}</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    ID: {selectedUserDetail.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Socket Status</span>
                  <div className="font-semibold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Connected (Active)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Chat State</span>
                  <div className="font-semibold text-slate-200 capitalize">
                    {selectedUserDetail.status} {selectedUserDetail.mediaType ? `(${selectedUserDetail.mediaType})` : ''}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Language Preference</span>
                  <div className="font-semibold text-slate-200">{selectedUserDetail.language}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Country Filter</span>
                  <div className="font-semibold text-slate-200">{selectedUserDetail.country}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Connected Duration</span>
                  <div className="font-semibold font-mono text-cyan-400">
                    {formatConnectedDuration(selectedUserDetail.connectedAt)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Active Partner</span>
                  <div className="font-semibold text-slate-200">
                    {selectedUserDetail.partnerUsername || 'None'}
                  </div>
                </div>

                {selectedUserDetail.roomId && (
                  <div className="col-span-2 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Active Room ID</span>
                    <div className="font-mono text-xs text-cyan-400">{selectedUserDetail.roomId}</div>
                  </div>
                )}

                <div className="col-span-2 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Selected Interests</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedUserDetail.interests && selectedUserDetail.interests.length > 0 ? (
                      selectedUserDetail.interests.map((interest, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                          #{interest}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">All topics (No explicit interests set)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setConfirmDisconnectModal({ id: selectedUserDetail.id, username: selectedUserDetail.username })}
                  disabled={disconnectingId === selectedUserDetail.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {disconnectingId === selectedUserDetail.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Terminating...</span>
                    </>
                  ) : (
                    <>
                      <UserX className="w-4 h-4" />
                      <span>Disconnect User WebSocket</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected Report Detail Modal */}
        {selectedReportDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    <span>Report Details</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    ID: {selectedReportDetail.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReportDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Reason Summary */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Reported Reason</span>
                  <div className="text-sm font-extrabold text-rose-300 mt-0.5">
                    {formatReasonLabel(selectedReportDetail.reason)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider inline-block mt-0.5 ${
                      selectedReportDetail.status === 'New'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : selectedReportDetail.status === 'Reviewed'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {selectedReportDetail.status}
                  </span>
                </div>
              </div>

              {/* Grid of Users & Session Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Reported User */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Reported User</span>
                  <div className="font-bold text-slate-100 text-sm">{selectedReportDetail.reportedUsername}</div>
                  <div className="text-[10px] font-mono text-slate-500">ID: {selectedReportDetail.reportedConnectionId}</div>
                  <div className="pt-1 flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedReportDetail.isReportedUserOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-slate-400">
                      {selectedReportDetail.isReportedUserOnline ? 'Active Online' : 'Offline / Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Reporter */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Reporter</span>
                  <div className="font-bold text-slate-100 text-sm">{selectedReportDetail.reporterUsername}</div>
                  <div className="text-[10px] font-mono text-slate-500">ID: {selectedReportDetail.reporterConnectionId}</div>
                  <div className="pt-1 text-[11px] text-slate-400">
                    User in room
                  </div>
                </div>

                {/* Report Timestamp */}
                <div className="col-span-2 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Submitted At</span>
                    <span className="font-mono text-slate-300">{new Date(selectedReportDetail.timestamp).toLocaleString()}</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">
                    {formatReportTime(selectedReportDetail.timestamp)}
                  </span>
                </div>

                {/* Room ID if present */}
                {selectedReportDetail.roomId && (
                  <div className="col-span-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Chat Room ID</span>
                    <span className="font-mono text-xs text-cyan-400">{selectedReportDetail.roomId}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-slate-800 pt-4">
                <button
                  onClick={() => setSelectedReportDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors order-2 sm:order-1"
                >
                  Close
                </button>

                <div className="flex items-center gap-2 order-1 sm:order-2">
                  {selectedReportDetail.status !== 'Reviewed' && (
                    <button
                      onClick={() => handleUpdateReportStatus(selectedReportDetail.id, 'Reviewed')}
                      disabled={actionInProgressReportId === selectedReportDetail.id}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Reviewed</span>
                    </button>
                  )}

                  {selectedReportDetail.status !== 'Resolved' && (
                    <button
                      onClick={() => handleUpdateReportStatus(selectedReportDetail.id, 'Resolved')}
                      disabled={actionInProgressReportId === selectedReportDetail.id}
                      className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>Resolve</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDisconnectReportedUser(selectedReportDetail.id)}
                    disabled={actionInProgressReportId === selectedReportDetail.id}
                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionInProgressReportId === selectedReportDetail.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserX className="w-4 h-4" />
                    )}
                    <span>Disconnect User</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Session Detail Modal */}
        {selectedSessionDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <span>Active Session Details</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    Room ID: {selectedSessionDetail.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSessionDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type & Status Summary */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Session Type</span>
                  <div className="text-sm font-extrabold text-cyan-300 mt-0.5 flex items-center gap-1.5">
                    {selectedSessionDetail.sessionType === 'Voice' ? (
                      <Mic className="w-4 h-4 text-amber-400" />
                    ) : selectedSessionDetail.sessionType === 'Video' ? (
                      <Video className="w-4 h-4 text-purple-400" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                    )}
                    <span>{selectedSessionDetail.sessionType} Chat</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Duration</span>
                  <span className="text-xs font-mono text-slate-200 block mt-0.5">
                    {formatConnectedDuration(selectedSessionDetail.createdAt)}
                  </span>
                </div>
              </div>

              {/* Connected Users Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* User 1 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">User 1</span>
                  <div className="font-bold text-slate-100 text-sm">{selectedSessionDetail.user1Username}</div>
                  <div className="text-[10px] font-mono text-slate-500">ID: {selectedSessionDetail.user1ConnectionId}</div>
                  <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Language: {selectedSessionDetail.user1Language}</span>
                  </div>
                </div>

                {/* User 2 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">User 2</span>
                  <div className="font-bold text-slate-100 text-sm">{selectedSessionDetail.user2Username}</div>
                  <div className="text-[10px] font-mono text-slate-500">ID: {selectedSessionDetail.user2ConnectionId}</div>
                  <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Language: {selectedSessionDetail.user2Language}</span>
                  </div>
                </div>
              </div>

              {/* Shared Interests */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Shared Interests</span>
                {selectedSessionDetail.sharedInterests.length === 0 ? (
                  <span className="text-xs text-slate-500">No matching interests declared.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSessionDetail.sharedInterests.map((interest, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs font-medium text-cyan-300">
                        #{interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  onClick={() => setSelectedSessionDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={() => setConfirmEndSessionModal({ roomId: selectedSessionDetail.id, user1: selectedSessionDetail.user1Username, user2: selectedSessionDetail.user2Username })}
                  disabled={actionInProgressSessionId === selectedSessionDetail.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionInProgressSessionId === selectedSessionDetail.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PhoneOff className="w-4 h-4" />
                  )}
                  <span>End Session Immediately</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BAN USER MODAL */}
        {banTargetUser && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Ban className="w-5 h-5 text-rose-500" />
                    <span>Issue Temporary Ban</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target: <strong className="text-slate-200">{banTargetUser.username}</strong> ({banTargetUser.id})
                  </p>
                </div>
                <button
                  onClick={() => setBanTargetUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ban Duration Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Ban Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '15 Minutes', mins: 15 },
                    { label: '30 Minutes', mins: 30 },
                    { label: '1 Hour', mins: 60 },
                    { label: '6 Hours', mins: 360 },
                    { label: '24 Hours', mins: 1440 },
                    { label: '3 Days', mins: 4320 },
                  ].map((dur) => (
                    <button
                      key={dur.mins}
                      type="button"
                      onClick={() => setBanDurationMinutes(dur.mins)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        banDurationMinutes === dur.mins
                          ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ban Reason Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Ban Reason</label>
                <select
                  value={banReasonSelect}
                  onChange={(e) => setBanReasonSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="Violation of community guidelines">Violation of community guidelines</option>
                  <option value="Harassment or inappropriate behavior">Harassment or inappropriate behavior</option>
                  <option value="Spamming or bot activity">Spamming or bot activity</option>
                  <option value="Explicit or offensive content">Explicit or offensive content</option>
                  <option value="Scam or phishing attempt">Scam or phishing attempt</option>
                  <option value="Custom">Custom Reason...</option>
                </select>

                {banReasonSelect === 'Custom' && (
                  <input
                    type="text"
                    value={customBanReason}
                    onChange={(e) => setCustomBanReason(e.target.value)}
                    placeholder="Enter custom ban reason..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 mt-2"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setBanTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBanUser}
                  disabled={isSubmittingBan}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingBan ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>Apply Ban</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* CLEAR AUDIT LOGS MODAL */}
        {isClearLogsModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-rose-500" />
                    <span>Clear Admin Audit Logs</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Confirmation required for log truncation.
                  </p>
                </div>
                <button
                  onClick={() => setIsClearLogsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 text-rose-200 text-xs space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Are you sure you want to clear all admin logs?</span>
                </p>
                <p className="text-slate-300 leading-relaxed">
                  This action will immediately wipe all <strong className="text-white">{auditLogs.length}</strong> recorded administrative audit entries from server memory. This operation cannot be undone.
                </p>
              </div>

              {clearLogsFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    clearLogsFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-300'
                      : 'bg-rose-950/50 border border-rose-800/50 text-rose-300'
                  }`}
                >
                  {clearLogsFeedback.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsClearLogsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAuditLogs}
                  disabled={isClearingLogs}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isClearingLogs ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Clear All Logs</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DISCONNECT USER CONFIRMATION MODAL */}
        {confirmDisconnectModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <UserX className="w-5 h-5 text-amber-500" />
                    <span>Disconnect User Socket</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Confirmation required for connection termination.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmDisconnectModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-200 text-xs space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Disconnect user "{confirmDisconnectModal.username}"?</span>
                </p>
                <p className="text-slate-300 leading-relaxed">
                  This action will immediately terminate WebSocket connection <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">{confirmDisconnectModal.id}</code>. If this user is currently chatting, their active session partner will be disconnected.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setConfirmDisconnectModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetId = confirmDisconnectModal.id;
                    setConfirmDisconnectModal(null);
                    await handleDisconnectUser(targetId);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5"
                >
                  <UserX className="w-4 h-4" />
                  <span>Confirm Disconnect</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* END SESSION CONFIRMATION MODAL */}
        {confirmEndSessionModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <PhoneOff className="w-5 h-5 text-rose-500" />
                    <span>End Active Chat Session</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Confirmation required for active room closure.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmEndSessionModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 text-rose-200 text-xs space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>End chat session between {confirmEndSessionModal.user1} & {confirmEndSessionModal.user2}?</span>
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Room ID: <code className="text-rose-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono text-[11px]">{confirmEndSessionModal.roomId}</code>. Both participants will receive an immediate disconnect signal and be returned to the main screen.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setConfirmEndSessionModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const roomId = confirmEndSessionModal.roomId;
                    setConfirmEndSessionModal(null);
                    await handleEndSession(roomId);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Confirm End Session</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
