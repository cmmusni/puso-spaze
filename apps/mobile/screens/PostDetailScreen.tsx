// ─────────────────────────────────────────────
// screens/PostDetailScreen.tsx
// Full post view with reactions + comments
// ─────────────────────────────────────────────

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ListRenderItem,
  Modal,
  Animated,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { PrayIcon, SupportIcon, LikeIcon } from "../components/ReactionIcons";
import {
  apiGetPostById,
  apiGetReactions,
  apiGetReactors,
  apiUpsertReaction,
  apiGetComments,
  apiCreateComment,
  apiDeleteComment,
  apiUpdateComment,
  apiUpsertCommentReaction,
  apiDeletePost,
  apiUpdatePost,
  apiSearchUsers,
  apiFlagComment,
  apiFlagPost,
  resolveAvatarUrl,
} from "../services/api";
import { useUser } from "../hooks/useUser";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import {
  colors as defaultColors,
  fonts,
  radii,
  ambientShadow,
} from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import MentionText from "../components/MentionText";
import {
  extractTrailingMentionQuery,
  replaceTrailingMention,
} from "../utils/mentions";
import type {
  Post,
  Comment,
  MentionUser,
  ReactionType,
  ReactionCounts,
} from "../../../packages/types";

type PostDetailRouteProp = RouteProp<
  {
    PostDetail: {
      postId?: string;
      post?: Post;
      openedFrom?: "notifications" | "profile";
      highlightCommentId?: string;
    };
  },
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
    [defaultColors.hot, defaultColors.primary],
    [defaultColors.primary, defaultColors.deep],
    [defaultColors.fuchsia, defaultColors.ink],
    [defaultColors.ink, defaultColors.deep],
    [defaultColors.hot, defaultColors.fuchsia],
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

const REACTION_TYPES: ReactionType[] = ["PRAY", "CARE", "SUPPORT", "LIKE"];
const SYSTEM_USER_ID = "system-encouragement-bot";

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

/** Subtle highlight pulse for a newly posted comment */
function CommentHighlightWrap({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 0,
        useNativeDriver: false,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: false,
      }),
    ]).start();
  }, [active]);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", defaultColors.secondary + "1E"],
  });

  const accentColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", defaultColors.secondary + "99"],
  });

  if (!active) return <>{children}</>;

  return (
    <Animated.View
      style={{
        backgroundColor: bgColor,
        borderRadius: radii.lg,
        marginHorizontal: -2,
        paddingHorizontal: 2,
        borderLeftWidth: 2,
        borderLeftColor: accentColor,
      }}
    >
      {children}
    </Animated.View>
  );
}

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
  if (type === "LIKE") return <LikeIcon size={size} color={color} />;
  return <Ionicons name={getCareIcon()} size={size} color={color} />;
}

export default function PostDetailScreen() {
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const route = useRoute<PostDetailRouteProp>();
  const routePost = route.params?.post;
  const webPathname =
    Platform.OS === "web"
      ? String(
          (globalThis as { location?: { pathname?: string } }).location
            ?.pathname ?? "",
        )
      : "";
  const webSearch =
    Platform.OS === "web"
      ? String(
          (globalThis as { location?: { search?: string } }).location?.search ??
            "",
        )
      : "";
  const webPostId =
    Platform.OS === "web"
      ? (() => {
          const match = webPathname.match(/\/post\/([^/?#]+)/i);
          return match?.[1] ? decodeURIComponent(match[1]) : undefined;
        })()
      : undefined;
  const queryOpenedFrom =
    Platform.OS === "web"
      ? new URLSearchParams(webSearch).get("openedFrom")
      : undefined;
  const queryHighlightCommentId =
    Platform.OS === "web"
      ? new URLSearchParams(webSearch).get("highlightCommentId")
      : undefined;
  const routePostId = route.params?.postId ?? webPostId;
  const [post, setPost] = useState<Post | null>(
    isValidPost(routePost) ? routePost : null,
  );
  const [postLoading, setPostLoading] = useState(
    !isValidPost(routePost) && !!routePostId,
  );
  const openedFrom = route.params?.openedFrom ?? queryOpenedFrom ?? undefined;
  const openedFromNotifications = openedFrom === "notifications";

  const handleBackPress = () => {
    if (openedFromNotifications) {
      navigation.navigate("Notifications" as never);
      return;
    }
    if (openedFrom === "profile") {
      (navigation as any).navigate("Profile");
      return;
    }
    // Navigate to Home with the post ID so it highlights/scrolls to it
    (navigation as any).navigate("Home", { highlightPostId: routePostId });
  };

  const { userId, username, role, avatarUrl } = useUser();
  const userAvatarUrl = avatarUrl;
  const isCoach = role === "COACH" || role === "ADMIN";
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === "web" && screenWidth >= 900;
  const isMedium =
    Platform.OS === "web" && screenWidth >= 600 && screenWidth < 900;
  const isSmall = Platform.OS === "web" && screenWidth < 600;
  const isExtraSmall = Platform.OS === "web" && screenWidth < 400;

  const [counts, setCounts] = useState<ReactionCounts>({});
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [commentMenuVisible, setCommentMenuVisible] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentReview, setCommentReview] = useState<string | null>(null);
  const [editCommentVisible, setEditCommentVisible] = useState(false);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [isCommentMultiline, setIsCommentMultiline] = useState(false);

  // ── Highlight newly posted comment ─────────────
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(
    null,
  );
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reply state ───────────────────────────────
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  // ── Comment reaction picker state ─────────────
  const [commentPickerTarget, setCommentPickerTarget] =
    useState<Comment | null>(null);

  // ── Post menu state ───────────────────────────
  const [postMenuVisible, setPostMenuVisible] = useState(false);
  const [editPostVisible, setEditPostVisible] = useState(false);
  const [editPostText, setEditPostText] = useState("");
  const [savingPostEdit, setSavingPostEdit] = useState(false);

  // ── Image viewer state ────────────────────────
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  // ── Floating reaction picker ──────────────────
  const [showPicker, setShowPicker] = useState(false);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  // ── Reactors modal ────────────────────────────
  type ReactorsTab = "ALL" | ReactionType;
  const [showReactors, setShowReactors] = useState(false);
  const [reactorsTab, setReactorsTab] = useState<ReactorsTab>("ALL");
  const [reactorsList, setReactorsList] = useState<
    Array<{
      type: string;
      user: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        role: string;
      };
    }>
  >([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);

  const openReactors = useCallback(async () => {
    setReactorsTab("ALL");
    setShowReactors(true);
    setReactorsLoading(true);
    try {
      const targetPostId = post?.id ?? routePostId;
      if (!targetPostId) return;
      const data = await apiGetReactors(targetPostId);
      setReactorsList(data.reactors);
    } catch {
      // silently fail — modal shows empty state
    } finally {
      setReactorsLoading(false);
    }
  }, [post?.id, routePostId]);

  const filteredReactors =
    reactorsTab === "ALL"
      ? reactorsList
      : reactorsList.filter((r) => r.type === reactorsTab);

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

  const refreshPostDetail = useCallback(async () => {
    const targetPostId = routePostId ?? post?.id;
    if (!targetPostId) return;

    setCommentsLoading(true);
    try {
      const [postData, reactData, commentData] = await Promise.all([
        apiGetPostById(targetPostId),
        apiGetReactions(targetPostId, userId ?? undefined),
        apiGetComments(targetPostId, userId ?? undefined),
      ]);

      setPost(postData.post);
      setCounts(reactData.counts);
      setUserReaction(reactData.userReaction);
      setComments(commentData.comments);
    } catch {
      // non-fatal
    } finally {
      setCommentsLoading(false);
    }
  }, [post?.id, routePostId, userId]);

  useEffect(() => {
    const validRoutePost = isValidPost(route.params?.post)
      ? route.params?.post
      : null;

    if (validRoutePost) {
      setPost(validRoutePost);
      setPostLoading(false);
      return;
    }

    const fallbackPostId = routePostId;
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
  }, [route.params?.post, routePostId]);

  // ── Load reactions + comments on mount ───────
  const loadData = useCallback(async () => {
    if (!post?.id) return;
    setCommentsLoading(true);
    try {
      const [reactData, commentData] = await Promise.all([
        apiGetReactions(post.id, userId ?? undefined),
        apiGetComments(post.id, userId ?? undefined),
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

  const queryCommentId =
    Platform.OS === "web"
      ? new URLSearchParams(webSearch).get("commentId")
      : null;
  const navHighlightId =
    route.params?.highlightCommentId ??
    queryHighlightCommentId ??
    queryCommentId ??
    null;

  useEffect(() => {
    if (!navHighlightId || commentsLoading || comments.length === 0) return;
    const idx = comments.findIndex((c) => c.id === navHighlightId);
    if (idx === -1) return;
    // Scroll to the comment then highlight it
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.3,
        });
      } catch {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
      setHighlightCommentId(navHighlightId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(
        () => setHighlightCommentId(null),
        3500,
      );
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navHighlightId, commentsLoading, comments.length]);

  useFocusEffect(
    useCallback(() => {
      if (!openedFromNotifications) return;
      void refreshPostDetail();
    }, [openedFromNotifications, refreshPostDetail]),
  );

  useEffect(() => {
    let active = true;

    if (!mentionQuery) {
      setMentionUsers([]);
      setMentionLoading(false);
      return () => {
        active = false;
      };
    }

    setMentionLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { users } = await apiSearchUsers(mentionQuery, 6);
        if (active) {
          setMentionUsers(users);
        }
      } catch {
        if (active) {
          setMentionUsers([]);
        }
      } finally {
        if (active) {
          setMentionLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

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
          parentId: replyingTo?.id,
        },
      );
      if (flagged) {
        setCommentError(
          "Your comment was flagged by our safety system and was not posted. Please revise it.",
        );
      } else {
        if (replyingTo) {
          // Add reply into parent's replies array
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyingTo.id
                ? { ...c, replies: [...(c.replies ?? []), comment] }
                : c,
            ),
          );
        } else {
          setComments((prev) => [...prev, comment]);
        }
        setCommentText("");
        setReplyingTo(null);
        setMentionQuery(null);
        setMentionUsers([]);
        setCommentError(null);
        setIsCommentMultiline(false);
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
          // Highlight the newly posted comment
          setHighlightCommentId(comment.id);
          if (highlightTimer.current) clearTimeout(highlightTimer.current);
          highlightTimer.current = setTimeout(
            () => setHighlightCommentId(null),
            3500,
          );
        }
      }
    } catch {
      Alert.alert("Error", "Could not post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const performDeleteComment = useCallback(
    async (comment: Comment) => {
      if (!post?.id || !userId) return;

      setDeletingCommentId(comment.id);
      try {
        await apiDeleteComment(post.id, comment.id, userId);
        setComments((prev) => prev.filter((item) => item.id !== comment.id));
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ??
          err?.message ??
          "Could not delete comment. Please try again.";
        showAlert("Error", msg);
      } finally {
        setDeletingCommentId(null);
      }
    },
    [post?.id, userId],
  );

  const openCommentMenu = useCallback((comment: Comment) => {
    setSelectedComment(comment);
    setCommentMenuVisible(true);
  }, []);

  const closeCommentMenu = useCallback(() => {
    setCommentMenuVisible(false);
    setSelectedComment(null);
  }, []);

  const handleDeleteFromMenu = useCallback(async () => {
    if (!selectedComment) return;

    const canDelete =
      !!userId && (selectedComment.userId === userId || role === "ADMIN");
    if (!canDelete) {
      closeCommentMenu();
      showAlert("Error", "You do not have permission to delete this comment.");
      return;
    }

    const commentToDelete = selectedComment;
    closeCommentMenu();

    const confirmed = await showConfirm(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
    );
    if (!confirmed) return;

    await performDeleteComment(commentToDelete);
  }, [selectedComment, closeCommentMenu, performDeleteComment, role, userId]);

  const handleEditFromMenu = useCallback(() => {
    if (!selectedComment) return;
    if (!userId || selectedComment.userId !== userId) {
      closeCommentMenu();
      showAlert("Error", "You can only edit your own comment.");
      return;
    }
    setEditCommentText(selectedComment.content);
    setCommentMenuVisible(false);
    setEditCommentVisible(true);
  }, [selectedComment, userId, closeCommentMenu]);

  const openCommentEditor = useCallback(
    (comment: Comment) => {
      if (!userId || comment.userId !== userId) {
        showAlert("Error", "You can only edit your own comment.");
        return;
      }
      setSelectedComment(comment);
      setEditCommentText(comment.content);
      setEditCommentVisible(true);
    },
    [userId],
  );

  const handleSaveEditedComment = useCallback(async () => {
    if (!post?.id || !selectedComment || !userId) return;

    const trimmed = editCommentText.trim();
    if (!trimmed) {
      showAlert("Error", "Comment cannot be empty.");
      return;
    }

    setSavingCommentEdit(true);
    try {
      const { comment, underReview } = await apiUpdateComment(
        post.id,
        selectedComment.id,
        {
          userId,
          content: trimmed,
        },
      );

      setComments((prev) =>
        prev.map((item) => (item.id === comment.id ? comment : item)),
      );
      setEditCommentVisible(false);
      setSelectedComment(null);
      if (underReview) {
        showAlert("Updated", "Comment updated and is under review.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Could not update comment. Please try again.";
      showAlert("Error", msg);
    } finally {
      setSavingCommentEdit(false);
    }
  }, [editCommentText, post?.id, selectedComment, userId]);

  // ── Delete post handler ───────────────────
  const handleDeletePost = useCallback(async () => {
    if (!post?.id || !userId) return;
    setPostMenuVisible(false);
    const confirmed = await showConfirm(
      "Delete Post",
      "Are you sure you want to delete this post?",
    );
    if (!confirmed) return;
    try {
      await apiDeletePost(post.id, userId);
      handleBackPress();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Could not delete post. Please try again.";
      showAlert("Error", msg);
    }
  }, [post?.id, userId]);

  // ── Edit post handler ─────────────────────
  const handleOpenEditPost = useCallback(() => {
    if (!post) return;
    setPostMenuVisible(false);
    setEditPostText(post.content);
    setEditPostVisible(true);
  }, [post]);

  const handleSavePostEdit = useCallback(async () => {
    if (!post?.id || !userId) return;
    const trimmed = editPostText.trim();
    if (trimmed.length < 3) {
      showAlert("Error", "Post content must be at least 3 characters.");
      return;
    }
    setSavingPostEdit(true);
    try {
      const { underReview } = await apiUpdatePost(post.id, {
        userId,
        content: trimmed,
        tags: post.tags,
      });
      setEditPostVisible(false);
      await showAlert(
        "Success",
        underReview
          ? "Post updated and is under review."
          : "Post updated successfully.",
      );
      refreshPostDetail();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Failed to update post. Please try again.";
      showAlert("Error", msg);
    } finally {
      setSavingPostEdit(false);
    }
  }, [post?.id, post?.tags, userId, editPostText]);

  const handleCommentInputChange = useCallback((text: string) => {
    setCommentText(text);
    setMentionQuery(extractTrailingMentionQuery(text));
  }, []);

  const handleSelectMention = useCallback((mentionHandle: string) => {
    setCommentText((prev) => replaceTrailingMention(prev, mentionHandle));
    setMentionQuery(null);
    setMentionUsers([]);
  }, []);

  // ── Comment reaction toggle ───────────────────
  const handleCommentReaction = useCallback(
    async (comment: Comment, type: ReactionType) => {
      if (!post?.id || !userId) return;
      // Optimistic update
      const prev = comment.userReaction;
      const newCounts = { ...(comment.reactionCounts ?? {}) };
      if (prev) newCounts[prev] = Math.max(0, (newCounts[prev] ?? 1) - 1);
      const newUserReaction = type !== prev ? type : null;
      if (newUserReaction) {
        newCounts[newUserReaction] = (newCounts[newUserReaction] ?? 0) + 1;
      }

      const updateComment = (c: Comment): Comment =>
        c.id === comment.id
          ? { ...c, reactionCounts: newCounts, userReaction: newUserReaction }
          : { ...c, replies: c.replies?.map(updateComment) };
      setComments((prev) => prev.map(updateComment));

      try {
        await apiUpsertCommentReaction(post.id, comment.id, { userId, type });
      } catch {
        loadData();
      }
    },
    [post?.id, userId, loadData],
  );

  // ── Render a single comment (reusable for replies) ───
  const renderCommentItem = (item: Comment, isReply = false) => {
    const isOwnAnonymousComment = item.isAnonymous && item.userId === userId;
    const rawName = isOwnAnonymousComment
      ? (username ?? item.user?.displayName ?? "Anonymous")
      : (item.user?.displayName ?? "Anonymous");
    const name = rawName;
    const commentAvatarUrl = isOwnAnonymousComment
      ? avatarUrl
      : item.user?.avatarUrl;
    const initial =
      item.isAnonymous && !isOwnAnonymousComment
        ? "?"
        : name.charAt(0).toUpperCase();
    const avatarGrad = avatarColors(initial);
    const isUnderReview = item.moderationStatus === "REVIEW";
    const isOwnComment = item.userId === userId;
    const canDeleteComment = isOwnComment || role === "ADMIN";
    const isDeletingThisComment = deletingCommentId === item.id;
    const canFlagComment = role === "ADMIN" || role === "COACH";

    const commentReactionCounts = item.reactionCounts ?? {};
    const commentUserReaction = item.userReaction ?? null;
    const commentTotalReactions = Object.values(commentReactionCounts).reduce(
      (sum, n) => sum + (n ?? 0),
      0,
    );

    return (
      <View
        key={item.id}
        style={[styles.commentRow, isReply && styles.commentRowReply]}
      >
        {item.userId === "system-encouragement-bot" ? (
          <Image
            source={require("../assets/logo.png")}
            style={[
              styles.commentAvatar,
              isReply && styles.commentAvatarReply,
              { borderRadius: isReply ? 6 : 8 },
            ]}
          />
        ) : commentAvatarUrl ? (
          <Image
            source={{ uri: resolveAvatarUrl(commentAvatarUrl) }}
            style={[styles.commentAvatar, isReply && styles.commentAvatarReply]}
          />
        ) : (
          <LinearGradient
            colors={avatarGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.commentAvatar, isReply && styles.commentAvatarReply]}
          >
            <Text style={styles.commentAvatarInitial}>{initial}</Text>
          </LinearGradient>
        )}

        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <View style={styles.commentMetaLeft}>
              <Text style={styles.commentAuthor} numberOfLines={1}>
                {name}
              </Text>
              {isOwnAnonymousComment && (
                <Text
                  style={[
                    styles.commentAnonymousAuthor,
                    isMedium && styles.commentAnonymousAuthorMd,
                    isSmall && styles.commentAnonymousAuthorSm,
                    isExtraSmall && styles.commentAnonymousAuthorXs,
                  ]}
                  numberOfLines={1}
                >
                  as {item.anonDisplayName ?? "Anonymous"}
                </Text>
              )}
              <Text style={styles.commentTime}>
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
            <View style={styles.commentMetaRight}>
              {isOwnComment && (
                <TouchableOpacity
                  onPress={() => openCommentEditor(item)}
                  activeOpacity={0.75}
                  style={styles.commentEditBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="create-outline"
                    size={13}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              {isOwnComment && (
                <TouchableOpacity
                  onPress={async () => {
                    const confirmed = await showConfirm(
                      "Delete Comment",
                      "Are you sure you want to delete this comment?",
                    );
                    if (confirmed) performDeleteComment(item);
                  }}
                  activeOpacity={0.75}
                  style={styles.commentEditBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={13}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              {canFlagComment && item.moderationStatus !== "FLAGGED" && (
                <TouchableOpacity
                  onPress={async () => {
                    if (!userId) return;
                    const confirmed = await showConfirm(
                      "Flag Comment",
                      "Flag this comment as inappropriate? It will be hidden from the feed.",
                    );
                    if (!confirmed) return;
                    try {
                      await apiFlagComment(item.id, userId);
                      await loadData();
                      showAlert(
                        "Flagged",
                        "Comment has been flagged and hidden.",
                      );
                    } catch (err: any) {
                      showAlert(
                        "Error",
                        err?.response?.data?.error ?? "Could not flag comment.",
                      );
                    }
                  }}
                  activeOpacity={0.75}
                  style={styles.commentEditBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="flag-outline"
                    size={13}
                    color={colors.warningText}
                  />
                </TouchableOpacity>
              )}
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
          </View>
          {canDeleteComment ? (
            <TouchableOpacity
              onLongPress={() => openCommentMenu(item)}
              disabled={isDeletingThisComment}
              activeOpacity={0.8}
              style={[
                styles.commentBubble,
                isOwnComment ? styles.commentBubbleOwn : null,
              ]}
            >
              {isDeletingThisComment ? (
                <ActivityIndicator size="small" color={colors.errorText} />
              ) : (
                <MentionText
                  text={item.content}
                  baseStyle={styles.commentText}
                  mentionStyle={styles.mentionText}
                />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.commentBubble}>
              <MentionText
                text={item.content}
                baseStyle={styles.commentText}
                mentionStyle={styles.mentionText}
              />
            </View>
          )}
          <View style={styles.commentActions}>
            {!isReply && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setReplyingTo(item);
                  setCommentText(`@${item.user?.displayName ?? "Anonymous"} `);
                }}
              >
                <Text style={styles.commentActionText}>Reply</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                handleCommentReaction(item, commentUserReaction ?? "LIKE")
              }
              onLongPress={() => setCommentPickerTarget(item)}
              style={styles.commentLikeBtn}
            >
              {commentUserReaction ? (
                <>
                  {renderReactionIcon(commentUserReaction, 14, colors.primary)}
                  <Text
                    style={[
                      styles.commentActionText,
                      styles.commentActionTextActive,
                    ]}
                  >
                    {commentUserReaction === "CARE"
                      ? "Care"
                      : commentUserReaction === "PRAY"
                        ? "Pray"
                        : commentUserReaction === "LIKE"
                          ? "Like"
                          : "Support"}
                  </Text>
                </>
              ) : (
                <Text style={styles.commentActionText}>Like</Text>
              )}
            </TouchableOpacity>
            {commentTotalReactions > 0 && (
              <View style={styles.commentReactionBadge}>
                {renderReactionIcon(
                  (Object.entries(commentReactionCounts).sort(
                    (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
                  )[0]?.[0] as ReactionType) ?? "LIKE",
                  10,
                  colors.primary,
                )}
                <Text style={styles.commentReactionCount}>
                  {commentTotalReactions}
                </Text>
              </View>
            )}
          </View>

          {/* Render replies */}
          {!isReply && item.replies && item.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {item.replies.map((reply) => renderCommentItem(reply, true))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderComment: ListRenderItem<Comment> = ({ item }) => {
    return (
      <CommentHighlightWrap active={item.id === highlightCommentId}>
        {renderCommentItem(item)}
      </CommentHighlightWrap>
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
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.screen}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              textAlign: "center",
              marginBottom: 14,
            }}
          >
            Post not available. Please open it again from the feed or
            notifications.
          </Text>
          <TouchableOpacity onPress={handleBackPress} activeOpacity={0.8}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              {openedFromNotifications
                ? "Back to notifications"
                : "Back to feed"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnAnonymousPost = post.isAnonymous && post.userId === userId;
  const displayName = isOwnAnonymousPost
    ? (username ?? post.user?.displayName ?? "Anonymous")
    : (post.user?.displayName ?? "Anonymous");
  const postAvatarUrl = isOwnAnonymousPost ? avatarUrl : post.user?.avatarUrl;
  const initial =
    post.isAnonymous && !isOwnAnonymousPost
      ? "?"
      : displayName.charAt(0).toUpperCase();
  const userInitial = (username ?? "A").charAt(0).toUpperCase();

  // Feeling detection
  const feelingTag = post.tags?.find((t) => FEELING_MAP[t.toLowerCase()]);
  const feeling = feelingTag ? FEELING_MAP[feelingTag.toLowerCase()] : null;
  const nonFeelingTags =
    post.tags?.filter((t) => !FEELING_MAP[t.toLowerCase()]) ?? [];

  const roleBadgeText =
    post.userId === SYSTEM_USER_ID
      ? "PUSO AI"
      : post.user?.role === "COACH"
        ? "Spaze Coach"
        : post.user?.role === "ADMIN"
          ? "Admin"
          : "Spaze Member";

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate("Home")}
          activeOpacity={0.7}
          style={styles.headerCenter}
        >
          <Image
            source={require("../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>PUSO Spaze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate("Profile")}
        >
          {userAvatarUrl ? (
            <Image
              source={{ uri: resolveAvatarUrl(userAvatarUrl) }}
              style={styles.headerAvatar}
            />
          ) : (
            <LinearGradient
              colors={[colors.primaryContainer, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerAvatar}
            >
              <Text style={styles.headerAvatarText}>{userInitial}</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        keyboardVerticalOffset={0}
      >
        <View
          style={[styles.contentColumn, isWide && styles.contentColumnWide]}
        >
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={renderComment}
            extraData={highlightCommentId}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                {/* ── Post card ── */}
                <View style={styles.postCard}>
                  {/* Author row */}
                  <View style={styles.postAuthorRow}>
                    {post.userId === SYSTEM_USER_ID ? (
                      <Image
                        source={require("../assets/logo.png")}
                        style={[styles.postAvatar, { borderRadius: 11 }]}
                      />
                    ) : postAvatarUrl ? (
                      <Image
                        source={{ uri: resolveAvatarUrl(postAvatarUrl) }}
                        style={styles.postAvatar}
                      />
                    ) : (
                      <LinearGradient
                        colors={avatarColors(initial)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.postAvatar}
                      >
                        <Text style={styles.postAvatarInitial}>{initial}</Text>
                      </LinearGradient>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.postNameRow}>
                        <Text style={styles.postAuthorName}>{displayName}</Text>
                        {(post.userId === userId ||
                          role === "ADMIN" ||
                          role === "COACH") && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.postMenuBtn}
                            hitSlop={{
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10,
                            }}
                            onPress={() => setPostMenuVisible(true)}
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={18}
                              color={colors.muted5}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.postSubtitle}>
                        {roleBadgeText} {"\u2022"}{" "}
                        {formatRelativeTime(post.createdAt)}
                        {isOwnAnonymousPost && (
                          <Text style={{ color: colors.secondary }}>
                            {" \u2022 Posted as "}
                            {post.anonDisplayName ?? "Anonymous"}
                          </Text>
                        )}
                        {feeling && (
                          <Text style={styles.postFeeling}>
                            {" \u2014 is feeling "}
                            {feeling.emoji} {feeling.label}
                          </Text>
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Content */}
                  <MentionText
                    text={post.content}
                    baseStyle={styles.postContent}
                    mentionStyle={styles.mentionText}
                  />

                  {/* Image */}
                  {post.imageUrl && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setImageViewerVisible(true)}
                    >
                      <Image
                        source={{ uri: resolveAvatarUrl(post.imageUrl) }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                      <View style={styles.imageExpandHint}>
                        <Ionicons
                          name="expand-outline"
                          size={16}
                          color="#fff"
                        />
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Tags */}
                  {nonFeelingTags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {nonFeelingTags.map((tag: string) => (
                        <View key={tag} style={styles.tagChip}>
                          <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Reaction buttons */}
                  <View style={styles.reactionBar}>
                    <View style={styles.reactionButtons}>
                      <TouchableOpacity
                        onPress={() => handleReaction(userReaction ?? "PRAY")}
                        onLongPress={() => {
                          setShowPicker(true);
                          Animated.timing(pickerAnim, {
                            toValue: 1,
                            duration: 200,
                            useNativeDriver: true,
                          }).start();
                        }}
                        delayLongPress={300}
                        activeOpacity={0.75}
                        style={[
                          styles.reactionBtn,
                          userReaction && styles.reactionBtnActive,
                        ]}
                      >
                        {userReaction ? (
                          renderReactionIcon(userReaction, 18, colors.primary)
                        ) : (
                          <PrayIcon size={18} color={colors.lightPrimary} />
                        )}
                      </TouchableOpacity>

                      <View style={styles.countButton}>
                        <Ionicons
                          name="chatbubble"
                          size={14}
                          color={colors.muted5}
                        />
                        {comments.length > 0 && (
                          <Text style={styles.footerCountMuted}>
                            {comments.length}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Reaction summary — overlapping icons + total */}
                    {topReactions.length > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={openReactors}
                        style={styles.reactionSummary}
                      >
                        <View style={styles.reactionEmojiStack}>
                          {topReactions.map((type, i) => (
                            <View
                              key={type}
                              style={[
                                styles.reactionEmojiBubble,
                                {
                                  zIndex: topReactions.length - i,
                                  marginLeft: i === 0 ? 0 : -6,
                                },
                              ]}
                            >
                              {renderReactionIcon(type, 10, colors.card)}
                            </View>
                          ))}
                        </View>
                        <Text style={styles.reactionSummaryText}>
                          {totalReactions}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* ── Comments header ── */}
                <Text style={styles.commentsHeader}>Comments</Text>

                {commentsLoading && (
                  <ActivityIndicator
                    color={colors.primary}
                    style={styles.commentsSpinner}
                  />
                )}

                {!commentsLoading && comments.length === 0 && (
                  <View style={styles.commentsEmptyRow}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color={colors.muted4}
                    />
                    <Text style={styles.commentsEmpty}>
                      {post?.userId === userId
                        ? `No comments yet — your story is waiting to be heard.`
                        : `No comments yet — be the first to respond.`}
                    </Text>
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
                style={[
                  styles.commentFeedbackText,
                  { color: colors.errorText },
                ]}
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

          {/* ── Mention suggestions ── */}
          {mentionQuery && (mentionLoading || mentionUsers.length > 0) && (
            <View style={styles.mentionBox}>
              {mentionLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                mentionUsers.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.mentionItem}
                    activeOpacity={0.8}
                    onPress={() => handleSelectMention(user.mentionHandle)}
                  >
                    <Text style={styles.mentionHandle}>
                      @{user.mentionHandle}
                    </Text>
                    <Text style={styles.mentionName}>{user.displayName}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
        {/* ── Reply indicator ── */}
        {replyingTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyIndicatorText}>
              Replying to{" "}
              <Text style={styles.replyIndicatorName}>
                {replyingTo.user?.displayName ?? "Anonymous"}
              </Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(null);
                setCommentText("");
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.muted5} />
            </TouchableOpacity>
          </View>
        )}
        {/* ── Comment input bar ── */}
        <View style={styles.inputBar}>
          {userAvatarUrl ? (
            <Image
              source={{ uri: resolveAvatarUrl(userAvatarUrl) }}
              style={styles.inputAvatar}
            />
          ) : (
            <LinearGradient
              colors={[colors.primaryContainer, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.inputAvatar}
            >
              <Text style={styles.inputAvatarText}>{userInitial}</Text>
            </LinearGradient>
          )}
          <TextInput
            style={styles.commentInput}
            placeholder="Write a supportive message..."
            placeholderTextColor={colors.muted4}
            value={commentText}
            onChangeText={handleCommentInputChange}
            multiline={isCommentMultiline}
            maxLength={500}
            editable={!submitting}
            onSubmitEditing={() => {
              if (!isCommentMultiline) handleComment();
            }}
            blurOnSubmit={false}
            {...(Platform.OS === "web"
              ? {
                  onKeyPress: (e: any) => {
                    const nativeEvent = e.nativeEvent;
                    if (
                      nativeEvent.key === "Enter" &&
                      (nativeEvent.metaKey || nativeEvent.ctrlKey)
                    ) {
                      e.preventDefault();
                      handleComment();
                    } else if (
                      nativeEvent.key === "Enter" &&
                      !nativeEvent.shiftKey &&
                      !isCommentMultiline
                    ) {
                      e.preventDefault();
                      setIsCommentMultiline(true);
                    }
                  },
                }
              : {})}
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
                  ? [colors.secondary, colors.primary]
                  : [colors.muted2, colors.muted4]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendGradient}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Comment menu modal ── */}
      <Modal
        visible={commentMenuVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeCommentMenu}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={closeCommentMenu}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.menuSheet}
          >
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Comment options</Text>
            {selectedComment?.userId === userId && (
              <TouchableOpacity
                style={styles.menuOptionBtn}
                activeOpacity={0.8}
                onPress={handleEditFromMenu}
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    { backgroundColor: colors.primaryContainer + "40" },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.menuOptionInfo}>
                  <Text style={styles.menuOptionText}>Edit comment</Text>
                  <Text style={styles.menuOptionSub}>
                    Change what you wrote
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {!!userId &&
              (selectedComment?.userId === userId || role === "ADMIN") && (
                <TouchableOpacity
                  style={styles.menuOptionBtn}
                  activeOpacity={0.8}
                  onPress={handleDeleteFromMenu}
                >
                  <View
                    style={[
                      styles.menuIconCircle,
                      { backgroundColor: colors.errorBg },
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.errorText}
                    />
                  </View>
                  <View style={styles.menuOptionInfo}>
                    <Text
                      style={[
                        styles.menuOptionText,
                        { color: colors.errorText },
                      ]}
                    >
                      Delete comment
                    </Text>
                    <Text style={styles.menuOptionSub}>
                      Permanently remove this comment
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            {(role === "COACH" || role === "ADMIN") &&
              selectedComment?.moderationStatus !== "FLAGGED" && (
                <TouchableOpacity
                  style={styles.menuOptionBtn}
                  activeOpacity={0.8}
                  onPress={async () => {
                    if (!selectedComment?.id || !userId) return;
                    const commentToFlag = selectedComment;
                    closeCommentMenu();
                    const confirmed = await showConfirm(
                      "Flag Comment",
                      "Flag this comment as inappropriate? It will be hidden from the feed.",
                    );
                    if (!confirmed) return;
                    try {
                      await apiFlagComment(commentToFlag.id, userId);
                      await loadData();
                      showAlert(
                        "Flagged",
                        "Comment has been flagged and hidden.",
                      );
                    } catch (err: any) {
                      showAlert(
                        "Error",
                        err?.response?.data?.error ?? "Could not flag comment.",
                      );
                    }
                  }}
                >
                  <View
                    style={[
                      styles.menuIconCircle,
                      { backgroundColor: colors.warningText + "20" },
                    ]}
                  >
                    <Ionicons
                      name="flag-outline"
                      size={18}
                      color={colors.warningText}
                    />
                  </View>
                  <View style={styles.menuOptionInfo}>
                    <Text
                      style={[
                        styles.menuOptionText,
                        { color: colors.warningText },
                      ]}
                    >
                      Flag comment
                    </Text>
                    <Text style={styles.menuOptionSub}>
                      Report as inappropriate content
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            <TouchableOpacity
              style={styles.menuCancelBtn}
              activeOpacity={0.8}
              onPress={closeCommentMenu}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit comment modal ── */}
      <Modal
        visible={editCommentVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (savingCommentEdit) return;
          setEditCommentVisible(false);
          setSelectedComment(null);
        }}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => {
            if (savingCommentEdit) return;
            setEditCommentVisible(false);
            setSelectedComment(null);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.menuSheet}
          >
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Edit comment</Text>
            <TextInput
              style={styles.editCommentInput}
              value={editCommentText}
              onChangeText={setEditCommentText}
              multiline
              maxLength={500}
              editable={!savingCommentEdit}
              placeholder="Update your comment..."
              placeholderTextColor={colors.muted4}
            />
            <View style={styles.editCommentActions}>
              <TouchableOpacity
                style={[styles.menuCancelBtn]}
                activeOpacity={0.8}
                onPress={() => {
                  setEditCommentVisible(false);
                  setSelectedComment(null);
                }}
                disabled={savingCommentEdit}
              >
                <Text style={styles.menuCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editCommentSaveBtn,
                  (savingCommentEdit || !editCommentText.trim()) && {
                    opacity: 0.5,
                  },
                ]}
                activeOpacity={0.85}
                onPress={handleSaveEditedComment}
                disabled={savingCommentEdit || !editCommentText.trim()}
              >
                {savingCommentEdit ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.editCommentSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
                        active && styles.pickerOptionActive,
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
                            : type === "LIKE"
                              ? "Like"
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Comment reaction picker modal ── */}
      <Modal
        visible={!!commentPickerTarget}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setCommentPickerTarget(null)}
      >
        <TouchableOpacity
          style={styles.commentPickerBackdrop}
          activeOpacity={1}
          onPress={() => setCommentPickerTarget(null)}
        >
          <View style={styles.commentPickerSheet}>
            <Text style={styles.menuTitle}>React to comment</Text>
            <View style={styles.commentPickerRow}>
              {REACTION_TYPES.map((type) => {
                const active = commentPickerTarget?.userReaction === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      if (commentPickerTarget) {
                        handleCommentReaction(commentPickerTarget, type);
                      }
                      setCommentPickerTarget(null);
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.commentPickerOption,
                      active && styles.pickerOptionActive,
                    ]}
                  >
                    <View style={styles.pickerIconWrap}>
                      {renderReactionIcon(type, 22, colors.card)}
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
                          : type === "LIKE"
                            ? "Like"
                            : "Support"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Post menu modal ── */}
      <Modal
        visible={postMenuVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPostMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setPostMenuVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.menuSheet}
          >
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Post options</Text>

            {post?.userId === userId && (
              <TouchableOpacity
                style={styles.menuOptionBtn}
                activeOpacity={0.8}
                onPress={handleOpenEditPost}
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    { backgroundColor: colors.primaryContainer + "40" },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.menuOptionInfo}>
                  <Text style={styles.menuOptionText}>Edit post</Text>
                  <Text style={styles.menuOptionSub}>
                    Change your post content
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {(role === "COACH" || role === "ADMIN") &&
              post?.moderationStatus !== "FLAGGED" && (
                <TouchableOpacity
                  style={styles.menuOptionBtn}
                  activeOpacity={0.8}
                  onPress={async () => {
                    if (!post?.id || !userId) return;
                    setPostMenuVisible(false);
                    const confirmed = await showConfirm(
                      "Flag Post",
                      "Flag this post as inappropriate? It will be hidden from the feed.",
                    );
                    if (!confirmed) return;
                    try {
                      await apiFlagPost(post.id, userId);
                      await refreshPostDetail();
                      showAlert("Flagged", "Post has been flagged and hidden.");
                    } catch (err: any) {
                      showAlert(
                        "Error",
                        err?.response?.data?.error ?? "Could not flag post.",
                      );
                    }
                  }}
                >
                  <View
                    style={[
                      styles.menuIconCircle,
                      { backgroundColor: colors.warningText + "20" },
                    ]}
                  >
                    <Ionicons
                      name="flag-outline"
                      size={18}
                      color={colors.warningText}
                    />
                  </View>
                  <View style={styles.menuOptionInfo}>
                    <Text
                      style={[
                        styles.menuOptionText,
                        { color: colors.warningText },
                      ]}
                    >
                      Flag post
                    </Text>
                    <Text style={styles.menuOptionSub}>
                      Report as inappropriate content
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

            {(post?.userId === userId || role === "ADMIN") && (
              <TouchableOpacity
                style={styles.menuOptionBtn}
                activeOpacity={0.8}
                onPress={handleDeletePost}
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    { backgroundColor: colors.errorBg },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.errorText}
                  />
                </View>
                <View style={styles.menuOptionInfo}>
                  <Text
                    style={[styles.menuOptionText, { color: colors.errorText }]}
                  >
                    Delete post
                  </Text>
                  <Text style={styles.menuOptionSub}>
                    Permanently remove this post
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuCancelBtn}
              activeOpacity={0.8}
              onPress={() => setPostMenuVisible(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit post modal ── */}
      <Modal
        visible={editPostVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setEditPostVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setEditPostVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.menuSheet}
          >
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Edit post</Text>
            <TextInput
              style={styles.editPostInput}
              value={editPostText}
              onChangeText={setEditPostText}
              multiline
              maxLength={500}
              placeholder="Update your post..."
              placeholderTextColor={colors.muted4}
              editable={!savingPostEdit}
            />
            <View style={styles.editPostActions}>
              <TouchableOpacity
                style={styles.menuCancelBtn}
                activeOpacity={0.8}
                onPress={() => setEditPostVisible(false)}
              >
                <Text style={styles.menuCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editPostSaveBtn,
                  (savingPostEdit || editPostText.trim().length < 3) && {
                    opacity: 0.5,
                  },
                ]}
                activeOpacity={0.85}
                disabled={savingPostEdit || editPostText.trim().length < 3}
                onPress={handleSavePostEdit}
              >
                {savingPostEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editPostSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Image viewer modal ── */}
      {post?.imageUrl && (
        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <View style={styles.imageViewerBackdrop}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              activeOpacity={0.8}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: resolveAvatarUrl(post.imageUrl) }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}

      {/* ── Reactors modal ── */}
      <Modal
        visible={showReactors}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowReactors(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowReactors(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.reactorsSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Reactions</Text>

            {/* Tab row */}
            <View style={styles.reactorsTabRow}>
              {(["ALL", ...REACTION_TYPES] as Array<"ALL" | ReactionType>).map(
                (tab) => {
                  const isActive = reactorsTab === tab;
                  const tabCount =
                    tab === "ALL"
                      ? reactorsList.length
                      : reactorsList.filter((r) => r.type === tab).length;
                  if (tabCount <= 0) return null;
                  return (
                    <TouchableOpacity
                      key={tab}
                      activeOpacity={0.8}
                      onPress={() => setReactorsTab(tab)}
                      style={[
                        styles.reactorsTab,
                        isActive && styles.reactorsTabActive,
                      ]}
                    >
                      {tab !== "ALL" && (
                        <View style={styles.reactorsTabIcon}>
                          {renderReactionIcon(
                            tab as ReactionType,
                            11,
                            colors.card,
                          )}
                        </View>
                      )}
                      <Text
                        style={[
                          styles.reactorsTabText,
                          isActive && styles.reactorsTabTextActive,
                        ]}
                      >
                        {tab === "ALL"
                          ? "All"
                          : tab.charAt(0) + tab.slice(1).toLowerCase()}
                      </Text>
                      {tabCount > 0 && (
                        <Text
                          style={[
                            styles.reactorsTabCount,
                            isActive && styles.reactorsTabCountActive,
                          ]}
                        >
                          {tabCount}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                },
              )}
            </View>

            {/* List */}
            {reactorsLoading ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginVertical: 32 }}
              />
            ) : filteredReactors.length === 0 ? (
              <View style={styles.reactorsEmpty}>
                <Ionicons
                  name="heart-outline"
                  size={32}
                  color={colors.muted4}
                />
                <Text style={styles.reactorsEmptyText}>No reactions yet</Text>
              </View>
            ) : (
              <FlatList
                data={filteredReactors}
                keyExtractor={(item, idx) => item.user.id + item.type + idx}
                style={styles.reactorsList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const initial = item.user.displayName.charAt(0).toUpperCase();
                  const avatarColors: [string, string] = [
                    colors.primary,
                    colors.secondary,
                  ];
                  return (
                    <View style={styles.reactorRow}>
                      <View style={styles.reactorAvatarWrap}>
                        {item.user.avatarUrl ? (
                          <Image
                            source={{
                              uri: resolveAvatarUrl(item.user.avatarUrl),
                            }}
                            style={styles.reactorAvatar}
                          />
                        ) : (
                          <LinearGradient
                            colors={avatarColors}
                            style={styles.reactorAvatar}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Text style={styles.reactorInitial}>{initial}</Text>
                          </LinearGradient>
                        )}
                        <View style={styles.reactorTypeBadge}>
                          {renderReactionIcon(
                            item.type as ReactionType,
                            9,
                            colors.card,
                          )}
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
    </SafeAreaView>
  );
}
// ─────────────────────────────────────────────
const createStyles = (colors: typeof defaultColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },

    // ── Header ───────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surfaceContainerLowest,
      gap: 12,
      width: "100%" as any,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerLogo: { width: 28, height: 28, borderRadius: 6 },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.displayBold,
      color: colors.primary,
    },
    headerAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    headerAvatarText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontFamily: fonts.displayBold,
    },

    // ── Scroll / list ─────────────────────────
    kav: { flex: 1, width: "100%" as any },
    contentColumn: { flex: 1 },
    contentColumnWide: {
      maxWidth: 680,
      width: "100%" as any,
      alignSelf: "center" as const,
    },
    listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

    // ── Post card ────────────────────────────
    postCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: 24,
      marginBottom: 24,
      ...ambientShadow,
    },
    postAuthorRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
      gap: 12,
    },
    postAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    postAvatarInitial: {
      color: colors.onPrimary,
      fontSize: 18,
      fontFamily: fonts.displayBold,
    },
    postNameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    postAuthorName: {
      color: colors.onSurface,
      fontFamily: fonts.displayBold,
      fontSize: 16,
    },
    postMenuBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    postSubtitle: {
      color: colors.onSurfaceVariant,
      fontSize: 13,
      fontFamily: fonts.bodyRegular,
      marginTop: 2,
    },
    postFeeling: {
      color: colors.secondary,
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
    },
    postContent: {
      color: colors.onSurface,
      fontSize: 16,
      lineHeight: 26,
      fontFamily: fonts.bodyRegular,
    },
    postImage: {
      width: "100%" as any,
      height: 240,
      borderRadius: radii.lg,
      marginTop: 16,
    },
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 12,
      gap: 8,
    },
    tagChip: {
      backgroundColor: colors.secondaryFixed,
      borderRadius: radii.full,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    tagText: {
      color: colors.onSecondaryFixed,
      fontSize: 12,
      fontFamily: fonts.bodySemiBold,
    },

    // ── Reaction bar ──────────────────────────
    reactionBar: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant + "30",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    reactionButtons: {
      flexDirection: "row",
      gap: 12,
    },
    reactionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceContainerLow,
    },
    reactionBtnActive: {
      backgroundColor: colors.primaryContainer + "30",
    },
    reactionBtnLabel: {
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurfaceVariant,
    },
    reactionBtnLabelActive: {
      color: colors.primary,
    },
    reactionSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    reactionEmojiStack: { flexDirection: "row" },
    reactionEmojiBubble: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    reactionSummaryText: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      fontFamily: fonts.bodySemiBold,
    },
    reactionSummaryDot: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },

    // ── Comments section ───────────────────────
    commentsHeader: {
      fontSize: 18,
      fontFamily: fonts.displayBold,
      color: colors.onSurface,
      marginBottom: 16,
    },
    commentsSpinner: { marginBottom: 16 },
    commentsEmptyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 24,
      paddingVertical: 20,
    },
    commentsEmpty: {
      color: colors.muted4,
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
    },

    // ── Comment rows ──────────────────────────
    commentRow: {
      flexDirection: "row",
      marginBottom: 20,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      marginTop: 2,
    },
    commentAvatarInitial: {
      color: colors.onPrimary,
      fontSize: 13,
      fontFamily: fonts.displayBold,
    },
    commentBody: { flex: 1 },
    commentMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
      gap: 4,
    },
    commentMetaLeft: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: 4,
    },
    commentMetaRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    commentAuthor: {
      color: colors.onSurface,
      fontFamily: fonts.displayBold,
      fontSize: 14,
    },
    commentAnonymousAuthor: {
      color: colors.secondary,
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
    },
    commentAnonymousAuthorMd: {
      maxWidth: 160,
    },
    commentAnonymousAuthorSm: {
      maxWidth: 120,
    },
    commentAnonymousAuthorXs: {
      maxWidth: 90,
    },
    commentTime: {
      color: colors.muted4,
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
    },
    commentBubble: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.lg,
      padding: 14,
    },
    commentBubbleOwn: {
      backgroundColor: colors.surfaceContainerHigh,
    },
    commentActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginTop: 6,
      paddingLeft: 4,
    },
    commentActionText: {
      fontSize: 12,
      fontFamily: fonts.bodySemiBold,
      color: colors.primary,
    },
    commentActionTextActive: {
      color: colors.primary,
    },
    commentLikeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    commentReactionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    commentReactionCount: {
      fontSize: 11,
      fontFamily: fonts.bodySemiBold,
      color: colors.primary,
    },
    commentRowReply: {
      marginLeft: 0,
      marginBottom: 12,
    },
    commentAvatarReply: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    repliesContainer: {
      marginTop: 12,
      paddingLeft: 0,
    },
    replyIndicator: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: colors.surfaceContainerLow,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant + "30",
      width: "100%" as any,
    },
    replyIndicatorText: {
      fontSize: 13,
      fontFamily: fonts.bodyRegular,
      color: colors.onSurfaceVariant,
    },
    replyIndicatorName: {
      fontFamily: fonts.bodySemiBold,
      color: colors.primary,
    },
    commentText: {
      color: colors.onSurface,
      fontSize: 14,
      lineHeight: 22,
      fontFamily: fonts.bodyRegular,
    },
    mentionText: {
      color: colors.primary,
      fontFamily: fonts.bodySemiBold,
    },
    commentEditBtn: {
      marginLeft: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceContainerLow,
    },
    flagCommentBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.sm,
      backgroundColor: colors.warningBg,
    },
    flagCommentText: {
      fontSize: 11,
      fontFamily: fonts.bodySemiBold,
      color: colors.warningText,
    },
    reviewBadge: {
      backgroundColor: colors.warningBg,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      borderRadius: radii.sm,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginLeft: 6,
    },
    reviewBadgeText: {
      color: colors.warningText,
      fontSize: 10,
      fontFamily: fonts.bodySemiBold,
    },
    reviewBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    // ── Comment moderation feedback ───────────
    commentFeedbackError: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.errorBg,
      borderRadius: radii.md,
      padding: 10,
    },
    commentFeedbackReview: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.warningBg,
      borderRadius: radii.md,
      padding: 10,
    },
    commentFeedbackText: {
      fontSize: 13,
      fontFamily: fonts.bodySemiBold,
    },

    // ── Comment input bar ─────────────────────
    inputBar: {
      backgroundColor: colors.surfaceContainerLowest,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant + "30",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Platform.OS === "ios" ? 28 : 14,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      width: "100%" as any,
    },
    inputAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 5,
    },
    inputAvatarText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontFamily: fonts.displayBold,
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radii.full,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
      color: colors.onSurface,
      minHeight: 38,
      maxHeight: 100,
      ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
    },
    sendBtn: { borderRadius: 20, overflow: "hidden", marginBottom: 3 },
    sendGradient: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },

    // ── Mention suggestions ───────────────────
    mentionBox: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingVertical: 6,
      paddingHorizontal: 10,
      gap: 6,
      ...ambientShadow,
    },
    mentionItem: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceContainerLow,
    },
    mentionHandle: {
      color: colors.primary,
      fontSize: 13,
      fontFamily: fonts.bodySemiBold,
    },
    mentionName: {
      color: colors.muted4,
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
      marginTop: 2,
    },

    // ── Menu modals ───────────────────────────
    menuBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      justifyContent: "flex-end",
    },
    menuSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: Platform.OS === "ios" ? 34 : 20,
      gap: 8,
      ...ambientShadow,
    },
    menuHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.outline + "40",
      alignSelf: "center",
      marginBottom: 12,
    },
    menuTitle: {
      color: colors.onSurface,
      fontSize: 18,
      fontFamily: fonts.displayBold,
      marginBottom: 8,
    },
    menuIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    menuOptionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderRadius: radii.lg,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    menuOptionInfo: {
      flex: 1,
    },
    menuOptionText: {
      fontSize: 15,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurface,
    },
    menuOptionSub: {
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
      color: colors.onSurfaceVariant,
      marginTop: 1,
    },
    menuDeleteBtn: {
      backgroundColor: colors.errorBg,
    },
    menuDeleteText: {
      color: colors.errorText,
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
    },
    menuEditText: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
    },
    menuCancelBtn: {
      flex: 1,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceContainerHigh,
      paddingHorizontal: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    menuCancelText: {
      color: colors.onSurface,
      fontSize: 15,
      fontFamily: fonts.displaySemiBold,
    },
    editPostInput: {
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radii.lg,
      minHeight: 120,
      maxHeight: 240,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.onSurface,
      fontFamily: fonts.bodyRegular,
      textAlignVertical: "top",
      ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
    },
    editPostActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    editPostSaveBtn: {
      flex: 1,
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    editPostSaveText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontFamily: fonts.displaySemiBold,
    },
    editCommentInput: {
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radii.lg,
      minHeight: 120,
      maxHeight: 240,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.onSurface,
      fontFamily: fonts.bodyRegular,
      textAlignVertical: "top",
      ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
    },
    editCommentActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    editCommentSaveBtn: {
      flex: 1,
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    editCommentSaveText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontFamily: fonts.displaySemiBold,
    },

    // ── Floating Picker Modal ────────────────
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
    modalCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
    pickerPill: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: radii.full,
      paddingVertical: 10,
      paddingHorizontal: 14,
      gap: 6,
      ...ambientShadow,
    },
    pickerOption: {
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: radii.full,
      minWidth: 76,
    },
    pickerOptionActive: {
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 2,
      borderColor: colors.secondary,
    },
    pickerIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    pickerLabel: {
      fontSize: 12,
      fontFamily: fonts.bodySemiBold,
      marginTop: 5,
    },
    pickerLabelDefault: { color: colors.onSurfaceVariant },
    pickerLabelActive: { color: colors.secondary },
    pickerCount: {
      fontSize: 11,
      color: colors.muted4,
      fontFamily: fonts.bodySemiBold,
      marginTop: 2,
    },

    // ── Comment reaction picker ──────────────
    commentPickerBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.25)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    commentPickerSheet: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: 18,
      gap: 12,
      maxWidth: 400,
      width: "100%" as any,
      ...ambientShadow,
    },
    commentPickerRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    commentPickerOption: {
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radii.full,
      minWidth: 64,
    },

    // ── Reaction row (compact) ────────────────
    countButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    footerCountMuted: {
      fontSize: 13,
      fontFamily: fonts.bodySemiBold,
      color: colors.muted5,
    },

    // ── Image expand hint ─────────────────────
    imageExpandHint: {
      position: "absolute",
      bottom: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },

    // ── Reactors modal ────────────────────────
    reactorsSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: Platform.OS === "ios" ? 34 : 20,
      maxHeight: "80%",
      ...ambientShadow,
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
      position: "relative",
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

    // ── Image viewer modal ────────────────────
    imageViewerBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    imageViewerClose: {
      position: "absolute",
      top: Platform.OS === "ios" ? 56 : 24,
      right: 20,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    imageViewerImage: {
      width: "92%",
      height: "80%",
    },
  });
