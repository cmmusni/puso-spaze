import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as defaultColors, fonts, radii, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";

// ── Alert event bus ──────────────────────────
type AlertPayload = {
  title: string;
  message: string;
  type: "alert" | "confirm";
  resolve?: (value: boolean) => void;
};

type AlertListener = (payload: AlertPayload) => void;

const listeners = new Set<AlertListener>();

export function emitAlert(payload: AlertPayload) {
  listeners.forEach((fn) => fn(payload));
}

function subscribe(fn: AlertListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ── Icon by title keyword ──────────────────
function getAlertIcon(title: string): {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
} {
  const t = title.toLowerCase();
  if (t.includes("success") || t.includes("updated") || t.includes("pinned") || t.includes("unpinned"))
    return { name: "checkmark-circle", color: defaultColors.safe, bg: defaultColors.safe + "18" };
  if (t.includes("error") || t.includes("failed") || t.includes("invalid"))
    return { name: "alert-circle", color: defaultColors.danger, bg: defaultColors.danger + "18" };
  if (t.includes("flag"))
    return { name: "flag", color: defaultColors.accent, bg: defaultColors.accent + "18" };
  if (t.includes("review") || t.includes("under"))
    return { name: "hourglass-outline", color: defaultColors.secondary, bg: defaultColors.secondary + "18" };
  if (t.includes("delete") || t.includes("remove"))
    return { name: "trash-outline", color: defaultColors.danger, bg: defaultColors.danger + "18" };
  if (t.includes("confirm"))
    return { name: "help-circle", color: defaultColors.secondary, bg: defaultColors.secondary + "18" };
  return { name: "information-circle", color: defaultColors.primary, bg: defaultColors.primaryContainer + "40" };
}

// ── Modal component ──────────────────────────
export default function CustomAlertModal() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<AlertPayload | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  const show = useCallback((p: AlertPayload) => {
    setPayload(p);
    setVisible(true);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [anim]);

  const dismiss = useCallback(
    (result: boolean) => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        payload?.resolve?.(result);
        setPayload(null);
      });
    },
    [anim, payload],
  );

  useEffect(() => subscribe(show), [show]);

  if (!payload) return null;

  const icon = getAlertIcon(payload.title);
  const isConfirm = payload.type === "confirm";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismiss(false)}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={32} color={icon.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{payload.title}</Text>

          {/* Message */}
          {payload.message ? (
            <Text style={styles.message}>{payload.message}</Text>
          ) : null}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {isConfirm && (
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={() => dismiss(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, isConfirm && styles.primaryBtnHalf]}
              activeOpacity={0.85}
              onPress={() => dismiss(isConfirm ? true : false)}
            >
              <Text style={styles.primaryText}>
                {isConfirm ? "Confirm" : "OK"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    ...ambientShadow,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurfaceVariant,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnHalf: {},
  primaryText: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.onPrimary,
  },
});
