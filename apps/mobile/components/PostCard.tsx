// ─────────────────────────────────────────────
// components/PostCard.tsx
// Renders a single SAFE post in the feed
// ─────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Image,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  Post,
  ReactionType,
  ReactionCounts,
} from "../../../packages/types";
import { REACTION_EMOJI as EMOJI } from "../../../packages/types";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { apiGetReactions, apiUpsertReaction } from "../services/api";
import { useUser } from "../hooks/useUser";
import { colors } from "../constants/theme";

const REACTION_TYPES: ReactionType[] = ["PRAY", "CARE", "SUPPORT"];

interface PostCardProps {
  post: Post;
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

type CardNavProp = NativeStackNavigationProp<RootStackParamList, "Home">;

export default function PostCard({ post }: PostCardProps) {
  const navigation = useNavigation<CardNavProp>();
  const { userId } = useUser();

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
        const total = Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0);
        setLocalTotal(total);
      })
      .catch(() => {/* keep defaults */});
  }, [post.id, userId]);

  // ── Floating picker ───────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const pickerAnim = useRef(new Animated.Value(0)).current;

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
        const total = Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0);
        setLocalTotal(total);
      })
      .catch(() => {/* keep current state */});
  };

  const closePicker = () => {
    Animated.timing(pickerAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowPicker(false));
  };

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

  const topEmojis = REACTION_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3)
    .map((t) => EMOJI[t]);

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
        onPress={() => navigation.getParent()?.navigate("PostDetail", { post })}
        onLongPress={openPicker}
        delayLongPress={300}
        style={[styles.card, userReaction ? styles.cardActive : styles.cardDefault]}
      >
        {/* ── Author row ── */}
        <View style={styles.authorRow}>
          <View style={styles.row}>
            <LinearGradient
              colors={colorPair}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarInitial}>{initial}</Text>
            </LinearGradient>
            <View>
              <Text style={styles.authorName}>{displayName}</Text>
              <Text style={styles.authorSubtitle}>
                👤
                {`Spaze ${post.user?.role === "COACH" ? "Coach" : "Member"}`}
              </Text>
            </View>
          </View>
          <View style={styles.timePill}>
            <Text style={styles.timeText}>{timeAgo}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Post Content ── */}
        <Text style={styles.content} numberOfLines={4}>
          {post.content}
        </Text>

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
            {topEmojis.length > 0 ? (
              <TouchableOpacity
                onPress={openPicker}
                onLongPress={openPicker}
                delayLongPress={300}
                activeOpacity={0.75}
                style={styles.emojiCluster}
              >
                {topEmojis.map((emoji, i) => (
                  <Text key={i} style={styles.emojiItem}>{emoji}</Text>
                ))}
                <Text style={styles.emojiCount}>{localTotal}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.footerCount}>
                {reactionLoading ? "…" : `🙇 ${localTotal}`}
              </Text>
            )}
            <Text style={styles.footerCount}>💬 {post.commentCount ?? 0}</Text>
          </View>
        </View>
      </TouchableOpacity>

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
                        onPress={() => handleReaction(type)}
                        activeOpacity={0.75}
                        style={[styles.reactionOption, active ? styles.reactionOptionActive : styles.reactionOptionDefault]}
                      >
                        <Text style={styles.reactionEmoji}>{EMOJI[type]}</Text>
                        <Text style={[styles.reactionLabel, active ? styles.reactionLabelActive : styles.reactionLabelDefault]}>
                          {type.toLowerCase().charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
                        </Text>
                        {count > 0 && (
                          <Text style={styles.reactionCount}>{count}</Text>
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
  cardActive: {
    borderWidth: 1.5,
    borderColor: colors.fuchsia,
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
    display: "flex",
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
  emojiCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emojiItem: {
    fontSize: 14,
  },
  emojiCount: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  footerCount: {
    fontSize: 13,
    color: colors.subtle,
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
  reactBtnActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.fuchsia,
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
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalCenter: {
    flex: 1,
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
  reactionEmoji: {
    fontSize: 36,
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
});