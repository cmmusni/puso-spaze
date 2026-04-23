// ─────────────────────────────────────────────
// components/ReactionPickerHost.tsx
// Renders the floating reaction picker at screen-root level.
// Driven by useReactionPickerStore. Mounted once per screen that
// hosts reaction-capable surfaces (HomeScreen, ProfileScreen,
// PostDetailScreen feed). Bubble onLayout populates window-coord
// bounds in pickerRefs.bubbleBounds for hit testing by PanResponder.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  ambientShadow,
  colors as defaultColors,
  fonts,
  radii,
} from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import {
  pickerRefs,
  useReactionPickerStore,
} from "../context/ReactionPickerStore";
import type { ReactionType } from "../../../packages/types";
import { PrayIcon, SupportIcon, LikeIcon, SadIcon } from "./ReactionIcons";

const REACTION_TYPES: ReactionType[] = [
  "PRAY",
  "CARE",
  "SUPPORT",
  "LIKE",
  "SAD",
];

const REACTION_LABELS: Record<ReactionType, string> = {
  PRAY: "Pray",
  CARE: "Care",
  SUPPORT: "Support",
  LIKE: "Like",
  SAD: "Sad",
};

const REACTION_GRADIENTS: Record<
  ReactionType,
  (c: typeof defaultColors) => [string, string]
> = {
  PRAY: (c) => [c.primary, c.secondary],
  CARE: (c) => [c.hot, c.fuchsia],
  SUPPORT: (c) => [c.tertiary, c.primary],
  LIKE: (c) => [c.secondary, c.primaryContainer],
  SAD: (c) => [c.tertiary, c.onSurfaceVariant],
};

function renderIcon(type: ReactionType, color: string) {
  const k = `${type}-${color}`;
  if (type === "PRAY") return <PrayIcon key={k} size={24} color={color} />;
  if (type === "SUPPORT")
    return <SupportIcon key={k} size={24} color={color} />;
  if (type === "LIKE") return <LikeIcon key={k} size={24} color={color} />;
  if (type === "SAD") return <SadIcon key={k} size={24} color={color} />;
  return <Ionicons key={k} name="heart" size={24} color={color} />;
}

export default function ReactionPickerHost() {
  const colors = useThemeStore((s) => s.colors);
  const visible = useReactionPickerStore((s) => s.visible);
  const pickerPos = useReactionPickerStore((s) => s.pickerPos);
  const userReaction = useReactionPickerStore((s) => s.userReaction);
  const pressedReaction = useReactionPickerStore((s) => s.pressedReaction);
  const openVersion = useReactionPickerStore((s) => s.openVersion);
  const close = useReactionPickerStore((s) => s.close);
  const setPressed = useReactionPickerStore((s) => s.setPressed);

  const pickerAnim = useRef(new Animated.Value(0)).current;
  // Window-coord offset of this host's root view. On web, the screen is
  // rendered inside a flex container next to the WebSidebar, so the
  // host's (0,0) is offset from the window origin. pickerPos comes from
  // measureInWindow (window coords), so we must subtract this offset to
  // anchor the picker correctly.
  const rootRef = useRef<View | null>(null);
  const [hostOffset, setHostOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const measureHost = () => {
    const node: any = rootRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x: number, y: number) => {
        setHostOffset((prev) =>
          prev.x === x && prev.y === y ? prev : { x, y },
        );
      });
    }
  };

  // Re-compute each bubble's window-coord bounds. On web (and during the
  // spring scale animation), measureInWindow returns the *currently
  // animated* visual bounds — bubbles start at 0.4× scale and grow, so
  // measured widths are smaller than final and the X-axis hit-test
  // becomes flaky. Instead, derive bounds geometrically from pickerPos
  // and the static pill layout (padding 10, gap 6, bubble 44×44). This
  // is deterministic, frame-independent, and consistent across web/native.
  const PILL_PADDING_H = 10;
  const PILL_PADDING_V = 8;
  const BUBBLE_SIZE = 44;
  const BUBBLE_GAP = 6;

  const remeasureBubbles = () => {
    if (!pickerPos) return;
    REACTION_TYPES.forEach((type, i) => {
      const left = pickerPos.left + PILL_PADDING_H + i * (BUBBLE_SIZE + BUBBLE_GAP);
      const top = pickerPos.top + PILL_PADDING_V;
      pickerRefs.bubbleBounds.set(type, {
        left,
        right: left + BUBBLE_SIZE,
        top,
        bottom: top + BUBBLE_SIZE,
      });
    });
  };

  useEffect(() => {
    if (visible) {
      measureHost();
      pickerAnim.setValue(0);
      Animated.spring(pickerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 7,
      }).start();
    } else {
      Animated.timing(pickerAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, pickerAnim, openVersion]);

  // After the picker becomes visible OR its on-screen position changes,
  // recompute bubble bounds so the PanResponder hit-test sees current
  // window coordinates. This is synchronous + deterministic.
  useEffect(() => {
    if (!visible) return;
    remeasureBubbles();
  }, [visible, openVersion, pickerPos]);

  if (!visible) return null;

  return (
    <View
      ref={rootRef}
      onLayout={measureHost}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 24 }]}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
      <View
        style={[
          styles.pickerAnchorLayer,
          pickerPos
            ? {
                top: pickerPos.top - hostOffset.y,
                left: pickerPos.left - hostOffset.x,
              }
            : { top: "50%", left: "50%" },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            pillStyle(colors),
            {
              opacity: pickerAnim,
              transform: [
                {
                  scale: pickerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
                {
                  translateY: pickerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {REACTION_TYPES.map((type, i) => {
            const active = userReaction === type;
            const isPressed = pressedReaction === type;
            const itemAnim = pickerAnim.interpolate({
              inputRange: [0, Math.min(0.15 + i * 0.12, 0.85), 1],
              outputRange: [0, 0, 1],
            });
            const gradient = REACTION_GRADIENTS[type](colors);
            return (
              <View key={type} style={styles.pickerItemWrap}>
                {isPressed && (
                  <View style={styles.pickerTooltip}>
                    <Text style={[styles.pickerTooltipText, type === 'SUPPORT' && { minWidth: 44 }]} numberOfLines={1}>
                      {REACTION_LABELS[type]}
                    </Text>
                  </View>
                )}
                <Animated.View
                  style={{
                    opacity: itemAnim,
                    transform: [
                      {
                        scale: itemAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, isPressed ? 1.25 : 1],
                        }),
                      },
                      {
                        translateY: itemAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [16, isPressed ? -6 : 0],
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      const fn = pickerRefs.onSelect;
                      close();
                      fn?.(type);
                    }}
                    onPressIn={() => setPressed(type)}
                    onPressOut={() => setPressed(null)}
                    activeOpacity={1}
                    accessibilityLabel={REACTION_LABELS[type]}
                  >
                    <LinearGradient
                      colors={gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        bubbleStyle(colors),
                        active && { borderWidth: 2, borderColor: colors.primary },
                      ]}
                    >
                      {renderIcon(type, colors.card)}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const pillStyle = (colors: typeof defaultColors) => ({
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: colors.card,
  borderRadius: radii.full,
  paddingVertical: 8,
  paddingHorizontal: 10,
  gap: 6,
  ...ambientShadow,
  shadowOpacity: 0.18,
  shadowRadius: 28,
  elevation: 16,
});

const bubbleStyle = (_colors: typeof defaultColors) => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center" as const,
  justifyContent: "center" as const,
});

const styles = StyleSheet.create({
  pickerAnchorLayer: {
    position: "absolute",
  },
  pickerItemWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pickerTooltip: {
    position: "absolute",
    top: -34,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(28,27,35,0.92)",

    zIndex: 1,
  },
  pickerTooltipText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap" as any } : {}),
    minWidth: 32,
    textAlign: "center" as const,
  },
});
