// ─────────────────────────────────────────────
// screens/CoachDashboard.tsx
// PUSO Coach review dashboard
// Shows REVIEW-status posts and comments;
// allows approving (→ SAFE) or rejecting (→ FLAGGED)
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { colors } from '../constants/theme';
import { useUserStore } from '../context/UserContext';
import { apiGetReviewQueue, apiModeratePost, apiModerateComment } from '../services/api';
import { showAlert } from '../utils/alertPlatform';
import type { Post, Comment } from '../../../packages/types';
import type { MainDrawerParamList } from '../navigation/MainDrawerNavigator';

type Nav = DrawerNavigationProp<MainDrawerParamList>;

type Tab = 'posts' | 'comments';

export default function CoachDashboard() {
  const navigation           = useNavigation<Nav>();
  const { userId, username, logoutUser } = useUserStore();

  const [tab, setTab]               = useState<Tab>('posts');
  const [posts, setPosts]           = useState<Post[]>([]);
  const [comments, setComments]     = useState<Comment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]         = useState<string | null>(null); // id being actioned

  // ── Fetch queue ───────────────────────────

  const fetchQueue = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const { posts: p, comments: c } = await apiGetReviewQueue(userId);
      setPosts(p);
      setComments(c);
    } catch (err) {
      if (!silent) showAlert('Error', 'Could not load review queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQueue(true);
  };

  // ── Moderation actions ────────────────────

  const moderatePost = async (postId: string, action: 'approve' | 'reject') => {
    if (!userId) {
      showAlert('Session Error', 'Could not identify your user session. Please sign out and sign back in.');
      return;
    }
    setActing(postId);
    try {
      await apiModeratePost(postId, { coachId: userId, action });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      const msg = err?.response?.data?.error
        ?? err?.response?.data?.errors?.[0]?.msg
        ?? err?.message
        ?? 'Could not moderate post. Please try again.';
      showAlert('Error', msg);
    } finally {
      setActing(null);
    }
  };

  const moderateComment = async (commentId: string, action: 'approve' | 'reject') => {
    if (!userId) {
      showAlert('Session Error', 'Could not identify your user session. Please sign out and sign back in.');
      return;
    }
    setActing(commentId);
    try {
      await apiModerateComment(commentId, { coachId: userId, action });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      const msg = err?.response?.data?.error
        ?? err?.response?.data?.errors?.[0]?.msg
        ?? err?.message
        ?? 'Could not moderate comment. Please try again.';
      showAlert('Error', msg);
    } finally {
      setActing(null);
    }
  };

  // ── Helpers ───────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Renders ───────────────────────────────

  const renderPostCard = (post: Post) => {
    const isBusy = acting === post.id;
    return (
      <View key={post.id} style={styles.card}>
        {/* Author + date */}
        <View style={styles.cardMeta}>
          <Text style={styles.cardAuthor}>{post.user?.displayName ?? 'Unknown'}</Text>
          <Text style={styles.cardDate}>{formatDate(post.createdAt)}</Text>
        </View>

        {/* Content */}
        <Text style={styles.cardContent}>{post.content}</Text>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => moderatePost(post.id, 'approve')}
            disabled={isBusy}
            style={[styles.actionBtn, styles.approveBtn]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.actionBtnRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.card} />
                <Text style={styles.actionBtnText}>Approve</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => moderatePost(post.id, 'reject')}
            disabled={isBusy}
            style={[styles.actionBtn, styles.rejectBtn]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.actionBtnRow}>
                <Ionicons name="close-circle-outline" size={14} color={colors.card} />
                <Text style={styles.actionBtnText}>Reject</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCommentCard = (comment: Comment) => {
    const isBusy = acting === comment.id;
    return (
      <View key={comment.id} style={styles.card}>
        {/* On post preview */}
        {comment.post && (
          <View style={styles.commentContext}>
            <Text style={styles.commentContextLabel}>On post: </Text>
            <Text style={styles.commentContextPreview} numberOfLines={1}>
              {comment.post.content}
            </Text>
          </View>
        )}

        {/* Author + date */}
        <View style={styles.cardMeta}>
          <Text style={styles.cardAuthor}>{comment.user?.displayName ?? 'Unknown'}</Text>
          <Text style={styles.cardDate}>{formatDate(comment.createdAt)}</Text>
        </View>

        {/* Content */}
        <Text style={styles.cardContent}>{comment.content}</Text>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => moderateComment(comment.id, 'approve')}
            disabled={isBusy}
            style={[styles.actionBtn, styles.approveBtn]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.actionBtnRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.card} />
                <Text style={styles.actionBtnText}>Approve</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => moderateComment(comment.id, 'reject')}
            disabled={isBusy}
            style={[styles.actionBtn, styles.rejectBtn]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.actionBtnRow}>
                <Ionicons name="close-circle-outline" size={14} color={colors.card} />
                <Text style={styles.actionBtnText}>Reject</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Empty state ───────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="checkmark-done-outline" size={28} color={colors.card} />
      </View>
      <Text style={styles.emptyTitle}>All clear!</Text>
      <Text style={styles.emptySubtitle}>
        No {tab === 'posts' ? 'posts' : 'comments'} waiting for review.
      </Text>
    </View>
  );
  // ── Render ────────────────────────────────

  const activeList = tab === 'posts' ? posts : comments;

  return (
    <LinearGradient
      colors={[colors.darkest, colors.deep, colors.ink]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Hamburger — opens drawer */}
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          style={styles.hamburger}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={18} color={colors.card} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shield-outline" size={18} color={colors.card} />
            <Text style={styles.headerTitle}>Coach Dashboard</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {username ?? 'Coach'} · review queue
          </Text>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setTab('posts')}
          style={[styles.tabBtn, tab === 'posts' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, tab === 'posts' && styles.tabBtnTextActive]}>
            Posts
            {posts.length > 0 && (
              <Text style={styles.tabBadge}> {posts.length}</Text>
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTab('comments')}
          style={[styles.tabBtn, tab === 'comments' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, tab === 'comments' && styles.tabBtnTextActive]}>
            Comments
            {comments.length > 0 && (
              <Text style={styles.tabBadge}> {comments.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.fuchsia} />
          <Text style={styles.loadingText}>Loading review queue…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.fuchsia}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeList.length === 0
            ? renderEmpty()
            : tab === 'posts'
              ? posts.map(renderPostCard)
              : comments.map(renderCommentCard)}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ───────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  hamburger: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.card,
    letterSpacing: 0.3,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.muted5,
    marginTop: 2,
  },

  // ── Tabs ─────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted5,
  },
  tabBtnTextActive: {
    color: colors.card,
  },
  tabBadge: {
    color: colors.fuchsia,
    fontWeight: '800',
  },

  // ── Loading / Empty ───────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted5,
    fontSize: 14,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.card,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted5,
    textAlign: 'center',
  },

  // ── List ──────────────────────────────────
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },

  // ── Card ─────────────────────────────────
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.muted3 + '40',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.fuchsia,
  },
  cardDate: {
    fontSize: 11,
    color: colors.muted5,
  },
  cardContent: {
    fontSize: 15,
    color: colors.card,
    lineHeight: 22,
    marginBottom: 16,
  },

  // ── Comment context ───────────────────────
  commentContext: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  commentContextLabel: {
    fontSize: 11,
    color: colors.muted5,
    fontWeight: '600',
  },
  commentContextPreview: {
    flex: 1,
    fontSize: 11,
    color: colors.muted5,
    fontStyle: 'italic',
  },

  // ── Action buttons ────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  approveBtn: {
    backgroundColor: colors.safeDark,
  },
  rejectBtn: {
    backgroundColor: colors.dangerDark,
  },
  actionBtnText: {
    color: colors.card,
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
