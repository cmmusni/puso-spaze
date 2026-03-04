// ─────────────────────────────────────────────
// src/api/userRoutes.ts
// POST /api/users
// PATCH /api/users/:userId/username
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { createUser, getUserById, searchUsers, updateUsername } from '../controllers/userController';
import { validate } from '../middlewares/validate';

const router = Router();

router.get(
  '/search',
  [
    query('q')
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage('q must be 1–30 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('limit must be between 1 and 10'),
    validate,
  ],
  searchUsers
);

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

router.get(
  '/:userId',
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getUserById
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
