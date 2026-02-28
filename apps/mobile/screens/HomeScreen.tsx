// ─────────────────────────────────────────────
// screens/HomeScreen.tsx
// Displays the feed of SAFE posts + create button
// ─────────────────────────────────────────────

import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ListRenderItem,
  StatusBar,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { usePosts } from "../hooks/usePosts";
import { useUser } from "../hooks/useUser";
import { useNotifications } from "../hooks/useNotifications";
import PostCard from "../components/PostCard";
import type { Post } from "../../../packages/types";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";

type HomeNavigationProp = DrawerNavigationProp<MainDrawerParamList, "Home">;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const { username, role, userId } = useUser();
  const isCoach = role === "COACH" || role === "ADMIN";
  const { posts, loading, error, fetchPosts } = usePosts();

  // Initialize push notifications and get unread count
  const { unreadCount, refreshUnreadCount } = useNotifications(userId);

  // Refresh the feed every time this screen comes into focus —
  // covers initial mount AND returning from PostScreen after submitting.
  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      refreshUnreadCount();
    }, [fetchPosts, refreshUnreadCount]),
  );

  const handleDeletePost = useCallback(() => {
    fetchPosts(); // Refresh the feed after deletion
  }, [fetchPosts]);

  const renderItem: ListRenderItem<Post> = useCallback(
    ({ item }) => <PostCard post={item} onDelete={handleDeletePost} />,
    [handleDeletePost],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="sparkles-outline" size={36} color={colors.card} />
      </View>
      <Text style={styles.emptyTitle}>The space is quiet…</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to share a prayer or word of encouragement!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.deep} />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={[colors.darkest, colors.deep, colors.fuchsia]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            activeOpacity={0.7}
            style={styles.hamburger}
          >
            <Ionicons name="menu-outline" size={22} color={colors.card} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={styles.appTitleRow}>
              <Text style={styles.appTitle}>PUSO Spaze</Text>
              <Ionicons name="sparkles-outline" size={18} color={colors.card} />
            </View>
            <Text style={styles.greeting}>
              <Text
                style={styles.greetingName}
              >{`Hey, ${isCoach ? "Coach " : ""}${username ?? "…"}`}</Text>
            </Text>
          </View>

          {/* Notification bell */}
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              activeOpacity={0.7}
              style={styles.notificationBtn}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={colors.card}
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Refresh button for web */}
          <TouchableOpacity
            onPress={fetchPosts}
            activeOpacity={0.7}
            style={styles.refreshBtn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Ionicons name="refresh-outline" size={24} color={colors.card} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Error Banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.errorRow}>
            <Ionicons
              name="warning-outline"
              size={14}
              color={colors.errorText}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      )}

      {/* ── Post Feed ── */}
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading ? <ListEmpty /> : null}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchPosts}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* ── Full-screen loader on first load ── */}
      {loading && posts.length === 0 && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* ── Gradient FAB ── */}
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
            style={styles.fabGradient}
          >
            <Text style={styles.fabIcon}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },

  // ── Header ───────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hamburger: {
    padding: 8,
    marginLeft: -8,
  },
  appTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  appTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.card,
    letterSpacing: -0.3,
  },
  greeting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  greetingName: { color: colors.accent, fontWeight: "700" },
  notificationBtn: {
    padding: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.hot,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.deep,
  },
  badgeText: {
    color: colors.card,
    fontSize: 8,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: 8,
    marginRight: -4,
  },

  // ── Error banner ─────────────────────────
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.errorLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: colors.errorText, fontSize: 13 },

  // ── Feed ─────────────────────────────────
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Empty state ──────────────────────────
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.deep,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.placeholder,
    textAlign: "center",
    lineHeight: 22,
  },

  // ── FAB ──────────────────────────────────
  fabWrap: { position: "absolute", bottom: 32, right: 24 },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  fabIcon: {
    color: colors.card,
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 34,
  },
});
