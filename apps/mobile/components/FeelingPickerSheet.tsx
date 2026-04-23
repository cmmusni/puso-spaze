// ─────────────────────────────────────────────
// components/FeelingPickerSheet.tsx
// Reusable inner contents of the "How are you feeling?" picker.
// Each screen wraps this in its own <Modal> so it can keep
// its own backdrop / positioning behaviour (anchored vs centered).
// ─────────────────────────────────────────────

import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  colors as defaultColors,
  fonts,
  radii,
  ambientShadow,
} from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { FEELING_OPTIONS } from "../constants/feelings";

type Variant = "compact" | "comfortable";

export interface FeelingPickerSheetProps {
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Visual size — `compact` matches HomeScreen, `comfortable` matches PostScreen. */
  variant?: Variant;
  /** Optional style for the outer card (e.g. absolute positioning). */
  style?: StyleProp<ViewStyle>;
  /** Stop touch events from bubbling to the parent backdrop. */
  stopPropagation?: boolean;
}

export default function FeelingPickerSheet({
  selected,
  onSelect,
  variant = "compact",
  style,
  stopPropagation = true,
}: FeelingPickerSheetProps) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors, variant), [colors, variant]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={stopPropagation ? (e) => e.stopPropagation() : undefined}
      style={[styles.sheet, style]}
    >
      <Text style={styles.title}>How are you feeling?</Text>
      <View style={styles.grid}>
        {FEELING_OPTIONS.map((f) => {
          const isActive = selected === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.option, isActive && styles.optionActive]}
              activeOpacity={0.8}
              onPress={() => onSelect(isActive ? null : f.key)}
            >
              <Text style={styles.emoji}>{f.emoji}</Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selected && (
        <TouchableOpacity
          style={styles.clearBtn}
          activeOpacity={0.8}
          onPress={() => onSelect(null)}
        >
          <Text style={styles.clearText}>Clear feeling</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (colors: typeof defaultColors, variant: Variant) => {
  const compact = variant === "compact";
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: compact ? 16 : 20,
      gap: compact ? 10 : 12,
      ...ambientShadow,
    },
    title: {
      color: colors.onSurface,
      fontSize: compact ? 16 : 18,
      fontFamily: fonts.displayBold,
      marginBottom: compact ? 2 : 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: compact ? 8 : 10,
    },
    option: {
      alignItems: "center",
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: compact ? radii.md : radii.lg,
      paddingHorizontal: compact ? 10 : 14,
      paddingVertical: compact ? 10 : 12,
      width: compact ? "30%" : "31%",
    },
    optionActive: {
      backgroundColor: colors.primaryContainer + "30",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    emoji: { fontSize: compact ? 20 : 24, marginBottom: compact ? 2 : 4 },
    label: {
      fontSize: compact ? 11 : 12,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurfaceVariant,
    },
    labelActive: {
      color: colors.primary,
    },
    clearBtn: {
      alignSelf: "center",
      paddingVertical: 10,
    },
    clearText: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
    },
  });
};
