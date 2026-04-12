// ─────────────────────────────────────────────
// src/api/recoveryRoutes.ts
// Public recovery request endpoint (no auth — user is locked out)
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate';
import { submitRecoveryRequest } from '../controllers/recoveryController';

const router = Router();

// POST /api/recovery-requests — public, no auth required
router.post(
  '/',
  [
    body('displayName').isString().trim().isLength({ min: 2 }).withMessage('Username is required (min 2 chars).'),
    body('reason').isString().trim().isLength({ min: 5 }).withMessage('Please describe why (min 5 chars).'),
    validate,
  ],
  submitRecoveryRequest
);

export default router;
