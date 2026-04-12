import React, { useCallback, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { colors as defaultColors, fonts, radii, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useUser } from "../hooks/useUser";
import { apiGetDashboardStats, apiFetchCoaches, apiGetOrCreateConversation, getBaseUrl, type DashboardStats } from "../services/api";
import type { CoachProfile } from "../../../packages/types";

const DAILY_GRACE_QUOTES = [
  "The world needs the light only you can carry.",
  "Your presence makes a difference. This space is safer because you are in it.",
  "You are stronger than you know, braver than you believe.",
];

export default function WebRightPanel() {
  const { username, userId } = useUser();
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0, dailyStories: 0, onlineCount: 0,
    trendingTags: [], dailyReflection: null,
  });
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [messagingCoachId, setMessagingCoachId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiGetDashboardStats(userId ?? undefined).then(setStats);
      apiFetchCoaches()
        .then((res) => setCoaches(res.coaches))
        .catch(() => {});
    }, [userId]),
  );

  const handleMessageCoach = async (coachId: string) => {
    if (!userId || messagingCoachId) return;
    setMessagingCoachId(coachId);
    try {
      const res = await apiGetOrCreateConversation({ userId, coachId });
      const coach = coaches.find((c) => c.id === coachId);
      navigation.navigate("Chat", {
        conversationId: res.conversation.id,
        coachName: coach ? `Coach ${coach.displayName}` : undefined,
      });
    } catch {
      // silent — user can retry
    } finally {
      setMessagingCoachId(null);
    }
  };

  const displayName = username ?? "friend";
  const graceQuote = DAILY_GRACE_QUOTES[new Date().getDate() % DAILY_GRACE_QUOTES.length];

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
            {stats.trendingTags.map((item) => {
              return (
                <View key={item.tag} style={styles.trendingItem}>
                  <Text style={styles.trendingCategory}>TRENDING</Text>
                  <Text style={styles.trendingTag}>#{item.tag}</Text>
                  <Text style={styles.trendingCount}>
                    {item.count} {item.count === 1 ? 'soul sharing' : 'souls sharing'}
                  </Text>
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
        {coaches.length > 0 ? (
          coaches.map((coach) => {
            const initial = coach.displayName.charAt(0).toUpperCase();
            return (
              <View key={coach.id} style={styles.coachRow}>
                {coach.avatarUrl ? (
                  <Image
                    source={{ uri: `${getBaseUrl()}${coach.avatarUrl}` }}
                    style={styles.coachAvatar}
                  />
                ) : (
                <LinearGradient
                  colors={[colors.secondary, colors.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.coachAvatar}
                >
                  <Text style={styles.coachAvatarText}>{initial}</Text>
                </LinearGradient>
                )}
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{coach.displayName}</Text>
                  <Text style={styles.coachSpecialty}>Spaze Coach</Text>
                </View>
                <TouchableOpacity
                  style={styles.messageBtn}
                  activeOpacity={0.7}
                  onPress={() => handleMessageCoach(coach.id)}
                  disabled={messagingCoachId === coach.id}
                >
                  <Ionicons name="chatbubble" size={12} color={colors.primary} />
                  <Text style={styles.messageBtnText}>
                    {messagingCoachId === coach.id ? 'Opening...' : 'Message'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No coaches available yet</Text>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  container: {
    maxWidth: 400,
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 16,
    backgroundColor: colors.background,
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
