import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors, fonts, radii, ambientShadow } from "../constants/theme";
import { useUser } from "../hooks/useUser";
import { apiGetDashboardStats, type DashboardStats } from "../services/api";

const DAILY_GRACE_QUOTES = [
  "The world needs the light only you can carry.",
  "Your presence makes a difference. This space is safer because you are in it.",
  "You are stronger than you know, braver than you believe.",
];

const COACHES = [
  { name: "Coach Sarah", specialty: "Life & Wellness Coach" },
  { name: "Coach Mark", specialty: "Mindfulness Guide" },
];

export default function WebRightPanel() {
  const { username } = useUser();
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0, dailyStories: 0, onlineCount: 0,
    trendingTags: [], dailyReflection: null,
  });

  useFocusEffect(
    useCallback(() => {
      apiGetDashboardStats().then(setStats);
    }, []),
  );

  const displayName = username ?? "friend";
  const graceQuote = DAILY_GRACE_QUOTES[new Date().getDate() % DAILY_GRACE_QUOTES.length];

  const tagLabels: Record<string, { category: string; count: string }> = {
    encouragement: { category: "MOST SHARED", count: "1.2k souls sharing" },
    "daily-glow": { category: "DAILY MANTRA", count: "856 souls sharing" },
    "finding-peace": { category: "JOURNALING", count: "540 souls sharing" },
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Trending Reflections */}
      <View style={styles.panelCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="flame" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Trending Reflections</Text>
        </View>
        {stats.trendingTags && stats.trendingTags.length > 0 ? (
          <View style={styles.trendingList}>
            {stats.trendingTags.map((tag) => {
              const meta = tagLabels[tag] ?? { category: "TRENDING", count: "souls sharing" };
              return (
                <View key={tag} style={styles.trendingItem}>
                  <Text style={styles.trendingCategory}>{meta.category}</Text>
                  <Text style={styles.trendingTag}>#{tag}</Text>
                  <Text style={styles.trendingCount}>{meta.count}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No trending topics yet</Text>
        )}
      </View>

      {/* Daily Grace card */}
      <LinearGradient
        colors={[colors.primaryContainer, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.graceCard}
      >
        <Text style={styles.graceQuoteMark}>{"\u201C\u201C"}</Text>
        <Text style={styles.graceQuote}>
          Keep glowing, {displayName}. {graceQuote}
        </Text>
        <Text style={styles.graceLabel}>DAILY GRACE</Text>
      </LinearGradient>

      {/* Message a Coach */}
      <View style={styles.panelCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Message a Coach</Text>
        </View>
        {COACHES.map((coach) => {
          const initial = coach.name.split(" ").pop()?.charAt(0) ?? "C";
          return (
            <View key={coach.name} style={styles.coachRow}>
              <LinearGradient
                colors={[colors.secondary, colors.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.coachAvatar}
              >
                <Text style={styles.coachAvatarText}>{initial}</Text>
              </LinearGradient>
              <View style={styles.coachInfo}>
                <Text style={styles.coachName}>{coach.name}</Text>
                <Text style={styles.coachSpecialty}>{coach.specialty}</Text>
              </View>
              <TouchableOpacity style={styles.messageBtn} activeOpacity={0.7}>
                <Ionicons name="chatbubble" size={12} color={colors.primary} />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 200,
    padding: 20,
    backgroundColor: colors.surfaceContainerLow,
  },
  panelCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 20,
    marginBottom: 16,
    ...ambientShadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },
  trendingList: {
    gap: 16,
  },
  trendingItem: {
    gap: 3,
  },
  trendingCategory: {
    fontSize: 10,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.2,
  },
  trendingTag: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  trendingCount: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
  },
  graceCard: {
    borderRadius: radii.xl,
    padding: 28,
    marginBottom: 16,
  },
  graceQuoteMark: {
    fontSize: 36,
    color: "rgba(255,255,255,0.4)",
    fontFamily: fonts.displayExtraBold,
    lineHeight: 40,
    marginBottom: 6,
  },
  graceQuote: {
    fontSize: 16,
    color: colors.onPrimary,
    fontFamily: fonts.displayBold,
    lineHeight: 24,
    marginBottom: 20,
  },
  graceLabel: {
    fontSize: 10,
    fontFamily: fonts.displaySemiBold,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 2.5,
    textAlign: "right",
  },
  coachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  coachAvatarText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontFamily: fonts.displayBold,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurface,
  },
  coachSpecialty: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  messageBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
});
