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
  registerWebPushSubscription,
  getVapidPublicKey,
} from '../controllers/notificationController';
import { requireAuth } from '../middlewares/requireAuth';

const router = Router();

// GET /api/notifications/vapid-public-key (public — needed before auth for subscription)
router.get('/vapid-public-key', getVapidPublicKey);

// GET /api/notifications?userId=xxx
router.get('/', requireAuth, getNotifications);

// GET /api/notifications/unread-count?userId=xxx
router.get('/unread-count', requireAuth, getUnreadCount);

// POST /api/notifications/register-token
router.post('/register-token', requireAuth, registerPushToken);

// POST /api/notifications/register-web-push
router.post('/register-web-push', requireAuth, registerWebPushSubscription);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, markNotificationRead);

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, markAllNotificationsRead);

export default router;
