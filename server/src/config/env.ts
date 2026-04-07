// ─────────────────────────────────────────────
// src/config/env.ts
// Environment variable loader + validation
// ─────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalBoolean(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (typeof value === 'undefined') return fallback;
  return value.toLowerCase() === 'true';
}

export const env = {
  PORT: parseInt(optional('PORT', '4000'), 10),
  NODE_ENV: optional('NODE_ENV', 'development'),
  DATABASE_URL: required('DATABASE_URL'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY', ''),
  /** Secret used to protect the invite-code generation endpoint */
  ADMIN_SECRET: optional('ADMIN_SECRET', 'pusocoach_admin_2026'),
  ALLOWED_ORIGINS: optional(
    'ALLOWED_ORIGINS',
    'https://api.puso-spaze.org,https://puso-spaze.org,https://www.puso-spaze.org'
  )
    .split(',')
    .map((s) => s.trim()),
  // ── Email (Resend) ──────────────────────────────────────────────────
  /** Resend API key for transactional emails */
  RESEND_API_KEY: optional('RESEND_API_KEY', ''),
  HOURLY_HOPE_AUTO_COMMENT_ENABLED: optionalBoolean('HOURLY_HOPE_AUTO_COMMENT_ENABLED', true),
  /** Comma-separated list of emails that receive new user signup alerts */
  NEW_USER_ALERT_TO: optional('NEW_USER_ALERT_TO', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Sender used for new-user alert emails */
  NEW_USER_ALERT_FROM: optional('NEW_USER_ALERT_FROM', 'PUSO Spaze <noreply@puso-spaze.org>'),
} as const;
