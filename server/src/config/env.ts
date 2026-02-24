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
  ALLOWED_ORIGINS: optional(
    'ALLOWED_ORIGINS',
    'http://localhost:8081,http://localhost:19006'
  )
    .split(',')
    .map((s) => s.trim()),
  // ── Email / SMTP ────────────────────────────────────────────────────
  /** SMTP host, e.g. smtp.gmail.com or smtp.mailtrap.io */
  SMTP_HOST: optional('SMTP_HOST', 'smtp.gmail.com'),
  /** SMTP port — 587 (STARTTLS) is the common default */
  SMTP_PORT: parseInt(optional('SMTP_PORT', '587'), 10),
  /** Whether to use TLS on the initial connection (port 465) */
  SMTP_SECURE: optional('SMTP_SECURE', 'false') === 'true',
  SMTP_USER: optional('SMTP_USER', 'cliffordmarkmusni@gmail.com'),
  SMTP_PASS: optional('SMTP_PASS', 'bmcc hkhp kjku bnnl'),
  /** From address shown in the sent email */
  SMTP_FROM: optional('SMTP_FROM', 'PUSO Spaze <no-reply@puso-spaze.app>'),
} as const;
