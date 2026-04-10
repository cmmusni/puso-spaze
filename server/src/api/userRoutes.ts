// ─────────────────────────────────────────────
// src/api/userRoutes.ts
// POST /api/users
// PATCH /api/users/:userId/username
// ─────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { createUser, getUserById, searchUsers, updateUsername, toggleAnonymous, toggleNotifications, checkUsername, uploadAvatar } from '../controllers/userController';
import { validate } from '../middlewares/validate';

const router = Router();

// ── Multer config for avatar uploads ──────────
const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  },
});

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

router.get(
  '/check',
  [
    query('username')
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage('username must be 2–30 characters'),
    validate,
  ],
  checkUsername
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
    body('deviceId')
      .optional()
      .isUUID()
      .withMessage('deviceId must be a valid UUID'),
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

router.patch(
  '/:userId/anonymous',
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('isAnonymous').isBoolean().withMessage('isAnonymous must be a boolean'),
    validate,
  ],
  toggleAnonymous
);

router.patch(
  '/:userId/notifications',
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('enabled').isBoolean().withMessage('enabled must be a boolean'),
    validate,
  ],
  toggleNotifications
);

router.post(
  '/:userId/avatar',
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  (req: Request, res: Response, next: NextFunction) => {
    if (req.is('multipart/form-data')) {
      avatarUpload.single('image')(req, res, next);
    } else {
      res.status(400).json({ error: 'Content-Type must be multipart/form-data.' });
    }
  },
  uploadAvatar
);

export default router;
