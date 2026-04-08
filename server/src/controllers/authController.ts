// ─────────────────────────────────────────────
// src/controllers/authController.ts
// POST /api/auth/redeem-invite — validate invite code, create COACH user
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { extractNewUserAlertContext, sendNewUserAlertEmail } from '../services/newUserAlertService';

/**
 * POST /api/auth/redeem-invite
 * Body: { displayName: string; code: string; deviceId?: string }
 *
 * Validates the invite code and creates (or promotes) the user as COACH.
 * If the username is already owned by a different device, rejects with 409.
 * Returns: { userId, displayName, role }
 */
export async function redeemInvite(req: Request, res: Response): Promise<void> {
  const { displayName, code, deviceId } = req.body as { displayName: string; code: string; deviceId?: string };

  try {
    // 1. Find the invite code
    const invite = await prisma.inviteCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!invite) {
      res.status(400).json({ error: 'Invalid invite code.' });
      return;
    }

    if (invite.used) {
      res.status(400).json({ error: 'This invite code has already been used.' });
      return;
    }

    // 2. Check device ownership if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { displayName },
      select: { id: true, deviceId: true },
    });

    if (existingUser && existingUser.deviceId && deviceId && existingUser.deviceId !== deviceId) {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    // 3. Upsert the user — keep existing role on re-login, default to COACH on first login
    const user = await prisma.user.upsert({
      where: { displayName },
      update: {
        lastActiveAt: new Date(),
        ...(deviceId && !existingUser?.deviceId ? { deviceId } : {}),
      },
      create: { displayName, role: 'COACH', ...(deviceId ? { deviceId } : {}) },
    });

    if (!existingUser) {
      const context = extractNewUserAlertContext(req);
      context.source = 'auth.redeem-invite';

      void sendNewUserAlertEmail({
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        context,
      });
    }

    // 4. Mark the invite code as used
    await prisma.inviteCode.update({
      where: { code: code.toUpperCase() },
      data: { used: true, usedBy: user.id, usedAt: new Date() },
    });

    res.status(201).json({
      userId: user.id,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (err) {
    console.error('[AuthController] redeemInvite error:', err);
    res.status(500).json({ error: 'Failed to redeem invite code.' });
  }
}
