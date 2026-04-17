// ─────────────────────────────────────────────
// src/controllers/userController.ts
// Business logic for POST /api/users
// Creates a user if they don't exist (upsert by displayName is naive;
// production should use device ID or JWT for idempotency)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { uploadBuffer } from '../config/cloudinary';
import { signToken } from '../utils/jwt';

/** Username that auto-assigns ADMIN role on creation */
export const ADMIN_USERNAME = 'admin';

/** Usernames that cannot be registered by anyone */
export const RESERVED_USERNAMES = [
  // Brand & app identity
  'spaze-admin',
  'admin',
  'puso',
  'puso-spaze',
  'pusospaze',
  'puso_spaze',
  'spaze',

  // Roles & staff
  'coach',
  'moderator',
  'administrator',
  'mod',
  'staff',
  'team',

  // System & technical
  'system',
  'support',
  'bot',
  'chatbot',
  'ai',
  'assistant',
  'api',
  'server',
  'root',
  'null',
  'undefined',
  'anonymous',
  'unknown',
  'deleted',
  'everyone',
  'test',
  'demo',
  'debug',
  'user',
  'account',

  // Trust & authority impersonation prevention
  'official',
  'verified',
  'help',
  'info',
  'contact',
  'developer',
  'dev',
  'founder',
  'owner',
  'ceo',

  // App route / screen names (prevent confusion)
  'login',
  'signup',
  'register',
  'settings',
  'profile',
  'home',
  'notifications',
  'messages',
  'journal',
  'chat',
  'recovery',
  'invite',

  // Faith-based impersonation prevention
  'god',
  'jesus',
  'jesus-christ',
  'christ',
  'holyspirit',
  'holy-spirit',
  'bible',
  'pastor',
  'priest',
  'reverend',

  // Feature names
  'hourly-hope',
  'daily-reflection',
  'encouragement',
  'community',
  'hope',
];

/** Check if a displayName is reserved (case-insensitive) */
export function isReservedUsername(name: string): boolean {
  return RESERVED_USERNAMES.some((r) => r.toLowerCase() === name.toLowerCase());
}

/** Check if a displayName is the admin username (case-insensitive) */
export function isAdminUsername(name: string): boolean {
  return name.toLowerCase() === ADMIN_USERNAME.toLowerCase();
}

/**
 * Generate a unique 6-digit PIN code.
 * Retries up to 10 times if a collision occurs.
 */
async function generateUniquePin(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const pin = String(crypto.randomInt(100000, 999999));
    const existing = await prisma.user.findUnique({ where: { pin }, select: { id: true } });
    if (!existing) return pin;
  }
  // Fallback: 8-digit PIN for extreme collision edge case
  return String(crypto.randomInt(10000000, 99999999));
}

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
  const { displayName, deviceId, platform, pin: loginPin } = req.body as { displayName: string; deviceId?: string; platform?: string; pin?: string };
  const isWeb = platform === 'web';

  try {
    const existingUser = await prisma.user.findFirst({
      where: { displayName: { equals: displayName, mode: 'insensitive' } },
      select: { id: true, deviceId: true, pin: true, role: true, displayName: true },
    });

    // ── Username exists: verify device ownership ──
    if (existingUser) {
      // QUALITY.md Scenario 5: If the existing user has a deviceId,
      // the request MUST also provide one — otherwise anyone can
      // claim the username by simply omitting deviceId.
      // Exception: web clients legitimately have no persistent device ID,
      // so we allow them through (weaker auth is accepted on web).
      if (existingUser.deviceId && !deviceId && !isWeb) {
        // No deviceId provided — check if PIN was given for cross-device login
        if (loginPin && existingUser.pin && loginPin === existingUser.pin) {
          // PIN matches — allow cross-device login and bind new device
        } else {
          res.status(409).json({ error: 'Username is already taken.' });
          return;
        }
      }
      if (existingUser.deviceId && deviceId && existingUser.deviceId !== deviceId) {
        // Different device — check if PIN was given for cross-device login
        if (loginPin && existingUser.pin && loginPin === existingUser.pin) {
          // PIN matches — allow cross-device login and bind new device
        } else {
          res.status(409).json({ error: 'Username is already taken.' });
          return;
        }
      }

      // Same device, PIN-verified, or legacy user without deviceId — allow login
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          lastActiveAt: new Date(),
          // Update deviceId when logging in from a new device via PIN
          ...(deviceId ? { deviceId } : {}),
          // Backfill PIN for users created before the PIN feature
          ...(!existingUser.pin ? { pin: await generateUniquePin() } : {}),
        },
      });

      res.status(200).json({
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        pin: user.pin,
        token: signToken({ userId: user.id, role: user.role }),
      });
      return;
    }

    // ── Block reserved usernames for new registrations ──
    if (isReservedUsername(displayName) && !isAdminUsername(displayName)) {
      res.status(403).json({ error: 'This username is reserved and unavailable.' });
      return;
    }

    // ── New user: create with deviceId and generate PIN ──
    const pin = await generateUniquePin();
    const user = await prisma.user.create({
      data: {
        displayName,
        pin,
        ...(deviceId ? { deviceId } : {}),
        ...(isAdminUsername(displayName) ? { role: 'ADMIN' } : {}),
      },
    });

    res.status(201).json({
      userId: user.id,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      pin: user.pin,
      token: signToken({ userId: user.id, role: user.role }),
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
        avatarUrl: true,
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

  // BUG-004 fix: Verify JWT userId matches the URL param to prevent IDOR
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only update your own username.' });
    return;
  }

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

  // BUG-005 fix: Verify JWT userId matches the URL param to prevent IDOR
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only change your own anonymous mode.' });
    return;
  }

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

  // IDOR fix: Verify JWT userId matches the URL param
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only change your own notification settings.' });
    return;
  }

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

  // IDOR fix: Verify JWT userId matches the URL param
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only update your own avatar.' });
    return;
  }

  const imageFile = (req as any).file as Express.Multer.File | undefined;

  if (!imageFile) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }

  try {
    const avatarUrl = await uploadBuffer(imageFile.buffer, 'puso-spaze/avatars');
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

/**
 * GET /api/users/:userId/pin
 * Returns the user's current PIN code.
 */
export async function getPin(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  // BUG-002 fix: Verify JWT userId matches the URL param to prevent IDOR
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only view your own PIN.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pin: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ pin: user.pin });
  } catch (err) {
    console.error('[UserController] getPin error:', err);
    res.status(500).json({ error: 'Failed to get PIN.' });
  }
}

/**
 * PATCH /api/users/:userId/pin
 * Body: { pin: string } — 6-digit numeric PIN
 * Updates the user's PIN code. Must be unique across all users.
 */
// ── POST /api/users/:userId/record-visit ──────
/**
 * Records that the user visited the HomeScreen today.
 * If they visited yesterday, streak increments. If they missed a day, streak resets to 1.
 * If already visited today, returns the current streak unchanged.
 */
export async function recordVisit(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only record your own visit.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, streakCount: true, lastStreakDate: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const lastDate = user.lastStreakDate;
  let newStreak: number;

  if (lastDate) {
    const lastMidnight = new Date(lastDate);
    lastMidnight.setUTCHours(0, 0, 0, 0);
    const diffMs = todayMidnight.getTime() - lastMidnight.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
      // Already visited today — no change
      res.json({ streak: user.streakCount });
      return;
    } else if (diffDays === 1) {
      // Visited yesterday — continue streak
      newStreak = user.streakCount + 1;
    } else {
      // Missed a day — reset streak
      newStreak = 1;
    }
  } else {
    // First ever visit
    newStreak = 1;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { streakCount: newStreak, lastStreakDate: todayMidnight, lastActiveAt: new Date() },
    select: { streakCount: true },
  });

  res.json({ streak: updated.streakCount });
}

// ── GET /api/users/:userId/stats ──────────────
export async function getUserStats(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, streakCount: true, lastStreakDate: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const [reactionsGiven, commentsGiven, postCount, journalCount] = await Promise.all([
    prisma.reaction.count({
      where: {
        userId,
        post: { userId: { not: userId } },
      },
    }),
    prisma.comment.count({
      where: {
        userId,
        moderationStatus: 'SAFE',
        post: { userId: { not: userId } },
      },
    }),
    prisma.post.count({
      where: { userId, moderationStatus: 'SAFE' },
    }),
    prisma.journal.count({
      where: { userId },
    }),
  ]);

  const encouragementsGiven = reactionsGiven + commentsGiven;

  // Streak: use stored value, but check if it's still valid (not expired)
  let streak = user.streakCount;
  if (user.lastStreakDate) {
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const lastMidnight = new Date(user.lastStreakDate);
    lastMidnight.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round((todayMidnight.getTime() - lastMidnight.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > 1) {
      // Streak has expired — reset it
      streak = 0;
      await prisma.user.update({
        where: { id: userId },
        data: { streakCount: 0 },
      });
    }
  }

  const totalReflections = postCount + journalCount;

  res.json({ encouragementsGiven, totalReflections, streak });
}

export async function updatePin(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { pin } = req.body as { pin: string };

  // BUG-003 fix: Verify JWT userId matches the URL param to prevent IDOR
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only change your own PIN.' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { pin },
      select: { id: true, pin: true },
    });
    res.json({ success: true, pin: user.pin });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found.' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'This PIN is already in use. Please choose a different one.' });
    } else {
      console.error('[UserController] updatePin error:', err);
      res.status(500).json({ error: 'Failed to update PIN.' });
    }
  }
}
