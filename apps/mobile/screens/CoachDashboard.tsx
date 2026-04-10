// ─────────────────────────────────────────────
// screens/CoachDashboard.tsx
// PUSO Coach review dashboard — Sacred Journal design
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
  Platform,
  Image,
  useWindowDimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { colors, fonts, radii, ambientShadow } from '../constants/theme';
import { useThemeStore } from '../context/ThemeContext';
import { useUserStore } from '../context/UserContext';
import {
  apiGetReviewQueue,
  apiModeratePost,
  apiModerateComment,
  apiGetDashboardStats,
  apiFetchConversations,
  getBaseUrl,
} from '../services/api';
import type { DashboardStats } from '../services/api';
import { showAlert } from '../utils/alertPlatform';
import type { Post, Comment, Conversation } from '../../../packages/types';
import type { MainDrawerParamList } from '../navigation/MainDrawerNavigator';

type Nav = DrawerNavigationProp<MainDrawerParamList>;

// ── Helpers ─────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function avatarColors(ch: string): [string, string] {
  const gradients: [string, string][] = [
    [colors.primary, colors.secondary],
    [colors.gradientStart, colors.gradientEnd],
    [colors.secondary, colors.tertiary],
    ['#A60550', '#7D45A2'],
    ['#371FA9', '#7C003A'],
  ];
  return gradients[ch.charCodeAt(0) % gradients.length];
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  struggling: { bg: '#FDEEF0', text: '#A60550' },
  encouragement: { bg: '#EEF5EE', text: '#22854A' },
  prayer: { bg: '#F0EEFF', text: '#371FA9' },
  gratitude: { bg: '#FFF8EC', text: '#92400E' },
  default: { bg: '#F1EBF9', text: '#7D45A2' },
};

function getTagColor(tag: string) {
  const key = tag.replace('#', '').toLowerCase();
  return TAG_COLORS[key] ?? TAG_COLORS.default;
}

// ─────────────────────────────────────────────

export default function CoachDashboard() {
  const navigation = useNavigation<Nav>();
  const { userId, username, role } = useUserStore();
  const { colors: themeColors, isDark } = useThemeStore();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1000;
  const isNarrow = width < 500;

  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // ── Fetch data ────────────────────────────

  const fetchAll = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const [queue, dashStats, convos] = await Promise.all([
        apiGetReviewQueue(userId),
        apiGetDashboardStats(),
        apiFetchConversations(userId),
      ]);
      setPosts(queue.posts);
      setComments(queue.comments);
      setStats(dashStats);
      setConversations(convos.conversations.slice(0, 3));
    } catch {
      if (!silent) showAlert('Error', 'Could not load dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(true); };

  // ── Moderation actions ────────────────────

  const moderatePost = async (postId: string, action: 'approve' | 'reject') => {
    if (!userId) return;
    setActing(postId);
    try {
      await apiModeratePost(postId, { coachId: userId, action });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not moderate post.';
      showAlert('Error', msg);
    } finally { setActing(null); }
  };

  const moderateComment = async (commentId: string, action: 'approve' | 'reject') => {
    if (!userId) return;
    setActing(commentId);
    try {
      await apiModerateComment(commentId, { coachId: userId, action });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not moderate comment.';
      showAlert('Error', msg);
    } finally { setActing(null); }
  };

  // ── Derived data ──────────────────────────
  const pendingCount = posts.length + comments.length;
  const flaggedCount = posts.filter(p => p.moderationStatus === 'FLAGGED').length;

  // ── Renders ───────────────────────────────

  const renderStatCard = (
    icon: keyof typeof Ionicons.glyphMap,
    iconBg: string,
    label: string,
    value: string | number,
    badge?: string,
    badgeColor?: string,
  ) => (
    <View style={s.statCard}>
      <View style={s.statTop}>
        <View style={[s.statIconWrap, { backgroundColor: iconBg + '18' }]}>
          <Ionicons name={icon} size={22} color={iconBg} />
        </View>
        {badge && (
          <Text style={[s.statBadge, { color: badgeColor ?? colors.safe }]}>{badge}</Text>
        )}
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{typeof value === 'number' ? String(value).padStart(2, '0') : value}</Text>
    </View>
  );

  const renderReviewCard = (item: Post | Comment, type: 'post' | 'comment') => {
    const isBusy = acting === item.id;
    const author = item.user?.displayName ?? 'Anonymous';
    const isAnonymous = (item as any).isAnonymous;
    const displayAuthor = isAnonymous ? (item as any).anonDisplayName ?? 'Anonymous Member' : author;
    const tags = type === 'post' ? ((item as Post).tags ?? []) : [];
    const postRef = type === 'comment' ? (item as Comment).post : null;

    return (
      <View key={item.id} style={s.reviewCard}>
        {/* Header */}
        <View style={s.reviewHeader}>
          <View style={s.reviewAuthorRow}>
            <View style={s.reviewAvatar}>
              <Ionicons name="person-outline" size={16} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.reviewAuthor}>{displayAuthor}</Text>
              {postRef && (
                <Text style={s.reviewPostRef} numberOfLines={1}>
                  On post: {postRef.content?.slice(0, 40)}…
                </Text>
              )}
              <Text style={s.reviewTime}>
                {type === 'comment' ? 'Comment' : 'Posted'} · {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          </View>
          {tags.length > 0 && (
            <View style={s.tagsRow}>
              {tags.slice(0, 2).map((tag) => {
                const tc = getTagColor(tag);
                return (
                  <View key={tag} style={[s.tagBadge, { backgroundColor: tc.bg }]}>
                    <Text style={[s.tagText, { color: tc.text }]}>#{tag.toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Content */}
        <Text style={s.reviewContent}>"{item.content}"</Text>

        {/* Image */}
        {type === 'post' && (item as Post).imageUrl && (
          <Image
            source={{ uri: `${getBaseUrl()}${(item as Post).imageUrl}` }}
            style={s.reviewImage}
            resizeMode="cover"
          />
        )}

        {/* Actions */}
        <View style={s.reviewActions}>
          <TouchableOpacity
            onPress={() => type === 'post' ? moderatePost(item.id, 'reject') : moderateComment(item.id, 'reject')}
            disabled={isBusy}
            style={s.flagBtn}
          >
            {isBusy ? <ActivityIndicator size="small" color={colors.onSurface} /> : (
              <Text style={s.flagBtnText}>Flag</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => type === 'post' ? moderatePost(item.id, 'approve') : moderateComment(item.id, 'approve')}
            disabled={isBusy}
            style={s.approveBtn}
          >
            {isBusy ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={s.approveBtnText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Right sidebar (wide only) ─────────────

  const rightPanel = (
    <View style={s.rightPanel}>
      {/* Community Sentiment */}
      <View style={s.sentimentCard}>
        <View style={s.sentimentHeader}>
          <Ionicons name="analytics-outline" size={20} color={colors.primary} />
          <Text style={s.sentimentTitle}>Community Sentiment</Text>
        </View>
        {(stats?.trendingTags ?? []).length > 0 ? (
          <>
            {(stats?.trendingTags ?? []).slice(0, 3).map((tag, i) => {
              const tc = getTagColor(tag);
              const pct = Math.max(20, 90 - i * 25);
              return (
                <View key={tag} style={s.sentimentRow}>
                  <Text style={[s.sentimentTag, { color: tc.text }]}>#{tag}</Text>
                  <View style={s.sentimentBarBg}>
                    <LinearGradient
                      colors={[tc.text, tc.text + '99']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.sentimentBarFill, { width: `${pct}%` as any }]}
                    />
                  </View>
                  <Text style={s.sentimentPct}>{pct}%</Text>
                </View>
              );
            })}
            <Text style={s.sentimentNote}>
              The PUSO community is active and thriving today.
            </Text>
          </>
        ) : (
          <Text style={s.sentimentNote}>No trending tags yet.</Text>
        )}
      </View>

      {/* Support Chats */}
      <View style={s.chatsCard}>
        <View style={s.chatsHeader}>
          <Text style={s.chatsTitle}>Support Chats</Text>
          {conversations.some(c => (c.unreadCount ?? 0) > 0) && (
            <View style={s.chatsDot} />
          )}
        </View>
        {conversations.length > 0 ? conversations.map((conv) => {
          const name = conv.user?.displayName ?? 'Member';
          const initial = name.charAt(0).toUpperCase();
          const grad = avatarColors(initial);
          const lastMsg = conv.lastMessage?.content ?? 'No messages yet';
          const time = conv.lastMessage ? formatRelativeTime(conv.lastMessage.createdAt) : '';
          return (
            <TouchableOpacity key={conv.id} style={s.chatRow} activeOpacity={0.7}>
              <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chatAvatar}>
                <Text style={s.chatAvatarText}>{initial}</Text>
              </LinearGradient>
              <View style={s.chatInfo}>
                <Text style={s.chatName}>{name}</Text>
                <Text style={s.chatPreview} numberOfLines={1}>"{lastMsg.slice(0, 30)}…"</Text>
              </View>
              <Text style={s.chatTime}>{time}</Text>
            </TouchableOpacity>
          );
        }) : (
          <Text style={s.sentimentNote}>No conversations yet.</Text>
        )}
        <TouchableOpacity
          style={s.goToMsgsBtn}
          onPress={() => (navigation as any).navigate('Messages')}
          activeOpacity={0.7}
        >
          <Text style={s.goToMsgsText}>GO TO MESSAGES</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Loading state ─────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: themeColors.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={s.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allItems = [
    ...posts.map(p => ({ ...p, _type: 'post' as const })),
    ...comments.map(c => ({ ...c, _type: 'comment' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ── Main render ───────────────────────────

  return (
    <SafeAreaView style={[s.root, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />

      {/* ── Top bar (mobile / narrow) ── */}
      {!isWide && (
        <View style={s.topBar}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            activeOpacity={0.7}
            style={s.hamburger}
          >
            <Ionicons name="menu-outline" size={24} color={colors.heading} />
          </TouchableOpacity>
          <Text style={s.topBarTitle}>Coach Dashboard</Text>
          <View style={{ width: 32 }} />
        </View>
      )}

      <View style={s.mainRow}>
        {/* Left / Main content */}
        <ScrollView
          style={s.scrollArea}
          contentContainerStyle={s.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Greeting ── */}
          <View style={s.greetingSection}>
            <Text style={s.greetingTitle}>
              {getGreeting()}, {username ?? 'Coach'}.
            </Text>
            <Text style={s.greetingSubtitle}>
              The PUSO community is active and leaning on your guidance today.
            </Text>
          </View>

          {/* ── Stats row ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.statsRow}
            style={s.statsScroll}
          >
            {renderStatCard(
              'clipboard-outline',
              colors.primary,
              'Pending Reviews',
              pendingCount,
              pendingCount > 0 ? `+${pendingCount} new` : undefined,
              colors.safe,
            )}
            {renderStatCard(
              'people-outline',
              colors.secondary,
              'Active Members',
              stats?.totalMembers ? stats.totalMembers.toLocaleString() : '—',
              stats?.onlineCount ? `${Math.round((stats.onlineCount / Math.max(stats.totalMembers, 1)) * 100)}% active` : undefined,
              colors.secondary,
            )}
            {renderStatCard(
              'flag-outline',
              colors.danger,
              'Flagged Posts',
              flaggedCount,
              flaggedCount > 0 ? 'Priority' : undefined,
              colors.danger,
            )}
          </ScrollView>

          {/* ── Coach Dashboard ── */}
          <View style={s.queueHeader}>
            <View style={s.queueTitleRow}>
              <Text style={[s.queueTitle, isNarrow && s.queueTitleNarrow]}>Coach Dashboard</Text>
              <View style={s.queueBadge}>
                <Text style={s.queueBadgeText}>{allItems.length} Pending</Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={s.viewAllLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {allItems.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Ionicons name="checkmark-done-outline" size={28} color={colors.primary} />
              </View>
              <Text style={s.emptyTitle}>All clear!</Text>
              <Text style={s.emptySubtitle}>No posts or comments waiting for review.</Text>
            </View>
          ) : (
            allItems.map((item) => renderReviewCard(item, item._type))
          )}
        </ScrollView>

        {/* Right panel (wide screens only) */}
        {isWide && rightPanel}
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles – Sacred Journal light design
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Layout ───────────────────────────────
  mainRow: {
    flex: 1,
    flexDirection: 'row',
  },
  scrollArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    paddingTop: Platform.OS === 'web' ? 12 : 8,
    paddingBottom: 40,
  },

  // ── Loading ──────────────────────────────
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.bodyRegular,
  },

  // ── Top bar (mobile) ─────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerLowest,
  },
  hamburger: { padding: 4 },
  topBarTitle: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },

  // ── Greeting ─────────────────────────────
  greetingSection: { marginBottom: 20 },
  greetingTitle: {
    fontSize: Platform.OS === 'web' ? 26 : 22,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 20,
  },

  // ── Stats ────────────────────────────────
  statsScroll: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    ...ambientShadow,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBadge: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    letterSpacing: -0.5,
  },

  // ── Queue header ─────────────────────────
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  queueTitleNarrow: {
    fontSize: 17,
  },
  queueBadge: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  queueBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.onPrimary,
  },
  viewAllLink: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },

  // ── Review card ──────────────────────────
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 12,
    ...ambientShadow,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAuthor: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.onSurface,
  },
  reviewPostRef: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  reviewTime: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.4,
  },
  reviewContent: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    fontStyle: 'italic',
    color: colors.onSurface,
    lineHeight: 21,
    marginBottom: 14,
  },
  reviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 14,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  flagBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.onSurface,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.onPrimary,
  },

  // ── Empty state ──────────────────────────
  emptyWrap: {
    paddingTop: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  // ── Right panel ──────────────────────────
  rightPanel: {
    width: 300,
    paddingVertical: 20,
    paddingRight: 24,
    gap: 16,
  },

  // Sentiment card
  sentimentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    ...ambientShadow,
  },
  sentimentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sentimentTitle: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  sentimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sentimentTag: {
    width: 100,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },
  sentimentBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  sentimentBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sentimentPct: {
    width: 36,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
  },
  sentimentNote: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 18,
  },

  // Chats card
  chatsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    ...ambientShadow,
  },
  chatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chatsTitle: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  chatsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    fontSize: 14,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  chatInfo: { flex: 1 },
  chatName: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.onSurface,
  },
  chatPreview: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 1,
  },
  chatTime: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
  },
  goToMsgsBtn: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  goToMsgsText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    letterSpacing: 0.6,
  },
});
