// ─────────────────────────────────────────────
// src/api/conversationRoutes.ts
// GET    /api/conversations/coaches              — list coaches
// GET    /api/conversations                      — list conversations
// POST   /api/conversations                      — get or create conversation
// GET    /api/conversations/:id/messages          — get messages
// POST   /api/conversations/:id/messages          — send message
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getCoaches,
  getAllConversations,
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  setTyping,
  getTyping,
  deleteConversation,
} from '../controllers/conversationController';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/requireAuth';

const router = Router();

// ── GET /api/conversations/coaches ─────────
router.get('/coaches', getCoaches);

// ── GET /api/conversations/all ─────────────
router.get('/all', requireAuth, getAllConversations);

// ── DELETE /api/conversations/:conversationId ──
router.delete(
  '/:conversationId',
  requireAuth,
  [
    param('conversationId').isUUID().withMessage('conversationId must be a valid UUID'),
    validate,
  ],
  deleteConversation
);

// ── GET /api/conversations ─────────────────
router.get(
  '/',
  requireAuth,
  [
    query('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getConversations
);

// ── POST /api/conversations ────────────────
router.post(
  '/',
  requireAuth,
  [
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('coachId').trim().isUUID().withMessage('coachId must be a valid UUID'),
    validate,
  ],
  getOrCreateConversation
);

// ── GET /api/conversations/:conversationId/messages ──
router.get(
  '/:conversationId/messages',
  requireAuth,
  [
    param('conversationId').isUUID().withMessage('conversationId must be a valid UUID'),
    query('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getMessages
);

// ── POST /api/conversations/:conversationId/messages ──
router.post(
  '/:conversationId/messages',
  requireAuth,
  [
    param('conversationId').isUUID().withMessage('conversationId must be a valid UUID'),
    body('senderId').trim().isUUID().withMessage('senderId must be a valid UUID'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('content must be 1–2000 characters'),
    validate,
  ],
  sendMessage
);

// ── POST /api/conversations/:conversationId/typing ──
router.post(
  '/:conversationId/typing',
  requireAuth,
  [
    param('conversationId').isUUID().withMessage('conversationId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  setTyping
);

// ── GET /api/conversations/:conversationId/typing ──
router.get(
  '/:conversationId/typing',
  requireAuth,
  [
    param('conversationId').isUUID().withMessage('conversationId must be a valid UUID'),
    query('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getTyping
);

export default router;
