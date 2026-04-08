import React, { useCallback, useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, SafeAreaView, ListRenderItem, StatusBar,
  StyleSheet, ScrollView, Platform, Image, useWindowDimensions,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, ambientShadow } from "../constants/theme";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { usePosts } from "../hooks/usePosts";
import { useUser } from "../hooks/useUser";
import { useNotifications } from "../hooks/useNotifications";
import { apiGetDashboardStats, type DashboardStats } from "../services/api";
import PostCard from "../components/PostCard";
import type { Post } from "../../../packages/types";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";

type HomeNav = DrawerNavigationProp<MainDrawerParamList, "Home">;

const CATEGORIES = ["All Stories", "Daily Reflection", "Community"] as const;
type Category = typeof CATEGORIES[number];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { username, role, userId } = useUser();
  const isCoach = role === "COACH" || role === "ADMIN";
  const { posts, loading, error, fetchPosts } = usePosts();
  const { unreadCount, refreshUnreadCount } = useNotifications(userId);
  const [activeCategory, setActiveCategory] = useState<Category>("All Stories");
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0, dailyStories: 0, onlineCount: 0,
    trendingTags: [], dailyReflection: null,
  });

  const loadStats = useCallback(async () => {
    const d = await apiGetDashboardStats();
    setStats(d);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      refreshUnreadCount();
      loadStats();
    }, [fetchPosts, refreshUnreadCount, loadStats]),
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchPosts(), refreshUnreadCount(), loadStats()]);
  }, [fetchPosts, refreshUnreadCount, loadStats]);

  const handleDeletePost = useCallback(() => {
    fetchPosts();
  }, [fetchPosts]);

  const renderItem: ListRenderItem<Post> = useCallback(
    ({ item }) => <PostCard post={item} onDelete={handleDeletePost} />,
    [handleDeletePost],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const fmtNum = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

  const displayName = username ?? "...";
  const initial = displayName.charAt(0).toUpperCase();

  const ListHeader = () => (
    <View>
      {/* ── Greeting section ── */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>
          {getGreeting()},{"\n"}
          {isCoach ? "Coach " : ""}
          {displayName}.
        </Text>
        <Text style={styles.greetingSub}>
          Welcome to your sacred space. What is on your heart today?
        </Text>
      </View>

      {/* ── Category filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
        style={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Daily Reflection card ── */}
      {stats.dailyReflection && activeCategory !== "Community" && (
        <View style={styles.section}>
          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionQuote}>
              {stats.dailyReflection.content.length > 200
                ? stats.dailyReflection.content.slice(0, 200) + "..."
                : stats.dailyReflection.content}
            </Text>
          </View>
        </View>
      )}

      {/* ── Keep Glowing encouragement card (hidden on wide - in right panel) ── */}
      {!isWide && (<>
      <View style={styles.section}>
        <LinearGradient
          colors={[colors.surfaceContainerLow, colors.surfaceVariant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.encourageCard}
        >
          <View style={styles.encourageSparkles}>
            <Ionicons name="sparkles" size={28} color={colors.secondary} />
          </View>
          <Text style={styles.encourageTitle}>Keep Glowing</Text>
          <Text style={styles.encourageQuote}>
            {"\u201C"}Remember that your presence makes a difference. This space is safer because you are in it.{"\u201D"}
          </Text>
        </LinearGradient>
      </View>

      {/* ── Spaze Stats (collapsed) ── */}
      <View style={styles.section}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{fmtNum(stats.totalMembers)}</Text>
            <Text style={styles.statLbl}>{"Active\nMembers"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.dailyStories}</Text>
            <Text style={styles.statLbl}>{"Daily\nStories"}</Text>
          </View>
        </View>
      </View>

      {stats.trendingTags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRENDING TOPICS</Text>
          <View style={styles.tagsRow}>
            {stats.trendingTags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      </>)}

      <View style={styles.feedHeaderSpacer} />
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="sparkles-outline" size={36} color={colors.card} />
      </View>
      <Text style={styles.emptyTitle}>The space is quiet...</Text>
      <Text style={styles.emptySub}>
        Be the first to share a prayer or word of encouragement!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {!isWide && (
            <TouchableOpacity
              onPress={() => navigation.openDrawer()}
              activeOpacity={0.7}
              style={styles.hamburger}
            >
              <Ionicons name="menu-outline" size={24} color={colors.heading} />
            </TouchableOpacity>
          )}
          {!isWide && (
            <Image
              source={require("../assets/logo.png")}
              style={styles.topBarLogo}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.muted4} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for encouragement, stories..."
            placeholderTextColor={colors.muted4}
            editable={false}
          />
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.7}
            style={styles.topBarIconBtn}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.heading} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.topBarIconBtn}
          >
            <Ionicons name="settings-outline" size={20} color={colors.heading} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.7}
            style={styles.avatarBtn}
          >
            <LinearGradient
              colors={[colors.primaryContainer, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.topBarAvatar}
            >
              <Text style={styles.topBarAvatarText}>{initial}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={!loading ? <ListEmpty /> : null}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {loading && posts.length === 0 && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <View style={styles.fabWrap}>

        <View style={{ flex: 1 }} />

        {/* FAB */}
        <TouchableOpacity
          onPress={() => navigation.getParent()?.navigate("Post")}
          activeOpacity={0.85}
          style={styles.fab}
        >
          <LinearGradient
            colors={[colors.secondary, colors.primaryContainer, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGrad}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.onPrimary} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // ── Top bar — glass-like, no hard border ──
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLowest,
    gap: 12,
  },
  hamburger: { padding: 4 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  topBarLogo: { width: 36, height: 36 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    padding: 0,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    position: "relative",
    backgroundColor: colors.surfaceContainerLow,
  },
  notifBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: colors.danger, borderRadius: 6,
    minWidth: 12, height: 12,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2,
  },
  notifBadgeText: { color: colors.onPrimary, fontSize: 7, fontFamily: fonts.bodyBold },
  avatarBtn: { position: "relative" },
  topBarAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  topBarAvatarText: {
    color: colors.onPrimary, fontSize: 14, fontFamily: fonts.displayBold,
  },

  // ── Greeting — display-lg, generous leading ──
  greetingSection: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 8 },
  greetingText: {
    fontSize: 32, fontFamily: fonts.displayBold, color: colors.onSurface, lineHeight: 42,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 16, fontFamily: fonts.bodyRegular, color: colors.onSurfaceVariant,
    marginTop: 8, lineHeight: 24,
  },

  // ── Category filter — reflection chips ──
  categoryScroll: { marginTop: 24 },
  categoryRow: { paddingHorizontal: 28, gap: 10 },
  categoryChip: {
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.onSurfaceVariant,
  },
  categoryTextActive: { color: colors.onPrimary },

  // ── Sections — generous sacred space ──
  section: { paddingHorizontal: 28, marginTop: 28 },
  sectionLabel: {
    fontSize: 11, fontFamily: fonts.displaySemiBold, color: colors.onSurfaceVariant,
    letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" as any,
  },

  // ── Daily reflection card ──
  reflectionCard: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: radii.xl,
    padding: 28,
    ...ambientShadow,
  },
  reflectionQuote: {
    fontSize: 16, fontFamily: fonts.bodyItalic, color: colors.onSurface, lineHeight: 26,
  },

  // ── Encouragement card — soft gradient, no border ──
  encourageCard: {
    borderRadius: radii.xl, padding: 32, alignItems: "center",
  },
  encourageSparkles: { marginBottom: 16 },
  encourageTitle: {
    fontSize: 22, fontFamily: fonts.displayBold, color: colors.onSurface, marginBottom: 14,
  },
  encourageQuote: {
    fontSize: 15, fontFamily: fonts.bodyRegular, color: colors.onSurfaceVariant,
    fontStyle: "italic", textAlign: "center", lineHeight: 24,
  },

  // ── Stats — tonal layering ──
  statsRow: { flexDirection: "row", gap: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: radii.xl,
    padding: 20, alignItems: "center",
    ...ambientShadow,
  },
  statNum: { fontSize: 30, fontFamily: fonts.displayExtraBold, color: colors.primary },
  statLbl: {
    fontSize: 13, fontFamily: fonts.bodyRegular, color: colors.onSurfaceVariant,
    textAlign: "center", marginTop: 6, lineHeight: 18,
  },

  // ── Tags — reflection chips ──
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tagChip: {
    backgroundColor: colors.secondaryFixed, borderRadius: radii.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  tagText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.onSecondaryFixed },

  // ── Feed spacer ──
  feedHeaderSpacer: { height: 24 },

  // ── Error ──
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 28, marginTop: 12,
    backgroundColor: colors.errorLight, borderRadius: radii.lg,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  errorText: { color: colors.errorText, fontSize: 14, fontFamily: fonts.bodyMedium },

  // ── List ──
  listContent: { paddingBottom: 120, paddingHorizontal: 24 },

  // ── Loader ──
  loaderOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 100, paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20, fontFamily: fonts.displayBold, color: colors.onSurface,
    marginBottom: 10, textAlign: "center",
  },
  emptySub: {
    fontSize: 15, fontFamily: fonts.bodyRegular, color: colors.onSurfaceVariant,
    textAlign: "center", lineHeight: 24,
  },

  // ── FAB & Journal button ──
  fabWrap: {
    position: "absolute", bottom: Platform.OS === "web" ? 60 : 36,
    left: 28, right: 28,
    flexDirection: "row", alignItems: "center",
  },
  journalBtn: {
    borderRadius: radii.full,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: colors.surfaceContainerLowest,
    ...ambientShadow,
  },
  journalBtnText: {
    fontSize: 15, fontFamily: fonts.displaySemiBold, color: colors.primary,
  },
  fab: {
    width: 60, height: 60, borderRadius: 30, overflow: "hidden",
    ...ambientShadow,
    shadowOpacity: 0.12,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
