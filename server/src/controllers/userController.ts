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
 * GET /api/users/check?username=<name>
 * Returns { available: boolean } — exact case-insensitive match.
 * Lightweight endpoint used by the login screen to pre-validate
 * a generated anonymous username before showing it to the user.
 */
export async function checkUsername(req: Request, res: Response): Promise<void> {
  const username = String(req.query.username ?? '').trim();
  if (!username) {
    res.status(400).json({ error: 'username query param is required.' });
    return;
  }
  try {
    const existing = await prisma.user.findFirst({
      where: { displayName: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });
    res.json({ available: !existing });
  } catch (err) {
    console.error('[UserController] checkUsername error:', err);
    res.status(500).json({ error: 'Failed to check username.' });
  }
}

/**
 * POST /api/users
 * Body: { displayName: string, deviceId?: string }
 * Returns: { userId, displayName, role }
 * 
 * Creates a user if they don't exist (default role: USER).
 * If user already exists, validates deviceId ownership before returning.
 * 
 * ⭐ COACHES: After signing out, can log back in with their username
 *    (no need for a new invite code). Their COACH role is retained.
 */
export async function createUser(req: Request, res: Response): Promise<void> {
  const { displayName, deviceId } = req.body as { displayName: string; deviceId?: string };

  try {
    const existingUser = await prisma.user.findUnique({
      where: { displayName },
      select: { id: true, deviceId: true, role: true, displayName: true },
    });

    // ── Username exists: verify device ownership ──
    if (existingUser) {
      // QUALITY.md Scenario 5: If the existing user has a deviceId,
      // the request MUST also provide one — otherwise anyone can
      // claim the username by simply omitting deviceId.
      if (existingUser.deviceId && !deviceId) {
        res.status(409).json({ error: 'Username is already taken.' });
        return;
      }
      if (existingUser.deviceId && deviceId && existingUser.deviceId !== deviceId) {
        res.status(409).json({ error: 'Username is already taken.' });
        return;
      }

      // Same device or legacy user without deviceId — allow login
      const user = await prisma.user.update({
        where: { displayName },
        data: {
          lastActiveAt: new Date(),
          // Back-fill deviceId for legacy users on first login with a device
          ...(deviceId && !existingUser.deviceId ? { deviceId } : {}),
        },
      });

      res.status(200).json({
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
      });
      return;
    }

    // ── New user: create with deviceId ──
    const user = await prisma.user.create({
      data: { displayName, ...(deviceId ? { deviceId } : {}) },
    });

    const context = extractNewUserAlertContext(req);
    context.source = 'users.create';

    void sendNewUserAlertEmail({
      userId: user.id,
      displayName: user.displayName,
      role: user.role,
      context,
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
        isAnonymous: true,
        notificationsEnabled: true,
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

/**
 * PATCH /api/users/:userId/anonymous
 * Body: { isAnonymous: boolean }
 * Toggles anonymous mode for the user.
 */
export async function toggleAnonymous(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { isAnonymous } = req.body as { isAnonymous: boolean };

  if (typeof isAnonymous !== 'boolean') {
    res.status(400).json({ error: 'isAnonymous must be a boolean.' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isAnonymous },
      select: { id: true, isAnonymous: true },
    });
    res.json({ success: true, isAnonymous: user.isAnonymous });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found.' });
    } else {
      console.error('[UserController] toggleAnonymous error:', err);
      res.status(500).json({ error: 'Failed to update anonymous mode.' });
    }
  }
}

/**
 * PATCH /api/users/:userId/notifications
 * Body: { enabled: boolean }
 * Toggles daily reflection reminder notifications for the user.
 */
export async function toggleNotifications(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { enabled } = req.body as { enabled: boolean };

  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean.' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { notificationsEnabled: enabled },
      select: { id: true, notificationsEnabled: true },
    });
    res.json({ success: true, notificationsEnabled: user.notificationsEnabled });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found.' });
    } else {
      console.error('[UserController] toggleNotifications error:', err);
      res.status(500).json({ error: 'Failed to update notification preference.' });
    }
  }
}

/**
 * POST /api/users/:userId/avatar
 * Uploads a profile avatar image via multipart form data.
 * Returns: { avatarUrl: string }
 */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const imageFile = (req as any).file as Express.Multer.File | undefined;

  if (!imageFile) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }

  try {
    const avatarUrl = `/uploads/${imageFile.filename}`;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });

    res.json({ avatarUrl: user.avatarUrl });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found.' });
    } else {
      console.error('[UserController] uploadAvatar error:', err);
      res.status(500).json({ error: 'Failed to upload avatar.' });
    }
  }
}
