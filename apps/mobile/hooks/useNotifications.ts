// ─────────────────────────────────────────────
// hooks/useNotifications.ts
// Push notifications — Expo (native) + Web Push (browser)
// ─────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  apiRegisterPushToken,
  apiGetUnreadCount,
  apiGetVapidPublicKey,
  apiRegisterWebPushSubscription,
} from '../services/api';

// ── Expo notifications (only imported on native) ──
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

if (Platform.OS !== 'web') {
  // Dynamic require so the web bundle never pulls in native modules
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export interface UseNotificationsResult {
  expoPushToken: string | null;
  notification: any | null;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

/**
 * Hook to manage push notifications: permissions, token registration, and unread count.
 * On web → registers a service worker + Web Push subscription.
 * On native → registers an Expo push token.
 */
export function useNotifications(userId: string | null): UseNotificationsResult {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // Fetch unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const { count } = await apiGetUnreadCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    if (Platform.OS === 'web') {
      // ── Web Push registration ──
      registerForWebPushAsync(userId).catch((err) =>
        console.error('Web push registration failed:', err)
      );
    } else {
      // ── Expo Push registration (native) ──
      registerForPushNotificationsAsync(userId).then((token) => {
        if (token) setExpoPushToken(token);
      });

      if (Notifications) {
        notificationListener.current =
          Notifications.addNotificationReceivedListener((n) => {
            setNotification(n);
            refreshUnreadCount();
          });

        responseListener.current =
          Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            console.log('Notification tapped:', data);
          });
      }
    }

    // Fetch initial unread count
    refreshUnreadCount();

    return () => {
      if (notificationListener.current && Notifications) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current && Notifications) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [userId]);

  return {
    expoPushToken,
    notification,
    unreadCount,
    refreshUnreadCount,
  };
}

// ─────────────────────────────────────────────
// Web Push registration (browser only)
// ─────────────────────────────────────────────

/**
 * Converts a base64-encoded VAPID public key to a Uint8Array for
 * the Web Push applicationServerKey option.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerForWebPushAsync(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] This browser does not support web push notifications');
    return;
  }

  // 1. Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // 2. Get VAPID public key from server
  let vapidPublicKey: string;
  try {
    const { publicKey } = await apiGetVapidPublicKey();
    vapidPublicKey = publicKey;
  } catch {
    console.warn('[WebPush] Server does not have VAPID keys configured');
    return;
  }

  // 3. Subscribe to push (or get existing subscription)
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[WebPush] Notification permission denied');
      return;
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  // 4. Send subscription to backend
  const subscriptionJSON = subscription.toJSON();
  await apiRegisterWebPushSubscription({
    userId,
    subscription: subscriptionJSON,
  });

  console.log('[WebPush] Subscription registered successfully');
}

// ─────────────────────────────────────────────
// Expo Push registration (native only)
// ─────────────────────────────────────────────

async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (!Device?.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  if (!Notifications) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '7abfd1c5-c91a-4aa6-9f10-01d57f24e5e3',
    });
    const token = tokenData.data;

    await apiRegisterPushToken({ userId, expoPushToken: token });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
    return null;
  }
}
