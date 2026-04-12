// ─────────────────────────────────────────────
// src/utils/jwt.ts
// JWT token signing and verification for user auth
// ─────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  role: string;
}

const TOKEN_EXPIRY = '7d';

/**
 * Sign a JWT token with userId and role.
 * Expires in 7 days by default.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & JwtPayload;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}
