// ─────────────────────────────────────────────
// src/api/authRoutes.ts
// POST /api/auth/redeem-invite — coach sign-up
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate';
import { redeemInvite, getInviteEmail, pinLogin } from '../controllers/authController';

const router = Router();

// Look up email associated with an invite code (for prefilling the coach signup form)
router.get('/invite-email', getInviteEmail);

// ── POST /api/auth/pin-login ────────────────
router.post(
  '/pin-login',
  [
    body('pin')
      .trim()
      .matches(/^\d{6,8}$/)
      .withMessage('pin must be a 6–8 digit code'),
    body('deviceId')
      .optional()
      .isUUID()
      .withMessage('deviceId must be a valid UUID'),
    validate,
  ],
  pinLogin
);

router.post(
  '/redeem-invite',
  [
    body('displayName')
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage('displayName must be 2–30 characters')
      .matches(/^[a-zA-Z0-9 _-]+$/)
      .withMessage('displayName contains invalid characters'),
    body('code')
      .trim()
      .isLength({ min: 11, max: 11 })
      .withMessage('code must be in format XXXXX-XXXXX'),
    body('deviceId')
      .optional()
      .isUUID()
      .withMessage('deviceId must be a valid UUID'),
    validate,
  ],
  redeemInvite
);

export default router;
