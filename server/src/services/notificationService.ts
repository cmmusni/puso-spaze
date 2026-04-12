// ─────────────────────────────────────────────
// src/services/notificationService.ts
// Notification creation and push notification delivery
// Supports both Expo Push (native) and Web Push (browser)
// ─────────────────────────────────────────────

import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import webpush from 'web-push';

// ── Web Push setup ────────────────────────────
let webPushReady = false;

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  webPushReady = true;
  console.log('[WebPush] VAPID keys configured — web push enabled');
} else {
  console.warn('⚠️  [WebPush] VAPID keys not set — web push notifications disabled');
}

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

/**
 * Sends a Web Push notification to a single subscription.
 * Silently catches errors (fire-and-forget) and clears invalid subscriptions.
 */
async function sendWebPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; data?: any }
): Promise<void> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error: any) {
    // 410 Gone or 404 = subscription expired/invalid — clear it
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.warn('[WebPush] Subscription expired, clearing:', subscription.endpoint.substring(0, 60));
      await prisma.user.updateMany({
        where: { webPushSubscription: { equals: subscription as unknown as Prisma.InputJsonValue } },
        data: { webPushSubscription: Prisma.DbNull },
      }).catch(() => {});
    } else {
      console.error('❌ Web push send failed:', error.statusCode || error.message);
    }
  }
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

    // Get user's push token and web push subscription
    const user = await prisma.user.findUnique({
      where: { id: notif.userId },
      select: { expoPushToken: true, webPushSubscription: true },
    });

    // Send Expo push notification if token exists (native)
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

    // Send Web Push notification if subscription exists (browser)
    if (user?.webPushSubscription && webPushReady) {
      await sendWebPush(
        user.webPushSubscription as unknown as webpush.PushSubscription,
        { title: notif.title, body: notif.body, data: notif.data ?? {} }
      );
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
    // Get all users with push tokens or web push subscriptions (excluding system bot)
    const users = await prisma.user.findMany({
      where: {
        id: { not: 'system-encouragement-bot' },
        OR: [
          { expoPushToken: { not: null } },
          { webPushSubscription: { not: Prisma.DbNull } },
        ],
      },
      select: { id: true, expoPushToken: true, webPushSubscription: true },
    });

    if (users.length === 0) return;

    const title = '🕊️ New Encouragement';
    const body = params.preview.substring(0, 100) + (params.preview.length > 100 ? '...' : '');
    const data = { postId: params.postId };

    // Create notifications in database for all users
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: 'ENCOURAGEMENT' as any,
        title,
        body,
        data,
      })),
    });

    // Send Expo push notifications
    const { Expo, expo } = await getExpoClient();

    const expoMessages: any[] = users
      .filter((u) => u.expoPushToken && Expo.isExpoPushToken(u.expoPushToken))
      .map((u) => ({
        to: u.expoPushToken!,
        sound: 'default',
        title,
        body,
        data,
      }));

    if (expoMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error('❌ Failed to send encouragement notifications:', error);
        }
      }
    }

    // Send Web Push notifications
    if (webPushReady) {
      const webPushUsers = users.filter((u) => u.webPushSubscription);
      for (const u of webPushUsers) {
        sendWebPush(u.webPushSubscription as unknown as webpush.PushSubscription, { title, body, data }).catch(() => {});
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

    // Get users with push tokens or web push subscriptions
    const users = await prisma.user.findMany({
      where: {
        id: { in: params.userIds },
        OR: [
          { expoPushToken: { not: null } },
          { webPushSubscription: { not: Prisma.DbNull } },
        ],
      },
      select: { expoPushToken: true, webPushSubscription: true },
    });

    if (users.length === 0) return;

    // Send Expo push notifications
    const { Expo, expo } = await getExpoClient();

    const expoMessages: any[] = users
      .filter((u) => u.expoPushToken && Expo.isExpoPushToken(u.expoPushToken))
      .map((u) => ({
        to: u.expoPushToken!,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      }));

    if (expoMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error('❌ Failed to send system notifications:', error);
        }
      }
    }

    // Send Web Push notifications
    if (webPushReady) {
      const webPushUsers = users.filter((u) => u.webPushSubscription);
      for (const u of webPushUsers) {
        sendWebPush(
          u.webPushSubscription as unknown as webpush.PushSubscription,
          { title: params.title, body: params.body, data: params.data ?? {} }
        ).catch(() => {});
      }
    }
  } catch (error) {
    console.error('❌ Failed to notify system:', error);
  }
}
