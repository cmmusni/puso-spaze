// ─────────────────────────────────────────────
// utils/alertPlatform.ts
// Cross-platform alert utility
// Uses custom styled modal on web, RN Alert on native
// ─────────────────────────────────────────────

import { Platform, Alert } from 'react-native';
import { emitAlert } from '../components/CustomAlertModal';

/**
 * Show an alert that works on both native and web platforms.
 * On web: uses custom styled modal
 * On native: uses React Native Alert.alert()
 * Returns a promise that resolves when the user dismisses the alert.
 */
export function showAlert(title: string, message: string = ''): Promise<void> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      emitAlert({ title, message, type: 'alert', resolve: () => resolve() });
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
    }
  });
}

/**
 * Show a confirmation dialog that works on both native and web.
 * On web: uses custom styled modal
 * On native: uses React Native Alert.alert() with buttons
 * Returns promise that resolves to true if confirmed, false if cancelled
 */
export function showConfirm(title: string, message: string = ''): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      emitAlert({ title, message, type: 'confirm', resolve });
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
        { text: 'OK', onPress: () => resolve(true) },
      ]);
    }
  });
}
