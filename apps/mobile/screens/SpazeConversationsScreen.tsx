// ─────────────────────────────────────────────
// screens/SpazeConversationsScreen.tsx
// Community-wide view of all member ↔ coach conversations
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
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../context/UserContext";
import { apiFetchAllConversations, apiDeleteConversation, getBaseUrl, resolveAvatarUrl } from "../services/api";
import { colors as defaultColors, fonts, radii, spacing, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { showConfirm } from "../utils/alertPlatform";
import type { Conversation } from "../../../packages/types";
import { useScrollBarVisibility } from "../hooks/useScrollBarVisibility";

export default function SpazeConversationsScreen({ navigation }: any) {
  const { userId, role } = useUserStore();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const s = useMemo(() => createStyles(colors), [colors]);
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

  const isAdmin = role === 'ADMIN';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetchAllConversations();
      setConversations(res.conversations.filter((c) => c.userId !== 'system-encouragement-bot' && c.coachId !== 'system-encouragement-bot'));
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const handleDeleteConversation = useCallback(async (convId: string, memberName: string, coachName: string) => {
    const confirmed = await showConfirm(
      'Delete Conversation',
      `Delete conversation between ${memberName} and ${coachName}? This will permanently remove all messages.`
    );
    if (!confirmed) return;
    try {
      await apiDeleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, []);

  // ── Block render for non-coaches ─────────

  // ── Filter conversations ──────────────────
  const filtered = search.trim()
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.user?.displayName?.toLowerCase().includes(q) ||
          c.coach?.displayName?.toLowerCase().includes(q) ||
          c.lastMessage?.content?.toLowerCase().includes(q)
        );
      })
    : conversations;

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

  // ── Render conversation card ──────────────
  const renderConversation = ({ item }: { item: Conversation }) => {
    const memberName = item.user?.displayName ?? "Member";
    const coachName = item.coach?.displayName ?? "Coach";
    const memberAvatar = item.user?.avatarUrl;
    const coachAvatar = item.coach?.avatarUrl;
    const memberInitial = getInitial(memberName);
    const coachInitial = getInitial(coachName);
    const memberGrad = getAvatarColors(memberName);
    const coachGrad = getAvatarColors(coachName);
    const lastMsg = item.lastMessage;
    const preview = lastMsg ? lastMsg.content : "No messages yet";
    const senderLabel = lastMsg?.sender?.displayName ?? "";
    const time = lastMsg ? formatTime(lastMsg.createdAt) : formatTime(item.updatedAt);
    const msgCount = item.messageCount ?? 0;
    const isMyConversation = item.userId === userId || item.coachId === userId;
    const isPending = !lastMsg || lastMsg.senderId !== item.coachId;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("Chat", {
          conversationId: item.id,
          convUserId: item.userId,
          convCoachId: item.coachId,
        })}
        activeOpacity={0.85}
        style={[s.convCard, { backgroundColor: colors.surfaceContainerLowest }]}
      >
        {/* Dual avatar */}
        <View style={s.dualAvatarWrap}>
          {memberAvatar ? (
            <Image
              source={{ uri: resolveAvatarUrl(memberAvatar) }}
              style={s.avatarLeft}
            />
          ) : (
            <LinearGradient
              colors={memberGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.avatarLeft}
            >
              <Text style={[s.avatarText, { color: colors.onPrimary }]}>{memberInitial}</Text>
            </LinearGradient>
          )}
          {coachAvatar ? (
            <Image
              source={{ uri: resolveAvatarUrl(coachAvatar) }}
              style={[s.avatarRight, { borderColor: colors.surfaceContainerLowest }]}
            />
          ) : (
            <LinearGradient
              colors={coachGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.avatarRight, { borderColor: colors.surfaceContainerLowest }]}
            >
              <Text style={[s.avatarTextSmall, { color: colors.onPrimary }]}>{coachInitial}</Text>
            </LinearGradient>
          )}
        </View>

        {/* Content */}
        <View style={s.convBody}>
          <View style={s.convTopRow}>
            <View style={s.convNames}>
              <Text style={[s.memberName, { color: colors.onSurface }]} numberOfLines={1}>
                {memberName}
              </Text>
              <Ionicons name="arrow-forward" size={12} color={colors.muted4} style={{ marginHorizontal: 4 }} />
              <Text style={[s.coachNameLabel, { color: colors.secondary }]} numberOfLines={1}>
                {coachName}
              </Text>
            </View>
            <Text style={[s.convTime, { color: colors.muted4 }]}>{time}</Text>
          </View>

          <Text style={[s.convPreview, { color: colors.muted5 }]} numberOfLines={1}>
            {senderLabel ? (
              <Text style={[s.convPreviewSender, { color: colors.onSurfaceVariant }]}>
                {senderLabel}:{" "}
              </Text>
            ) : null}
            {preview}
          </Text>

          {/* Meta row */}
          <View style={s.metaRow}>
            {msgCount > 0 && (
              <View style={s.metaChip}>
                <Ionicons name="chatbubble-outline" size={11} color={colors.muted5} />
                <Text style={[s.metaText, { color: colors.muted5 }]}>
                  {msgCount} {msgCount === 1 ? "message" : "messages"}
                </Text>
              </View>
            )}
            {isPending && (
              <View style={[s.pendingBadge, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="time-outline" size={10} color={colors.tertiary} />
                <Text style={[s.pendingBadgeText, { color: colors.tertiary }]}>Pending</Text>
              </View>
            )}
            {isMyConversation && (
              <View style={[s.myBadge, { backgroundColor: colors.secondaryFixed }]}>
                <Text style={[s.myBadgeText, { color: colors.onSecondaryFixed }]}>You</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.muted3} style={{ marginLeft: 4 }} />

        {isAdmin && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              handleDeleteConversation(item.id, memberName, coachName);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.deleteBtn}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ── Empty state ───────────────────────────
  const renderEmpty = () => {
    const isSearching = search.trim().length > 0;
    return (
      <View style={s.emptyState}>
        <View style={s.emptyIconWrap}>
          <LinearGradient
            colors={[colors.secondaryFixed, colors.surfaceContainerHigh]}
            style={s.emptyIconGrad}
          >
            <Ionicons
              name={isSearching ? "search-outline" : "people-outline"}
              size={36}
              color={colors.secondary}
            />
          </LinearGradient>
        </View>
        <Text style={[s.emptyTitle, { color: colors.onSurface }]}>
          {isSearching ? "No results found" : "No conversations yet"}
        </Text>
        <Text style={[s.emptySubtext, { color: colors.muted5 }]}>
          {isSearching
            ? `No conversations matching "${search.trim()}". Try a different name or keyword.`
            : "When members start chatting with coaches, conversations will appear here."}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <FlatList
        ref={flatListRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
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
                    <Ionicons name="people-circle" size={38} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={s.heroTitle}>Spaze Conversations</Text>
                  <Text style={s.heroSubtitle}>
                    All conversations between members and coaches in the community
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* ── Search bar ── */}
            <View style={[s.searchWrap, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Ionicons name="search" size={16} color={colors.muted4} />
              <TextInput
                style={[s.searchInput, { color: colors.onSurface }]}
                placeholder="Search by name or message…"
                placeholderTextColor={colors.muted4}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={16} color={colors.muted4} />
                </TouchableOpacity>
              )}
            </View>

            {/* ── Stats row ── */}
            <View style={s.statsRow}>
              <View style={[s.statCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                <Ionicons name="people" size={18} color={colors.secondary} />
                <Text style={[s.statNumber, { color: colors.onSurface }]}>
                  {new Set(conversations.map((c) => c.userId)).size}
                </Text>
                <Text style={[s.statLabel, { color: colors.muted5 }]}>Members</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                <Ionicons name="heart" size={18} color={colors.tertiary} />
                <Text style={[s.statNumber, { color: colors.onSurface }]}>
                  {new Set(conversations.map((c) => c.coachId)).size}
                </Text>
                <Text style={[s.statLabel, { color: colors.muted5 }]}>Coaches</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                <Ionicons name="chatbubbles" size={18} color={colors.primary} />
                <Text style={[s.statNumber, { color: colors.onSurface }]}>
                  {conversations.filter((c) => !c.lastMessage || c.lastMessage.senderId !== c.coachId).length}
                </Text>
                <Text style={[s.statLabel, { color: colors.muted5 }]}>Pending Chats</Text>
              </View>
            </View>

            {/* ── Section header ── */}
            <View style={s.sectionHeader}>
              <Ionicons name="chatbubbles" size={18} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.onSurface }]}>
                All Conversations
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            renderEmpty()
          )
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  safeArea: { flex: 1 },

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

  // ── Hero ──────────────────────────────────
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
    maxWidth: 320,
  },

  // ── Search ────────────────────────────────
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    padding: 0,
  },

  // ── Stats ─────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: radii.xl,
    padding: 14,
    alignItems: "center",
    gap: 4,
    ...ambientShadow,
  },
  statNumber: {
    fontSize: 22,
    fontFamily: fonts.displayExtraBold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
  },

  // ── Section ───────────────────────────────
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

  // ── Conversation card ─────────────────────
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    ...ambientShadow,
  },
  dualAvatarWrap: {
    width: 52,
    height: 44,
    marginRight: 12,
    position: "relative",
  },
  avatarLeft: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    left: 0,
  },
  avatarRight: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
  },
  avatarTextSmall: {
    fontSize: 11,
    fontFamily: fonts.displayBold,
  },
  convBody: { flex: 1 },
  convTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  convNames: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    flexShrink: 1,
  },
  coachNameLabel: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    flexShrink: 1,
  },
  convTime: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
  },
  convPreview: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    marginBottom: 4,
  },
  convPreviewSender: {
    fontFamily: fonts.bodySemiBold,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
  },
  myBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  myBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
  },
  deleteBtn: {
    marginLeft: 4,
    padding: 4,
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
