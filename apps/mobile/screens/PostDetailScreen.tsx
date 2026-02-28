// ─────────────────────────────────────────────
// screens/PostDetailScreen.tsx
// Full post view with reactions + comments
// ─────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ListRenderItem,
  Modal,
  Animated,
  StyleSheet,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { PrayIcon, SupportIcon } from "../components/ReactionIcons";
import {
  apiGetPostById,
  apiGetReactions,
  apiUpsertReaction,
  apiGetComments,
  apiCreateComment,
} from "../services/api";
import { useUser } from "../hooks/useUser";
import { colors } from "../constants/theme";
import type {
  Post,
  Comment,
  ReactionType,
  ReactionCounts,
} from "../../../packages/types";

type PostDetailRouteProp = RouteProp<
  { PostDetail: { postId?: string; post?: Post; openedFrom?: "notifications" } },
  "PostDetail"
>;

function isValidPost(value: unknown): value is Post {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  );
}

// Gradient avatar (same logic as PostCard)
function avatarColors(initial: string): [string, string] {
  const palette: [string, string][] = [
    [colors.hot, colors.primary],
    [colors.primary, colors.deep],
    [colors.fuchsia, colors.ink],
    [colors.ink, colors.deep],
    [colors.hot, colors.fuchsia],
  ];
  return palette[initial.charCodeAt(0) % palette.length];
}

function formatRelativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const REACTION_TYPES: ReactionType[] = ["PRAY", "CARE", "SUPPORT"];
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

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<PostDetailRouteProp>();
  const routePost = route.params?.post;
  const routePostId = route.params?.postId;
  const [post, setPost] = useState<Post | null>(
    isValidPost(routePost) ? routePost : null,
  );
  const [postLoading, setPostLoading] = useState(
    !isValidPost(routePost) && !!routePostId,
  );
  const openedFrom = route.params?.openedFrom;
  const openedFromNotifications = openedFrom === "notifications";

  const handleBackPress = () => {
    if (openedFromNotifications) {
      navigation.navigate("Notifications" as never);
      return;
    }
    navigation.goBack();
  };

  const { userId, username, role } = useUser();
  const isCoach = role === "COACH" || role === "ADMIN";

  const [counts, setCounts] = useState<ReactionCounts>({});
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentReview, setCommentReview] = useState<string | null>(null);

  // ── Floating reaction picker ──────────────────
  const [showPicker, setShowPicker] = useState(false);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  const closePicker = () => {
    Animated.timing(pickerAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowPicker(false));
  };

  const handleReactionFromPicker = (type: ReactionType) => {
    closePicker();
    handleReaction(type);
  };

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const validRoutePost = isValidPost(route.params?.post)
      ? route.params?.post
      : null;

    if (validRoutePost) {
      setPost(validRoutePost);
      setPostLoading(false);
      return;
    }

    const fallbackPostId = route.params?.postId;
    if (!fallbackPostId) {
      setPost(null);
      setPostLoading(false);
      return;
    }

    let cancelled = false;
    setPostLoading(true);

    (async () => {
      try {
        const { post: fetchedPost } = await apiGetPostById(fallbackPostId);
        if (!cancelled) {
          setPost(fetchedPost);
        }
      } catch {
        if (!cancelled) {
          setPost(null);
        }
      } finally {
        if (!cancelled) {
          setPostLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route.params?.post, route.params?.postId]);

  // ── Load reactions + comments on mount ───────
  const loadData = useCallback(async () => {
    if (!post?.id) return;
    setCommentsLoading(true);
    try {
      const [reactData, commentData] = await Promise.all([
        apiGetReactions(post.id, userId ?? undefined),
        apiGetComments(post.id),
      ]);
      setCounts(reactData.counts);
      setUserReaction(reactData.userReaction);
      setComments(commentData.comments);
    } catch {
      // non-fatal
    } finally {
      setCommentsLoading(false);
    }
  }, [post?.id, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Refresh handler ───────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Toggle reaction ───────────────────────────
  const handleReaction = async (type: ReactionType) => {
    if (!post?.id) return;
    if (!userId) {
      Alert.alert("Not logged in");
      return;
    }
    setReactionLoading(true);
    try {
      const prev = userReaction;
      // Optimistic update
      const newCounts = { ...counts };
      if (prev) newCounts[prev] = Math.max(0, (newCounts[prev] ?? 1) - 1);
      if (type !== prev) {
        newCounts[type] = (newCounts[type] ?? 0) + 1;
        setUserReaction(type);
      } else {
        setUserReaction(null);
      }
      setCounts(newCounts);

      await apiUpsertReaction(post.id, { userId, type });
    } catch {
      // Revert on failure
      loadData();
    } finally {
      setReactionLoading(false);
    }
  };

  // ── Submit comment ────────────────────────────
  const handleComment = async () => {
    if (!post?.id) return;
    if (!commentText.trim()) return;
    if (!userId) {
      Alert.alert("Not logged in");
      return;
    }
    setSubmitting(true);
    try {
      const { comment, flagged, underReview } = await apiCreateComment(
        post.id,
        {
          userId,
          content: commentText.trim(),
        },
      );
      if (flagged) {
        setCommentError(
          "Your comment was flagged by our safety system and was not posted. Please revise it.",
        );
      } else {
        setComments((prev) => [...prev, comment]);
        setCommentText("");
        setCommentError(null);
        if (underReview) {
          setCommentReview(
            "Your comment is under review and will appear once approved.",
          );
          setTimeout(() => setCommentReview(null), 4000);
        } else {
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            150,
          );
        }
      }
    } catch {
      Alert.alert("Error", "Could not post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render a single comment ───────────────────
  const renderComment: ListRenderItem<Comment> = ({ item }) => {
    const name =
      item.user?.role === "COACH" || item.user?.role === "ADMIN"
        ? `Coach ${item.user?.displayName ?? "Anonymous"}`
        : (item.user?.displayName ?? "Anonymous");
    const initial = name.charAt(0).toUpperCase();
    const avatarGrad = avatarColors(initial);
    const isUnderReview = item.moderationStatus === "REVIEW";
    return (
      <View style={styles.commentRow}>
        {item.userId === "system-encouragement-bot" ? (
          <Image
            source={require("../assets/logo.png")}
            style={styles.commentAvatar}
          />
        ) : (
          <LinearGradient
            colors={avatarGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.commentAvatar}
          >
            <Text style={styles.commentAvatarInitial}>{initial}</Text>
          </LinearGradient>
        )}

        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentAuthor}>{name}</Text>
            <Text style={styles.commentTime}>
              {formatRelativeTime(item.createdAt)}
            </Text>
            {isUnderReview && (
              <View style={styles.reviewBadge}>
                <View style={styles.reviewBadgeRow}>
                  <Ionicons
                    name="search-outline"
                    size={10}
                    color={colors.warningText}
                  />
                  <Text style={styles.reviewBadgeText}>Review</Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.commentBubble}>
            <Text style={styles.commentText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  const totalReactions = Object.values(counts).reduce(
    (sum, n) => sum + (n ?? 0),
    0,
  );
  const topReactions = REACTION_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);

  if (postLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, textAlign: "center", marginBottom: 14 }}>
            Post not available. Please open it again from the feed or notifications.
          </Text>
          <TouchableOpacity onPress={handleBackPress} activeOpacity={0.8}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              {openedFromNotifications ? "Back to notifications" : "Back to feed"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = post.user?.displayName ?? "Anonymous";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={[colors.darkest, colors.deep, colors.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={handleBackPress}
          activeOpacity={0.75}
          style={styles.backBtn}
        >
          <Ionicons
            name="arrow-back-outline"
            size={16}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.backText}>
            {openedFromNotifications ? "Back to notifications" : "Back to feed"}
          </Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={colors.card}
          />
          <Text style={styles.headerTitle}>Encourage one another</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Commenting as{" "}
          <Text
            style={styles.headerName}
          >{`${isCoach ? "Coach" : ""} ${username ?? "Anonymous"}`}</Text>
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={renderComment}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {/* ── Post card ── */}
              <View style={styles.postCard}>
                {/* Author */}
                <View style={styles.postAuthorRow}>
                  <LinearGradient
                    colors={avatarColors(initial)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.postAvatar}
                  >
                    <Text style={styles.postAvatarInitial}>{initial}</Text>
                  </LinearGradient>
                  <View>
                    <Text style={styles.postAuthorName}>{displayName}</Text>
                    <Text style={styles.postAuthorTime}>
                      {formatRelativeTime(post.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.postDivider} />
                <Text style={styles.postContent}>{post.content}</Text>

                {post.tags && post.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {post.tags.map((tag: string) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Reaction summary pill ── */}
              {totalReactions > 0 && (
                <View style={styles.reactionSummary}>
                  <View style={styles.reactionEmojiStack}>
                    {topReactions.map((type, i) => (
                      <View
                        key={i}
                        style={[
                          styles.reactionEmojiBubble,
                          i > 0 ? styles.reactionEmojiOffset : undefined,
                        ]}
                      >
                        {renderReactionIcon(type, 12, colors.card)}
                      </View>
                    ))}
                  </View>
                  <Text style={styles.reactionSummaryCount}>
                    {totalReactions}{" "}
                    {totalReactions === 1 ? "reaction" : "reactions"}
                  </Text>
                </View>
              )}

              {/* ── Comments header ── */}
              <View style={styles.commentsHeaderRow}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={14}
                  color={colors.deep}
                />
                <Text style={styles.commentsHeader}>
                  Comments {comments.length > 0 ? `(${comments.length})` : ""}
                </Text>
              </View>

              {commentsLoading && (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.commentsSpinner}
                />
              )}

              {!commentsLoading && comments.length === 0 && (
                <View style={styles.commentsEmptyRow}>
                  <Text style={styles.commentsEmpty}>
                    No comments yet — be the first to encourage.
                  </Text>
                  <Ionicons
                    name="sparkles-outline"
                    size={24}
                    color={colors.muted5}
                  />
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />

        {/* ── Comment moderation feedback ── */}
        {commentError && (
          <View style={styles.commentFeedbackError}>
            <Text
              style={[styles.commentFeedbackText, { color: colors.errorText }]}
            >
              {commentError}
            </Text>
          </View>
        )}
        {commentReview && (
          <View style={styles.commentFeedbackReview}>
            <Text
              style={[
                styles.commentFeedbackText,
                { color: colors.warningText },
              ]}
            >
              {commentReview}
            </Text>
          </View>
        )}

        {/* ── Comment input ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write an encouragement…"
            placeholderTextColor={colors.muted4}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            editable={!submitting}
          />
          <TouchableOpacity
            onPress={handleComment}
            disabled={submitting || !commentText.trim()}
            activeOpacity={0.85}
            style={styles.sendBtn}
          >
            <LinearGradient
              colors={
                commentText.trim()
                  ? [colors.hot, colors.ink]
                  : [colors.muted2, colors.muted4]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendGradient}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={16} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Floating Reaction Picker Modal ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closePicker}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closePicker}
        >
          <View style={styles.modalCenter}>
            <TouchableOpacity activeOpacity={1}>
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
                      {
                        translateY: pickerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [24, 0],
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
                      onPress={() => handleReactionFromPicker(type)}
                      activeOpacity={0.75}
                      style={[
                        styles.pickerOption,
                        active
                          ? styles.pickerOptionActive
                          : styles.pickerOptionDefault,
                      ]}
                    >
                      <View style={styles.pickerIconWrap}>
                        {renderReactionIcon(type, 24, colors.card)}
                      </View>
                      <Text
                        style={[
                          styles.pickerLabel,
                          active
                            ? styles.pickerLabelActive
                            : styles.pickerLabelDefault,
                        ]}
                      >
                        {type === "PRAY"
                          ? "Pray"
                          : type === "CARE"
                            ? "Care"
                            : "Support"}
                      </Text>
                      {count > 0 && (
                        <Text style={styles.pickerCount}>{count}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.dismissHint}>Tap outside to dismiss</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },

  // ── Header ───────────────────────────────
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  backText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.card },

  // ── Scroll / list ─────────────────────────
  kav: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 20 },

  // ── Post card ────────────────────────────
  postCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.muted3,
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  postAvatarInitial: { color: colors.card, fontSize: 16, fontWeight: "700" },
  postAuthorName: { color: colors.heading, fontWeight: "700", fontSize: 15 },
  postAuthorTime: { color: colors.muted5, fontSize: 12 },
  postDivider: { height: 1, backgroundColor: colors.muted3, marginBottom: 14 },
  postContent: { color: colors.text, fontSize: 16, lineHeight: 26 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 6 },
  tagChip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.muted2,
  },
  tagText: { color: colors.ink, fontSize: 11, fontWeight: "600" },

  // ── Reaction summary ──────────────────────
  reactionSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
    paddingHorizontal: 4,
  },
  reactionEmojiStack: { flexDirection: "row" },
  reactionEmojiBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  reactionEmojiOffset: { marginLeft: -6, zIndex: 9 },
  reactionSummaryCount: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },

  // ── Action bar (React / Comment) ──────────────
  actionBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.muted3,
    overflow: "hidden",
  },
  actionBarReact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: colors.muted3,
  },
  actionBarComment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  actionBarEmoji: { fontSize: 20 },
  actionBarLabel: { fontSize: 14, fontWeight: "700" },
  actionBarLabelDefault: { color: colors.subtle },
  actionBarLabelActive: { color: colors.fuchsia },
  actionBarHint: { fontSize: 11, color: colors.muted5 },

  // ── Comments section ───────────────────────
  commentsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  commentsHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.deep,
  },
  commentsSpinner: { marginBottom: 16 },
  commentsEmptyRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  commentsEmpty: {
    color: colors.muted5,
    fontSize: 14,
    textAlign: "center",
  },

  // ── Comment rows ──────────────────────────
  commentRow: { flexDirection: "row", marginBottom: 16 },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  commentAvatarInitial: { color: colors.card, fontSize: 13, fontWeight: "700" },
  commentBody: { flex: 1 },
  commentMeta: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  commentAuthor: {
    color: colors.deep,
    fontWeight: "700",
    fontSize: 13,
    marginRight: 8,
  },
  commentTime: { color: colors.muted5, fontSize: 11 },
  commentBubble: {
    backgroundColor: colors.muted1,
    borderRadius: 14,
    padding: 12,
  },
  commentText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  reviewBadge: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  reviewBadgeText: {
    color: colors.warningText,
    fontSize: 10,
    fontWeight: "700",
  },
  reviewBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentFeedbackError: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 12,
    padding: 10,
  },
  commentFeedbackReview: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 10,
  },
  commentFeedbackText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Input bar ─────────────────────────────
  inputBar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.muted1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.heading,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: colors.muted1,
  },
  sendBtn: { borderRadius: 20, overflow: "hidden" },
  sendGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Floating Picker Modal ────────────────────
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  modalCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  pickerOption: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 40,
    minWidth: 76,
  },
  pickerOptionDefault: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  pickerOptionActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.fuchsia,
  },
  pickerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerLabel: { fontSize: 12, fontWeight: "700", marginTop: 5 },
  pickerLabelDefault: { color: colors.subtle },
  pickerLabelActive: { color: colors.fuchsia },
  pickerCount: {
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
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  headerName: { color: colors.accent, fontWeight: "700" },
});
