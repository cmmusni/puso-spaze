// ─────────────────────────────────────────────
// src/api/coachRoutes.ts
// PUSO Coach dashboard API
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { getReviewQueue, moderatePost, moderateComment, flagPost } from '../controllers/coachController';

const router = Router();

// GET  /api/coach/review?coachId=...
router.get('/review', getReviewQueue);

// PATCH /api/coach/posts/:id/moderate
router.patch(
  '/posts/:id/moderate',
  [
    param('id').isUUID().withMessage('Invalid post id'),
    body('coachId').isUUID().withMessage('coachId is required'),
    body('action').isIn(['approve', 'reject']).withMessage("action must be 'approve' or 'reject'"),
    validate,
  ],
  moderatePost
);

// PATCH /api/coach/posts/:id/flag
router.patch(
  '/posts/:id/flag',
  [
    param('id').isUUID().withMessage('Invalid post id'),
    body('coachId').isUUID().withMessage('coachId is required'),
    validate,
  ],
  flagPost
);

// PATCH /api/coach/comments/:id/moderate
router.patch(
  '/comments/:id/moderate',
  [
    param('id').isUUID().withMessage('Invalid comment id'),
    body('coachId').isUUID().withMessage('coachId is required'),
    body('action').isIn(['approve', 'reject']).withMessage("action must be 'approve' or 'reject'"),
    validate,
  ],
  moderateComment
);

export default router;
