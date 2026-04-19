// ─────────────────────────────────────────────
// screens/SpazeCoachScreen.tsx
// Coach list + conversation history — Sacred Journal design
// Users: see coaches to message + their conversations
// Coaches: see all conversations across all users
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../context/UserContext";
import {
  apiFetchCoaches,
  apiFetchConversations,
  apiGetOrCreateConversation,
  resolveAvatarUrl,
} from "../services/api";
import { colors as defaultColors, fonts, radii, spacing, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useScrollBarVisibility } from "../hooks/useScrollBarVisibility";
import type { CoachProfile, Conversation } from "../../../packages/types";

const DEFAULT_SPECIALTIES = ["Wellness", "Support"];

export default function SpazeCoachScreen({ navigation }: any) {
  const { userId, role } = useUserStore();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const s = useMemo(() => createStyles(colors), [colors]);
  const isCoach = role === "COACH" || role === "ADMIN";
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  const flatListRef = useRef<FlatList>(null);
  const scrollToTopTrigger = useScrollBarVisibility((s) => s.scrollToTopTrigger);
  const scrollToTopRef = useRef(scrollToTopTrigger);
  useEffect(() => {
    if (scrollToTopTrigger > 0 && scrollToTopTrigger !== scrollToTopRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    scrollToTopRef.current = scrollToTopTrigger;
  }, [scrollToTopTrigger]);

  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [coachRes, convRes] = await Promise.all([
        apiFetchCoaches(),
        apiFetchConversations(userId),
      ]);
      setCoaches(coachRes.coaches.filter((c) => c.id !== userId && c.id !== 'system-encouragement-bot'));
      setConversations(convRes.conversations.filter((c) => c.userId !== 'system-encouragement-bot' && c.coachId !== 'system-encouragement-bot'));
    } catch (err) {
      console.error("Failed to fetch coach data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ── Start or open conversation ────────────
  const handleMessageCoach = async (coachId: string) => {
    if (!userId) return;
    setStartingChat(coachId);
    try {
      const res = await apiGetOrCreateConversation({ userId, coachId });
      const coach = coaches.find((c: any) => c.id === coachId);
      navigation.navigate("Chat", {
        conversationId: res.conversation.id,
        coachName: coach ? coach.displayName : undefined,
      });
    } catch (err) {
      console.error("Failed to start conversation:", err);
    } finally {
      setStartingChat(null);
    }
  };

  const handleOpenConversation = (conversationId: string) => {
    navigation.navigate("Chat", { conversationId });
  };

  // ── Format date ───────────────────────────
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getInitial = (name?: string) =>
    name ? name.charAt(0).toUpperCase() : "?";

  // ── Avatar palette ────────────────────────
  const avatarPalette: [string, string][] = [
    [colors.secondary, colors.primary],
    [colors.primaryContainer, colors.primary],
    [colors.secondary, colors.primaryContainer],
    [colors.primaryContainer, colors.tertiary],
    [colors.secondary, colors.tertiary],
  ];

  const getAvatarColors = (name?: string): [string, string] => {
    const ch = (name ?? "?").charAt(0).toUpperCase();
    return avatarPalette[ch.charCodeAt(0) % avatarPalette.length];
  };

  // ── Render coach card (horizontal) ────────
  const renderCoachCard = (item: CoachProfile) => {
    const isStarting = startingChat === item.id;
    const grad = getAvatarColors(item.displayName);
    const isOnline = !!item.lastActiveAt &&
      Date.now() - new Date(item.lastActiveAt).getTime() < 15 * 60 * 1000;

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => handleMessageCoach(item.id)}
        disabled={isStarting}
        activeOpacity={0.85}
        style={[s.coachCard, { backgroundColor: colors.surfaceContainerLowest }]}
      >
        <View style={s.coachAvatarWrap}>
          {item.avatarUrl ? (
            <Image
              source={{ uri: resolveAvatarUrl(item.avatarUrl) }}
              style={s.coachAvatarImg}
            />
          ) : (
            <LinearGradient
              colors={grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.coachAvatarGrad}
            >
              <Text style={[s.coachAvatarText, { color: colors.onPrimary }]}>
                {getInitial(item.displayName)}
              </Text>
            </LinearGradient>
          )}
          <View style={[s.onlineDot, { borderColor: colors.surfaceContainerLowest, backgroundColor: isOnline ? colors.safe : colors.muted4 }]} />
        </View>
        <Text style={[s.coachCardName, { color: colors.onSurface }]} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={[s.coachCardRole, { color: colors.muted5 }]}>
          {item.role === "ADMIN" ? "Lead Coach" : "Wellness Coach"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.specialtyRow} contentContainerStyle={s.specialtyRowContent}>
          {(item.specialties && item.specialties.length > 0 ? item.specialties : DEFAULT_SPECIALTIES).map((tag) => (
            <View key={tag} style={[s.specialtyChip, { backgroundColor: colors.secondaryFixed }]}>
              <Text style={[s.specialtyText, { color: colors.onSecondaryFixed }]} numberOfLines={1}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
        {isStarting ? (
          <View style={[s.coachMsgBtn, { backgroundColor: colors.secondary }]}>
            <ActivityIndicator size="small" color={colors.onPrimary} />
          </View>
        ) : (
          <View style={[s.coachMsgBtn, { backgroundColor: colors.secondary }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.onPrimary} />
            <Text style={[s.coachMsgBtnText, { color: colors.onPrimary }]}>Message</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Render conversation card ──────────────
  const renderConversationCard = ({ item }: { item: Conversation }) => {
    const otherName = isCoach
      ? item.user?.displayName ?? "User"
      : item.coach?.displayName ?? "Coach";
    const otherAvatar = isCoach ? item.user?.avatarUrl : item.coach?.avatarUrl;
    const initial = getInitial(otherName);
    const grad = getAvatarColors(otherName);
    const lastMsg = item.lastMessage;
    const preview = lastMsg ? lastMsg.content : "No messages yet";
    const senderLabel = lastMsg?.sender?.displayName
      ? `${lastMsg.sender.displayName}: `
      : "";
    const time = lastMsg ? formatTime(lastMsg.createdAt) : formatTime(item.createdAt);

    return (
      <TouchableOpacity
        onPress={() => handleOpenConversation(item.id)}
        activeOpacity={0.8}
        style={[s.convCard, { backgroundColor: colors.surfaceContainerLowest }]}
      >
        <View style={s.convAvatarWrap}>
          {otherAvatar ? (
            <Image
              source={{ uri: resolveAvatarUrl(otherAvatar) }}
              style={s.convAvatarImg}
            />
          ) : (
            <LinearGradient
              colors={grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.convAvatarGrad}
            >
              <Text style={[s.convAvatarText, { color: colors.onPrimary }]}>{initial}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={s.convBody}>
          <View style={s.convTopRow}>
            <Text style={[s.convName, { color: colors.onSurface }]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={[s.convTime, { color: colors.muted4 }]}>{time}</Text>
          </View>
          <Text style={[s.convPreview, { color: colors.muted5 }]} numberOfLines={1}>
            {senderLabel ? (
              <Text style={[s.convPreviewSender, { color: colors.onSurfaceVariant }]}>
                {senderLabel}
              </Text>
            ) : null}
            {preview}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted3} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  // ── Empty state ───────────────────────────
  const renderEmptyConversations = () => (
    <View style={s.emptyState}>
      <View style={s.emptyIconWrap}>
        <LinearGradient
          colors={[colors.secondaryFixed, colors.surfaceContainerHigh]}
          style={s.emptyIconGrad}
        >
          <Ionicons name="chatbubbles-outline" size={36} color={colors.secondary} />
        </LinearGradient>
      </View>
      <Text style={[s.emptyTitle, { color: colors.onSurface }]}>No conversations yet</Text>
      <Text style={[s.emptySubtext, { color: colors.muted5 }]}>
        {isCoach
          ? "When members reach out, their conversations will appear here."
          : "Tap on a coach above to start a private, safe conversation."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <FlatList
        ref={flatListRef}
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationCard}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.listContent, isWide && s.listContentWide]}
        ListHeaderComponent={
          <>
            {/* ── Hero Header ── */}
            <View style={s.heroCard}>
              <LinearGradient
                colors={[colors.primaryContainer, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.heroBg}
              >
                <View style={s.heroContent}>
                  <View style={s.heroIconWrap}>
                    <Ionicons name="heart-circle" size={38} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={s.heroTitle}>Spaze Coach</Text>
                  <Text style={s.heroSubtitle}>
                    {isCoach
                      ? "Manage conversations and support your community"
                      : "Connect with a coach for guidance and support"}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* ── Coach carousel ── */}
            {coaches.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="people" size={18} color={colors.primary} />
                  <Text style={[s.sectionTitle, { color: colors.onSurface }]}>Available Coaches</Text>
                </View>
                <FlatList
                  data={coaches}
                  keyExtractor={(coach) => coach.id}
                  renderItem={({ item }) => renderCoachCard(item)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.coachScroll}
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS !== "web"}
                />
              </View>
            )}

            {/* ── Conversations header ── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Ionicons name="chatbubbles" size={18} color={colors.primary} />
                <Text style={[s.sectionTitle, { color: colors.onSurface }]}>
                  {isCoach ? "All Conversations" : "My Conversations"}
                </Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            renderEmptyConversations()
          )
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  loadingWrap: {
    paddingTop: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  listContentWide: {
    maxWidth: 720,
    alignSelf: "center" as any,
    width: "100%" as any,
  },

  // ── Hero header ───────────────────────────
  heroCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    ...ambientShadow,
  },
  heroBg: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  heroBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: fonts.displayBold,
    color: "#FFFFFF",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },

  // ── Section ───────────────────────────────
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Coach carousel ────────────────────────
  coachScroll: {
    paddingRight: spacing.md,
    gap: 12,
  },
  coachCard: {
    borderRadius: radii.xl,
    padding: spacing.md,
    alignItems: "center",
    width: 154,
    ...ambientShadow,
  },
  coachAvatarWrap: {
    position: "relative",
    marginBottom: 10,
  },
  coachAvatarGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  coachAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  coachAvatarText: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.safe,
    borderWidth: 2.5,
  },
  coachCardName: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    textAlign: "center",
    marginBottom: 2,
  },
  coachCardRole: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    textAlign: "center",
    marginBottom: 8,
  },
  specialtyRow: {
    marginBottom: 12,
    maxWidth: "100%" as any,
  },
  specialtyRowContent: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 1,
  },
  specialtyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  specialtyText: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
  },
  coachMsgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    width: "100%" as any,
  },
  coachMsgBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Conversation card ─────────────────────
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    ...ambientShadow,
  },
  convAvatarWrap: {
    marginRight: 12,
  },
  convAvatarGrad: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  convAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  convAvatarText: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
  },
  convBody: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  convName: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
  },
  convPreview: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
  },
  convPreviewSender: {
    fontFamily: fonts.bodySemiBold,
  },

  // ── Empty ─────────────────────────────────
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    marginBottom: spacing.md,
  },
  emptyIconGrad: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: fonts.displaySemiBold,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
});
