// ─────────────────────────────────────────────
// src/api/coachRoutes.ts
// PUSO Coach dashboard API
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/requireAuth';
import { getReviewQueue, moderatePost, moderateComment, flagPost, flagComment, getMembers, getCoaches } from '../controllers/coachController';
import { getRecoveryRequests, reviewRecoveryRequest } from '../controllers/recoveryController';

const router = Router();

// GET  /api/coach/review?coachId=...
router.get('/review', requireAuth, getReviewQueue);

// GET  /api/coach/members?coachId=...
router.get('/members', requireAuth, getMembers);

// GET  /api/coach/coaches?coachId=...
router.get('/coaches', requireAuth, getCoaches);

// PATCH /api/coach/posts/:id/moderate
router.patch(
  '/posts/:id/moderate',
  requireAuth,
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
  requireAuth,
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
  requireAuth,
  [
    param('id').isUUID().withMessage('Invalid comment id'),
    body('coachId').isUUID().withMessage('coachId is required'),
    body('action').isIn(['approve', 'reject']).withMessage("action must be 'approve' or 'reject'"),
    validate,
  ],
  moderateComment
);

// PATCH /api/coach/comments/:id/flag
router.patch(
  '/comments/:id/flag',
  requireAuth,
  [
    param('id').isUUID().withMessage('Invalid comment id'),
    body('coachId').isUUID().withMessage('coachId is required'),
    validate,
  ],
  flagComment
);

// ── Recovery request management ─────────────

// GET /api/coach/recovery-requests?coachId=...
router.get('/recovery-requests', requireAuth, getRecoveryRequests);

// PATCH /api/coach/recovery-requests/:id
router.patch(
  '/recovery-requests/:id',
  requireAuth,
  [
    param('id').isUUID().withMessage('Invalid request id'),
    body('coachId').isUUID().withMessage('coachId is required'),
    body('action').isIn(['approve', 'deny']).withMessage("action must be 'approve' or 'deny'"),
    validate,
  ],
  reviewRecoveryRequest
);

export default router;
