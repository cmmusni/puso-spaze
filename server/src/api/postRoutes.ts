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
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { createPost, getPosts, getPostById, deletePost, updatePost } from '../controllers/postController';
import { upsertReaction, getReactions } from '../controllers/reactionController';
import { createComment, getComments, deleteComment, updateComment } from '../controllers/commentController';
import { validate } from '../middlewares/validate';

const router = Router();

// ── Multer config for post images ──────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

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
  upload.single('image'),
  [
    body('userId')
      .trim()
      .isUUID()
      .withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 3, max: 500 })
      .withMessage('content must be 3–500 characters'),
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
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  deletePost
);

router.patch(
  '/:postId',
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 3, max: 500 })
      .withMessage('content must be 3–500 characters'),
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
router.post('/:postId/reactions', upsertReaction);

// ── Comments ───────────────────────────────
router.get('/:postId/comments', getComments);
router.post(
  '/:postId/comments',
  [
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('content must be 1–500 characters'),
    validate,
  ],
  createComment
);

router.delete(
  '/:postId/comments/:commentId',
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    param('commentId').isUUID().withMessage('commentId must be a valid UUID'),
    validate,
  ],
  deleteComment
);

router.patch(
  '/:postId/comments/:commentId',
  [
    param('postId').isUUID().withMessage('postId must be a valid UUID'),
    param('commentId').isUUID().withMessage('commentId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('content must be 1–500 characters'),
    validate,
  ],
  updateComment
);

export default router;
