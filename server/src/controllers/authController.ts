// ─────────────────────────────────────────────
// src/controllers/authController.ts
// POST /api/auth/redeem-invite — validate invite code, create COACH user
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';

/**
 * POST /api/auth/redeem-invite
 * Body: { displayName: string; code: string }
 *
 * Validates the invite code and creates (or promotes) the user as COACH.
 * Returns: { userId, displayName, role }
 */
export async function redeemInvite(req: Request, res: Response): Promise<void> {
  const { displayName, code } = req.body as { displayName: string; code: string };

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

    // 2. Upsert the user — keep existing role on re-login, default to COACH on first login
    const user = await prisma.user.upsert({
      where: { displayName },
      update: {},  // preserve any manually elevated role (e.g. ADMIN)
      create: { displayName, role: 'COACH' },
    });

    // 3. Mark the invite code as used
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
