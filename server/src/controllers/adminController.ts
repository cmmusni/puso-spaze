// ─────────────────────────────────────────────
// src/controllers/adminController.ts
// Admin-only operations (protected by ADMIN_SECRET header)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { Resend } from 'resend';
import { prisma } from '../config/db';
import { env } from '../config/env';

// ── Resend client (lazy singleton) ───
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
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

async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.role === 'ADMIN';
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
    const record = await prisma.inviteCode.create({ data: { code, email } });

    // ── Send email via Resend ────────────────────────────
    const resend = getResend();
    console.log('[AdminController] Attempting to send email to:', email);
    
    await resend.emails.send({
      from: 'PUSO Spaze <noreply@puso-spaze.org>',
      to: email,
      subject: '🛡️ Your PUSO Spaze Coach Invite Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#A60550">🛡️ PUSO Spaze Coach Invitation</h2>
          <p>Hello,</p>
          <p>You have been invited to join <strong>PUSO Spaze</strong> as a Coach.</p>
          <div style="background:#E5DAF0;border-radius:12px;padding:20px;text-align:center;margin:24px 0">
            <p style="margin:0 0 16px;color:#6A4D75;font-size:13px">Click the button below to get started:</p>
            <a href="https://puso-spaze.org/signup?code=${record.code}" style="display:inline-block;background:#A60550;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Accept Invitation</a>
          </div>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:24px 0;border-radius:4px">
            <p style="margin:0;color:#92400e;font-size:14px"><strong>Note:</strong> If the button doesn't work, you can manually enter this code in the app:</p>
            <p style="margin:8px 0 0;font-size:24px;font-weight:900;letter-spacing:4px;color:#A60550;text-align:center">${record.code}</p>
          </div>
          <p style="color:#7E638E;font-size:12px">This invitation can only be used once.</p>
          <hr style="border:none;border-top:1px solid #D8CCE8">
          <p style="color:#7E638E;font-size:12px">— The PUSO Spaze Team</p>
        </div>
      `,
    });

    res.status(201).json({ code: record.code, email });
  } catch (err) {
    console.error('[AdminController] sendInviteCodeByEmail error:', err);
    res.status(500).json({ error: 'Failed to generate or send invite code.' });
  }
}

/**
 * POST /api/admin/posts/:postId/pin
 * Header: Authorization: Bearer <ADMIN_SECRET>
 * 
 * Pins a post to the top of the feed.
 * Returns: { post }
 */
export async function pinPost(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId } = req.body as { userId?: string };

  if (!(await verifyAdmin(userId ?? ''))) {
    res.status(403).json({ error: 'Access denied. Admin account required.' });
    return;
  }

  try {
    // ── Check if post exists ─────────────────
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    // ── Pin the post ─────────────────────────
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { pinned: true },
      include: {
        user: { select: { displayName: true, role: true, avatarUrl: true } },
      },
    });

    res.json({
      post: {
        id: updatedPost.id,
        content: updatedPost.content,
        userId: updatedPost.userId,
        user: updatedPost.user,
        createdAt: updatedPost.createdAt.toISOString(),
        moderationStatus: updatedPost.moderationStatus,
        tags: updatedPost.tags,
        pinned: updatedPost.pinned,
      },
    });
  } catch (err) {
    console.error('[AdminController] pinPost error:', err);
    res.status(500).json({ error: 'Failed to pin post.' });
  }
}

/**
 * POST /api/admin/posts/:postId/unpin
 * Header: Authorization: Bearer <ADMIN_SECRET>
 * 
 * Unpins a post.
 * Returns: { post }
 */
export async function unpinPost(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId } = req.body as { userId?: string };

  if (!(await verifyAdmin(userId ?? ''))) {
    res.status(403).json({ error: 'Access denied. Admin account required.' });
    return;
  }

  try {
    // ── Check if post exists ─────────────────
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    // ── Unpin the post ───────────────────────
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { pinned: false },
      include: {
        user: { select: { displayName: true, role: true, avatarUrl: true } },
      },
    });

    res.json({
      post: {
        id: updatedPost.id,
        content: updatedPost.content,
        userId: updatedPost.userId,
        user: updatedPost.user,
        createdAt: updatedPost.createdAt.toISOString(),
        moderationStatus: updatedPost.moderationStatus,
        tags: updatedPost.tags,
        pinned: updatedPost.pinned,
      },
    });
  } catch (err) {
    console.error('[AdminController] unpinPost error:', err);
    res.status(500).json({ error: 'Failed to unpin post.' });
  }
}

/**
 * POST /api/admin/users/:userId/reset-device
 * Header: Authorization: Bearer <ADMIN_SECRET>
 *
 * Clears a user's deviceId binding so they can log in from any device.
 * Used for account recovery when a user has lost access (cleared cache, no PIN).
 * Returns: { success: true, displayName }
 */
export async function resetUserDevice(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deviceId: null },
    });

    console.log(`[AdminController] Device binding reset for user "${user.displayName}" (${userId})`);
    res.json({ success: true, displayName: user.displayName });
  } catch (err) {
    console.error('[AdminController] resetUserDevice error:', err);
    res.status(500).json({ error: 'Failed to reset device binding.' });
  }
}

// ─────────────────────────────────────────────
// JWT-authenticated admin endpoints
// These use req.user from requireAuth middleware
// instead of the ADMIN_SECRET header.
// ─────────────────────────────────────────────

/**
 * POST /api/admin/my/invite-codes
 * JWT Auth — requires ADMIN role
 * Body: { count?: number }
 */
export async function generateInviteCodeJwt(req: Request, res: Response): Promise<void> {
  if (!(await verifyAdmin(req.user?.userId ?? ''))) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  return generateInviteCodes(req, res);
}

/**
 * GET /api/admin/my/invite-codes
 * JWT Auth — requires ADMIN role
 */
export async function listInviteCodesJwt(req: Request, res: Response): Promise<void> {
  if (!(await verifyAdmin(req.user?.userId ?? ''))) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  return listInviteCodes(req, res);
}

/**
 * POST /api/admin/my/invite-codes/send-email
 * JWT Auth — requires ADMIN role
 * Body: { email: string }
 */
export async function sendInviteCodeByEmailJwt(req: Request, res: Response): Promise<void> {
  if (!(await verifyAdmin(req.user?.userId ?? ''))) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  return sendInviteCodeByEmail(req, res);
}
