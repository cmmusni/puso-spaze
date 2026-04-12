// ─────────────────────────────────────────────
// src/api/notificationRoutes.ts
// Notification API routes
// ─────────────────────────────────────────────

import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  registerPushToken,
} from '../controllers/notificationController';
import { requireAuth } from '../middlewares/requireAuth';

const router = Router();

// GET /api/notifications?userId=xxx
router.get('/', requireAuth, getNotifications);

// GET /api/notifications/unread-count?userId=xxx
router.get('/unread-count', requireAuth, getUnreadCount);

// POST /api/notifications/register-token
router.post('/register-token', requireAuth, registerPushToken);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, markNotificationRead);

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, markAllNotificationsRead);

export default router;
