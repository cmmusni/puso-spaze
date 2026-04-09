// ─────────────────────────────────────────────
// src/api/journalRoutes.ts
// GET    /api/journals              — list user's journals
// GET    /api/journals/:journalId   — single journal entry
// POST   /api/journals              — create journal entry
// PATCH  /api/journals/:journalId   — update journal entry
// DELETE /api/journals/:journalId   — delete journal entry
// ─────────────────────────────────────────────

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getJournals,
  getJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
} from '../controllers/journalController';
import { validate } from '../middlewares/validate';

const router = Router();

// ── GET /api/journals ──────────────────────
router.get(
  '/',
  [
    query('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getJournals
);

// ── GET /api/journals/:journalId ───────────
router.get(
  '/:journalId',
  [
    param('journalId').isUUID().withMessage('journalId must be a valid UUID'),
    query('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  getJournalById
);

// ── POST /api/journals ─────────────────────
router.post(
  '/',
  [
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('title must be 1–200 characters'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('content must be 1–5000 characters'),
    body('mood')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('mood must be at most 50 characters'),
    body('tags')
      .optional()
      .isArray({ max: 10 })
      .withMessage('tags must be an array of up to 10 items'),
    validate,
  ],
  createJournal
);

// ── PATCH /api/journals/:journalId ─────────
router.patch(
  '/:journalId',
  [
    param('journalId').isUUID().withMessage('journalId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('title must be 1–200 characters'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('content must be 1–5000 characters'),
    body('mood')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('mood must be at most 50 characters'),
    body('tags')
      .optional()
      .isArray({ max: 10 })
      .withMessage('tags must be an array of up to 10 items'),
    validate,
  ],
  updateJournal
);

// ── DELETE /api/journals/:journalId ────────
router.delete(
  '/:journalId',
  [
    param('journalId').isUUID().withMessage('journalId must be a valid UUID'),
    body('userId').trim().isUUID().withMessage('userId must be a valid UUID'),
    validate,
  ],
  deleteJournal
);

export default router;
