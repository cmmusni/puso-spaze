// ─────────────────────────────────────────────
// src/controllers/userController.ts
// Business logic for POST /api/users
// Creates a user if they don't exist (upsert by displayName is naive;
// production should use device ID or JWT for idempotency)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { extractNewUserAlertContext, sendNewUserAlertEmail } from '../services/newUserAlertService';

function toMentionHandle(displayName: string): string {
  return displayName.trim().replace(/\s+/g, '_');
}

const EVERYONE_MENTION_HANDLE = 'everyone';

/**
 * GET /api/users/search?q=...&limit=...
 * Returns users for @mention autocomplete.
 */
export async function searchUsers(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim();
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 10)
    : 8;

  if (!q) {
    res.json({ users: [] });
    return;
  }

  try {
    const includeEveryone = EVERYONE_MENTION_HANDLE.startsWith(q.toLowerCase());
    const dbTake = includeEveryone ? Math.max(limit - 1, 0) : limit;

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { displayName: { startsWith: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' },
      take: dbTake,
    });

    const results = users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      mentionHandle: toMentionHandle(user.displayName),
    }));

    if (includeEveryone) {
      results.unshift({
        id: 'everyone',
        displayName: 'Everyone',
        role: 'USER',
        mentionHandle: EVERYONE_MENTION_HANDLE,
      });
    }

    res.json({
      users: results.slice(0, limit),
    });
  } catch (err) {
    console.error('[UserController] searchUsers error:', err);
    res.status(500).json({ error: 'Failed to search users.' });
  }
}

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
    const existingUser = await prisma.user.findUnique({
      where: { displayName },
      select: { id: true },
    });

    const user = await prisma.user.upsert({
      where: { displayName },
      update: {},  // Preserve existing role (including COACH/ADMIN)
      create: { displayName },  // New users default to USER role
    });

    if (!existingUser) {
      const context = extractNewUserAlertContext(req);
      context.source = 'users.create';

      void sendNewUserAlertEmail({
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        context,
      });
    }

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
 * GET /api/users/:userId
 * Returns: { user: { id, displayName, role, createdAt } }
 * Checks if a user exists by ID (useful for debugging).
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('[UserController] getUserById error:', err);
    res.status(500).json({ error: 'Failed to get user.' });
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
