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

const router = Router();

// GET /api/notifications?userId=xxx
router.get('/', getNotifications);

// GET /api/notifications/unread-count?userId=xxx
router.get('/unread-count', getUnreadCount);

// POST /api/notifications/register-token
router.post('/register-token', registerPushToken);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', markNotificationRead);

// PATCH /api/notifications/read-all
router.patch('/read-all', markAllNotificationsRead);

export default router;
