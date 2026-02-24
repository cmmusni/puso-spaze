// ─────────────────────────────────────────────
// utils/alertPlatform.ts
// Cross-platform alert utility
// Uses React Native Alert on native, browser alert on web
// ─────────────────────────────────────────────

import { Platform, Alert } from 'react-native';

/**
 * Show an alert that works on both native and web platforms.
 * On web: uses browser alert()
 * On native: uses React Native Alert.alert()
 */
export function showAlert(title: string, message: string = '') {
  if (Platform.OS === 'web') {
    // Browser alert
    const fullMessage = message ? `${title}\n\n${message}` : title;
    window.alert(fullMessage);
  } else {
    // React Native alert (native platforms)
    Alert.alert(title, message);
  }
}

/**
 * Show a confirmation dialog that works on both native and web.
 * On web: uses browser confirm()
 * On native: uses React Native Alert.alert() with buttons
 * Returns promise that resolves to true if confirmed, false if cancelled
 */
export function showConfirm(title: string, message: string = ''): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const fullMessage = message ? `${title}\n\n${message}` : title;
      const confirmed = window.confirm(fullMessage);
      resolve(confirmed);
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
        { text: 'OK', onPress: () => resolve(true) },
      ]);
    }
  });
}
