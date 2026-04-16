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
      from: 'PUSO Spaze <noreply@puso-spaze.org>',
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
