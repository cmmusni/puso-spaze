// ─────────────────────────────────────────────
// src/controllers/notificationController.ts
// Notification API handlers
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';

/**
 * GET /api/notifications
 * Get all notifications for a user
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string;

  if (!userId) {
    res.status(400).json({ error: 'userId query parameter required' });
    return;
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 notifications
    });

    res.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { userId } = req.body as { userId: string };

  if (!userId) {
    res.status(400).json({ error: 'userId required in body' });
    return;
  }

  try {
    // Verify notification belongs to user
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json({ notification: updated });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const { userId } = req.body as { userId: string };

  if (!userId) {
    res.status(400).json({ error: 'userId required in body' });
    return;
  }

  try {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
}

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string;

  if (!userId) {
    res.status(400).json({ error: 'userId query parameter required' });
    return;
  }

  try {
    const count = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({ count });
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
}

/**
 * POST /api/notifications/register-token
 * Register or update a user's Expo push token
 */
export async function registerPushToken(req: Request, res: Response): Promise<void> {
  const { userId, expoPushToken } = req.body as { userId: string; expoPushToken: string };

  if (!userId || !expoPushToken) {
    res.status(400).json({ error: 'userId and expoPushToken required' });
    return;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { expoPushToken },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
}
