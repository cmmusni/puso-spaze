import type { Request } from 'express';
import { Resend } from 'resend';
import { env } from '../config/env';
import { prisma } from '../config/db';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface NewUserAlertContext {
  source: 'users.create' | 'auth.redeem-invite';
  ipAddress: string;
  forwardedFor: string;
  userAgent: string;
  platformHint: string;
}

export interface NewUserAlertPayload {
  userId: string;
  displayName: string;
  role: string;
  context: NewUserAlertContext;
}

export function extractNewUserAlertContext(req: Request): NewUserAlertContext {
  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader)
    ? forwardedForHeader.join(', ')
    : forwardedForHeader ?? 'n/a';

  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader.join(' | ')
    : userAgentHeader ?? 'n/a';

  const platformHintHeader =
    req.headers['sec-ch-ua-platform'] ?? req.headers['x-platform'] ?? req.headers['expo-platform'];
  const platformHint = Array.isArray(platformHintHeader)
    ? platformHintHeader.join(' | ')
    : platformHintHeader ?? 'n/a';

  return {
    source: 'users.create',
    ipAddress: req.ip ?? 'n/a',
    forwardedFor,
    userAgent,
    platformHint,
  };
}

export async function sendNewUserAlertEmail(payload: NewUserAlertPayload): Promise<void> {
  if (!env.RESEND_API_KEY) {
    return;
  }

  if (env.NEW_USER_ALERT_TO.length === 0) {
    return;
  }

  try {
    const displayName = escapeHtml(payload.displayName);
    const userId = escapeHtml(payload.userId);
    const role = escapeHtml(payload.role);
    const source = escapeHtml(payload.context.source);
    const ipAddress = escapeHtml(payload.context.ipAddress);
    const forwardedFor = escapeHtml(payload.context.forwardedFor);
    const platformHint = escapeHtml(payload.context.platformHint);
    const userAgent = escapeHtml(payload.context.userAgent);
    const serverTime = escapeHtml(new Date().toISOString());

    await getResend().emails.send({
      from: env.NEW_USER_ALERT_FROM,
      to: env.NEW_USER_ALERT_TO,
      subject: `🆕 New PUSO Spaze user: ${payload.displayName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:16px">
          <h2 style="margin-bottom:8px">New user joined PUSO Spaze</h2>
          <p style="margin-top:0;color:#444">A new account was created.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:14px">
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Username</strong></td><td style="padding:8px;border:1px solid #ddd">${displayName}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>User ID</strong></td><td style="padding:8px;border:1px solid #ddd">${userId}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Role</strong></td><td style="padding:8px;border:1px solid #ddd">${role}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Source</strong></td><td style="padding:8px;border:1px solid #ddd">${source}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>IP</strong></td><td style="padding:8px;border:1px solid #ddd">${ipAddress}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>X-Forwarded-For</strong></td><td style="padding:8px;border:1px solid #ddd">${forwardedFor}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Platform</strong></td><td style="padding:8px;border:1px solid #ddd">${platformHint}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>User-Agent</strong></td><td style="padding:8px;border:1px solid #ddd">${userAgent}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Server Time</strong></td><td style="padding:8px;border:1px solid #ddd">${serverTime}</td></tr>
          </table>
        </div>
      `,
    });
  } catch (error) {
    console.error('[NewUserAlert] Failed to send new-user alert email:', error);
  }
}

// ── Recovery Request Alert ─────────────────────────────────────────────

export interface RecoveryAlertPayload {
  displayName: string;
  reason: string;
  requestId: string;
}

/**
 * Send an email to all ADMIN users (with an email on file) notifying them
 * of a new account recovery request.
 */
export async function sendRecoveryAlertEmail(payload: RecoveryAlertPayload): Promise<void> {
  if (!env.RESEND_API_KEY) return;

  try {
    // Query all ADMIN users that have an email set
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', email: { not: null } },
      select: { email: true },
    });

    const recipients = admins
      .map((a) => a.email!)
      .filter(Boolean);

    if (recipients.length === 0) return;

    const displayName = escapeHtml(payload.displayName);
    const reason = escapeHtml(payload.reason);
    const requestId = escapeHtml(payload.requestId);
    const serverTime = escapeHtml(new Date().toISOString());

    await getResend().emails.send({
      from: env.NEW_USER_ALERT_FROM,
      to: recipients,
      subject: `🔑 Account Recovery Request: ${payload.displayName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:16px">
          <h2 style="margin-bottom:8px;color:#A60550">Account Recovery Request</h2>
          <p style="margin-top:0;color:#444">A user has submitted an account recovery request and needs coach review.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:14px">
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Username</strong></td><td style="padding:8px;border:1px solid #ddd">${displayName}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Reason</strong></td><td style="padding:8px;border:1px solid #ddd">${reason}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Request ID</strong></td><td style="padding:8px;border:1px solid #ddd">${requestId}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Server Time</strong></td><td style="padding:8px;border:1px solid #ddd">${serverTime}</td></tr>
          </table>
          <p style="margin-top:20px;color:#444">Please review this request in the <strong>Coach Dashboard</strong>.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[RecoveryAlert] Failed to send recovery alert email:', error);
  }
}
