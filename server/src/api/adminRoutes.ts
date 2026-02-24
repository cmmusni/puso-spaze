// ─────────────────────────────────────────────
// src/api/adminRoutes.ts
// Admin-only routes — protected by ADMIN_SECRET bearer token
// ─────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate';
import { generateInviteCodes, listInviteCodes, sendInviteCodeByEmail } from '../controllers/adminController';
import { env } from '../config/env';
import { triggerEncouragementNow } from '../services/encouragementScheduler';

const router = Router();

// ── Middleware: require ADMIN_SECRET ──────────
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== env.ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  next();
}

// GET  /api/admin/invite-codes
router.get('/invite-codes', requireAdmin, listInviteCodes);

// POST /api/admin/invite-codes
router.post(
  '/invite-codes',
  requireAdmin,
  [body('count').optional().isInt({ min: 1, max: 20 }), validate],
  generateInviteCodes
);

// POST /api/admin/invite-codes/send-email
router.post(
  '/invite-codes/send-email',
  requireAdmin,
  [
    body('email').isEmail().withMessage('A valid email address is required.'),
    validate,
  ],
  sendInviteCodeByEmail
);

// POST /api/admin/encouragement/trigger
// Manually trigger an encouragement post (for testing)
router.post('/encouragement/trigger', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await triggerEncouragementNow();
    res.json({ success: true, message: 'Encouragement post created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create encouragement post' });
  }
});

export default router;
