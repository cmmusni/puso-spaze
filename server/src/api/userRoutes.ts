// ─────────────────────────────────────────────
// src/api/userRoutes.ts
// POST /api/users
// PATCH /api/users/:userId/username
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param } from 'express-validator';
import { createUser, updateUsername } from '../controllers/userController';
import { validate } from '../middlewares/validate';

const router = Router();

router.post(
  '/',
  [
    body('displayName')
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage('displayName must be 2–30 characters')
      .matches(/^[a-zA-Z0-9 _-]+$/)
      .withMessage('displayName contains invalid characters'),
    validate,
  ],
  createUser
);

router.patch(
  '/:userId/username',
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('displayName')
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage('displayName must be 2–30 characters')
      .matches(/^[a-zA-Z0-9 _-]+$/)
      .withMessage('displayName contains invalid characters'),
    validate,
  ],
  updateUsername
);

export default router;
