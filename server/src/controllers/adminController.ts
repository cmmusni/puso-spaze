// ─────────────────────────────────────────────
// src/controllers/adminController.ts
// Admin-only operations (protected by ADMIN_SECRET header)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { prisma } from '../config/db';
import { env } from '../config/env';

// ── Nodemailer transporter (lazy singleton) ───
let _transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
      // Force IPv4 (Railway doesn't support IPv6)
      family: 4,
    });
  }
  return _transporter;
}

// ── Helpers ───────────────────────────────────
function generateCode(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous O/0/I/1
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Format as XXXXX-XXXXX
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/**
 * POST /api/admin/invite-codes
 * Header: Authorization: Bearer <ADMIN_SECRET>
 * Body:   { count?: number }   (default 1, max 20)
 *
 * Returns: { codes: string[] }
 */
export async function generateInviteCodes(req: Request, res: Response): Promise<void> {
  const count = Math.min(Number(req.body?.count) || 1, 20);
  const codes: string[] = [];

  try {
    for (let i = 0; i < count; i++) {
      let code = '';
      // Retry on the rare collision
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateCode();
        const exists = await prisma.inviteCode.findUnique({ where: { code } });
        if (!exists) break;
      }
      const record = await prisma.inviteCode.create({ data: { code } });
      codes.push(record.code);
    }

    res.status(201).json({ codes });
  } catch (err) {
    console.error('[AdminController] generateInviteCodes error:', err);
    res.status(500).json({ error: 'Failed to generate invite codes.' });
  }
}

/**
 * GET /api/admin/invite-codes
 * Header: Authorization: Bearer <ADMIN_SECRET>
 * Returns all invite codes with their status.
 */
export async function listInviteCodes(_req: Request, res: Response): Promise<void> {
  try {
    const codes = await prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ codes });
  } catch (err) {
    console.error('[AdminController] listInviteCodes error:', err);
    res.status(500).json({ error: 'Failed to list invite codes.' });
  }
}

/**
 * POST /api/admin/invite-codes/send-email
 * Header: Authorization: Bearer <ADMIN_SECRET>
 * Body:   { email: string }
 *
 * Generates a fresh invite code and emails it to the given address.
 * Returns: { code: string; email: string }
 */
export async function sendInviteCodeByEmail(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  try {
    // ── Generate a unique code ─────────────────
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const exists = await prisma.inviteCode.findUnique({ where: { code } });
      if (!exists) break;
    }
    const record = await prisma.inviteCode.create({ data: { code } });

    // ── Send email ────────────────────────────
    const transporter = getTransporter();
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: '🛡️ Your PUSO Spaze Coach Invite Code',
      text: [
        'Hello,',
        '',
        'You have been invited to join PUSO Spaze as a Coach.',
        '',
        `Your invite code is:  ${record.code}`,
        '',
        'Open the PUSO Spaze app by clicking this link: http://localhost:8081/',
        'Tap "PUSO Coach? Enter invite code", enter your name and this code to get started.',
        '',
        'This code can only be used once.',
        '',
        '— The PUSO Spaze Team',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#7c3aed">🛡️ PUSO Spaze Coach Invitation</h2>
          <p>Hello,</p>
          <p>You have been invited to join <strong>PUSO Spaze</strong> as a Coach.</p>
          <div style="background:#f3f4f6;border-radius:12px;padding:20px;text-align:center;margin:24px 0">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">YOUR INVITE CODE</p>
            <p style="margin:0;font-size:28px;font-weight:900;letter-spacing:4px;color:#7c3aed">${record.code}</p>
          </div>
          <p>Open the <strong>PUSO Spaze</strong> app by clicking this link: <a href="http://localhost:8081/" style="color:#7c3aed;text-decoration:none">http://localhost:8081/</a></p>
          <p>Tap <em>"PUSO Coach? Enter invite code"</em>, enter your name and this code to get started.</p>
          <p style="color:#9ca3af;font-size:12px">This code can only be used once.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px">— The PUSO Spaze Team</p>
        </div>
      `,
    });

    res.status(201).json({ code: record.code, email });
  } catch (err) {
    console.error('[AdminController] sendInviteCodeByEmail error:', err);
    res.status(500).json({ error: 'Failed to generate or send invite code.' });
  }
}
