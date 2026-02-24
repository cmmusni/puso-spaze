// ─────────────────────────────────────────────
// src/middlewares/logger.ts
// HTTP request logger using Morgan
// ─────────────────────────────────────────────

import morgan from 'morgan';
import { env } from '../config/env';

// ── Dev: colorized concise output
// ── Production: combined Apache-style log
export const logger = morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev');
