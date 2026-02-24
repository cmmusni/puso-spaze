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
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ListRenderItem,
  Modal,
  Animated,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
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
  REACTION_EMOJI,
} from "../../../packages/types";
import { REACTION_EMOJI as EMOJI } from "../../../packages/types";
import type { RootStackParamList } from "../navigation/AppNavigator";

type PostDetailRouteProp = RouteProp<RootStackParamList, "PostDetail">;

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

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<PostDetailRouteProp>();
  const { post } = route.params;

  const { userId, username, role } = useUser();
  const isCoach = role === "COACH" || role === "ADMIN";

  const [counts, setCounts] = useState<ReactionCounts>({});
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
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

  // ── Load reactions + comments on mount ───────
  const loadData = useCallback(async () => {
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
  }, [post.id, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Toggle reaction ───────────────────────────
  const handleReaction = async (type: ReactionType) => {
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
          "🚫 Your comment was flagged by our safety system and was not posted. Please revise it.",
        );
      } else {
        setComments((prev) => [...prev, comment]);
        setCommentText("");
        setCommentError(null);
        if (underReview) {
          setCommentReview(
            "🔍 Your comment is under review and will appear once approved.",
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
        <LinearGradient
          colors={avatarGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.commentAvatar}
        >
          <Text style={styles.commentAvatarInitial}>{initial}</Text>
        </LinearGradient>
        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentAuthor}>{name}</Text>
            <Text style={styles.commentTime}>
              {formatRelativeTime(item.createdAt)}
            </Text>
            {isUnderReview && (
              <View style={styles.reviewBadge}>
                <Text style={styles.reviewBadgeText}>🔍 Review</Text>
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
  const topReactionEmojis = REACTION_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3)
    .map((t) => EMOJI[t]);

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
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back to feed</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Encourage one another ⋆⭒˚</Text>
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
                    {post.tags.map((tag) => (
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
                    {topReactionEmojis.map((emoji, i) => (
                      <View
                        key={i}
                        style={[
                          styles.reactionEmojiBubble,
                          i > 0 ? styles.reactionEmojiOffset : undefined,
                        ]}
                      >
                        <Text style={styles.reactionEmojiText}>{emoji}</Text>
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
              <Text style={styles.commentsHeader}>
                💬 Comments {comments.length > 0 ? `(${comments.length})` : ""}
              </Text>

              {commentsLoading && (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.commentsSpinner}
                />
              )}

              {!commentsLoading && comments.length === 0 && (
                <Text style={styles.commentsEmpty}>
                  No comments yet — be the first to encourage! 🔥
                </Text>
              )}
            </View>
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
                <Text style={styles.sendIcon}>↑</Text>
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
                      <Text style={styles.pickerEmoji}>{EMOJI[type]}</Text>
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
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
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
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  reactionEmojiOffset: { marginLeft: -6, zIndex: 9 },
  reactionEmojiText: { fontSize: 12 },
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
  commentsHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.deep,
    marginBottom: 16,
  },
  commentsSpinner: { marginBottom: 16 },
  commentsEmpty: {
    color: colors.muted5,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
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
    backgroundColor: colors.surface,
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
  sendIcon: { fontSize: 18, color: "#fff" },

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
  pickerEmoji: { fontSize: 36 },
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
