// ─────────────────────────────────────────────
// utils/haptics.ts
// Cross-platform haptic feedback helpers.
// No-ops on web or when haptics aren't available.
// ─────────────────────────────────────────────

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function tapLight(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tapMedium(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
