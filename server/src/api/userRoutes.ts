// ─────────────────────────────────────────────
// src/api/userRoutes.ts
// POST /api/users
// PATCH /api/users/:userId/username
// ─────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { createUser, getUserById, searchUsers, updateUsername, toggleAnonymous, toggleNotifications, checkUsername, uploadAvatar, uploadBanner, updateBio, getContacts, updateContacts, getPin, updatePin, getUserStats, recordVisit, updateSpecialties } from '../controllers/userController';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/requireAuth';
import { isValidImageBuffer } from '../utils/validateImageMagicBytes';

const router = Router();

// ── Multer config for avatar uploads (memory storage → Cloudinary) ──────
const avatarStorage = multer.memoryStorage();

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
    body('pin')
      .optional()
      .isString()
      .matches(/^\d{6,8}$/)
      .withMessage('PIN must be 6–8 digits'),
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
  requireAuth,
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
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('isAnonymous').isBoolean().withMessage('isAnonymous must be a boolean'),
    validate,
  ],
  toggleAnonymous
);

router.patch(
  '/:userId/notifications',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('enabled').isBoolean().withMessage('enabled must be a boolean'),
    validate,
  ],
  toggleNotifications
);

router.post(
  '/:userId/avatar',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  (req: Request, res: Response, next: NextFunction) => {
    if (req.is('multipart/form-data')) {
      avatarUpload.single('image')(req, res, (err) => {
        if (err) return next(err);
        // QUALITY.md Scenario 8: Magic byte validation
        const file = (req as any).file as Express.Multer.File | undefined;
        if (file && !isValidImageBuffer(file.buffer)) {
          res.status(400).json({ error: 'Uploaded file is not a valid image.' });
          return;
        }
        next();
      });
    } else {
      res.status(400).json({ error: 'Content-Type must be multipart/form-data.' });
    }
  },
  uploadAvatar
);

router.post(
  '/:userId/banner',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  (req: Request, res: Response, next: NextFunction) => {
    if (req.is('multipart/form-data')) {
      avatarUpload.single('image')(req, res, (err) => {
        if (err) return next(err);
        const file = (req as any).file as Express.Multer.File | undefined;
        if (file && !isValidImageBuffer(file.buffer)) {
          res.status(400).json({ error: 'Uploaded file is not a valid image.' });
          return;
        }
        next();
      });
    } else {
      res.status(400).json({ error: 'Content-Type must be multipart/form-data.' });
    }
  },
  uploadBanner
);

router.get(
  '/:userId/pin',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getPin
);

router.post(
  '/:userId/record-visit',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  recordVisit
);

router.get(
  '/:userId/stats',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getUserStats
);

router.patch(
  '/:userId/pin',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('pin')
      .isString()
      .matches(/^\d{6}$/)
      .withMessage('PIN must be exactly 6 digits'),
    validate,
  ],
  updatePin
);

router.patch(
  '/:userId/bio',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('bio').isString().withMessage('bio must be a string'),
    validate,
  ],
  updateBio
);

router.get(
  '/:userId/contacts',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getContacts
);

router.patch(
  '/:userId/contacts',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  updateContacts
);

router.patch(
  '/:userId/specialties',
  requireAuth,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID'),
    body('specialties').isArray().withMessage('specialties must be an array'),
    validate,
  ],
  updateSpecialties
);

export default router;
