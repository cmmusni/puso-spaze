import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import {
  colors as defaultColors,
  spacing,
  radii,
  ambientShadow,
} from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";

/**
 * Reusable skeleton placeholders that mirror the rough shape of common
 * list items / cards across the app. Visual only — they replace
 * `ActivityIndicator` blocks while data is loading.
 */

type Colors = typeof defaultColors;

const useColors = () => useThemeStore((s) => s.colors);

// ── Generic helpers ──────────────────────────────────────────────

export function SkeletonList({
  count = 3,
  Item,
}: {
  count?: number;
  Item: React.ComponentType;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </>
  );
}

// ── Post card (Home feed) ────────────────────────────────────────

function PostCardSkeletonInner({ colors }: { colors: Colors }) {
  return (
    <View
      style={[
        baseStyles.card,
        { backgroundColor: colors.card },
        ambientShadow,
      ]}
    >
      {/* Header row */}
      <View style={baseStyles.headerRow}>
        <SkeletonBox width={40} height={40} borderRadius={radii.full} />
        <View style={{ flex: 1, marginLeft: spacing.sm, gap: 6 }}>
          <SkeletonBox width={120} height={12} borderRadius={radii.sm} />
          <SkeletonBox width={70} height={10} borderRadius={radii.sm} />
        </View>
      </View>

      {/* Body lines */}
      <View style={{ marginTop: spacing.md, gap: 8 }}>
        <SkeletonBox width="100%" height={12} borderRadius={radii.sm} />
        <SkeletonBox width="92%" height={12} borderRadius={radii.sm} />
        <SkeletonBox width="60%" height={12} borderRadius={radii.sm} />
      </View>

      {/* Reactions row */}
      <View style={baseStyles.actionsRow}>
        <SkeletonBox width={60} height={24} borderRadius={radii.full} />
        <SkeletonBox width={60} height={24} borderRadius={radii.full} />
        <SkeletonBox width={60} height={24} borderRadius={radii.full} />
      </View>
    </View>
  );
}

export function PostCardSkeleton() {
  const colors = useColors();
  return <PostCardSkeletonInner colors={colors} />;
}

export function PostFeedSkeleton({ count = 3 }: { count?: number }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeletonInner key={i} colors={colors} />
      ))}
    </View>
  );
}

// ── Journal card ─────────────────────────────────────────────────

function JournalCardSkeletonInner({ colors }: { colors: Colors }) {
  return (
    <View
      style={[
        baseStyles.card,
        { backgroundColor: colors.card },
        ambientShadow,
      ]}
    >
      <View style={baseStyles.headerRow}>
        <SkeletonBox width={36} height={36} borderRadius={radii.md} />
        <View style={{ flex: 1, marginLeft: spacing.sm, gap: 6 }}>
          <SkeletonBox width="60%" height={14} borderRadius={radii.sm} />
          <SkeletonBox width={80} height={10} borderRadius={radii.sm} />
        </View>
      </View>
      <View style={{ marginTop: spacing.md, gap: 8 }}>
        <SkeletonBox width="100%" height={11} borderRadius={radii.sm} />
        <SkeletonBox width="85%" height={11} borderRadius={radii.sm} />
        <SkeletonBox width="40%" height={11} borderRadius={radii.sm} />
      </View>
    </View>
  );
}

export function JournalListSkeleton({ count = 3 }: { count?: number }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <JournalCardSkeletonInner key={i} colors={colors} />
      ))}
    </View>
  );
}

// ── Notification row ─────────────────────────────────────────────

function NotificationRowSkeletonInner({ colors }: { colors: Colors }) {
  return (
    <View
      style={[
        baseStyles.row,
        { backgroundColor: colors.card },
        ambientShadow,
      ]}
    >
      <SkeletonBox width={40} height={40} borderRadius={radii.full} />
      <View style={{ flex: 1, marginLeft: spacing.sm, gap: 6 }}>
        <SkeletonBox width="80%" height={12} borderRadius={radii.sm} />
        <SkeletonBox width="50%" height={10} borderRadius={radii.sm} />
      </View>
    </View>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <NotificationRowSkeletonInner key={i} colors={colors} />
      ))}
    </View>
  );
}

// ── Conversation row ─────────────────────────────────────────────

function ConversationRowSkeletonInner({ colors }: { colors: Colors }) {
  return (
    <View
      style={[
        baseStyles.row,
        { backgroundColor: colors.card },
        ambientShadow,
      ]}
    >
      <SkeletonBox width={48} height={48} borderRadius={radii.full} />
      <View style={{ flex: 1, marginLeft: spacing.sm, gap: 6 }}>
        <SkeletonBox width="55%" height={13} borderRadius={radii.sm} />
        <SkeletonBox width="80%" height={11} borderRadius={radii.sm} />
      </View>
      <SkeletonBox width={40} height={10} borderRadius={radii.sm} />
    </View>
  );
}

export function ConversationListSkeleton({ count = 4 }: { count?: number }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <ConversationRowSkeletonInner key={i} colors={colors} />
      ))}
    </View>
  );
}

// ── Coach card ───────────────────────────────────────────────────

function CoachCardSkeletonInner({ colors }: { colors: Colors }) {
  return (
    <View
      style={[
        baseStyles.card,
        { backgroundColor: colors.card },
        ambientShadow,
      ]}
    >
      <View style={baseStyles.headerRow}>
        <SkeletonBox width={56} height={56} borderRadius={radii.full} />
        <View style={{ flex: 1, marginLeft: spacing.md, gap: 8 }}>
          <SkeletonBox width="55%" height={14} borderRadius={radii.sm} />
          <SkeletonBox width="35%" height={11} borderRadius={radii.sm} />
        </View>
      </View>
      <View style={{ marginTop: spacing.md, gap: 8 }}>
        <SkeletonBox width="100%" height={11} borderRadius={radii.sm} />
        <SkeletonBox width="80%" height={11} borderRadius={radii.sm} />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <SkeletonBox width="100%" height={36} borderRadius={radii.md} />
      </View>
    </View>
  );
}

export function CoachListSkeleton({ count = 3 }: { count?: number }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <CoachCardSkeletonInner key={i} colors={colors} />
      ))}
    </View>
  );
}

// ── Chat message bubbles ─────────────────────────────────────────

function MessageBubbleSkeletonInner({
  colors,
  align,
  width,
}: {
  colors: Colors;
  align: "left" | "right";
  width: number;
}) {
  return (
    <View
      style={{
        alignSelf: align === "right" ? "flex-end" : "flex-start",
        marginVertical: 4,
        paddingHorizontal: spacing.md,
      }}
    >
      <View
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderRadius: radii.lg,
          padding: spacing.sm,
          gap: 6,
          width,
        }}
      >
        <SkeletonBox width="100%" height={10} borderRadius={radii.sm} />
        <SkeletonBox width="70%" height={10} borderRadius={radii.sm} />
      </View>
    </View>
  );
}

export function ChatMessageSkeleton({ count = 5 }: { count?: number }) {
  const colors = useColors();
  const widths = [180, 220, 140, 240, 160, 200, 120];
  return (
    <View style={{ paddingTop: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <MessageBubbleSkeletonInner
          key={i}
          colors={colors}
          align={i % 2 === 0 ? "left" : "right"}
          width={widths[i % widths.length]}
        />
      ))}
    </View>
  );
}

// ── Post detail ──────────────────────────────────────────────────

export function PostDetailSkeleton() {
  const colors = useColors();
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      <PostCardSkeletonInner colors={colors} />
      <View style={{ paddingHorizontal: spacing.sm, gap: spacing.sm }}>
        <SkeletonBox width={120} height={12} borderRadius={radii.sm} />
        <NotificationRowSkeletonInner colors={colors} />
        <NotificationRowSkeletonInner colors={colors} />
      </View>
    </View>
  );
}

// ── Shared base styles ───────────────────────────────────────────

const baseStyles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
