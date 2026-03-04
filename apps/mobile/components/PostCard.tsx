// ─────────────────────────────────────────────
// components/PostCard.tsx
// Renders a single SAFE post in the feed
// ─────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  type GestureResponderEvent,
  Image,
  ActivityIndicator,
} from "react-native";
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
import { PrayIcon, SupportIcon } from "./ReactionIcons";
import {
  apiGetReactions,
  apiUpsertReaction,
  apiDeletePost,
  apiUpdatePost,
  apiFlagPost,
  apiPinPost,
  apiUnpinPost,
} from "../services/api";
import { useUser } from "../hooks/useUser";
import { colors } from "../constants/theme";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import MentionText from "./MentionText";

const REACTION_TYPES: ReactionType[] = ["PRAY", "CARE", "SUPPORT"];
const SYSTEM_USER_ID = "system-encouragement-bot";

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
  if (type === "PRAY") return <PrayIcon size={size} color={color} />;
  if (type === "SUPPORT") return <SupportIcon size={size} color={color} />;
  return <Ionicons name={getCareIcon()} size={size} color={color} />;
}

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
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
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// PostCard is used inside drawer screens, so we use any for navigation type
type CardNavProp = any;

export default function PostCard({ post, onDelete }: PostCardProps) {
  const navigation = useNavigation<CardNavProp>();
  const { userId, role } = useUser();
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const displayName = post.user?.displayName ?? "Anonymous";
  const timeAgo = formatRelativeTime(post.createdAt);
  const initial = displayName.charAt(0).toUpperCase();

  // ── Local reaction state (optimistic) ────────
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [counts, setCounts] = useState<ReactionCounts>({});
  const [localTotal, setLocalTotal] = useState(post.reactionCount ?? 0);
  const [reactionLoading, setReactionLoading] = useState(false);

  // ── Fetch counts on mount ─────────────────────
  useEffect(() => {
    apiGetReactions(post.id, userId ?? undefined)
      .then((data) => {
        setCounts(data.counts);
        setUserReaction(data.userReaction);
        const total = Object.values(data.counts).reduce(
          (s, n) => s + (n ?? 0),
          0,
        );
        setLocalTotal(total);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, [post.id, userId]);

  // ── Floating picker ───────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  // ── 3-dot menu ────────────────────────────────
  const [showMenu, setShowMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ top: 80, right: 20 });
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const openPicker = () => {
    setShowPicker(true);
    Animated.spring(pickerAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 7,
    }).start();
    // Silently refresh counts in background (data already loaded on mount)
    apiGetReactions(post.id, userId ?? undefined)
      .then((data) => {
        setCounts(data.counts);
        setUserReaction(data.userReaction);
        const total = Object.values(data.counts).reduce(
          (s, n) => s + (n ?? 0),
          0,
        );
        setLocalTotal(total);
      })
      .catch(() => {
        /* keep current state */
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
    navigation.getParent()?.navigate("PostDetail", { postId: post.id });
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
        showAlert("Success", "Post has been unpinned.");
      } else {
        await apiPinPost(post.id, userId);
        showAlert("Success", "Post has been pinned.");
      }
      onDelete?.(post.id);
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
    closePicker();
    setReactionLoading(true);
    const prev = userReaction;
    // Optimistic update
    const newCounts = { ...counts };
    if (prev) newCounts[prev] = Math.max(0, (newCounts[prev] ?? 1) - 1);
    const removing = type === prev;
    if (!removing) {
      newCounts[type] = (newCounts[type] ?? 0) + 1;
      setUserReaction(type);
      if (!prev) setLocalTotal((t) => t + 1);
    } else {
      setUserReaction(null);
      setLocalTotal((t) => Math.max(0, t - 1));
    }
    setCounts(newCounts);
    try {
      await apiUpsertReaction(post.id, { userId, type });
    } catch {
      // Revert
      setUserReaction(prev);
      setCounts(counts);
      setLocalTotal(post.reactionCount ?? 0);
    } finally {
      setReactionLoading(false);
    }
  };

  const topReactions = REACTION_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);

  const avatarPalette: [string, string][] = [
    [colors.hot, colors.primary],
    [colors.primary, colors.deep],
    [colors.fuchsia, colors.ink],
    [colors.ink, colors.deep],
    [colors.hot, colors.fuchsia],
  ];
  const colorPair = avatarPalette[initial.charCodeAt(0) % avatarPalette.length];

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() =>
          navigation.getParent()?.navigate("PostDetail", { postId: post.id })
        }
        onLongPress={openPicker}
        delayLongPress={300}
        style={[
          styles.card,
          post.pinned ? styles.cardPinned : null,
          styles.cardDefault,
        ]}
      >
        {/* ── Author row ── */}
        <View style={styles.authorRow}>
          <View style={styles.row}>
            {post.userId === "system-encouragement-bot" ? (
              <Image
                source={require("../assets/logo.png")}
                style={styles.avatar}
              />
            ) : (
              <LinearGradient
                colors={colorPair}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarInitial}>{initial}</Text>
              </LinearGradient>
            )}

            <View>
              <Text style={styles.authorName}>{displayName}</Text>
              <View style={styles.authorSubtitleRow}>
                <Ionicons
                  name="person-sharp"
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.authorSubtitle}>
                  {`Spaze ${post.userId === "system-encouragement-bot" ? "AI" : post.user?.role === "COACH" ? "Coach" : post.user?.role === "ADMIN" ? "Admin" : "Member"}`}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            {post.pinned && (
              <View style={styles.pinnedPill}>
                <Ionicons name="pin" size={12} color={colors.accent} />
                <Text style={styles.pinnedPillText}>Pinned</Text>
              </View>
            )}
            <View style={styles.timePill}>
              <Text style={styles.timeText}>{timeAgo}</Text>
            </View>
            <TouchableOpacity
              onPress={openMenu}
              activeOpacity={0.7}
              style={styles.menuButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Post Content ── */}
        <MentionText
          text={post.content}
          baseStyle={styles.content}
          mentionStyle={styles.mentionText}
          numberOfLines={4}
        />

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
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <TouchableOpacity
              onPress={() => handleReaction(userReaction ?? "PRAY")}
              onLongPress={openPicker}
              delayLongPress={300}
              activeOpacity={0.75}
              style={styles.countButton}
            >
              {userReaction ? (
                renderReactionIcon(userReaction, 22, colors.primary)
              ) : (
                <PrayIcon
                  size={22}
                  color={colors.lightPrimary}
                  style={{ top: -1 }}
                />
              )}
              <Text style={styles.footerCount}>
                {reactionLoading ? "…" : `${localTotal}`}
              </Text>
            </TouchableOpacity>
            <View style={styles.countButton}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={styles.footerCount}>{post.commentCount ?? 0}</Text>
            </View>
          </View>

          {topReactions.length > 0 && (
            <View style={styles.reactionSummaryRight}>
              {topReactions.map((type, i) => (
                <View
                  key={type}
                  style={[
                    styles.iconChip,
                    i > 0 ? styles.reactionSummaryOffset : undefined,
                  ]}
                >
                  {renderReactionIcon(type, 13, colors.card)}
                </View>
              ))}
            </View>
          )}
        </View>

        {post.latestComment && post.latestComment.userId !== SYSTEM_USER_ID && (
          <View style={styles.latestCommentWrap}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={13}
              color={colors.muted5}
            />
            <MentionText
              text={`${post.latestComment.user?.displayName ?? "Member"}: ${post.latestComment.content}`}
              baseStyle={styles.latestCommentText}
              mentionStyle={styles.mentionText}
              numberOfLines={1}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* ── Floating Reaction Picker Modal ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closePicker}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closePicker}
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.pickerPill,
                {
                  opacity: pickerAnim,
                  transform: [
                    {
                      scale: pickerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {REACTION_TYPES.map((type) => {
                const active = userReaction === type;
                const count = counts[type] ?? 0;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => handleReaction(type)}
                    activeOpacity={0.75}
                    style={[
                      styles.reactionOption,
                      active
                        ? styles.reactionOptionActive
                        : styles.reactionOptionDefault,
                    ]}
                  >
                    <View style={styles.reactionIconCircle}>
                      {renderReactionIcon(
                        type,
                        32,
                        colors.card,
                      )}
                    </View>
                    <Text
                      style={[
                        styles.reactionLabel,
                        active
                          ? styles.reactionLabelActive
                          : styles.reactionLabelDefault,
                      ]}
                    >
                      {type.toLowerCase().charAt(0).toUpperCase() +
                        type.slice(1).toLowerCase()}
                    </Text>
                    {count > 0 && (
                      <Text style={styles.reactionCount}>{count}</Text>
                    )}
                  </TouchableOpacity>
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
          style={styles.modalBackdrop}
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
    </>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Card ──────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardDefault: {
    borderWidth: 1,
    borderColor: colors.muted3,
  },
  cardPinned: {
    borderColor: colors.accent,
  },
  // ── Author ────────────────────────────────
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pinnedPillText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarInitial: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "700",
  },
  authorName: {
    color: colors.heading,
    fontWeight: "700",
    fontSize: 14,
  },
  authorSubtitle: {
    color: colors.muted5,
    fontSize: 11,
    marginTop: 1,
  },
  authorSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberIcon: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
  },
  timePill: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
  },
  menuButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Body ──────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: colors.muted3,
    marginBottom: 12,
  },
  content: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
  mentionText: {
    color: colors.primary,
    fontWeight: "700",
  },

  // ── Tags ──────────────────────────────────
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 6,
  },
  tagChip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.muted2,
  },
  tagText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
  },

  // ── Footer ────────────────────────────────
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.muted3,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionSummaryRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  reactionSummaryOffset: {
    marginLeft: -6,
  },
  footerCount: {
    fontSize: 13,
    color: colors.primary,
  },
  countButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 24,
  },
  latestCommentWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.muted3,
  },
  latestCommentText: {
    flex: 1,
    color: colors.muted5,
    fontSize: 12,
    lineHeight: 16,
  },
  reactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  reactBtnDefault: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  reactBtnEmoji: {
    fontSize: 14,
  },
  reactBtnLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  reactBtnLabelDefault: {
    color: colors.subtle,
  },
  reactBtnLabelActive: {
    color: colors.fuchsia,
  },
  reactBtnHint: {
    fontSize: 10,
    color: colors.muted5,
    marginLeft: 2,
  },

  // ── Modal / Picker ────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerPill: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
    shadowColor: colors.darkest,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: colors.muted1,
  },
  reactionOption: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 40,
    minWidth: 76,
  },
  reactionOptionDefault: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  reactionOptionActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.fuchsia,
  },
  reactionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  reactionLabelDefault: {
    color: colors.subtle,
  },
  reactionLabelActive: {
    color: colors.fuchsia,
  },
  reactionCount: {
    fontSize: 11,
    color: colors.muted5,
    fontWeight: "600",
    marginTop: 2,
  },
  dismissHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 24,
    fontWeight: "500",
  },

  // ── 3-Dot Menu ────────────────────────────
  menuModalContainer: {
    position: "absolute",
    alignItems: "flex-end",
  },
  menuDropdown: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: colors.darkest,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: colors.muted2,
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
    backgroundColor: colors.muted2,
    marginVertical: 4,
  },
  menuOptionIcon: {
    fontSize: 20,
  },
  menuOptionText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  menuOptionTextAccent: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  menuOptionTextWarning: {
    color: colors.warningText,
  },
  menuOptionTextDanger: {
    color: colors.danger,
  },
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  editSheet: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.muted2,
    padding: 14,
  },
  editTitle: {
    color: colors.heading,
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 10,
  },
  editInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.muted2,
    minHeight: 120,
    maxHeight: 220,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.heading,
    textAlignVertical: "top",
  },
  editActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  editCancelBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.muted3,
    backgroundColor: colors.surface,
  },
  editCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  editSaveBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: colors.primary,
    minWidth: 70,
    alignItems: "center",
  },
  editSaveText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "700",
  },
});
