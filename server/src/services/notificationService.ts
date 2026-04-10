// ─────────────────────────────────────────────
// src/services/notificationService.ts
// Notification creation and push notification delivery
// ─────────────────────────────────────────────

import { prisma } from '../config/db';

// Lazy-load Expo SDK (it's an ES Module)
let Expo: any;
let expo: any;

async function getExpoClient() {
  if (!expo) {
    const expoModule = await import('expo-server-sdk');
    Expo = expoModule.Expo;
    expo = new Expo();
  }
  return { Expo, expo };
}

export interface NotificationData {
  userId: string;
  type: 'REACTION' | 'COMMENT' | 'ENCOURAGEMENT' | 'SYSTEM' | 'MESSAGE';
  title: string;
  body: string;
  data?: any;
}

/**
 * Creates a notification in the database and sends push notification if user has a token
 */
export async function createNotification(notif: NotificationData): Promise<void> {
  try {
    // Create notification in database
    await prisma.notification.create({
      data: {
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        data: notif.data ?? {},
      },
    });

    // Get user's push token
    const user = await prisma.user.findUnique({
      where: { id: notif.userId },
      select: { expoPushToken: true },
    });

    // Send push notification if token exists
    if (user?.expoPushToken) {
      const { Expo, expo } = await getExpoClient();
      
      if (Expo.isExpoPushToken(user.expoPushToken)) {
        const message: any = {
          to: user.expoPushToken,
          sound: 'default',
          title: notif.title,
          body: notif.body,
          data: notif.data ?? {},
        };

        const chunks = expo.chunkPushNotifications([message]);
        for (const chunk of chunks) {
          try {
            await expo.sendPushNotificationsAsync(chunk);
          } catch (error) {
            console.error('❌ Failed to send push notification:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
  }
}

/**
 * Creates a reaction notification
 */
export async function notifyReaction(params: {
  postId: string;
  postAuthorId: string;
  reactorId: string;
  reactorName: string;
  reactionType: string;
}): Promise<void> {
  // Don't notify if user reacted to their own post
  if (params.postAuthorId === params.reactorId) return;

  // Don't notify system bot
  if (params.postAuthorId === 'system-encouragement-bot') return;

  const emoji = params.reactionType === 'PRAY' ? '🙏' : params.reactionType === 'CARE' ? '💙' : '🤝';
  
  await createNotification({
    userId: params.postAuthorId,
    type: 'REACTION',
    title: 'New Reaction',
    body: `${params.reactorName} reacted ${emoji} to your post`,
    data: {
      postId: params.postId,
      reactorId: params.reactorId,
      reactionType: params.reactionType,
    },
  });
}

/**
 * Creates a comment notification
 */
export async function notifyComment(params: {
  postId: string;
  postAuthorId: string;
  commenterId: string;
  commenterName: string;
  commentPreview: string;
}): Promise<void> {
  // Don't notify if user commented on their own post
  if (params.postAuthorId === params.commenterId) return;

  // Don't notify system bot
  if (params.postAuthorId === 'system-encouragement-bot') return;

  await createNotification({
    userId: params.postAuthorId,
    type: 'COMMENT',
    title: 'New Comment',
    body: `${params.commenterName}: ${params.commentPreview.substring(0, 50)}${params.commentPreview.length > 50 ? '...' : ''}`,
    data: {
      postId: params.postId,
      commenterId: params.commenterId,
    },
  });
}

/**
 * Sends encouragement notification to all users with push tokens
 */
export async function notifyNewEncouragement(params: {
  postId: string;
  preview: string;
}): Promise<void> {
  try {
    // Get all users with push tokens (excluding system bot)
    const users = await prisma.user.findMany({
      where: {
        expoPushToken: { not: null },
        id: { not: 'system-encouragement-bot' },
      },
      select: { id: true, expoPushToken: true },
    });

    if (users.length === 0) return;

    // Create notifications in database for all users
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: 'ENCOURAGEMENT' as any,
        title: '🕊️ New Encouragement',
        body: params.preview.substring(0, 100) + (params.preview.length > 100 ? '...' : ''),
        data: { postId: params.postId },
      })),
    });

    const { Expo, expo } = await getExpoClient();

    // Send push notifications
    const messages: any[] = users
      .filter((u) => u.expoPushToken && Expo.isExpoPushToken(u.expoPushToken))
      .map((u) => ({
        to: u.expoPushToken!,
        sound: 'default',
        title: '🕊️ New Encouragement',
        body: params.preview.substring(0, 100) + (params.preview.length > 100 ? '...' : ''),
        data: { postId: params.postId },
      }));

    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error('❌ Failed to send encouragement notifications:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to notify new encouragement:', error);
  }
}

/**
 * Sends a system notification to specific user(s)
 */
export async function notifySystem(params: {
  userIds: string[];
  title: string;
  body: string;
  data?: any;
}): Promise<void> {
  try {
    // Create notifications in database
    await prisma.notification.createMany({
      data: params.userIds.map((userId) => ({
        userId,
        type: 'SYSTEM' as any,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      })),
    });

    // Get users with push tokens
    const users = await prisma.user.findMany({
      where: {
        id: { in: params.userIds },
        expoPushToken: { not: null },
      },
      select: { expoPushToken: true },
    });

    if (users.length === 0) return;

    const { Expo, expo } = await getExpoClient();

    const messages: any[] = users
      .filter((u) => u.expoPushToken && Expo.isExpoPushToken(u.expoPushToken))
      .map((u) => ({
        to: u.expoPushToken!,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      }));

    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error('❌ Failed to send system notifications:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to notify system:', error);
  }
}
