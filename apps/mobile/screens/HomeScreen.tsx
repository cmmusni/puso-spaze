import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ListRenderItem,
  StatusBar,
  StyleSheet,
  Platform,
  TextInput,
  Modal,
  Animated,
  useWindowDimensions,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors as defaultColors, fonts, radii, spacing, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { usePosts } from "../hooks/usePosts";
import { useUser } from "../hooks/useUser";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "../hooks/useNotifications";
import { apiGetDashboardStats, apiRecordVisit, resolveAvatarUrl, type DashboardStats } from "../services/api";
import { validatePostContent } from "../utils/validators";
import { POST_MAX_LENGTH, POST_MIN_LENGTH } from "../../../packages/core/constants";
import { showAlert } from "../utils/alertPlatform";
import PostCard from "../components/PostCard";
import type { Post } from "../../../packages/types";
import WebRightPanel from "../components/WebRightPanel";
import { PostFeedSkeleton } from "../components/LoadingSkeletons";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";
import { useScrollBarVisibility } from "../hooks/useScrollBarVisibility";
import { useWebPullToRefresh } from "../hooks/useWebPullToRefresh";
import { useReactionsStore } from "../context/ReactionsStore";
import { optimizeCloudinaryUrl } from "../utils/optimizeImage";

type HomeNav = DrawerNavigationProp<MainDrawerParamList, "Home">;

const FEELING_OPTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "grateful", emoji: "\u{1F60A}", label: "Grateful" },
  { key: "prayerful", emoji: "\u{1F64F}", label: "Prayerful" },
  { key: "strong", emoji: "\u{1F4AA}", label: "Strong" },
  { key: "struggling", emoji: "\u{1F622}", label: "Struggling" },
  { key: "hopeful", emoji: "\u{1F917}", label: "Hopeful" },
  { key: "heavy-hearted", emoji: "\u{1F614}", label: "Heavy-hearted" },
  { key: "blessed", emoji: "\u2728", label: "Blessed" },
  { key: "loved", emoji: "\u2764\uFE0F", label: "Loved" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Brief highlight pulse for a newly created post */
function HighlightWrap({ children, flatListRef }: { children: React.ReactNode; flatListRef: React.RefObject<FlatList<any> | null> }) {
  const anim = useRef(new Animated.Value(1)).current;
  const viewRef = useRef<View>(null);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 1500, useNativeDriver: false }),
    ]).start();
  }, []);

  // Scroll the highlighted post into view
  useEffect(() => {
    const doScroll = () => {
      if (Platform.OS === 'web') {
        // On web, use native scrollIntoView — works with any layout
        const node = viewRef.current as any;
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (node && typeof node.measure === 'undefined') {
          // react-native-web: the underlying DOM node
          try {
            const el = (node as any)._nativeTag ?? (node as any).getNode?.() ?? node;
            if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {}
        }
      } else {
        // On native, measure position relative to the FlatList and scrollToOffset
        viewRef.current?.measureLayout(
          flatListRef.current?.getScrollableNode?.() as any,
          (_x, y) => {
            flatListRef.current?.scrollToOffset({ offset: Math.max(0, y - 100), animated: true });
          },
          () => {},
        );
      }
    };
    // Delay to ensure layout is complete
    const t1 = setTimeout(doScroll, 300);
    const t2 = setTimeout(doScroll, 800);
    const t3 = setTimeout(doScroll, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", defaultColors.secondary + "1E"],
  });

  const accentColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", defaultColors.secondary + "99"],
  });

  return (
    <Animated.View ref={viewRef as any} style={{ backgroundColor: bgColor, borderRadius: radii.lg, marginHorizontal: -2, paddingHorizontal: 2, borderLeftWidth: 2, borderLeftColor: accentColor }}>
      {children}
    </Animated.View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const route = useRoute<RouteProp<MainDrawerParamList, "Home">>();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { username, role, userId, avatarUrl } = useUser();
  const isCoach = role === "COACH" || role === "ADMIN";
  const { posts, loading, loadingMore, hasMore, error, fetchPosts, loadMore, submitPost } = usePosts();
  const { unreadCount, refreshUnreadCount, requestWebPushPermission, webPushSubscribed, webPushSupported } = useNotifications(userId);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(false);
  const showPushBanner = Platform.OS === 'web' && webPushSupported && !webPushSubscribed && !pushBannerDismissed;
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  const showRightPanel = width >= 1200;

  // ── FlatList ref for scrolling ──
  const flatListRef = useRef<FlatList<Post>>(null);

  // ── Highlight newly posted item ──
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const processedParamId = useRef<string | null>(null);
  const lastViewedPostId = useRef<string | null>(null);

  // ── FAB visibility — hide while composer is on screen ──
  const [showFab, setShowFab] = useState(false);
  const composerBottomY = useRef(0);

  // ── Scroll-direction bar visibility ──
  const setBarsVisible = useScrollBarVisibility((s) => s.setBarsVisible);
  const scrollToTopTrigger = useScrollBarVisibility((s) => s.scrollToTopTrigger);
  const lastScrollY = useRef(0);
  const topBarTranslateY = useRef(new Animated.Value(0)).current;
  const fabTranslateY = useRef(new Animated.Value(0)).current;
  const BOTTOM_TAB_BAR_HEIGHT = 70;
  const barsShown = useRef(true);
  const SCROLL_DIR_THRESHOLD = 10;
  const [topBarHeight, setTopBarHeight] = useState(54);

  const animateBars = useCallback((visible: boolean) => {
    if (barsShown.current === visible) return;
    barsShown.current = visible;
    setBarsVisible(visible);
    Animated.parallel([
      Animated.timing(topBarTranslateY, {
        toValue: visible ? 0 : -topBarHeight - 10,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fabTranslateY, {
        toValue: visible ? 0 : BOTTOM_TAB_BAR_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [setBarsVisible, topBarTranslateY, fabTranslateY, topBarHeight]);

  const handleScroll = useCallback((e: { nativeEvent: NativeScrollEvent }) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    setShowFab(offsetY > composerBottomY.current);

    // Only hide/show bars on mobile / narrow web
    if (isWide) return;

    const delta = offsetY - lastScrollY.current;
    if (offsetY <= 0) {
      animateBars(true);
    } else if (delta > SCROLL_DIR_THRESHOLD) {
      animateBars(false);
    } else if (delta < -SCROLL_DIR_THRESHOLD) {
      animateBars(true);
    }
    lastScrollY.current = offsetY;
  }, [animateBars, isWide]);

  // ── Scroll to top when active tab is re-tapped ──
  const scrollToTopRef = useRef(scrollToTopTrigger);
  useEffect(() => {
    if (scrollToTopTrigger > 0 && scrollToTopTrigger !== scrollToTopRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      animateBars(true);
    }
    scrollToTopRef.current = scrollToTopTrigger;
  }, [scrollToTopTrigger, animateBars]);

  // ── Search state ──
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SHORT_DAILY_REFLECTION_LENGTH = 80;

  // Debounce search input → 400ms
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQuery(searchText.trim());
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText]);

  // Re-fetch whenever the debounced query changes
  useEffect(() => {
    fetchPosts(searchQuery || undefined);
  }, [searchQuery, fetchPosts]);

  // ── Inline composer state ──
  const [composeText, setComposeText] = useState("");
  const [composeImage, setComposeImage] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [feelingPickerVisible, setFeelingPickerVisible] = useState(false);
  const [feelingAnchor, setFeelingAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const feelingBtnRef = useRef<View>(null);
  const FEELING_SHEET_WIDTH = 280;
  const FEELING_SHEET_EST_HEIGHT = 260;
  const openFeelingPicker = useCallback(() => {
    const node: any = feelingBtnRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        setFeelingAnchor({ x, y, w, h });
        setFeelingPickerVisible(true);
      });
    } else {
      setFeelingAnchor(null);
      setFeelingPickerVisible(true);
    }
  }, []);
  const feelingObj = selectedFeeling
    ? FEELING_OPTIONS.find((f) => f.key === selectedFeeling)
    : null;

  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    dailyStories: 0,
    onlineCount: 0,
    trendingTags: [],
    dailyReflection: null,
  });
  const [reflectionExpanded, setReflectionExpanded] = useState(false);

  const loadStats = useCallback(async () => {
    const d = await apiGetDashboardStats(userId ?? undefined);
    setStats(d);
  }, [userId]);

  // Pick up highlight request from PostScreen navigation
  useEffect(() => {
    const id = route.params?.highlightPostId;
    if (id && id !== processedParamId.current) {
      processedParamId.current = id;
      setScrollTargetId(id);
    }
  }, [route.params?.highlightPostId]);

  // Clear the highlight param when leaving the screen so it doesn't retrigger on back-navigation
  // Also reset bar visibility so other screens always show bars
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      if (route.params?.highlightPostId) {
        navigation.setParams({ highlightPostId: undefined });
        processedParamId.current = null;
      }
      // Reset bars to visible when navigating away
      barsShown.current = true;
      setBarsVisible(true);
      topBarTranslateY.setValue(0);
      fabTranslateY.setValue(0);
    });
    return unsubscribe;
  }, [navigation, route.params?.highlightPostId, setBarsVisible, topBarTranslateY]);

  useFocusEffect(
    useCallback(() => {
      fetchPosts(searchQuery || undefined);
      refreshUnreadCount();
      loadStats();
      // Record HomeScreen visit for streak tracking
      if (userId) {
        apiRecordVisit(userId).catch((err: any) =>
          console.warn('[HomeScreen] streak record-visit failed:', err)
        );
      }
    }, [fetchPosts, searchQuery, refreshUnreadCount, loadStats, userId]),
  );

  // Highlight last-viewed post when returning from PostDetailScreen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (lastViewedPostId.current) {
        setScrollTargetId(lastViewedPostId.current);
        lastViewedPostId.current = null;
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    // Tell PostCards to re-hydrate their reactions from the server
    // (covers reactions made by other clients since last fetch).
    useReactionsStore.getState().requestRefresh();
    await Promise.all([
      fetchPosts(searchQuery || undefined),
      refreshUnreadCount(),
      loadStats(),
    ]);
  }, [fetchPosts, searchQuery, refreshUnreadCount, loadStats]);

  // Web/PWA pull-to-refresh (no-op on native; native uses RefreshControl).
  // Disabled while a modal is open so its scrolls don't trigger feed refresh.
  const webPtr = useWebPullToRefresh({
    onRefresh: handleRefresh,
    enabled: !feelingPickerVisible && !showPushBanner,
  });

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
      const tags = selectedFeeling ? [selectedFeeling] : undefined;
      const { flagged, underReview, postId: newPostId } = await submitPost({
        userId,
        content: trimmed,
        imageUri: composeImage ?? undefined,
        tags,
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
        setSelectedFeeling(null);
      } else {
        setComposeText("");
        setComposeImage(null);
        setSelectedFeeling(null);
        if (newPostId) setScrollTargetId(newPostId);
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

  // Scroll to & highlight new post once it appears in the list.
  // Timers are stored in refs so they survive effect re-runs caused by
  // concurrent fetchPosts calls updating `posts`.
  const scrollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!scrollTargetId || posts.length === 0) return;

    let idx = posts.findIndex((p) => p.id === scrollTargetId);
    if (idx < 0) return; // post not in list yet — effect will re-run when posts updates

    // Found it — clear the target and start highlighting
    setScrollTargetId(null);

    // Clear any previous highlight timers
    scrollTimers.current.forEach(clearTimeout);
    scrollTimers.current = [];

    setHighlightPostId(posts[idx].id);

    // HighlightWrap handles scrolling itself via scrollIntoView/measureLayout.
    // Just clear highlight after animation settles.
    const t = setTimeout(() => setHighlightPostId(null), 3500);
    scrollTimers.current = [t];
  }, [posts, scrollTargetId]);

  const handlePinPost = useCallback(
    (postId: string) => {
      setScrollTargetId(postId);
      fetchPosts();
    },
    [fetchPosts],
  );

  const handlePostPress = useCallback((postId: string) => {
    lastViewedPostId.current = postId;
  }, []);

  const renderItem: ListRenderItem<Post> = useCallback(
    ({ item }) => {
      if (item.id === highlightPostId) {
        return (
          <HighlightWrap flatListRef={flatListRef}>
            <PostCard post={item} onDelete={handleDeletePost} onPin={handlePinPost} onPostPress={handlePostPress} />
          </HighlightWrap>
        );
      }
      return <PostCard post={item} onDelete={handleDeletePost} onPin={handlePinPost} onPostPress={handlePostPress} />;
    },
    [handleDeletePost, handlePinPost, handlePostPress, highlightPostId],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const fmtNum = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

  const displayName = username ?? "...";
  const initial = displayName.charAt(0).toUpperCase();

  const listHeader = (
    <View style={!isWide && !showRightPanel ? { paddingHorizontal: 20 } : undefined}>
      {/* ── Error banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Greeting section ── */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>
          {getGreeting()}, {displayName}.
        </Text>
        <Text style={styles.greetingSub}>
          Welcome to your safe space. What's on your heart today?
        </Text>
      </View>

      {/* ── Push notification permission banner (web only) ── */}

      {/* ── Daily Reflection card ── */}
      {stats.dailyReflection && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DAILY REFLECTION</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (stats.dailyReflection && stats.dailyReflection.content.length > 100) {
                setReflectionExpanded((prev) => !prev);
              }
            }}
          >
          <LinearGradient
            colors={[colors.surfaceContainerLow, colors.surfaceVariant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.reflectionCard}
          >
            <View style={styles.reflectionIcon}>
              <Ionicons name="sparkles" size={24} color={colors.secondary} />
            </View>
            <Text style={styles.reflectionQuote}>
              {!reflectionExpanded && stats.dailyReflection.content.length > SHORT_DAILY_REFLECTION_LENGTH
                ? stats.dailyReflection.content.slice(0, SHORT_DAILY_REFLECTION_LENGTH) + '...'
                : stats.dailyReflection.content}
            </Text>
            {stats.dailyReflection.content.length > SHORT_DAILY_REFLECTION_LENGTH && (
              <View style={styles.seeMoreBtn}>
                <Text style={styles.seeMoreText}>
                  {reflectionExpanded ? 'See less' : 'See more...'}
                </Text>
              </View>
            )}
          </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Inline Composer ── */}
      <View
        style={styles.composerSection}
        onLayout={(e) => {
          composerBottomY.current =
            e.nativeEvent.layout.y + e.nativeEvent.layout.height;
        }}
      >
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
              maxLength={POST_MAX_LENGTH}
              editable={!composing}
            />
          </View>

          {composeImage && (
            <View style={styles.composerImageWrap}>
              <Image
                source={{ uri: composeImage }}
                style={styles.composerImagePreview}
                contentFit="cover"
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

          {/* ── Selected feeling chip ── */}
          {feelingObj && (
            <View style={styles.feelingChipRow}>
              <View style={styles.feelingChip}>
                <Text style={styles.feelingChipEmoji}>{feelingObj.emoji}</Text>
                <Text style={styles.feelingChipText}>
                  Feeling {feelingObj.label}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedFeeling(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
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
                ref={feelingBtnRef}
                style={styles.composerActionBtn}
                activeOpacity={0.7}
                disabled={composing}
                onPress={openFeelingPicker}
              >
                <Ionicons
                  name="happy-outline"
                  size={18}
                  color={selectedFeeling ? colors.primary : colors.onSurface}
                />
                <Text
                  style={[
                    styles.composerActionText,
                    !!selectedFeeling && { color: colors.primary },
                  ]}
                >
                  Feeling
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handlePostReflection}
              activeOpacity={0.85}
              disabled={composing || composeText.trim().length < POST_MIN_LENGTH}
              accessibilityRole="button"
              accessibilityLabel="Post"
              style={[
                styles.composerSubmitBtn,
                (composing || composeText.trim().length < POST_MIN_LENGTH) &&
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
                  <Text style={styles.composerSubmitText}>Post</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Spaze Stats & trending (hidden when right panel visible) ── */}
      {!showRightPanel && (
        <>
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
                {stats.trendingTags.map((item) => (
                  <View key={item.tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>#{item.tag}</Text>
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

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      loadMore(searchQuery || undefined);
    }
  }, [hasMore, loadingMore, loadMore, searchQuery]);

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return null;
  }, [loadingMore, colors.primary]);

  const listEmpty = (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={searchQuery ? "search-outline" : "sparkles-outline"}
          size={36}
          color={colors.card}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? "No results found" : "The space is quiet..."}
      </Text>
      <Text style={styles.emptySub}>
        {searchQuery
          ? `We couldn't find anything matching "${searchQuery}". Try a different search.`
          : "Be the first to share a prayer or word of encouragement!"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.gradientStart}
      />

      {/* ── Top bar ── */}
      <Animated.View
        onLayout={(e) => setTopBarHeight(e.nativeEvent.layout.height)}
        style={[
          styles.topBar,
          { backgroundColor: colors.surfaceContainerLowest, transform: [{ translateY: topBarTranslateY }], paddingTop: Platform.OS !== 'web' ? insets.top + 6 : 10 },
        ]}
      >
        <View style={styles.topBarLeft}>
          {!isWide && Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={() => navigation.openDrawer()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              style={styles.hamburger}
            >
              <Ionicons name="menu-outline" size={24} color={colors.heading} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setHighlightPostId(null);
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
              handleRefresh();
            }}
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/logo.png")}
              style={styles.topBarLogo}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={16}
            color={searchText ? colors.primary : colors.muted4}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={
              width < 400 ? "Search..." : "Search for encouragement, stories..."
            }
            placeholderTextColor={colors.muted4}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText("")}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted4} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.topBarRight}>
          {isWide && (
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
          )}
          <TouchableOpacity
            onPress={() => {
              setHighlightPostId(null);
              navigation.navigate("Profile");
            }}
            activeOpacity={0.7}
            style={styles.avatarBtn}
          >
            {isWide && (
              <View style={styles.avatarInfo}>
                <Text style={styles.avatarName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.avatarRole}>
                  {isCoach ? "COACH" : "SPAZE MEMBER"}
                </Text>
              </View>
            )}
            {avatarUrl ? (
              <Image
                source={{ uri: optimizeCloudinaryUrl(resolveAvatarUrl(avatarUrl), 56) }}
                style={styles.topBarAvatar}
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
            <LinearGradient
              colors={[colors.primaryContainer, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.topBarAvatar}
            >
              <Text style={styles.topBarAvatarText}>{initial}</Text>
            </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.contentRow}>
        <View style={styles.feedColumn}>
          <FlatList
            ref={(node) => {
              (flatListRef as any).current = node;
              // On web, hand the underlying scroll DOM node to the PTR hook
              if (Platform.OS === 'web' && node) {
                const scrollNode = (node as any).getScrollableNode?.();
                webPtr.attach(scrollNode ?? null);
              } else {
                webPtr.attach(null);
              }
            }}
            data={posts}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: isWide || showRightPanel ? 36 : 0, paddingTop: topBarHeight },
            ]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={!loading ? listEmpty : null}
            ListFooterComponent={listFooter}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onScrollToIndexFailed={() => {}}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressViewOffset={topBarHeight}
              />
            }
          />

          {loading && posts.length === 0 && (
            <View
              style={[styles.loaderOverlay, { paddingTop: topBarHeight }]}
              pointerEvents="none"
            >
              <PostFeedSkeleton count={3} />
            </View>
          )}

          {/* Web/PWA pull-to-refresh indicator (no-op on native) */}
          {Platform.OS === 'web' && (webPtr.pullDistance > 0 || webPtr.refreshing) && (
            <View
              pointerEvents="none"
              style={[
                styles.webPtrIndicator,
                {
                  top: topBarHeight + Math.max(0, webPtr.pullDistance - 28),
                  opacity: webPtr.refreshing ? 1 : Math.min(1, webPtr.pullDistance / 60),
                },
              ]}
            >
              <View
                style={[
                  styles.webPtrCircle,
                  webPtr.willTrigger && styles.webPtrCircleReady,
                ]}
              >
                {webPtr.refreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="arrow-down"
                    size={18}
                    color={webPtr.willTrigger ? colors.primary : colors.muted4}
                    style={{
                      transform: [
                        { rotate: webPtr.willTrigger ? '180deg' : '0deg' },
                      ],
                    }}
                  />
                )}
              </View>
            </View>
          )}

          {showFab && (
            <Animated.View
              style={[
                styles.fabWrap,
                { transform: [{ translateY: fabTranslateY }] },
              ]}
            >
              <View style={{ flex: 1 }} />

              {/* FAB */}
              <TouchableOpacity
                onPress={() => navigation.navigate("Post")}
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
            </Animated.View>
          )}
        </View>

        {showRightPanel && <WebRightPanel topBarHeight={topBarHeight} />}
      </View>

      {/* ── Feeling picker modal ── */}
      <Modal
        visible={feelingPickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        backdropColor="transparent"
        onRequestClose={() => setFeelingPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFeelingPickerVisible(false)}
        >
          {(() => {
            const sheetStyle: any[] = [styles.modalSheet, { width: FEELING_SHEET_WIDTH, maxWidth: FEELING_SHEET_WIDTH }];
            if (feelingAnchor) {
              const margin = 8;
              // Prefer placing above the button; fall back to below if not enough room
              const spaceAbove = feelingAnchor.y;
              const spaceBelow = height - (feelingAnchor.y + feelingAnchor.h);
              const placeAbove = spaceAbove >= FEELING_SHEET_EST_HEIGHT + margin || spaceAbove > spaceBelow;
              const top = placeAbove
                ? Math.max(margin, feelingAnchor.y - FEELING_SHEET_EST_HEIGHT - margin)
                : feelingAnchor.y + feelingAnchor.h + margin;
              // Center horizontally on the button, then clamp into viewport\n
              let left = feelingAnchor.x + feelingAnchor.w / 2 - FEELING_SHEET_WIDTH / 2;
              left = Math.max(margin, Math.min(left, width - FEELING_SHEET_WIDTH - margin));
              sheetStyle.push({ position: "absolute" as const, top, left });
            } else {
              // Fallback: center on screen if no anchor was measured
              sheetStyle.push({
                position: "absolute" as const,
                top: Math.max(16, (height - FEELING_SHEET_EST_HEIGHT) / 2),
                left: Math.max(16, (width - FEELING_SHEET_WIDTH) / 2),
              });
            }
            return (
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={sheetStyle}
              >
            <Text style={styles.modalTitle}>How are you feeling?</Text>
            <View style={styles.feelingGrid}>
              {FEELING_OPTIONS.map((f) => {
                const isActive = selectedFeeling === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.feelingOption,
                      isActive && styles.feelingOptionActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedFeeling(isActive ? null : f.key);
                      setFeelingPickerVisible(false);
                    }}
                  >
                    <Text style={styles.feelingEmoji}>{f.emoji}</Text>
                    <Text
                      style={[
                        styles.feelingLabel,
                        isActive && styles.feelingLabelActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedFeeling && (
              <TouchableOpacity
                style={styles.feelingClearBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedFeeling(null);
                  setFeelingPickerVisible(false);
                }}
              >
                <Text style={styles.feelingClearText}>Clear feeling</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
            );
          })()}
        </TouchableOpacity>
      </Modal>

      {/* ── Push notification prompt modal (web only) ── */}
      <Modal
        visible={showPushBanner}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPushBannerDismissed(true)}
      >
        <View style={styles.pushModalBackdrop}>
          <View style={[styles.pushModalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.pushModalIconWrap}>
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pushModalIcon}
              >
                <Ionicons name="notifications" size={32} color={colors.onPrimary} />
              </LinearGradient>
            </View>
            <Text style={styles.pushModalTitle}>Stay in the Loop</Text>
            <Text style={styles.pushModalText}>
              Get notified when someone reacts, comments, or sends you a message of encouragement.
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await requestWebPushPermission();
                setPushBannerDismissed(true);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pushModalEnableBtn}
              >
                <Ionicons name="notifications-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.pushModalEnableText}>Enable Notifications</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPushBannerDismissed(true)}
              activeOpacity={0.7}
              style={styles.pushModalDismissBtn}
            >
              <Text style={styles.pushModalDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // ── Content row — feed + right panel on wide screens ──
  contentRow: { flex: 1, flexDirection: "row" },
  feedColumn: { flex: 1 },

  // ── Top bar — glass-like, no hard border ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Platform.OS === "web" ? 20 : 12,
    paddingBottom: 10,
    backgroundColor: colors.surfaceContainerLowest,
    gap: Platform.OS === "web" ? 12 : 8,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  hamburger: { padding: 4 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  topBarLogo: { width: 30, height: 30, borderRadius: 7 },
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
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.heading,
    padding: 0,
    margin: 0,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
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
  greetingSection: { paddingTop: 28, paddingBottom: 4 },
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

  // ── Push notification modal ──
  pushModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pushModalSheet: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    maxWidth: 380,
    width: '100%' as any,
    alignItems: 'center' as any,
    ...ambientShadow,
  },
  pushModalIconWrap: {
    marginBottom: spacing.lg,
  },
  pushModalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
  },
  pushModalTitle: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    textAlign: 'center' as any,
    marginBottom: spacing.sm,
  },
  pushModalText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    textAlign: 'center' as any,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  pushModalEnableBtn: {
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    width: '100%' as any,
  },
  pushModalEnableText: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  pushModalDismissBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  pushModalDismissText: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
  },

  // ── Inline Composer ──
  composerSection: { marginTop: 16, marginBottom: spacing.sm },
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
  feelingChipRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  feelingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryContainer + "25",
    borderWidth: 1,
    borderColor: colors.primary + "30",
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feelingChipEmoji: {
    fontSize: 14,
  },
  feelingChipText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
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
  section: { marginTop: 20 },
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
    borderRadius: radii.xl,
    padding: 28,
  },
  reflectionIcon: {
    marginBottom: 12,
  },
  reflectionQuote: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    lineHeight: 24,
    fontStyle: "italic",
  },
  seeMoreBtn: {
    marginTop: 8,
  },
  seeMoreText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.secondary,
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
  listContent: { paddingBottom: 120 },

  // ── Loader ──
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "stretch",
    justifyContent: "flex-start",
  },

  // ── Web/PWA pull-to-refresh indicator ──
  webPtrIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
  },
  webPtrCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    ...ambientShadow,
  },
  webPtrCircleReady: {
    backgroundColor: colors.primaryContainer,
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
    bottom: Platform.OS === "ios" ? 100 : 90,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 50,
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

  // ── Feeling picker modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
    gap: 10,
    width: "85%",
    maxWidth: 320,
    ...ambientShadow,
  },
  modalTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontFamily: fonts.displayBold,
    marginBottom: 2,
  },
  feelingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feelingOption: {
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: "30%",
  },
  feelingOptionActive: {
    backgroundColor: colors.primaryContainer + "30",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  feelingEmoji: { fontSize: 20, marginBottom: 2 },
  feelingLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
  },
  feelingLabelActive: {
    color: colors.primary,
  },
  feelingClearBtn: {
    alignSelf: "center",
    paddingVertical: 10,
  },
  feelingClearText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
});
