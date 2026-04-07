import React, { useCallback, useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, SafeAreaView, ListRenderItem, StatusBar,
  StyleSheet, ScrollView, Platform, Image, useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
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

const CATEGORIES = ["All Stories", "Daily Reflection", "Community", "Devotional", "Personal Story"] as const;
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
          Welcome to your sacred space for reflection and connection.
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
          colors={[colors.surface, colors.muted1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.encourageCard}
        >
          <View style={styles.encourageSparkles}>
            <Ionicons name="sparkles" size={28} color={colors.fuchsia} />
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

      <View style={styles.feedHeader}>
        <Ionicons name="newspaper-outline" size={16} color={colors.primary} />
        <Text style={styles.feedHeaderText}>Community Feed</Text>
      </View>
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
      <StatusBar barStyle="light-content" backgroundColor={colors.deep} />

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
          <Image
            source={require("../assets/logo.png")}
            style={styles.topBarLogo}
            resizeMode="contain"
          />
        </View>

        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          activeOpacity={0.7}
          style={styles.avatarBtn}
        >
          <LinearGradient
            colors={[colors.primary, colors.deep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topBarAvatar}
          >
            <Text style={styles.topBarAvatarText}>{initial}</Text>
          </LinearGradient>
          {unreadCount > 0 && (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
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
        <TouchableOpacity
          onPress={() => navigation.getParent()?.navigate("Post")}
          activeOpacity={0.85}
          style={styles.fab}
        >
          <LinearGradient
            colors={[colors.hot, colors.primary, colors.deep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGrad}
          >
            <Text style={styles.fabIcon}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: 24 },

  // ── Top bar ──
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.muted3,
  },
  hamburger: { padding: 4 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  topBarLogo: { width: 36, height: 36 },
  avatarBtn: { position: "relative" },
  topBarAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  topBarAvatarText: {
    color: colors.card, fontSize: 14, fontWeight: "800",
  },
  avatarBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: colors.danger, borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.card,
  },
  avatarBadgeText: { color: colors.card, fontSize: 8, fontWeight: "700" },

  // ── Greeting ──
  greetingSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  greetingText: {
    fontSize: 28, fontWeight: "800", color: colors.heading, lineHeight: 34,
  },
  greetingSub: {
    fontSize: 14, color: colors.subtle, marginTop: 6, lineHeight: 20,
  },

  // ── Category filter tabs ──
  categoryScroll: { marginTop: 16 },
  categoryRow: { paddingHorizontal: 20, gap: 8 },
  categoryChip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.muted3,
  },
  categoryChipActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 13, fontWeight: "600", color: colors.subtle,
  },
  categoryTextActive: { color: colors.card },

  // ── Sections ──
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: colors.muted5,
    letterSpacing: 1.2, marginBottom: 10,
  },

  // ── Daily reflection card ──
  reflectionCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: colors.muted3,
  },
  reflectionQuote: {
    fontSize: 14, fontStyle: "italic", color: colors.text, lineHeight: 22,
  },

  // ── Encouragement card ──
  encourageCard: {
    borderRadius: 20, padding: 28, alignItems: "center",
    borderWidth: 1, borderColor: colors.muted2,
  },
  encourageSparkles: { marginBottom: 12 },
  encourageTitle: {
    fontSize: 20, fontWeight: "800", color: colors.heading, marginBottom: 12,
  },
  encourageQuote: {
    fontSize: 14, color: colors.text, fontStyle: "italic",
    textAlign: "center", lineHeight: 22,
  },

  // ── Stats ──
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.muted3, alignItems: "center",
  },
  statNum: { fontSize: 28, fontWeight: "800", color: colors.primary },
  statLbl: {
    fontSize: 12, color: colors.muted5, textAlign: "center",
    marginTop: 4, lineHeight: 16,
  },

  // ── Tags ──
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.muted2,
  },
  tagText: { fontSize: 13, fontWeight: "600", color: colors.fuchsia },

  // ── Feed header ──
  feedHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  feedHeaderText: { fontSize: 16, fontWeight: "700", color: colors.heading },

  // ── Error ──
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: colors.errorLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  errorText: { color: colors.errorText, fontSize: 13 },

  // ── List ──
  listContent: { paddingBottom: 110 },

  // ── Loader ──
  loaderOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 80, paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: "700", color: colors.deep,
    marginBottom: 8, textAlign: "center",
  },
  emptySub: {
    fontSize: 14, color: colors.muted4, textAlign: "center", lineHeight: 22,
  },

  // ── FAB ──
  fabWrap: { position: "absolute", bottom: Platform.OS === "web" ? 60 : 32, right: 24 },
  fab: {
    width: 62, height: 62, borderRadius: 31, overflow: "hidden",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  fabIcon: {
    color: colors.card, fontSize: 30, fontWeight: "300", lineHeight: 34,
  },
});
