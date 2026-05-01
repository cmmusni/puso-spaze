// ─────────────────────────────────────────────
// utils/haptics.ts
// Cross-platform haptic feedback helpers.
// Android: prefer our local Expo module's direct Vibrator call (bypasses
//   the "Touch feedback" / "System haptics" global toggle). Fall back to
//   expo-haptics if the module isn't linked.
// iOS: expo-haptics (Taptic Engine).
// Web/PWA: navigator.vibrate (Android Chrome supports it; iOS Safari
//   ignores it). Always silently no-ops if the device or browser doesn't
//   support haptics — never throws.
// ─────────────────────────────────────────────

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Lazy-require so web bundles don't choke on the local native module.
let systemClick: {
  systemVibrate?: (ms: number) => boolean;
  hasVibrator?: () => boolean;
} | null = null;
try {
  systemClick = require('../modules/system-click');
} catch {
  systemClick = null;
}

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
    (navigator as Navigator).vibrate(ms);
  } catch {
    /* ignore */
  }
}

function nativeImpact(style: Haptics.ImpactFeedbackStyle): void {
  try {
    const result = Haptics.impactAsync(style);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

// Returns true if the direct Android vibrator path was used.
function tryAndroidDirectVibrate(ms: number): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    return systemClick?.systemVibrate?.(ms) === true;
  } catch {
    return false;
  }
}

export function tapLight(): void {
  if (Platform.OS === 'web') {
    webVibrate(8);
    return;
  }
  if (tryAndroidDirectVibrate(10)) return;
  nativeImpact(Haptics.ImpactFeedbackStyle.Light);
}

export function tapMedium(): void {
  if (Platform.OS === 'web') {
    webVibrate(15);
    return;
  }
  if (tryAndroidDirectVibrate(20)) return;
  nativeImpact(Haptics.ImpactFeedbackStyle.Medium);
}

// Diagnostic: whether this device has a vibrator motor (Android only).
// Returns true on iOS (Taptic Engine assumed present) and false on web.
export function deviceHasVibrator(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') {
    try {
      return systemClick?.hasVibrator?.() === true;
    } catch {
      return false;
    }
  }
  return false;
}
