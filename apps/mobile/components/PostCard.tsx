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
  Modal,
  Animated,
  StyleSheet,
  FlatList,
  type GestureResponderEvent,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  Post,
  ReactionType,
  ReactionCounts,
} from "../../../packages/types";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { PrayIcon, SupportIcon, LikeIcon } from "./ReactionIcons";
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
import { tapLight, tapMedium } from "../utils/haptics";
import { noSelectStyle, suppressWebMenu } from "../utils/suppressWebMenu";
import { usePressAnimation } from "../hooks/usePressAnimation";
import { colors as defaultColors, fonts, radii, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import MentionText from "./MentionText";
import { optimizeCloudinaryUrl } from "../utils/optimizeImage";

const REACTION_TYPES: ReactionType[] = ["PRAY", "CARE", "SUPPORT", "LIKE"];
const SYSTEM_USER_ID = "system-encouragement-bot";

const REACTION_LABELS: Record<ReactionType, string> = {
  PRAY: "Pray",
  CARE: "Care",
  SUPPORT: "Support",
  LIKE: "Like",
};

// Per-reaction gradient palette (sourced from theme tokens).
const REACTION_GRADIENTS: Record<
  ReactionType,
  (c: typeof defaultColors) => [string, string]
> = {
  PRAY: (c) => [c.primary, c.secondary],
  CARE: (c) => [c.hot, c.fuchsia],
  SUPPORT: (c) => [c.tertiary, c.primary],
  LIKE: (c) => [c.secondary, c.primaryContainer],
};

const FEELING_MAP: Record<string, { emoji: string; label: string }> = {
  grateful: { emoji: "\u{1F60A}", label: "Grateful" },
  prayerful: { emoji: "\u{1F64F}", label: "Prayerful" },
  strong: { emoji: "\u{1F4AA}", label: "Strong" },
  struggling: { emoji: "\u{1F622}", label: "Struggling" },
  hopeful: { emoji: "\u{1F917}", label: "Hopeful" },
  "heavy-hearted": { emoji: "\u{1F614}", label: "Heavy-hearted" },
  blessed: { emoji: "\u2728", label: "Blessed" },
  loved: { emoji: "\u2764\uFE0F", label: "Loved" },
};

const CARE_ICON_CANDIDATES: Array<keyof typeof Ionicons.glyphMap> = [
  "heart",
  "heart-outline",
  "ellipse",
];

function getCareIcon(): keyof typeof Ionicons.glyphMap {
  const candidates = CARE_ICON_CANDIDATES;
  return candidates.find((name) => name in Ionicons.glyphMap) ?? "ellipse";
}

function renderReactionIcon(type: ReactionType, size: number, color: string) {
  // The `key` includes both type and color. This forces React to remount the
  // underlying <Image>/<Ionicons> whenever either changes — Safari otherwise
  // caches the CSS mask-image (used to implement `tintColor`) inside any
  // ancestor compositing layer, so the icon's color never updates after a
  // select/deselect.
  const k = `${type}-${color}`;
  if (type === "PRAY") return <PrayIcon key={k} size={size} color={color} />;
  if (type === "SUPPORT")
    return <SupportIcon key={k} size={size} color={color} />;
  if (type === "LIKE") return <LikeIcon key={k} size={size} color={color} />;
  return <Ionicons key={k} name={getCareIcon()} size={size} color={color} />;
}

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  onPin?: (postId: string) => void;
  onPostPress?: (postId: string) => void;
  openedFrom?: string;
}

/**
 * Formats a UTC ISO date string into a readable relative time
 * e.g. "2 hours ago", "just now"
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000); // seconds

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
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
  const userReaction = reactionState?.userReaction ?? null;
  const counts = reactionState?.counts ?? {};
  const localTotal = reactionState?.total ?? (post.reactionCount ?? 0);

  // ── Fetch counts on mount ─────────────────────
  // Only fetch from the server if the store has no data for this post yet.
  // This avoids refetching on remount (e.g. when coming back from PostDetail)
  // which can race with an in-flight POST and overwrite the store with stale
  // server state.
  useEffect(() => {
    if (useReactionsStore.getState().byPostId[post.id]) return;
    apiGetReactions(post.id, userId ?? undefined)
      .then((data) => {
        // Don't clobber if a write set state while the fetch was in flight.
        if (useReactionsStore.getState().byPostId[post.id]) return;
        setReactions(post.id, data.counts, data.userReaction);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, [post.id, userId, setReactions]);

  // ── Floating picker ───────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [pressedReaction, setPressedReaction] = useState<ReactionType | null>(
    null,
  );
  // Position of the picker pill in window coordinates. Set on long-press by
  // measuring the anchor (reaction button or card press location) so the
  // picker appears just above it instead of being centered on screen.
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const reactionBtnRef = useRef<View>(null);
  const reactionPress = usePressAnimation();
  const pickerAnim = useRef(new Animated.Value(0)).current;

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

  // Estimated dimensions of the picker pill (4 bubbles × 44 + gaps + padding).
  // Used to position the picker above its anchor before measuring on layout.
  const PICKER_WIDTH = 224;
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
    setPickerPos({ top, left });
    setShowPicker(true);
    Animated.spring(pickerAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 7,
    }).start();
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

  const openPicker = () => {
    // Legacy entry point — opens centered if anchor unknown.
    openPickerAt({
      x: screenWidth / 2 - 22,
      y: screenHeight / 2 - 22,
      width: 44,
      height: 44,
    });
  };

  const closePicker = () => {
    Animated.timing(pickerAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowPicker(false));
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
    if (showPicker) closePicker();
    const snapshot = applyToggle(post.id, type);
    try {
      await apiUpsertReaction(post.id, { userId, type });
    } catch {
      rollback(post.id, snapshot);
    }
  };

  const topReactions = REACTION_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);

  const avatarPalette: [string, string][] = [
    [colors.secondary, colors.primary],
    [colors.primaryContainer, colors.gradientStart],
    [colors.secondary, colors.primaryContainer],
    [colors.primaryContainer, colors.primary],
    [colors.secondary, colors.tertiary],
  ];
  const colorPair = avatarPalette[initial.charCodeAt(0) % avatarPalette.length];

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
            <TouchableOpacity
              ref={reactionBtnRef as any}
              onPress={() => handleReaction(userReaction ?? "PRAY")}
              onPressIn={reactionPress.onPressIn}
              onPressOut={reactionPress.onPressOut}
              onLongPress={() => {
                reactionPress.onLongPress();
                openPickerFromReactionBtn();
              }}
              delayLongPress={300}
              activeOpacity={1}
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
            </TouchableOpacity>
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
          const cColorPair = avatarPalette[cInitial.charCodeAt(0) % avatarPalette.length];
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

      {/* ── Floating Reaction Picker Modal (Facebook-style) ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="none"
        statusBarTranslucent
        backdropColor="transparent"
        onRequestClose={closePicker}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closePicker}
          />
          <View
            style={[
              styles.pickerAnchorLayer,
              pickerPos
                ? { top: pickerPos.top, left: pickerPos.left }
                : styles.modalCenter,
            ]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.pickerPill,
                {
                  opacity: pickerAnim,
                  transform: [
                    {
                      scale: pickerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                    {
                      translateY: pickerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {REACTION_TYPES.map((type, i) => {
                const active = userReaction === type;
                const isPressed = pressedReaction === type;
                // Stagger each icon's entrance
                const itemAnim = pickerAnim.interpolate({
                  inputRange: [
                    0,
                    Math.min(0.15 + i * 0.12, 0.85),
                    1,
                  ],
                  outputRange: [0, 0, 1],
                });
                const gradient = REACTION_GRADIENTS[type](colors);
                return (
                  <View key={type} style={styles.pickerItemWrap}>
                    {/* Floating label above pressed/active icon */}
                    {isPressed && (
                      <View style={styles.pickerTooltip}>
                        <Text style={styles.pickerTooltipText}>
                          {REACTION_LABELS[type]}
                        </Text>
                      </View>
                    )}
                    <Animated.View
                      style={{
                        opacity: itemAnim,
                        transform: [
                          {
                            scale: itemAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.4, isPressed ? 1.25 : 1],
                            }),
                          },
                          {
                            translateY: itemAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [16, isPressed ? -6 : 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleReaction(type)}
                        onPressIn={() => setPressedReaction(type)}
                        onPressOut={() => setPressedReaction(null)}
                        activeOpacity={1}
                        accessibilityLabel={REACTION_LABELS[type]}
                      >
                        <LinearGradient
                          colors={gradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.pickerBubble,
                            active && styles.pickerBubbleActive,
                          ]}
                        >
                          {renderReactionIcon(type, 24, colors.card)}
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </View>
      </Modal>

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
          <TouchableOpacity activeOpacity={1} style={styles.reactorsSheet}>
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
                    <View style={styles.reactorRow}>
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
                    </View>
                  );
                }}
              />
            )}
          </TouchableOpacity>
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
  footerCount: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
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
  reactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  reactBtnDefault: {
    backgroundColor: "transparent",
  },
  reactBtnEmoji: {
    fontSize: 14,
  },
  reactBtnLabel: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  reactBtnLabelDefault: {
    color: colors.onSurfaceVariant,
  },
  reactBtnLabelActive: {
    color: colors.secondary,
  },
  reactBtnHint: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.bodyRegular,
    marginLeft: 2,
  },

  // ── Modal / Picker ────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  // Anchor layer for the floating picker. When pickerPos is set we override
  // top/left inline so the picker sits just above the long-pressed button.
  pickerAnchorLayer: {
    position: "absolute",
  },
  pickerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.full,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    ...ambientShadow,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  pickerItemWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBubbleActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pickerTooltip: {
    position: "absolute",
    top: -34,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(28,27,35,0.92)",
  },
  pickerTooltipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
  },
  dismissHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 24,
    fontFamily: fonts.bodyMedium,
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
  menuOptionIcon: {
    fontSize: 20,
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
