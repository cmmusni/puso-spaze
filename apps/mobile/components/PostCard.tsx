// ─────────────────────────────────────────────
// components/PostCard.tsx
// Renders a single SAFE post in the feed
// ─────────────────────────────────────────────

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  Animated,
  StyleSheet,
  FlatList,
  type GestureResponderEvent,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  PanResponder,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  Post,
  ReactionType,
  ReactionCounts,
} from "../../../packages/types";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { renderReactionIcon } from "./ReactionIcon";
import {
  apiGetReactions,
  apiGetReactors,
  apiUpsertReaction,
  apiDeletePost,
  apiUpdatePost,
  apiFlagPost,
  apiPinPost,
  apiUnpinPost,
  resolveAvatarUrl,
} from "../services/api";
import { useUserStore } from "../context/UserContext";
import { useReactionsStore } from "../context/ReactionsStore";
import {
  findBubbleAt,
  useReactionPickerStore,
} from "../context/ReactionPickerStore";
import { tapLight, tapMedium } from "../utils/haptics";
import { playClick } from "../utils/clickSound";
import { noSelectStyle, suppressWebMenu } from "../utils/suppressWebMenu";
import { usePressAnimation } from "../hooks/usePressAnimation";
import { colors as defaultColors, fonts, radii, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import MentionText from "./MentionText";
import { optimizeCloudinaryUrl } from "../utils/optimizeImage";
import { FEELING_MAP } from "../constants/feelings";
import { getAvatarColors } from "../utils/avatarColors";
import { formatRelativeTime } from "../utils/formatTime";

const REACTION_TYPES: ReactionType[] = ["PRAY", "CARE", "SUPPORT", "LIKE", "SAD"];
const SYSTEM_USER_ID = "system-encouragement-bot";

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  onPin?: (postId: string) => void;
  onPostPress?: (postId: string) => void;
  openedFrom?: string;
}

// PostCard is used inside drawer screens, so we use any for navigation type
type CardNavProp = any;

function PostCardImpl({ post, onDelete, onPin, onPostPress, openedFrom }: PostCardProps) {
  const navigation = useNavigation<CardNavProp>();
  // Narrow selectors so unrelated user-store updates (bio, contacts, banner)
  // don't re-render every PostCard in the feed. React.memo above relies on this.
  const userId = useUserStore((s) => s.userId);
  const role = useUserStore((s) => s.role);
  const currentUserDisplayName = useUserStore((s) => s.username);
  const currentUserAvatarUrl = useUserStore((s) => s.avatarUrl);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const isMedium = screenWidth < 900 && screenWidth >= 600;
  const isSmall = screenWidth < 600;

  // ── Anonymous owner detection ─────────────────
  const isOwnAnonymousPost = post.isAnonymous && post.userId === userId;
  const displayName = isOwnAnonymousPost
    ? (currentUserDisplayName ?? post.user?.displayName ?? "Anonymous")
    : (post.user?.displayName ?? "Anonymous");
  const displayAvatarUrl = isOwnAnonymousPost ? currentUserAvatarUrl : post.user?.avatarUrl;
  const timeAgo = formatRelativeTime(post.createdAt);
  const initial = post.isAnonymous && !isOwnAnonymousPost ? "?" : displayName.charAt(0).toUpperCase();

  // ── Reaction state (shared via global ReactionsStore) ──
  const reactionState = useReactionsStore(
    (s) => s.byPostId[post.id],
  );
  const setReactions = useReactionsStore((s) => s.setReactions);
  const applyToggle = useReactionsStore((s) => s.applyToggle);
  const rollback = useReactionsStore((s) => s.rollback);
  const refreshTick = useReactionsStore((s) => s.refreshTick);
  const userReaction = reactionState?.userReaction ?? null;
  const counts = reactionState?.counts ?? {};
  const localTotal = reactionState?.total ?? (post.reactionCount ?? 0);

  // ── Fetch counts on mount, and re-fetch on global refresh ─────
  // On first mount, only hit the server if the store has no entry yet
  // (avoids racing with an in-flight POST after returning from PostDetail).
  // When refreshTick bumps (pull-to-refresh), force a re-fetch to pick up
  // changes made by other clients.
  useEffect(() => {
    const hasEntry = !!useReactionsStore.getState().byPostId[post.id];
    const isInitialMount = refreshTick === 0;
    if (isInitialMount && hasEntry) return;
    apiGetReactions(post.id, userId ?? undefined)
      .then((data) => {
        setReactions(post.id, data.counts, data.userReaction);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, [post.id, userId, setReactions, refreshTick]);

  // ── Floating picker ───────────────────────────
  // The picker overlay is rendered globally by <ReactionPickerHost />
  // (mounted at screen-root in HomeScreen, ProfileScreen, PostDetailScreen)
  // so it escapes FlatList row clipping AND is not a <Modal> — preserving
  // the long-press → drag → release continuous gesture across surfaces.
  const reactionBtnRef = useRef<View>(null);
  const reactionPress = usePressAnimation();

  // ── Facebook-style continuous gesture (long-press → drag → release) ──
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedBeyondTapRef = useRef(false);
  const userReactionRef = useRef<ReactionType | null>(null);
  const handleReactionRef = useRef<(type: ReactionType) => void>(() => {});

  // ── Reactors modal ────────────────────────────
  const [showReactors, setShowReactors] = useState(false);
  const [reactorsTab, setReactorsTab] = useState<"ALL" | ReactionType>("ALL");
  const [reactorsList, setReactorsList] = useState<
    Array<{ type: string; user: { id: string; displayName: string; avatarUrl: string | null; role: string } }>
  >([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);

  const openReactors = async () => {
    setReactorsTab("ALL");
    setShowReactors(true);
    setReactorsLoading(true);
    try {
      const data = await apiGetReactors(post.id);
      setReactorsList(data.reactors);
    } catch {
      // silently fail
    } finally {
      setReactorsLoading(false);
    }
  };

  // ── 3-dot menu ────────────────────────────────
  const [showMenu, setShowMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ top: 80, right: 20 });
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  // Estimated dimensions of the picker pill (5 bubbles × 44 + gaps + padding).
  // Used to position the picker above its anchor before measuring on layout.
  const PICKER_WIDTH = 270;
  const PICKER_HEIGHT = 60;

  const openPickerAt = (anchor: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    tapMedium();
    let left = anchor.x + anchor.width / 2 - PICKER_WIDTH / 2;
    left = Math.max(8, Math.min(left, screenWidth - PICKER_WIDTH - 8));
    // Prefer above the anchor; if not enough room, drop below.
    let top = anchor.y - PICKER_HEIGHT - 8;
    if (top < 8) top = anchor.y + anchor.height + 8;
    // Push to the global picker store. The host overlay (mounted at
    // screen-root) renders at this window-coord position and populates
    // bubble bounds via measureInWindow for hit testing.
    useReactionPickerStore.getState().open({
      pickerPos: { top, left },
      userReaction: userReactionRef.current,
      onSelect: (type) => handleReactionRef.current(type),
    });
  };

  const openPickerFromReactionBtn = () => {
    const node = reactionBtnRef.current;
    if (node && typeof (node as any).measureInWindow === "function") {
      (node as any).measureInWindow(
        (x: number, y: number, w: number, h: number) =>
          openPickerAt({ x, y, width: w, height: h }),
      );
    } else {
      // Fallback: center horizontally near the bottom of the screen.
      openPickerAt({
        x: screenWidth / 2 - 22,
        y: screenHeight - 200,
        width: 44,
        height: 44,
      });
    }
  };

  const openPickerFromCard = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    openPickerAt({
      x: pageX - 22,
      y: pageY - 22,
      width: 44,
      height: 44,
    });
  };

  const closePicker = () => {
    useReactionPickerStore.getState().close();
  };

  const openMenu = (event: GestureResponderEvent) => {
    const { pageY, pageX } = event.nativeEvent;
    const estimatedMenuHeight =
      88 + (canPin ? 44 : 0) + (canFlag ? 44 : 0) + (canDelete ? 44 : 0);
    const top = Math.min(
      Math.max(16, pageY + 8),
      screenHeight - estimatedMenuHeight - 16,
    );
    setMenuAnchor({
      top,
      right: Math.max(12, screenWidth - pageX + 12),
    });
    setShowMenu(true);
    Animated.spring(menuAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 7,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowMenu(false));
  };

  const handleViewComments = () => {
    closeMenu();
    onPostPress?.(post.id);
    navigation.navigate("PostDetail" as any, { postId: post.id, openedFrom });
  };

  const handleDeletePost = async () => {
    closeMenu();
    const confirmed = await showConfirm(
      "Delete Post",
      "Are you sure you want to delete this post?",
    );

    if (confirmed) {
      if (!userId) return;
      try {
        await apiDeletePost(post.id, userId);
        onDelete?.(post.id);
      } catch (error) {
        showAlert("Error", "Failed to delete post. Please try again.");
      }
    }
  };

  const handleOpenEditPost = () => {
    closeMenu();
    setEditContent(post.content);
    setEditModalVisible(true);
  };

  const handleSaveEditPost = async () => {
    if (!userId) return;
    const trimmed = editContent.trim();
    if (trimmed.length < 3) {
      showAlert("Error", "Post content must be at least 3 characters.");
      return;
    }

    setSavingEdit(true);
    try {
      const { underReview } = await apiUpdatePost(post.id, {
        userId,
        content: trimmed,
        tags: post.tags,
      });
      setEditModalVisible(false);
      showAlert(
        "Success",
        underReview
          ? "Post updated and is under review."
          : "Post updated successfully."
      );
      onDelete?.(post.id);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ??
        error?.message ??
        "Failed to update post. Please try again.";
      showAlert("Error", message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleFlagPost = async () => {
    closeMenu();
    const confirmed = await showConfirm(
      "Flag this post",
      "This will flag the post as inappropriate. Are you sure?",
    );

    if (confirmed) {
      if (!userId) return;
      try {
        await apiFlagPost(post.id, userId);
        showAlert("Success", "Post has been flagged.");
        onDelete?.(post.id); // Refresh the feed
      } catch (error) {
        showAlert("Error", "Failed to flag post. Please try again.");
      }
    }
  };

  const handleTogglePin = async () => {
    closeMenu();
    if (role !== "ADMIN" || !userId) return;

    try {
      if (post.pinned) {
        await apiUnpinPost(post.id, userId);
        await showAlert("Success", "Post has been unpinned.");
        onDelete?.(post.id);
      } else {
        await apiPinPost(post.id, userId);
        await showAlert("Success", "Post has been pinned.");
        onPin?.(post.id) ?? onDelete?.(post.id);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ??
        error?.message ??
        "Failed to update pin status. Please try again.";
      showAlert("Error", message);
    }
  };

  // ── Permission check ──────────────────────────
  const canDelete = userId === post.userId || role === "ADMIN";
  const canEdit = userId === post.userId;
  const canFlag = role === "COACH" || role === "ADMIN";
  const canPin = role === "ADMIN";

  const handleReaction = async (type: ReactionType) => {
    if (!userId) return;
    tapLight();
    playClick();
    if (useReactionPickerStore.getState().visible) closePicker();
    const snapshot = applyToggle(post.id, type);
    try {
      await apiUpsertReaction(post.id, { userId, type });
    } catch {
      rollback(post.id, snapshot);
    }
  };

  // Keep gesture refs in sync with latest values so the PanResponder
  // (built once with empty deps) always sees the current reaction + handler.
  useEffect(() => {
    userReactionRef.current = userReaction;
    handleReactionRef.current = handleReaction;
  });

  // PanResponder for the reaction button: tap toggles current reaction;
  // long-press opens the picker; once open, dragging the finger highlights
  // the bubble whose X aligns with the finger; releasing over a bubble
  // selects it. The picker overlay is rendered globally by
  // <ReactionPickerHost /> so the gesture survives across feed surfaces.
  const reactionPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: () => {
          reactionPress.onPressIn();
          movedBeyondTapRef.current = false;
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = setTimeout(() => {
            reactionPress.onLongPress();
            openPickerFromReactionBtn();
          }, 300);
        },

        onPanResponderMove: (_e, g) => {
          const pickerStore = useReactionPickerStore.getState();
          if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) {
            movedBeyondTapRef.current = true;
            // Movement before the long-press fires cancels the picker.
            if (!pickerStore.visible && longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }
          if (!pickerStore.visible) return;
          pickerStore.setPressed(findBubbleAt(g.moveX));
        },

        onPanResponderRelease: (_e, g) => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          reactionPress.onPressOut();

          const pickerStore = useReactionPickerStore.getState();
          if (pickerStore.visible) {
            const hit = findBubbleAt(g.moveX || g.x0);
            pickerStore.setPressed(null);
            closePicker();
            if (hit) {
              handleReactionRef.current(hit);
            }
            return;
          }

          if (!movedBeyondTapRef.current) {
            handleReactionRef.current(userReactionRef.current ?? "PRAY");
          }
        },

        onPanResponderTerminate: () => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          reactionPress.onPressOut();
          const pickerStore = useReactionPickerStore.getState();
          pickerStore.setPressed(null);
          if (pickerStore.visible) closePicker();
        },
      }),
    // Stable handlers — closures use refs/store getState for fresh values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const topReactions = REACTION_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);

  const colorPair = getAvatarColors(initial, colors);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          onPostPress?.(post.id);
          navigation.navigate("PostDetail" as any, { postId: post.id, openedFrom });
        }}
        onLongPress={openPickerFromCard}
        delayLongPress={300}
        {...suppressWebMenu()}
        style={[
          styles.card,
          post.pinned ? styles.cardPinned : null,
          styles.cardDefault,
          { backgroundColor: colors.card },
          noSelectStyle,
          isSmall && { borderRadius: 0, marginHorizontal: 0, marginBottom: 2 },
          isMedium && { padding: 24, marginBottom: 20, marginHorizontal: 20 },
          isWide && { padding: 28, marginBottom: 24 },
        ]}
      >
        {/* ── Author row ── */}
        <View style={styles.authorRow}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            disabled={post.userId === SYSTEM_USER_ID || (post.isAnonymous && !isOwnAnonymousPost)}
            onPress={() => navigation.navigate("Profile", { userId: post.userId })}
          >
            {post.userId === "system-encouragement-bot" ? (
              <Image
                source={require("../assets/logo.png")}
                style={[styles.avatar, isMedium && styles.avatarMd, isWide && styles.avatarWide, { borderRadius: isMedium ? 10 : 8 }]}
                cachePolicy="memory-disk"
              />
            ) : displayAvatarUrl ? (
              <Image
                source={{ uri: optimizeCloudinaryUrl(resolveAvatarUrl(displayAvatarUrl), 80) }}
                style={[styles.avatar, isMedium && styles.avatarMd, isWide && styles.avatarWide]}
                cachePolicy="memory-disk"
                transition={200}
                recyclingKey={`avatar-${post.id}-${displayAvatarUrl}`}
              />
            ) : (
              <LinearGradient
                colors={colorPair}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, isMedium && styles.avatarMd, isWide && styles.avatarWide]}
              >
                <Text style={[styles.avatarInitial, isMedium && { fontSize: 17 }, isWide && { fontSize: 19 }]}>{initial}</Text>
              </LinearGradient>
            )}

            <View style={{ flexShrink: 1, flex: 1, }}>
              <View style={styles.authorNameRow}>
                <Text
                  style={[styles.authorName, isMedium && { fontSize: 15 }, isWide && { fontSize: 16 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayName}
                </Text>
                {isOwnAnonymousPost && (
                  <Text
                    adjustsFontSizeToFit
                    style={[styles.authorSubtitle, { color: colors.secondary }]}
                    numberOfLines={1}
                  >
                    {"● Posted as "}{post.anonDisplayName ?? "Anonymous"}
                  </Text>
                )}
                {post.userId !== "system-encouragement-bot" && post.user?.role !== "USER" && !post.isAnonymous && (
                  <View style={[
                    styles.roleBadge,
                    post.user?.role === "COACH" ? styles.roleBadgeCoach :
                    post.user?.role === "ADMIN" ? styles.roleBadgeAdmin :
                    styles.roleBadgeMember,
                  ]}>
                    <Text style={[
                      styles.roleBadgeText,
                      post.user?.role === "COACH" ? styles.roleBadgeTextCoach :
                      post.user?.role === "ADMIN" ? styles.roleBadgeTextAdmin :
                      styles.roleBadgeTextMember,
                    ]}>
                      {post.userId === "system-encouragement-bot" ? "PUSO AI" :
                       post.user?.role === "COACH" ? "Coach" :
                       post.user?.role === "ADMIN" ? "ADMIN" :
                       ""}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.subtitleRow}>
                <Text style={styles.authorSubtitle}>{timeAgo}</Text>
                {(() => {
                  const feelingTag = post.tags?.find((t) => FEELING_MAP[t]);
                  if (!feelingTag) return null;
                  const f = FEELING_MAP[feelingTag];
                  return (
                    <Text style={styles.feelingText}>
                      {" · is feeling "}
                      <Text style={styles.feelingEmoji}>{f.emoji}</Text>
                      {" "}
                      <Text style={styles.feelingLabel}>{f.label}</Text>
                    </Text>
                  );
                })()}
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            {post.pinned && (
              <View style={styles.pinnedPill}>
                <Ionicons name="pin" size={12} color={colors.accent} />
                {(isMedium || isWide) && <Text style={styles.pinnedPillText}>Pinned</Text>}
              </View>
            )}
            <TouchableOpacity
              onPress={openMenu}
              activeOpacity={0.7}
              style={styles.menuButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Post Content ── */}
        <MentionText
          text={post.content}
          baseStyle={styles.content}
          mentionStyle={styles.mentionText}
          numberOfLines={4}
        />

        {/* ── Post Image ── */}
        {post.imageUrl && (
          <Image
            source={{ uri: optimizeCloudinaryUrl(resolveAvatarUrl(post.imageUrl), 600) }}
            style={[styles.postImage, isMedium && !isWide && { height: 260 }, isWide && { height: 340 }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={300}
            recyclingKey={`post-image-${post.id}-${post.imageUrl}`}
          />
        )}

        {/* ── Tags ── */}
        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {post.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer: reaction + comment counts ── */}
        <View style={[styles.footer, isMedium && !isWide && { marginTop: 20, paddingTop: 16 }, isWide && { marginTop: 24, paddingTop: 18 }]}>
          <View style={styles.footerLeft}>
            {/* Main reaction button — defaults to Pray, shows user's reaction when set */}
            <View
              ref={reactionBtnRef}
              {...reactionPanResponder.panHandlers}
              {...suppressWebMenu()}
              style={[styles.countButton, noSelectStyle]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.reactionPressBg,
                  { opacity: reactionPress.bgOpacity },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={{ transform: [{ scale: reactionPress.scale }] }}
              >
                {/* key forces remount on reaction change. Safari otherwise
                    caches the mask-image (tintColor) inside the composited
                    layer created by the Animated transform, so the icon
                    color never updates after a select/deselect. */}
                {renderReactionIcon(
                  userReaction ?? "PRAY",
                  18,
                  userReaction ? colors.primary : colors.lightPrimary,
                )}
              </Animated.View>
            </View>
            {/* Comment button */}
            <TouchableOpacity
              onPress={() => {
                onPostPress?.(post.id);
                navigation.navigate("PostDetail" as any, { postId: post.id });
              }}
              activeOpacity={0.75}
              style={styles.countButton}
            >
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={colors.muted5}
              />
              <Text style={styles.footerCountMuted}>
                {post.commentCount ? `${post.commentCount}` : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right side: overlapping reaction summary */}
          {topReactions.length > 0 && (
            <TouchableOpacity
              onPress={openReactors}
              activeOpacity={0.75}
              style={styles.reactionSummary}
            >
              <View style={styles.reactionStack}>
                {topReactions.map((type, i) => (
                  <View
                    key={type}
                    style={[
                      styles.reactionStackIcon,
                      { zIndex: topReactions.length - i, marginLeft: i === 0 ? 0 : -6 },
                    ]}
                  >
                    {renderReactionIcon(type, 14, colors.card)}
                  </View>
                ))}
              </View>
              <Text style={styles.reactionSummaryCount}>{localTotal}</Text>
            </TouchableOpacity>
          )}
        </View>

        {post.latestComment && post.latestComment.userId !== SYSTEM_USER_ID && (() => {
          const isOwnAnonComment = post.latestComment!.isAnonymous && post.latestComment!.userId === userId;
          const cName = isOwnAnonComment
            ? (currentUserDisplayName ?? post.latestComment!.user?.displayName ?? "Member")
            : (post.latestComment!.user?.displayName ?? "Member");
          const cInitial = post.latestComment!.isAnonymous && !isOwnAnonComment ? "?" : cName.charAt(0).toUpperCase();
          const cColorPair = getAvatarColors(cInitial, colors);
          const cTime = formatRelativeTime(post.latestComment!.createdAt);
          const cAvatarUrl = isOwnAnonComment ? currentUserAvatarUrl : (post.latestComment!.isAnonymous ? null : post.latestComment!.user?.avatarUrl);
          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                onPostPress?.(post.id);
                navigation.navigate("PostDetail" as any, {
                  postId: post.id,
                  highlightCommentId: post.latestComment!.id,
                  openedFrom,
                });
              }}
              style={[styles.latestCommentWrap, !isMedium && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }, isMedium && styles.latestCommentWrapMd, isWide && styles.latestCommentWrapWide]}
            >
              <View style={[styles.commentInner, isMedium && styles.commentInnerMd]}>
                {cAvatarUrl ? (
                  <Image
                    source={{ uri: optimizeCloudinaryUrl(resolveAvatarUrl(cAvatarUrl), 52) }}
                    style={[styles.commentAvatar, isMedium && { width: 26, height: 26, borderRadius: 13 }]}
                    cachePolicy="memory-disk"
                    transition={200}
                    recyclingKey={`comment-avatar-${post.latestComment!.id}-${cAvatarUrl}`}
                  />
                ) : (
                <LinearGradient
                  colors={cColorPair}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.commentAvatar, isMedium && { width: 26, height: 26, borderRadius: 13 }]}
                >
                  <Text style={styles.commentAvatarText}>{cInitial}</Text>
                </LinearGradient>
                )}
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor} numberOfLines={1}>{cName}</Text>
                    <Text style={styles.commentTimeDot}>{"  \u00B7  "}</Text>
                    <Text style={styles.commentTime}>{cTime}</Text>
                  </View>
                  <MentionText
                    text={post.latestComment.content}
                    baseStyle={styles.latestCommentText}
                    mentionStyle={styles.mentionText}
                    numberOfLines={2}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        })()}
      </TouchableOpacity>

      {/* ── Floating Reaction Picker ─────────────────────────────────
          The picker overlay is rendered at screen-root by
          <ReactionPickerHost /> (mounted in HomeScreen, ProfileScreen,
          PostDetailScreen). PostCard pushes window-coord position +
          callbacks to useReactionPickerStore on long-press; the host
          subscribes and renders. This preserves the long-press → drag →
          release continuous gesture by keeping the picker out of any
          <Modal> (which would interrupt touch on Android) and out of the
          FlatList row (which would clip the overflow). */}

      {/* ── 3-Dot Menu Modal ── */}
      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View
            style={[
              styles.menuModalContainer,
              { top: menuAnchor.top, right: menuAnchor.right },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              <Animated.View
                style={[
                  styles.menuDropdown,
                  {
                    opacity: menuAnim,
                    transform: [
                      {
                        scale: menuAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                      {
                        translateY: menuAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={handleViewComments}
                  activeOpacity={0.7}
                  style={styles.menuOption}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.menuOptionText}>View Comments</Text>
                </TouchableOpacity>
                {canPin && (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      onPress={handleTogglePin}
                      activeOpacity={0.7}
                      style={styles.menuOption}
                    >
                      <Ionicons
                        name={post.pinned ? "pin" : "pin-outline"}
                        size={18}
                        color={colors.accent}
                      />
                      <Text style={styles.menuOptionTextAccent}>
                        {post.pinned ? "Unpin Post" : "Pin Post"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {canFlag && (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      onPress={handleFlagPost}
                      activeOpacity={0.7}
                      style={styles.menuOption}
                    >
                      <Ionicons
                        name="flag-outline"
                        size={18}
                        color={colors.warningText}
                      />
                      <Text
                        style={[
                          styles.menuOptionText,
                          styles.menuOptionTextWarning,
                        ]}
                      >
                        Flag this post
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {canEdit && (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      onPress={handleOpenEditPost}
                      activeOpacity={0.7}
                      style={styles.menuOption}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.menuOptionText}>Edit Post</Text>
                    </TouchableOpacity>
                  </>
                )}
                {canDelete && (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      onPress={handleDeletePost}
                      activeOpacity={0.7}
                      style={styles.menuOption}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.danger}
                      />
                      <Text
                        style={[
                          styles.menuOptionText,
                          styles.menuOptionTextDanger,
                        ]}
                      >
                        Delete Post
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !savingEdit && setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.editBackdrop}
          activeOpacity={1}
          onPress={() => !savingEdit && setEditModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.editSheet}
          >
            <Text style={styles.editTitle}>Edit Post</Text>
            <TextInput
              style={styles.editInput}
              value={editContent}
              onChangeText={setEditContent}
              editable={!savingEdit}
              multiline
              maxLength={500}
              placeholder="Update your post..."
              placeholderTextColor={colors.muted4}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                activeOpacity={0.8}
                onPress={() => setEditModalVisible(false)}
                disabled={savingEdit}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveBtn}
                activeOpacity={0.8}
                onPress={handleSaveEditPost}
                disabled={savingEdit || editContent.trim().length < 3}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.editSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* ── Reactors modal ── */}
      <Modal
        visible={showReactors}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowReactors(false)}
      >
        <TouchableOpacity
          style={styles.reactorsBackdrop}
          activeOpacity={1}
          onPress={() => setShowReactors(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.reactorsSheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
            <View style={styles.reactorsHandle} />
            <Text style={styles.reactorsTitle}>Reactions</Text>

            {/* Tabs */}
            <View style={styles.reactorsTabRow}>
              {(["ALL", ...REACTION_TYPES] as Array<"ALL" | ReactionType>).map((tab) => {
                const isActive = reactorsTab === tab;
                const count = tab === "ALL"
                  ? reactorsList.length
                  : reactorsList.filter((r) => r.type === tab).length;

                if (count <= 0) return null;

                return (
                  <TouchableOpacity
                    key={tab}
                    activeOpacity={0.8}
                    onPress={() => setReactorsTab(tab)}
                    style={[styles.reactorsTab, isActive && styles.reactorsTabActive]}
                  >
                    {tab !== "ALL" && (
                      <View style={styles.reactorsTabIcon}>
                        {renderReactionIcon(tab as ReactionType, 11, colors.card)}
                      </View>
                    )}
                    <Text style={[styles.reactorsTabText, isActive && styles.reactorsTabTextActive]}>
                      {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </Text>
                    {count > 0 && (
                      <Text style={[styles.reactorsTabCount, isActive && styles.reactorsTabCountActive]}>
                        {count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* List */}
            {reactorsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
            ) : reactorsList.filter((r) => reactorsTab === "ALL" || r.type === reactorsTab).length === 0 ? (
              <View style={styles.reactorsEmpty}>
                <Ionicons name="heart-outline" size={32} color={colors.muted4} />
                <Text style={styles.reactorsEmptyText}>No reactions yet</Text>
              </View>
            ) : (
              <FlatList
                data={reactorsList.filter((r) => reactorsTab === "ALL" || r.type === reactorsTab)}
                keyExtractor={(item, idx) => item.user.id + item.type + idx}
                style={styles.reactorsList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const initial = item.user.displayName.charAt(0).toUpperCase();
                  const grad: [string, string] = [colors.primary, colors.secondary];
                  return (
                    <Pressable
                      onPress={() => {
                        setShowReactors(false);
                        navigation.navigate("Profile", { userId: item.user.id });
                      }}
                      style={styles.reactorRow}
                    >
                      <View style={styles.reactorAvatarWrap}>
                        {item.user.avatarUrl ? (
                          <Image
                            source={{ uri: optimizeCloudinaryUrl(resolveAvatarUrl(item.user.avatarUrl), 56) }}
                            style={styles.reactorAvatar}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <LinearGradient
                            colors={grad}
                            style={styles.reactorAvatar}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Text style={styles.reactorInitial}>{initial}</Text>
                          </LinearGradient>
                        )}
                        <View style={styles.reactorTypeBadge}>
                          {renderReactionIcon(item.type as ReactionType, 9, colors.card)}
                        </View>
                      </View>
                      <Text style={styles.reactorName} numberOfLines={1}>
                        {item.user.displayName}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// Memoize so feed list (HomeScreen) only re-renders cards whose `post` reference
// actually changed (e.g., reaction toggle, edit). With stable handlers from
// parent, a shallow prop comparison is sufficient.
const PostCard = React.memo(PostCardImpl);
export default PostCard;

// ─────────────────────────────────────────────
// Styles — Sacred Journal design system
// No 1px borders. Tonal layering. xl corners. Generous padding.
// ─────────────────────────────────────────────
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  // ── Card — "fresh page" ───────────────────
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 14,
    ...ambientShadow,
  },
  cardDefault: {},
  cardPinned: {
    backgroundColor: colors.surfaceBright,
  },
  // ── Author ────────────────────────────────
  authorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pinnedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.secondaryFixed,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pinnedPillText: {
    color: colors.onSecondaryFixed,
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarMd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarWide: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
  },
  avatarInitial: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: fonts.displayBold,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 1,
  },
  authorName: {
    color: colors.onSurface,
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    flexShrink: 1,
    minWidth: 50,
  },
  roleBadge: {
    borderRadius: radii.full,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  roleBadgeCoach: {
    backgroundColor: colors.primary,
  },
  roleBadgeAdmin: {
    backgroundColor: colors.darkest,
  },
  roleBadgeMember: {
    backgroundColor: colors.surfaceVariant,
  },
  roleBadgeText: {
    fontSize: 9,
    fontFamily: fonts.displaySemiBold,
    letterSpacing: 0.8,
  },
  roleBadgeTextCoach: {
    color: colors.onPrimary,
    lineHeight: 10,
  },
  roleBadgeTextAdmin: {
    color: colors.onPrimary,
    lineHeight: 10,
  },
  roleBadgeTextMember: {
    color: colors.onSurfaceVariant,
    lineHeight: 10,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 1,
  },
  authorSubtitle: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
  },
  feelingText: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
  },
  feelingEmoji: {
    fontSize: 12,
  },
  feelingLabel: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  menuButton: {
    width: 16,
    height: 22,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  // ── Body ──────────────────────────────────
  content: {
    color: colors.onSurface,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    lineHeight: 24,
  },
  mentionText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: radii.lg,
    marginTop: 14,
  },

  // ── Tags — reflection chips ───────────────
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    gap: 8,
  },
  tagChip: {
    backgroundColor: colors.secondaryFixed,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    color: colors.onSecondaryFixed,
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Footer — no top border, use spacing ───
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  footerCountMuted: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.bodySemiBold,
  },
  countButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  // Tinted background that fades in while a reaction button is pressed.
  // Provides visible feedback on web/PWA where haptics are unavailable.
  reactionPressBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryContainer,
    opacity: 0,
    borderRadius: radii.full,
  },
  reactionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reactionStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  reactionStackIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  reactionSummaryCount: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.bodySemiBold,
  },
  latestCommentWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 16,
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: -16,
    marginBottom: -16,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: "hidden",
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  latestCommentWrapMd: {
    marginHorizontal: -24,
    marginBottom: -24,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  latestCommentWrapWide: {
    marginHorizontal: -28,
    marginBottom: -28,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  commentInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  commentInnerMd: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  commentAvatarText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontFamily: fonts.displayBold,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAuthor: {
    fontSize: 12,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  commentTimeDot: {
    fontSize: 10,
    color: colors.muted4,
  },
  commentTime: {
    fontSize: 10,
    fontFamily: fonts.bodyRegular,
    color: colors.muted5,
  },
  latestCommentText: {
    flex: 1,
    color: colors.onSurfaceVariant,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    lineHeight: 17,
  },

  // ── 3-Dot Menu ────────────────────────────
  menuBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuModalContainer: {
    position: "absolute",
    alignItems: "flex-end",
  },
  menuDropdown: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: 6,
    minWidth: 190,
    ...ambientShadow,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 14,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.outline + "15",
    marginHorizontal: 12,
  },
  menuOptionText: {
    color: colors.primary,
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
  },
  menuOptionTextAccent: {
    color: colors.tertiary,
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
  },
  menuOptionTextWarning: {
    color: colors.warningText,
  },
  menuOptionTextDanger: {
    color: colors.danger,
  },
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(28,27,35,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  editSheet: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 24,
  },
  editTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    marginBottom: 16,
  },
  editInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.lg,
    minHeight: 120,
    maxHeight: 220,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    textAlignVertical: "top",
  },
  editActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  editCancelBtn: {
    borderRadius: radii.full,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surfaceVariant,
  },
  editCancelText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
  editSaveBtn: {
    borderRadius: radii.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    minWidth: 80,
    alignItems: "center",
  },
  editSaveText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Reactors modal ────────────────────────────
  reactorsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "flex-end",
  },
  reactorsSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "80%" as any,
    ...ambientShadow,
  },
  reactorsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outline + "40",
    alignSelf: "center",
    marginBottom: 12,
  },
  reactorsTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontFamily: fonts.displayBold,
    marginBottom: 12,
  },
  reactorsTabRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  reactorsTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  reactorsTabActive: {
    backgroundColor: colors.primary,
  },
  reactorsTabIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reactorsTabText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
  },
  reactorsTabTextActive: {
    color: colors.onPrimary,
  },
  reactorsTabCount: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted4,
  },
  reactorsTabCountActive: {
    color: colors.onPrimary + "CC",
  },
  reactorsList: {
    maxHeight: 360,
  },
  reactorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  reactorAvatarWrap: {
    width: 40,
    height: 40,
  },
  reactorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reactorInitial: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.displayBold,
  },
  reactorTypeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  reactorName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurface,
  },
  reactorsEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  reactorsEmptyText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
  },
});
