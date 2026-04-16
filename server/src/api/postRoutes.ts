// ─────────────────────────────────────────────
// src/api/postRoutes.ts
// POST   /api/posts            — create post
// GET    /api/posts            — fetch posts
// DELETE /api/posts/:id        — delete post (owner or admin)
// GET    /api/posts/:id/reactions  — get reaction counts
// POST   /api/posts/:id/reactions  — toggle reaction
// GET    /api/posts/:id/comments   — get comments
// POST   /api/posts/:id/comments   — add comment
// DELETE /api/posts/:id/comments/:commentId — delete own comment (or any comment if admin)
import { POST_MIN_LENGTH, POST_MAX_LENGTH } from '../config/postLimits';
// ─────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import { createPost, getPosts, getPostById, deletePost, updatePost, reportPost } from '../controllers/postController';
import { upsertReaction, getReactions } from '../controllers/reactionController';
import { createComment, getComments, deleteComment, updateComment, upsertCommentReaction } from '../controllers/commentController';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/requireAuth';
import { isValidImageBuffer } from '../utils/validateImageMagicBytes';

const router = Router();

// ── Multer config for post images (memory storage → Cloudinary) ──────────
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  },
});

// ── GET /api/posts ─────────────────────────
router.get('/', getPosts);

// ── GET /api/posts/:postId ─────────────────
router.get(
  '/:postId',
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    validate,
  ],
  getPostById
);

// ── POST /api/posts ────────────────────────
router.post(
  '/',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    if (req.is('multipart/form-data')) {
      upload.single('image')(req, res, (err) => {
        if (err) return next(err);
        // QUALITY.md Scenario 8: Magic byte validation after multer saves the file
        const file = (req as any).file as Express.Multer.File | undefined;
        if (file && !isValidImageBuffer(file.buffer)) {
          res.status(400).json({ error: 'Uploaded file is not a valid image.' });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  [
    body('userId')
      .trim()
      .isUUID()
      .withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: POST_MIN_LENGTH, max: POST_MAX_LENGTH })
      .withMessage(`content must be ${POST_MIN_LENGTH}–${POST_MAX_LENGTH} characters`),
    body('tags')
      .optional()
      .customSanitizer((value) => {
        if (typeof value === 'string') {
          try { return JSON.parse(value); } catch { return value; }
        }
        return value;
      })
      .isArray({ max: 5 })
      .withMessage('tags must be an array of up to 5 items'),
    validate,
  ],
  createPost
);

// ── DELETE /api/posts/:postId ──────────────
router.delete(
  '/:postId',
  requireAuth,
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  deletePost
);

router.patch(
  '/:postId',
  requireAuth,
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: POST_MIN_LENGTH, max: POST_MAX_LENGTH })
      .withMessage(`content must be ${POST_MIN_LENGTH}–${POST_MAX_LENGTH} characters`),
    body('tags')
      .optional()
      .isArray({ max: 5 })
      .withMessage('tags must be an array of up to 5 items'),
    validate,
  ],
  updatePost
);

// ── Reactions ──────────────────────────────
router.get('/:postId/reactions', getReactions);
router.post('/:postId/reactions', requireAuth, upsertReaction);

// ── Report (user-facing flag) ──────────────
router.post(
  '/:postId/report',
  requireAuth,
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  reportPost
);

// ── Comments ───────────────────────────────
router.get('/:postId/comments', getComments);
router.post(
  '/:postId/comments',
  requireAuth,
  [
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 3, max: 500 })
      .withMessage('content must be 3–500 characters'),
    validate,
  ],
  createComment
);

router.delete(
  '/:postId/comments/:commentId',
  requireAuth,
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    param('commentId').isUUID().withMessage('commentId must be a valid UUID'),
    validate,
  ],
  deleteComment
);

router.patch(
  '/:postId/comments/:commentId',
  requireAuth,
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    param('commentId').isUUID().withMessage('commentId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 3, max: 500 })
      .withMessage('content must be 3–500 characters'),
    validate,
  ],
  updateComment
);

// ── Comment Reactions ──────────────────────
router.post(
  '/:postId/comments/:commentId/reactions',
  requireAuth,
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    param('commentId').isUUID().withMessage('commentId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('type').isIn(['PRAY', 'CARE', 'SUPPORT', 'LIKE']).withMessage('type must be PRAY, CARE, SUPPORT, or LIKE'),
    validate,
  ],
  upsertCommentReaction
);

export default router;
