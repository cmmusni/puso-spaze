// ─────────────────────────────────────────────
// utils/haptics.ts
// Cross-platform haptic feedback helpers.
// Native: expo-haptics. Web/PWA: navigator.vibrate (Android Chrome supports
// it; iOS Safari ignores it). Always silently no-ops if the device or
// browser doesn't support haptics — never throws.
// ─────────────────────────────────────────────

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Cache web feature detection so we don't probe on every call.
const webVibrateSupported: boolean = (() => {
  if (Platform.OS !== 'web') return false;
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof (navigator as Navigator).vibrate === 'function'
    );
  } catch {
    return false;
  }
})();

function webVibrate(ms: number): void {
  if (!webVibrateSupported) return;
  try {
    // Some browsers throw if called outside a user-gesture context or with
    // bad arguments; swallow everything.
    (navigator as Navigator).vibrate(ms);
  } catch {
    /* ignore */
  }
}

function nativeImpact(style: Haptics.ImpactFeedbackStyle): void {
  // expo-haptics may reject (and on some devices throw synchronously) when
  // no haptic engine is present (e.g. tablets, older Androids, emulators).
  try {
    const result = Haptics.impactAsync(style);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function tapLight(): void {
  if (Platform.OS === 'web') {
    webVibrate(8);
    return;
  }
  nativeImpact(Haptics.ImpactFeedbackStyle.Light);
}

export function tapMedium(): void {
  if (Platform.OS === 'web') {
    webVibrate(15);
    return;
  }
  nativeImpact(Haptics.ImpactFeedbackStyle.Medium);
}
