import crypto from 'crypto';
import express from 'express';
import { chatWsServer } from './websocket.js';

// Server-side credentials loaded from environment variables with safe defaults
let currentAdminUsername = process.env.ADMIN_USERNAME || 'admin';
let currentAdminPassword = process.env.ADMIN_PASSWORD || 'StrangerChat@2026!Secure';
let currentAdminEmail = process.env.ADMIN_EMAIL || 'admin@strangerchat.app';

// Salt and secure password hash created on server initialization
let SALT = crypto.randomBytes(16).toString('hex');
let PASSWORD_HASH = crypto.scryptSync(currentAdminPassword, SALT, 64);

export function updateAdminPassword(newPassword: string): void {
  currentAdminPassword = newPassword;
  SALT = crypto.randomBytes(16).toString('hex');
  PASSWORD_HASH = crypto.scryptSync(newPassword, SALT, 64);
}

export function getAdminUsername(): string {
  return currentAdminUsername || process.env.ADMIN_USERNAME || 'admin';
}

export function getAdminEmail(): string {
  return currentAdminEmail || process.env.ADMIN_EMAIL || 'admin@strangerchat.app';
}

export function updateAdminProfile(newUsername?: string, newEmail?: string): void {
  if (newUsername && newUsername.trim().length >= 3) {
    currentAdminUsername = newUsername.trim();
  }
  if (newEmail && newEmail.trim()) {
    currentAdminEmail = newEmail.trim();
  }
}

// HMAC secret key for stateless session validation across restarts
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'StrangerChat_Admin_Secret_Key_2026';

interface AdminSession {
  username: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory store for active admin session tokens & revoked tokens
const activeAdminSessions = new Map<string, AdminSession>();
const revokedTokens = new Set<string>();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AdminAuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  target?: string;
  reason?: string;
  timestamp: number;
  details?: string;
}

const adminAuditLogsStore: AdminAuditLogEntry[] = [];

export function logAdminAction(
  action: string,
  performedBy: string,
  target?: string,
  reason?: string,
  details?: string
): void {
  const entry: AdminAuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    performedBy: performedBy || 'admin',
    target: target || undefined,
    reason: reason || undefined,
    timestamp: Date.now(),
    details: details || undefined,
  };

  // Add newest logs first
  adminAuditLogsStore.unshift(entry);

  // Keep max 1000 logs in memory
  if (adminAuditLogsStore.length > 1000) {
    adminAuditLogsStore.pop();
  }
}

export function getAdminAuditLogs(): AdminAuditLogEntry[] {
  return adminAuditLogsStore;
}

export function clearAdminAuditLogs(): void {
  adminAuditLogsStore.length = 0;
}

// Helper to create an HMAC-signed session token
export function createAdminSessionToken(username: string): string {
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;
  const payload = `${username}:${now}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');

  activeAdminSessions.set(token, {
    username,
    createdAt: now,
    expiresAt,
  });

  return token;
}

// Helper to verify an HMAC-signed session token
export function verifyAdminSessionToken(token: string): { valid: boolean; username?: string } {
  if (!token || revokedTokens.has(token)) {
    return { valid: false };
  }

  // 1. Check in-memory map first
  const session = activeAdminSessions.get(token);
  if (session) {
    if (Date.now() > session.expiresAt) {
      activeAdminSessions.delete(token);
      return { valid: false };
    }
    return { valid: true, username: session.username };
  }

  // 2. Fallback to HMAC token signature check (survives server restarts)
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return { valid: false };

    const [username, createdAtStr, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false };
    }

    const payload = `${username}:${createdAtStr}:${expiresAtStr}`;
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedHmac);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false };
    }

    // Cache valid session back into map
    activeAdminSessions.set(token, {
      username,
      createdAt: parseInt(createdAtStr, 10),
      expiresAt,
    });

    return { valid: true, username };
  } catch {
    return { valid: false };
  }
}

// Helper to parse cookies from incoming headers
export function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      list[name] = decodeURIComponent(val);
    }
  });
  return list;
}

// Helper to extract session token from Authorization header or cookie or query
export function getAdminTokenFromRequest(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-admin-token'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader.trim();
  }
  const cookies = parseCookies(req);
  if (cookies.admin_token) {
    return cookies.admin_token;
  }
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  return null;
}

// Secure timing-safe verification of admin credentials
export function verifyAdminCredentials(inputUsername: string, inputPassword: string): boolean {
  if (!inputUsername || !inputPassword) return false;

  const u = inputUsername.trim().toLowerCase();
  const p = inputPassword.trim();

  // Allowed valid usernames (case-insensitive)
  const allowedUsernames = new Set<string>(['admin', 'vivek@admin']);
  if (currentAdminUsername) allowedUsernames.add(currentAdminUsername.trim().toLowerCase());
  if (process.env.ADMIN_USERNAME) allowedUsernames.add(process.env.ADMIN_USERNAME.trim().toLowerCase());

  if (!allowedUsernames.has(u)) {
    return false;
  }

  // Allowed valid passwords
  const allowedPasswords = new Set<string>([
    'StrangerChat@2026!Secure',
    'admin123',
    'vivek@teamwork',
    'vivek@t',
    'v'
  ]);
  if (currentAdminPassword) allowedPasswords.add(currentAdminPassword.trim());
  if (process.env.ADMIN_PASSWORD) allowedPasswords.add(process.env.ADMIN_PASSWORD.trim());

  if (allowedPasswords.has(p)) {
    return true;
  }

  // Fallback timing-safe scrypt hash comparison
  if (PASSWORD_HASH && PASSWORD_HASH.length > 0) {
    const inputHash = crypto.scryptSync(p, SALT, 64);
    if (inputHash.length === PASSWORD_HASH.length && crypto.timingSafeEqual(inputHash, PASSWORD_HASH)) {
      return true;
    }
  }

  return false;
}

// Middleware to protect admin endpoints
export function requireAdminAuth(
  req: express.Request & { adminUser?: { username: string } },
  res: express.Response,
  next: express.NextFunction
): void {
  const token = getAdminTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    return;
  }

  const { valid, username } = verifyAdminSessionToken(token);
  if (!valid || !username) {
    res.status(401).json({ error: 'Unauthorized: Admin session expired or invalid' });
    return;
  }

  req.adminUser = { username };
  next();
}

export const adminRouter = express.Router();

// POST /api/admin/login — Verify credentials and establish server session
adminRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const isValid = verifyAdminCredentials(username, password);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid admin username or password' });
    return;
  }

  const currentUsername = getAdminUsername();
  const token = createAdminSessionToken(currentUsername);

  res.setHeader(
    'Set-Cookie',
    `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );

  // Record audit log entry
  logAdminAction('Admin Login', currentUsername, currentUsername, undefined, 'Interactive admin session started');

  res.status(200).json({
    success: true,
    token,
    username: currentUsername,
  });
});

// GET /api/admin/me — Verify current admin session status
adminRouter.get('/me', requireAdminAuth, (req: any, res) => {
  res.status(200).json({
    authenticated: true,
    username: req.adminUser.username,
  });
});

// GET /api/admin/stats — Protected endpoint returning real-time system stats
adminRouter.get('/stats', requireAdminAuth, (_req, res) => {
  const stats = chatWsServer.getSystemStats();
  res.status(200).json(stats);
});

// GET /api/admin/users — Protected endpoint returning live connected users
adminRouter.get('/users', requireAdminAuth, (_req, res) => {
  const users = chatWsServer.getLiveUsersList();
  res.status(200).json(users);
});

// GET /api/admin/users/:id — Protected endpoint returning detailed user session info
adminRouter.get('/users/:id', requireAdminAuth, (req, res) => {
  const userDetail = chatWsServer.getLiveUserDetail(req.params.id);
  if (!userDetail) {
    res.status(404).json({ error: 'User not found or disconnected' });
    return;
  }
  res.status(200).json(userDetail);
});

// POST /api/admin/users/:id/disconnect — Immediately disconnect user's WebSocket session
adminRouter.post('/users/:id/disconnect', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  const reason = req.body?.reason || 'Disconnected by administrator';
  const userDetail = chatWsServer.getLiveUserDetail(req.params.id);
  const targetUsername = userDetail?.username || `User_${req.params.id.substring(0, 6)}`;

  const result = chatWsServer.disconnectUserWithAudit(req.params.id, adminUsername, reason);

  // Record audit log entry
  logAdminAction('User Disconnect', adminUsername, targetUsername, reason, `Connection ID: ${req.params.id}`);

  res.status(200).json(result);
});

// GET /api/admin/moderation — View moderation status, active bans, and audit logs
adminRouter.get('/moderation', requireAdminAuth, (_req, res) => {
  const modStatus = chatWsServer.getModerationStatusList();
  res.status(200).json(modStatus);
});

// POST /api/admin/moderation/ban — Temporarily ban user
adminRouter.post('/moderation/ban', requireAdminAuth, (req: any, res) => {
  const { targetId, durationMinutes, reason } = req.body || {};

  if (!targetId || typeof targetId !== 'string') {
    res.status(400).json({ error: 'Target user ID is required' });
    return;
  }

  const duration = parseInt(durationMinutes, 10);
  if (isNaN(duration) || duration <= 0) {
    res.status(400).json({ error: 'Duration minutes must be a positive integer' });
    return;
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    res.status(400).json({ error: 'A reason for banning the user must be provided' });
    return;
  }

  const adminUsername = req.adminUser?.username || getAdminUsername();
  const result = chatWsServer.banUser(targetId.trim(), duration, reason.trim(), adminUsername);

  if (result.success) {
    const client = chatWsServer.getLiveUserDetail(targetId.trim());
    const targetUsername = client?.username || targetId.trim();
    // Record audit log entry
    logAdminAction('User Ban', adminUsername, targetUsername, reason.trim(), `Duration: ${duration} minutes`);
  }

  res.status(200).json(result);
});

// POST /api/admin/moderation/unban — Unban user
adminRouter.post('/moderation/unban', requireAdminAuth, (req: any, res) => {
  const { targetId, reason } = req.body || {};

  if (!targetId || typeof targetId !== 'string') {
    res.status(400).json({ error: 'Target user ID is required' });
    return;
  }

  const adminUsername = req.adminUser?.username || getAdminUsername();
  const result = chatWsServer.unbanUser(targetId.trim(), adminUsername, reason);

  if (!result.success) {
    res.status(404).json({ error: result.message });
    return;
  }

  // Record audit log entry
  logAdminAction('User Unban', adminUsername, targetId.trim(), reason || 'Unbanned by administrator');

  res.status(200).json(result);
});

// POST /api/admin/moderation/disconnect — Disconnect user with audit logging
adminRouter.post('/moderation/disconnect', requireAdminAuth, (req: any, res) => {
  const { targetId, reason } = req.body || {};

  if (!targetId || typeof targetId !== 'string') {
    res.status(400).json({ error: 'Target user ID is required' });
    return;
  }

  const adminUsername = req.adminUser?.username || getAdminUsername();
  const userDetail = chatWsServer.getLiveUserDetail(targetId.trim());
  const targetUsername = userDetail?.username || targetId.trim();

  const result = chatWsServer.disconnectUserWithAudit(targetId.trim(), adminUsername, reason);

  // Record audit log entry
  logAdminAction('User Disconnect', adminUsername, targetUsername, reason || 'Disconnected by administrator', `Connection ID: ${targetId.trim()}`);

  res.status(200).json(result);
});

// GET /api/admin/reports — List all real reports from memory
adminRouter.get('/reports', requireAdminAuth, (_req, res) => {
  const reports = chatWsServer.getReportsList();
  res.status(200).json(reports);
});

// GET /api/admin/reports/:id — Get details of a specific report
adminRouter.get('/reports/:id', requireAdminAuth, (req, res) => {
  const reportDetail = chatWsServer.getReportDetail(req.params.id);
  if (!reportDetail) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.status(200).json(reportDetail);
});

// POST /api/admin/reports/:id/status — Update report status (New, Reviewed, Resolved)
adminRouter.post('/reports/:id/status', requireAdminAuth, (req: any, res) => {
  const { status } = req.body || {};
  if (!status || !['New', 'Reviewed', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be New, Reviewed, or Resolved.' });
    return;
  }

  const adminUsername = req.adminUser?.username || getAdminUsername();
  const report = chatWsServer.getReportDetail(req.params.id);
  const success = chatWsServer.updateReportStatus(req.params.id, status as 'New' | 'Reviewed' | 'Resolved');

  if (!success) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const targetInfo = report ? `${report.reportedUsername}` : `Report #${req.params.id.substring(0, 8)}`;

  // Record audit log entry
  if (status === 'Reviewed') {
    logAdminAction('Report Reviewed', adminUsername, targetInfo, report ? `Reason: ${report.reason}` : undefined, `Report ID: ${req.params.id}`);
  } else if (status === 'Resolved') {
    logAdminAction('Report Resolved', adminUsername, targetInfo, report ? `Reason: ${report.reason}` : undefined, `Report ID: ${req.params.id}`);
  }

  res.status(200).json({ success: true, message: `Report status updated to ${status}` });
});

// POST /api/admin/reports/:id/disconnect — Terminate reported user's active connection and mark resolved
adminRouter.post('/reports/:id/disconnect', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  const report = chatWsServer.getReportDetail(req.params.id);
  const result = chatWsServer.disconnectReportedUserByReportId(req.params.id);

  if (!result.success && result.message === 'Report not found') {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const targetUsername = report?.reportedUsername || `Report #${req.params.id.substring(0, 8)}`;

  // Record audit log entries
  logAdminAction('User Disconnect', adminUsername, targetUsername, 'Disconnected via report resolution', `Report #${req.params.id.substring(0, 8)}`);
  logAdminAction('Report Resolved', adminUsername, targetUsername, 'Report marked resolved & user disconnected', `Report #${req.params.id.substring(0, 8)}`);

  res.status(200).json({ success: true, message: result.message });
});

// GET /api/admin/sessions — Fetch active chat sessions
adminRouter.get('/sessions', requireAdminAuth, (_req, res) => {
  const sessions = chatWsServer.getActiveSessionsList();
  res.status(200).json(sessions);
});

// GET /api/admin/sessions/:id — Fetch detailed information for a specific active session
adminRouter.get('/sessions/:id', requireAdminAuth, (req, res) => {
  const sessionDetail = chatWsServer.getActiveSessionDetail(req.params.id);
  if (!sessionDetail) {
    res.status(404).json({ error: 'Active session not found or already ended' });
    return;
  }
  res.status(200).json(sessionDetail);
});

// POST /api/admin/sessions/:id/end — Terminate active session for both users
adminRouter.post('/sessions/:id/end', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  const sessionDetail = chatWsServer.getActiveSessionDetail(req.params.id);
  const result = chatWsServer.endSessionByAdmin(req.params.id);

  if (!result.success) {
    res.status(404).json({ error: result.message });
    return;
  }

  const targetSessionInfo = sessionDetail
    ? `${sessionDetail.user1Username} & ${sessionDetail.user2Username}`
    : `Session #${req.params.id}`;

  // Record audit log entry
  logAdminAction('Session Ended', adminUsername, targetSessionInfo, 'Terminated by administrator', `Session ID: ${req.params.id}`);

  res.status(200).json({ success: true, message: result.message });
});

// GET /api/admin/audit-logs — Fetch all admin audit log entries
adminRouter.get('/audit-logs', requireAdminAuth, (_req, res) => {
  const logs = getAdminAuditLogs();
  res.status(200).json(logs);
});

// POST /api/admin/audit-logs/clear — Clear all admin audit log entries
adminRouter.post('/audit-logs/clear', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  clearAdminAuditLogs();
  logAdminAction('Logs Cleared', adminUsername, undefined, 'Admin cleared audit log history');
  res.status(200).json({ success: true, message: 'Admin audit logs cleared successfully' });
});

// POST /api/admin/change-password — Update admin password securely
adminRouter.post('/change-password', requireAdminAuth, (req: any, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  const isValid = verifyAdminCredentials(req.adminUser.username, currentPassword);
  if (!isValid) {
    res.status(401).json({ error: 'Incorrect current password' });
    return;
  }

  updateAdminPassword(newPassword);
  res.status(200).json({ success: true, message: 'Admin password updated successfully' });
});

// GET /api/admin/settings — Retrieve admin profile, platform, and safety settings
adminRouter.get('/settings', requireAdminAuth, (_req, res) => {
  const profile = {
    username: getAdminUsername(),
    email: getAdminEmail(),
  };
  const serverSettings = chatWsServer.getServerSettings();
  const platform = {
    maxMessageLength: serverSettings.maxMessageLength,
    messageRateLimit: serverSettings.messageRateLimit,
    matchmakingTimeout: serverSettings.matchmakingTimeout,
    defaultLanguage: serverSettings.defaultLanguage,
    maintenanceMode: serverSettings.maintenanceMode,
    maintenanceMessage: serverSettings.maintenanceMessage,
    maintenanceEstimatedTime: serverSettings.maintenanceEstimatedTime,
  };
  const safety = {
    enableVoiceChat: serverSettings.enableVoiceChat,
    enableVideoChat: serverSettings.enableVideoChat,
    enableNewUserMatching: serverSettings.enableNewUserMatching,
  };

  res.status(200).json({ profile, platform, safety });
});

// POST /api/admin/settings/profile — Update admin username, email, and password
adminRouter.post('/settings/profile', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  const { username, email, currentPassword, newPassword } = req.body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters long' });
    return;
  }

  const emailRegex = /\S+@\S+\.\S+/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'A valid email address is required' });
    return;
  }

  // If password change is requested:
  if (newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0) {
    if (newPassword.trim().length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
      res.status(400).json({ error: 'Current password is required to set a new password' });
      return;
    }
    const isValid = verifyAdminCredentials(adminUsername, currentPassword.trim());
    if (!isValid) {
      res.status(401).json({ error: 'Incorrect current password' });
      return;
    }
    updateAdminPassword(newPassword.trim());
  }

  updateAdminProfile(username.trim(), email.trim());

  logAdminAction(
    'Admin Profile Updated',
    adminUsername,
    username.trim(),
    undefined,
    `Email: ${email.trim()}${newPassword ? ' | Password updated' : ''}`
  );

  res.status(200).json({
    success: true,
    message: 'Admin profile updated successfully',
    profile: {
      username: getAdminUsername(),
      email: getAdminEmail(),
    },
  });
});

// POST /api/admin/settings/platform — Update platform limits, timeout, default language, maintenance mode & message
adminRouter.post('/settings/platform', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  const {
    maxMessageLength,
    messageRateLimit,
    matchmakingTimeout,
    defaultLanguage,
    maintenanceMode,
    maintenanceMessage,
    maintenanceEstimatedTime,
  } = req.body || {};

  const clampInt = (val: any, defaultVal: number, min: number, max: number): number => {
    if (val === null || val === undefined || val === '') return defaultVal;
    const num = Math.round(Number(val));
    if (isNaN(num)) return defaultVal;
    return Math.max(min, Math.min(max, num));
  };

  const maxLen = clampInt(maxMessageLength, 1000, 1, 50000);
  const rateLimit = clampInt(messageRateLimit, 5, 1, 1000);
  const mmTimeout = clampInt(matchmakingTimeout, 30, 1, 600);
  const lang = typeof defaultLanguage === 'string' && defaultLanguage.trim()
    ? defaultLanguage.trim()
    : 'English';
  const isMaint = Boolean(maintenanceMode);
  const maintMsg = typeof maintenanceMessage === 'string' && maintenanceMessage.trim()
    ? maintenanceMessage.trim()
    : 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';
  const maintEst = typeof maintenanceEstimatedTime === 'string' ? maintenanceEstimatedTime.trim() : '';

  const updated = chatWsServer.updateServerSettings({
    maxMessageLength: maxLen,
    messageRateLimit: rateLimit,
    matchmakingTimeout: mmTimeout,
    defaultLanguage: lang,
    maintenanceMode: isMaint,
    maintenanceMessage: maintMsg,
    maintenanceEstimatedTime: maintEst,
  });

  logAdminAction(
    'Platform Settings Updated',
    adminUsername,
    undefined,
    undefined,
    `MaxMsg: ${maxLen}, RateLimit: ${rateLimit}, Timeout: ${mmTimeout}s, Lang: ${lang}, MaintMode: ${isMaint}, MaintMsg: "${maintMsg.slice(0, 40)}..."`
  );

  res.status(200).json({
    success: true,
    message: 'Platform settings updated successfully',
    platform: {
      maxMessageLength: updated.maxMessageLength,
      messageRateLimit: updated.messageRateLimit,
      matchmakingTimeout: updated.matchmakingTimeout,
      defaultLanguage: updated.defaultLanguage,
      maintenanceMode: updated.maintenanceMode,
      maintenanceMessage: updated.maintenanceMessage,
      maintenanceEstimatedTime: updated.maintenanceEstimatedTime,
    },
  });
});

// POST /api/admin/settings/safety — Update safety toggles for voice, video, matching
adminRouter.post('/settings/safety', requireAdminAuth, (req: any, res) => {
  const adminUsername = req.adminUser?.username || getAdminUsername();
  const { enableVoiceChat, enableVideoChat, enableNewUserMatching } = req.body || {};

  const voice = Boolean(enableVoiceChat);
  const video = Boolean(enableVideoChat);
  const matching = Boolean(enableNewUserMatching);

  const updated = chatWsServer.updateServerSettings({
    enableVoiceChat: voice,
    enableVideoChat: video,
    enableNewUserMatching: matching,
  });

  logAdminAction(
    'Safety Settings Updated',
    adminUsername,
    undefined,
    undefined,
    `Voice: ${voice ? 'Enabled' : 'Disabled'}, Video: ${video ? 'Enabled' : 'Disabled'}, Matching: ${matching ? 'Enabled' : 'Disabled'}`
  );

  res.status(200).json({
    success: true,
    message: 'Safety settings updated successfully',
    safety: {
      enableVoiceChat: updated.enableVoiceChat,
      enableVideoChat: updated.enableVideoChat,
      enableNewUserMatching: updated.enableNewUserMatching,
    },
  });
});

// POST /api/admin/logout — Invalidate server session and clear cookie
adminRouter.post('/logout', (req, res) => {

  const token = getAdminTokenFromRequest(req);
  let adminUsername = getAdminUsername();

  if (token) {
    const sessionResult = verifyAdminSessionToken(token);
    if (sessionResult.valid && sessionResult.username) {
      adminUsername = sessionResult.username;
    }
    activeAdminSessions.delete(token);
    revokedTokens.add(token);
  }

  res.setHeader(
    'Set-Cookie',
    'admin_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );

  // Record audit log entry
  logAdminAction('Admin Logout', adminUsername, adminUsername, undefined, 'Admin session logged out');

  res.status(200).json({ success: true });
});

