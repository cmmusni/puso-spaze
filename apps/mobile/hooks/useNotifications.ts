// ─────────────────────────────────────────────
// hooks/useNotifications.ts
// Expo push notifications setup and management
// ─────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiRegisterPushToken, apiGetUnreadCount } from '../services/api';

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface UseNotificationsResult {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

/**
 * Hook to manage push notifications: permissions, token registration, and unread count
 */
export function useNotifications(userId: string | null): UseNotificationsResult {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

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

    // Register for push notifications
    registerForPushNotificationsAsync(userId).then((token) => {
      if (token) {
        setExpoPushToken(token);
      }
    });

    // Fetch initial unread count
    refreshUnreadCount();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
      // Refresh unread count when new notification arrives
      refreshUnreadCount();
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      // You can navigate to specific screens based on notification data
      console.log('Notification tapped:', data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
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

/**
 * Registers the device for push notifications and sends token to backend
 */
async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '7abfd1c5-c91a-4aa6-9f10-01d57f24e5e3', // Replace with your Expo project ID
    });
    const token = tokenData.data;

    // Register token with backend
    await apiRegisterPushToken({ userId, expoPushToken: token });

    // Configure notification channel for Android
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
