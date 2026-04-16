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

export const env = {
  PORT: parseInt(optional('PORT', '4000'), 10),
  NODE_ENV: optional('NODE_ENV', 'development'),
  DATABASE_URL: required('DATABASE_URL'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY', ''),
  /** Secret used to protect the invite-code generation endpoint */
  ADMIN_SECRET: optional('ADMIN_SECRET', 'pusocoach_admin_2026'),
  /** Secret used to sign JWT auth tokens — MUST be set in production */
  JWT_SECRET: optional('JWT_SECRET', 'puso_jwt_dev_secret_change_me'),
  ALLOWED_ORIGINS: optional(
    'ALLOWED_ORIGINS',
    'https://api.puso-spaze.org,https://puso-spaze.org,https://www.puso-spaze.org'
  )
    .split(',')
    .map((s) => s.trim()),
  // ── Email (Resend) ──────────────────────────────────────────────────
  /** Resend API key for transactional emails */
  RESEND_API_KEY: optional('RESEND_API_KEY', ''),
  /** Comma-separated list of emails that receive new user signup alerts */
  NEW_USER_ALERT_TO: optional('NEW_USER_ALERT_TO', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Sender used for new-user alert emails */
  NEW_USER_ALERT_FROM: optional('NEW_USER_ALERT_FROM', 'PUSO Spaze <noreply@puso-spaze.org>'),
  // ── Web Push (VAPID) ──────────────────────────────────────────────
  /** VAPID public key for Web Push API — generate with: npx web-push generate-vapid-keys */
  VAPID_PUBLIC_KEY: optional('VAPID_PUBLIC_KEY', ''),
  /** VAPID private key for Web Push API */
  VAPID_PRIVATE_KEY: optional('VAPID_PRIVATE_KEY', ''),
  /** VAPID subject (mailto: or https: URL) */
  VAPID_SUBJECT: optional('VAPID_SUBJECT', 'mailto:admin@puso-spaze.org'),
  // ── Cloudinary (persistent image storage) ─────────────────────────
  /** Cloudinary cloud name — get from cloudinary.com dashboard */
  CLOUDINARY_CLOUD_NAME: optional('CLOUDINARY_CLOUD_NAME', ''),
  /** Cloudinary API key */
  CLOUDINARY_API_KEY: optional('CLOUDINARY_API_KEY', ''),
  /** Cloudinary API secret */
  CLOUDINARY_API_SECRET: optional('CLOUDINARY_API_SECRET', ''),
} as const;

// ── Startup security warnings ────────────────
// QUALITY.md Scenario 6: Loudly warn if the admin secret is the hardcoded default
if (!process.env.ADMIN_SECRET) {
  console.warn(
    '⚠️  [SECURITY] ADMIN_SECRET is using the hardcoded default. ' +
    'Set the ADMIN_SECRET environment variable in production!'
  );
}
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    '⚠️  [SECURITY] OPENAI_API_KEY is not set — all content that passes the ' +
    'local keyword filter will default to REVIEW status.'
  );
}
if (!process.env.JWT_SECRET) {
  console.warn(
    '⚠️  [SECURITY] JWT_SECRET is using the hardcoded default. ' +
    'Set the JWT_SECRET environment variable in production!'
  );
}
