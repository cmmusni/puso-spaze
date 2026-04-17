// ─────────────────────────────────────────────
// src/index.ts — PUSO Spaze Server Entry Point
// Express app setup + route registration
// ─────────────────────────────────────────────

import path from 'path';
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
import notificationRoutes from './api/notificationRoutes';
import journalRoutes from './api/journalRoutes';
import conversationRoutes from './api/conversationRoutes';
import recoveryRoutes from './api/recoveryRoutes';
import { startReflectionReminderScheduler } from './services/reflectionReminderScheduler';
import { startStreakReminderScheduler } from './services/streakReminderScheduler';
import { startPendingChatReminderScheduler } from './services/pendingChatReminderScheduler';
import { getDailyReflection, getPersonalisedDailyReflection } from './services/dailyReflectionService';
import { deepStripNullBytes, stripNullBytes } from './utils/sanitize';

// ── App ───────────────────────────────────────
const app = express();

// ── Global Middleware ─────────────────────────
app.use(logger);

app.use(
  cors({
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// BUG-001 fix: Strip null bytes from all request bodies, query params,
// and URL params globally. PostgreSQL text columns cannot store \u0000.
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = deepStripNullBytes(req.body);
  }
  // Also strip from query string values
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = stripNullBytes(val);
      }
    }
  }
  next();
});

// BUG-007 fix: Reject excessively nested JSON payloads.
// Deeply nested objects (20+ levels) can cause stack overflows or
// unhandled errors in route handlers. Limit nesting to 10 levels.
function getJsonDepth(value: unknown, current = 0): number {
  if (current > 10) return current;
  if (Array.isArray(value)) {
    let max = current;
    for (const item of value) {
      max = Math.max(max, getJsonDepth(item, current + 1));
      if (max > 10) return max;
    }
    return max;
  }
  if (value !== null && typeof value === 'object') {
    let max = current;
    for (const v of Object.values(value)) {
      max = Math.max(max, getJsonDepth(v, current + 1));
      if (max > 10) return max;
    }
    return max;
  }
  return current;
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && getJsonDepth(req.body) > 10) {
    res.status(400).json({ error: 'Request body is too deeply nested.' });
    return;
  }
  next();
});

// ── Serve uploaded images with security headers ──
// QUALITY.md Scenario 8: Prevent uploaded files from executing scripts
app.use('/uploads', (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// ── Health check ──────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Online user count (public, no auth) ───────
app.get('/api/stats/online', async (_req, res) => {
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const count = await prisma.user.count({
      where: { lastActiveAt: { gte: fifteenMinAgo } },
    });
    res.json({ online: count });
  } catch {
    res.json({ online: 0 });
  }
});

app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24*60*60*1000);
    const m15 = new Date(now.getTime() - 15*60*1000);
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    // Fetch recent user posts (last 7 days, up to 5) if userId is provided
    const recentUserPosts = userId
      ? await prisma.post.findMany({
          where: {
            userId,
            moderationStatus: 'SAFE',
            createdAt: { gte: new Date(now.getTime() - 7*24*60*60*1000) },
          },
          select: { content: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [];

    const [totalMembers,dailyStories,onlineCount,trendingTags,reflectionContent] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { createdAt: { gte: h24 }, moderationStatus: 'SAFE' } }),
      prisma.user.count({ where: { lastActiveAt: { gte: m15 } } }),
      prisma.post.findMany({
        where: { moderationStatus: 'SAFE', tags: { isEmpty: false } },
        select: { tags: true }, orderBy: { createdAt: 'desc' }, take: 50,
      }).then((posts) => {
        const tc: Record<string,number> = {};
        for (const p of posts) for (const t of p.tags) tc[t]=(tc[t]||0)+1;
        return Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t,c])=>({ tag: t, count: c }));
      }),
      recentUserPosts.length > 0 && userId
        ? getPersonalisedDailyReflection(userId, recentUserPosts.map(p => p.content))
        : getDailyReflection(),
    ]);
    const dailyReflection = reflectionContent
      ? { id: 'daily-reflection', content: reflectionContent, createdAt: new Date().toISOString() }
      : null;
    res.json({ totalMembers, dailyStories, onlineCount, trendingTags, dailyReflection });
  } catch {
    res.json({ totalMembers:0, dailyStories:0, onlineCount:0, trendingTags:[], dailyReflection:null });
  }
});

// ── API Routes ────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/recovery-requests', recoveryRoutes);

// ── 404 handler ───────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ──────────────────────
app.use(
  (
    err: Error & { type?: string; status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Catch body-parser errors (malformed JSON, payload too large, etc.)
    // body-parser always sets err.status to 400 or 413 for client errors.
    if (err.status && err.status >= 400 && err.status < 500) {
      res.status(err.status).json({ error: err.message || 'Bad request.' });
      return;
    }
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

  // Start the daily reflection reminder scheduler
  startReflectionReminderScheduler();

  // Start the streak reminder scheduler (3h before midnight PHT)
  startStreakReminderScheduler();

  // Start the pending chat reminder scheduler (every 15 min)
  startPendingChatReminderScheduler();

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
