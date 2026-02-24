// ─────────────────────────────────────────────
// src/api/postRoutes.ts
// POST /api/posts            — create post
// GET  /api/posts            — fetch posts
// GET  /api/posts/:id/reactions  — get reaction counts
// POST /api/posts/:id/reactions  — toggle reaction
// GET  /api/posts/:id/comments   — get comments
// POST /api/posts/:id/comments   — add comment
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body } from 'express-validator';
import { createPost, getPosts } from '../controllers/postController';
import { upsertReaction, getReactions } from '../controllers/reactionController';
import { createComment, getComments } from '../controllers/commentController';
import { validate } from '../middlewares/validate';

const router = Router();

// ── GET /api/posts ─────────────────────────
router.get('/', getPosts);

// ── POST /api/posts ────────────────────────
router.post(
  '/',
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
      .isArray({ max: 5 })
      .withMessage('tags must be an array of up to 5 items'),
    validate,
  ],
  createPost
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

export default router;
