// ─────────────────────────────────────────────
// screens/SpazeCoachScreen.tsx
// Coach list + conversation history
// Users: see coaches to message + their conversations
// Coaches: see all conversations across all users
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  SectionList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../context/UserContext";
import {
  apiFetchCoaches,
  apiFetchConversations,
  apiGetOrCreateConversation,
} from "../services/api";
import { colors, fonts, radii, spacing, ambientShadow } from "../constants/theme";
import type { CoachProfile, Conversation } from "../../../packages/types";

export default function SpazeCoachScreen({ navigation }: any) {
  const { userId, role } = useUserStore();
  const isCoach = role === "COACH" || role === "ADMIN";

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
      // Filter out the current user from the coaches list
      setCoaches(coachRes.coaches.filter((c) => c.id !== userId));
      setConversations(convRes.conversations);
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

  // Re-fetch when screen comes into focus
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
      navigation.navigate("Chat", { conversationId: res.conversation.id });
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

  const getInitial = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // ── Render coach card ─────────────────────
  const renderCoachCard = ({ item }: { item: CoachProfile }) => {
    const isStarting = startingChat === item.id;
    return (
      <View style={styles.coachCard}>
        <View style={styles.coachAvatar}>
          <LinearGradient
            colors={[colors.primaryContainer, colors.secondary]}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>{getInitial(item.displayName)}</Text>
          </LinearGradient>
        </View>
        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>{item.displayName}</Text>
          <Text style={styles.coachRole}>
            {item.role === "ADMIN" ? "Lead Coach" : "Wellness Coach"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleMessageCoach(item.id)}
          disabled={isStarting}
          style={styles.messageBtn}
          activeOpacity={0.75}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="chatbubble" size={14} color={colors.primary} />
              <Text style={styles.messageBtnText}>Message</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render conversation card ──────────────
  const renderConversationCard = ({ item }: { item: Conversation }) => {
    const otherName = isCoach
      ? `${item.user?.displayName ?? "User"} → ${item.coach?.displayName ?? "Coach"}`
      : item.coach?.displayName ?? "Coach";
    const initial = isCoach
      ? getInitial(item.user?.displayName)
      : getInitial(item.coach?.displayName);
    const lastMsg = item.lastMessage;
    const preview = lastMsg
      ? `${lastMsg.sender?.displayName ?? "..."}: ${lastMsg.content}`
      : "No messages yet";
    const time = lastMsg ? formatTime(lastMsg.createdAt) : formatTime(item.createdAt);

    return (
      <TouchableOpacity
        onPress={() => handleOpenConversation(item.id)}
        activeOpacity={0.8}
        style={styles.conversationCard}
      >
        <View style={styles.convAvatar}>
          <LinearGradient
            colors={[colors.primaryContainer, colors.secondary]}
            style={styles.avatarGradientSmall}
          >
            <Text style={styles.avatarTextSmall}>{initial}</Text>
          </LinearGradient>
        </View>
        <View style={styles.convContent}>
          <View style={styles.convTopRow}>
            <Text style={styles.convName} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={styles.convTime}>{time}</Text>
          </View>
          <Text style={styles.convPreview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Empty state ───────────────────────────
  const renderEmptyConversations = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={40} color={colors.muted3} />
      <Text style={styles.emptyText}>No conversations yet</Text>
      <Text style={styles.emptySubtext}>
        {isCoach
          ? "Conversations from members will appear here."
          : "Send a message to a coach to get started."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* ── Top bar ── */}
      <LinearGradient
        colors={[colors.primaryContainer, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topBar}
      >
        <TouchableOpacity
          onPress={() => navigation.openDrawer?.() ?? navigation.goBack()}
          style={styles.topBarBtn}
        >
          <Ionicons name="menu" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Ionicons name="chatbubbles" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
          <Text style={styles.topBarTitle}>Spaze Coach</Text>
        </View>
        <View style={styles.topBarBtn} />
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationCard}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {/* ── Coach list (users only, or coaches can message other coaches) ── */}
              {coaches.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Message a Coach</Text>
                  <View style={styles.coachListCard}>
                    {coaches.map((coach, idx) => (
                      <React.Fragment key={coach.id}>
                        {renderCoachCard({ item: coach })}
                        {idx < coaches.length - 1 && <View style={styles.coachDivider} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Conversations header ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {isCoach ? "All Conversations" : "My Conversations"}
                </Text>
                {conversations.length > 0 && (
                  <Text style={styles.sectionSubtitle}>
                    {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
                  </Text>
                )}
              </View>
            </>
          }
          ListEmptyComponent={renderEmptyConversations}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Top bar ─────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 14) + 14 : 14,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
    ...(Platform.OS === "web"
      ? { maxWidth: 680, alignSelf: "center" as any, width: "100%" as any }
      : {}),
  },

  // ── Section ───────────────────────────────
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted5,
    marginBottom: spacing.sm,
  },

  // ── Coach list ────────────────────────────
  coachListCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...ambientShadow,
  },
  coachCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  coachDivider: {
    height: 1,
    backgroundColor: colors.muted1,
  },
  coachAvatar: {
    marginRight: 14,
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },
  coachRole: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted5,
    marginTop: 2,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  messageBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },

  // ── Conversation card ─────────────────────
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: spacing.sm,
    ...ambientShadow,
  },
  convAvatar: {
    marginRight: 12,
  },
  avatarGradientSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextSmall: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  convContent: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  convName: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
  },
  convPreview: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted5,
  },

  // ── Empty ─────────────────────────────────
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted5,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
