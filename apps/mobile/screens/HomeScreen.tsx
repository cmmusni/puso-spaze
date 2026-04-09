import React, { useCallback, useState, useEffect } from "react";
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
  Platform,
  Image,
  TextInput,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, ambientShadow } from "../constants/theme";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { usePosts } from "../hooks/usePosts";
import { useUser } from "../hooks/useUser";
import { useNotifications } from "../hooks/useNotifications";
import { apiGetDashboardStats, type DashboardStats } from "../services/api";
import { validatePostContent } from "../utils/validators";
import { showAlert } from "../utils/alertPlatform";
import PostCard from "../components/PostCard";
import type { Post } from "../../../packages/types";
import WebRightPanel from "../components/WebRightPanel";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";

type HomeNav = DrawerNavigationProp<MainDrawerParamList, "Home">;



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
  const { posts, loading, error, fetchPosts, submitPost } = usePosts();
  const { unreadCount, refreshUnreadCount } = useNotifications(userId);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  // ── Inline composer state ──
  const [composeText, setComposeText] = useState("");
  const [composeImage, setComposeImage] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    dailyStories: 0,
    onlineCount: 0,
    trendingTags: [],
    dailyReflection: null,
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

  // ── Inline composer actions ──
  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setComposeImage(result.assets[0].uri);
    }
  };

  const handlePostReflection = async () => {
    const trimmed = composeText.trim();
    const validationErr = validatePostContent(trimmed);
    if (validationErr) {
      showAlert("Oops", validationErr);
      return;
    }
    if (!userId) {
      showAlert("Session Error", "User not found. Please log in again.");
      return;
    }
    setComposing(true);
    try {
      const { flagged, underReview } = await submitPost({
        userId,
        content: trimmed,
        imageUri: composeImage ?? undefined,
      });
      if (flagged) {
        showAlert(
          "Flagged",
          "Your message was flagged by our safety system. Please revise.",
        );
      } else if (underReview) {
        showAlert(
          "Under Review",
          "Your post is under review and will appear shortly.",
        );
        setComposeText("");
        setComposeImage(null);
      } else {
        setComposeText("");
        setComposeImage(null);
        fetchPosts();
      }
    } catch (err: unknown) {
      showAlert(
        "Error",
        err instanceof Error ? err.message : "Failed to submit post.",
      );
    } finally {
      setComposing(false);
    }
  };

  const renderItem: ListRenderItem<Post> = useCallback(
    ({ item }) => <PostCard post={item} onDelete={handleDeletePost} />,
    [handleDeletePost],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const fmtNum = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

  const displayName = username ?? "...";
  const initial = displayName.charAt(0).toUpperCase();

  const listHeader = (
    <View>
      {/* ── Greeting section ── */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>
          {getGreeting()},{"\n"}
          {isCoach ? "Coach " : ""}
          {displayName}.
        </Text>
        <Text style={styles.greetingSub}>
          Welcome to your safe space. What's on your heart today?
        </Text>
      </View>

      {/* ── Daily Reflection card ── */}
      {stats.dailyReflection && (
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

      {/* ── Inline Composer ── */}
      <View style={styles.composerSection}>
        <View style={styles.composerCard}>
          <View style={styles.composerTop}>
            <View style={styles.composerIcon}>
              <Ionicons
                name="create-outline"
                size={22}
                color={colors.primary}
              />
            </View>
            <TextInput
              style={styles.composerInput}
              placeholder="Share your thoughts, a prayer, or a moment of gratitude..."
              placeholderTextColor={colors.muted4}
              value={composeText}
              onChangeText={setComposeText}
              multiline
              maxLength={500}
              editable={!composing}
            />
          </View>

          {composeImage && (
            <View style={styles.composerImageWrap}>
              <Image
                source={{ uri: composeImage }}
                style={styles.composerImagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.composerImageRemove}
                onPress={() => setComposeImage(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.composerBottom}>
            <View style={styles.composerActions}>
              <TouchableOpacity
                style={styles.composerActionBtn}
                onPress={handlePickPhoto}
                activeOpacity={0.7}
                disabled={composing}
              >
                <Ionicons
                  name="image-outline"
                  size={18}
                  color={colors.onSurface}
                />
                <Text style={styles.composerActionText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.composerActionBtn}
                activeOpacity={0.7}
                disabled={composing}
                onPress={() => navigation.getParent()?.navigate("Post")}
              >
                <Ionicons
                  name="happy-outline"
                  size={18}
                  color={colors.onSurface}
                />
                <Text style={styles.composerActionText}>Feeling</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handlePostReflection}
              activeOpacity={0.85}
              disabled={composing || composeText.trim().length < 3}
              style={[
                styles.composerSubmitBtn,
                (composing || composeText.trim().length < 3) &&
                  styles.composerSubmitDisabled,
              ]}
            >
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.composerSubmitGrad}
              >
                {composing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.composerSubmitText}>Post Reflection</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Keep Glowing encouragement card (hidden on wide - in right panel) ── */}
      {!isWide && (
        <>
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
                {"\u201C"}Remember that your presence makes a difference. This
                space is safer because you are in it.{"\u201D"}
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
        </>
      )}

      <View style={styles.feedHeaderSpacer} />
    </View>
  );

  const listEmpty = (
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

  const showRightPanel = isWide && width >= 1200;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.gradientStart}
      />

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
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search for encouragement, stories...
          </Text>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.7}
            style={styles.topBarIconBtn}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.heading}
            />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.7}
            style={styles.avatarBtn}
          >
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.avatarRole}>
                {isCoach ? "COACH" : "SPAZE MEMBER"}
              </Text>
            </View>
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

      <View style={styles.contentRow}>
        <View style={styles.feedColumn}>
          <FlatList
            data={posts}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={!loading ? listEmpty : null}
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
                colors={[
                  colors.secondary,
                  colors.primaryContainer,
                  colors.primary,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabGrad}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={24}
                  color={colors.onPrimary}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {showRightPanel && <WebRightPanel />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // ── Content row — feed + right panel on wide screens ──
  contentRow: { flex: 1, flexDirection: "row" },
  feedColumn: { flex: 1 },

  // ── Top bar — glass-like, no hard border ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Platform.OS === "web" ? 20 : 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerLowest,
    gap: Platform.OS === "web" ? 12 : 8,
  },
  hamburger: { padding: 4 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  topBarLogo: { width: 30, height: 30 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
    gap: 8,
    minWidth: 0,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topBarIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    backgroundColor: colors.surfaceContainerLow,
  },
  notifBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 6,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  notifBadgeText: {
    color: colors.onPrimary,
    fontSize: 7,
    fontFamily: fonts.bodyBold,
  },
  avatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.full,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 10,
  },
  avatarInfo: {
    alignItems: "flex-end",
  },
  avatarName: {
    fontSize: 13,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    maxWidth: 100,
  },
  avatarRole: {
    fontSize: 9,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  topBarAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarAvatarText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontFamily: fonts.displayBold,
  },

  // ── Greeting — display-lg, generous leading ──
  greetingSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  greetingText: {
    fontSize: 32,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 24,
  },

  // ── Inline Composer ──
  composerSection: { paddingHorizontal: 20, marginTop: 16 },
  composerCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 18,
    ...ambientShadow,
  },
  composerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  composerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    minHeight: 80,
    textAlignVertical: "top",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  composerImageWrap: {
    marginTop: 12,
    marginLeft: 56,
    position: "relative",
    alignSelf: "flex-start",
  },
  composerImagePreview: {
    width: 120,
    height: 80,
    borderRadius: 12,
  },
  composerImageRemove: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  composerBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  composerActions: {
    flexDirection: "row",
    gap: 16,
  },
  composerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  composerActionText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.onSurface,
  },
  composerSubmitBtn: {
    borderRadius: radii.full,
    overflow: "hidden",
  },
  composerSubmitDisabled: {
    opacity: 0.5,
  },
  composerSubmitGrad: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  composerSubmitText: {
    fontSize: 14,
    fontFamily: fonts.displayBold,
    color: "#FFFFFF",
  },

  // ── Sections ──
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: "uppercase" as any,
  },

  // ── Daily reflection card ──
  reflectionCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 28,
    ...ambientShadow,
  },
  reflectionQuote: {
    fontSize: 16,
    fontFamily: fonts.bodyItalic,
    color: colors.onSurface,
    lineHeight: 26,
  },

  // ── Encouragement card — soft gradient, no border ──
  encourageCard: {
    borderRadius: radii.xl,
    padding: 32,
    alignItems: "center",
  },
  encourageSparkles: { marginBottom: 16 },
  encourageTitle: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    marginBottom: 14,
  },
  encourageQuote: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 24,
  },

  // ── Stats — tonal layering ──
  statsRow: { flexDirection: "row", gap: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 20,
    alignItems: "center",
    ...ambientShadow,
  },
  statNum: {
    fontSize: 30,
    fontFamily: fonts.displayExtraBold,
    color: colors.primary,
  },
  statLbl: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },

  // ── Tags — reflection chips ──
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tagChip: {
    backgroundColor: colors.secondaryFixed,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSecondaryFixed,
  },

  // ── Feed spacer ──
  feedHeaderSpacer: { height: 16 },

  // ── Error ──
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.errorLight,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    color: colors.errorText,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },

  // ── List ──
  listContent: { paddingBottom: 120, paddingHorizontal: 20 },

  // ── Loader ──
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    marginBottom: 10,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 24,
  },

  // ── FAB & Journal button ──
  fabWrap: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 60 : 36,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  journalBtn: {
    borderRadius: radii.full,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: colors.surfaceContainerLowest,
    ...ambientShadow,
  },
  journalBtnText: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.primary,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    ...ambientShadow,
    shadowOpacity: 0.12,
    marginRight: 24,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
