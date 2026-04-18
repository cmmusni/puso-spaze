// ─────────────────────────────────────────────
// hooks/usePressAnimation.ts
// Visible press feedback for buttons (essential on
// web/PWA where there's no haptic feedback).
//
// Returns:
//   - scale: Animated.Value to apply to a transform
//   - bgOpacity: Animated.Value for a tinted overlay
//   - handlers: spread onto a Pressable / TouchableOpacity
// ─────────────────────────────────────────────

import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

export type PressAnimationOptions = {
  pressedScale?: number; // scale while finger is down
  longPressedScale?: number; // scale once long-press fires
  fadeInMs?: number; // background fade-in
  fadeOutMs?: number; // background fade-out
  bgPeakOpacity?: number; // max opacity of the tinted background overlay
};

export function usePressAnimation(opts: PressAnimationOptions = {}) {
  const {
    pressedScale = 0.88,
    longPressedScale = 1.1,
    fadeInMs = 80,
    fadeOutMs = 160,
    bgPeakOpacity = 0.35,
  } = opts;

  const scale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressedScale,
        useNativeDriver: true,
        tension: 220,
        friction: 12,
      }),
      Animated.timing(bgOpacity, {
        toValue: bgPeakOpacity,
        duration: fadeInMs,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, bgOpacity, pressedScale, fadeInMs, bgPeakOpacity]);

  const onPressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 9,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: fadeOutMs,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, bgOpacity, fadeOutMs]);

  const onLongPress = useCallback(() => {
    // Punch up briefly then settle. Indicates the long-press was registered.
    Animated.sequence([
      Animated.spring(scale, {
        toValue: longPressedScale,
        useNativeDriver: true,
        tension: 240,
        friction: 6,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 8,
      }),
    ]).start();
  }, [scale, longPressedScale]);

  return { scale, bgOpacity, onPressIn, onPressOut, onLongPress };
}
