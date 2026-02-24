// ─────────────────────────────────────────────
// src/controllers/userController.ts
// Business logic for POST /api/users
// Creates a user if they don't exist (upsert by displayName is naive;
// production should use device ID or JWT for idempotency)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';

/**
 * POST /api/users
 * Body: { displayName: string }
 * Returns: { userId, displayName, role }
 * 
 * Creates a user if they don't exist (default role: USER).
 * If user already exists, returns them with their existing role preserved.
 * 
 * ⭐ COACHES: After signing out, can log back in with their username
 *    (no need for a new invite code). Their COACH role is retained.
 */
export async function createUser(req: Request, res: Response): Promise<void> {
  const { displayName } = req.body as { displayName: string };

  try {
    const user = await prisma.user.upsert({
      where: { displayName },
      update: {},  // Preserve existing role (including COACH/ADMIN)
      create: { displayName },  // New users default to USER role
    });

    res.status(201).json({
      userId: user.id,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (err) {
    console.error('[UserController] createUser error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
}

/**
 * PATCH /api/users/:userId/username
 * Body: { displayName: string }
 * Returns: { success: boolean }
 * Updates the user's display name.
 */
export async function updateUsername(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { displayName } = req.body as { displayName: string };

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { displayName },
    });

    res.status(200).json({
      success: true,
      userId: updatedUser.id,
      displayName: updatedUser.displayName,
    });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found.' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'Username already taken.' });
    } else {
      console.error('[UserController] updateUsername error:', err);
      res.status(500).json({ error: 'Failed to update username.' });
    }
  }
}
