// ─────────────────────────────────────────────
// src/api/adminRoutes.ts
// Admin-only routes — protected by ADMIN_SECRET bearer token
// ─────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate';
import {
  generateInviteCodes,
  listInviteCodes,
  sendInviteCodeByEmail,
  pinPost,
  unpinPost,
  resetUserDevice,
  generateInviteCodeJwt,
  listInviteCodesJwt,
  sendInviteCodeByEmailJwt,
} from '../controllers/adminController';
import { requireAuth } from '../middlewares/requireAuth';
import { env } from '../config/env';

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

// POST /api/admin/posts/:postId/pin
router.post(
  '/posts/:postId/pin',
  [body('userId').isString().notEmpty().withMessage('userId is required.'), validate],
  pinPost
);

// POST /api/admin/posts/:postId/unpin
router.post(
  '/posts/:postId/unpin',
  [body('userId').isString().notEmpty().withMessage('userId is required.'), validate],
  unpinPost
);

// POST /api/admin/users/:userId/reset-device
router.post(
  '/users/:userId/reset-device',
  requireAdmin,
  resetUserDevice
);

// ── JWT-authenticated admin routes ───────────
// These allow the in-app admin user (role ADMIN) to manage invites
// without needing the ADMIN_SECRET.

// GET  /api/admin/my/invite-codes
router.get('/my/invite-codes', requireAuth, listInviteCodesJwt);

// POST /api/admin/my/invite-codes
router.post(
  '/my/invite-codes',
  requireAuth,
  [body('count').optional().isInt({ min: 1, max: 20 }), validate],
  generateInviteCodeJwt
);

// POST /api/admin/my/invite-codes/send-email
router.post(
  '/my/invite-codes/send-email',
  requireAuth,
  [
    body('email').isEmail().withMessage('A valid email address is required.'),
    validate,
  ],
  sendInviteCodeByEmailJwt
);

export default router;
