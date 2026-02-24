// ─────────────────────────────────────────────
// src/index.ts — PUSO Spaze Server Entry Point
// Express app setup + route registration
// ─────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './middlewares/logger';
import { prisma } from './config/db';
import userRoutes from './api/userRoutes';
import postRoutes from './api/postRoutes';
import authRoutes from './api/authRoutes';
import adminRoutes from './api/adminRoutes';
import coachRoutes from './api/coachRoutes';

// ── App ───────────────────────────────────────
const app = express();

// ── Global Middleware ─────────────────────────
app.use(logger);

app.use(
  cors({
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coach', coachRoutes);

// ── 404 handler ───────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ──────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
);

// ── Start ─────────────────────────────────────
async function main() {
  // Verify DB connection on startup
  try {
    await prisma.$connect();
    console.log('[DB] Connected to Postgres');
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    process.exit(1);
  }

  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(
      `[Server] PUSO Spaze API running on http://localhost:${env.PORT}`
    );
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});

export default app;
