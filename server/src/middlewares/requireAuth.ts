// ─────────────────────────────────────────────
// src/middlewares/requireAuth.ts
// JWT authentication middleware
// Verifies the Bearer token and attaches req.user
// Also tracks user activity (lastActiveAt) with
// a 1-minute throttle to avoid excessive DB writes.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../config/db';

// Extend Express Request to include user from JWT
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Activity tracking (throttled per user) ────
// Only write to DB if last update was >1 minute ago
const ACTIVITY_THROTTLE_MS = 60_000;
const lastActivityMap = new Map<string, number>();

function trackActivity(userId: string): void {
  const now = Date.now();
  const last = lastActivityMap.get(userId) ?? 0;
  if (now - last < ACTIVITY_THROTTLE_MS) return;

  lastActivityMap.set(userId, now);

  // Fire-and-forget — never block the request
  prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } })
    .catch(() => {});
}

/**
 * Middleware that requires a valid JWT in the Authorization header.
 * Sets req.user = { userId, role } on success.
 * Returns 401 if token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.user = payload;

  // Track user activity for online count
  trackActivity(payload.userId);

  next();
}
