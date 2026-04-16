// ─────────────────────────────────────────────
// screens/CoachDashboard.tsx
// PUSO Coach review dashboard — Sacred Journal design
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  StatusBar,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { colors as defaultColors, fonts, radii, ambientShadow } from '../constants/theme';
import { useThemeStore } from '../context/ThemeContext';
import { useUserStore } from '../context/UserContext';
import {
  apiGetReviewQueue,
  apiModeratePost,
  apiModerateComment,
  apiDeletePost,
  apiDeleteComment,
  apiGetDashboardStats,
  apiFetchConversations,
  apiGetRecoveryRequests,
  apiReviewRecovery,
  apiAdminGenerateInviteCodes,
  apiAdminListInviteCodes,
  apiAdminSendInviteByEmail,
  getBaseUrl,
} from '../services/api';
import type { DashboardStats } from '../services/api';
import { showAlert, showConfirm } from '../utils/alertPlatform';
import type { Post, Comment, Conversation, RecoveryRequest, InviteCode } from '../../../packages/types';
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
    [defaultColors.primary, defaultColors.secondary],
    [defaultColors.gradientStart, defaultColors.gradientEnd],
    [defaultColors.secondary, defaultColors.tertiary],
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
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const s = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isNarrow = width < 500;

  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const isAdmin = role === 'ADMIN';

  // ── Invite state (admin only) ─────────────
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInviteCodes, setShowInviteCodes] = useState(false);

  // ── Fetch data ────────────────────────────

  const fetchAll = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const [queue, dashStats, convos, recoveryRes] = await Promise.all([
        apiGetReviewQueue(userId),
        apiGetDashboardStats(),
        apiFetchConversations(userId),
        apiGetRecoveryRequests(userId),
      ]);
      setPosts(queue.posts);
      setComments(queue.comments);
      setStats(dashStats);
      setConversations(convos.conversations.slice(0, 3));
      setRecoveryRequests(recoveryRes.requests);

      // Fetch invite codes for admin
      if (role === 'ADMIN') {
        try {
          const invRes = await apiAdminListInviteCodes();
          setInviteCodes(invRes.codes);
        } catch { /* non-critical */ }
      }
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

  const deletePost = async (postId: string) => {
    if (!userId) return;
    setActing(postId);
    try {
      await apiDeletePost(postId, userId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not delete post.';
      showAlert('Error', msg);
    } finally { setActing(null); }
  };

  const deleteComment = async (commentId: string, postId: string) => {
    if (!userId) return;
    setActing(commentId);
    try {
      await apiDeleteComment(postId, commentId, userId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not delete comment.';
      showAlert('Error', msg);
    } finally { setActing(null); }
  };

  // ── Recovery actions ──────────────────────

  const handleRecovery = async (requestId: string, action: 'approve' | 'deny') => {
    if (!userId) return;
    const label = action === 'approve' ? 'Approve' : 'Deny';
    const confirmed = await showConfirm(
      `${label} Recovery?`,
      action === 'approve'
        ? 'This will clear the device binding so the user can log in from any device. Are you sure?'
        : 'This will reject the recovery request. The user will need to submit a new one.'
    );
    if (!confirmed) return;

    setActing(requestId);
    try {
      await apiReviewRecovery(requestId, { coachId: userId, action });
      setRecoveryRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not process recovery request.';
      showAlert('Error', msg);
    } finally { setActing(null); }
  };

  // ── Invite actions (admin only) ───────────

  const handleGenerateCode = async () => {
    setInviteLoading(true);
    try {
      const res = await apiAdminGenerateInviteCodes(1);
      showAlert('Invite Code Generated', `Code: ${res.codes[0]}`);
      const invRes = await apiAdminListInviteCodes();
      setInviteCodes(invRes.codes);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to generate invite code.';
      showAlert('Error', msg);
    } finally { setInviteLoading(false); }
  };

  const handleSendInviteEmail = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      showAlert('Error', 'Please enter an email address.');
      return;
    }
    setInviteLoading(true);
    try {
      const res = await apiAdminSendInviteByEmail(email);
      showAlert('Invite Sent', `Invite code sent to ${res.email}`);
      setInviteEmail('');
      const invRes = await apiAdminListInviteCodes();
      setInviteCodes(invRes.codes);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to send invite.';
      showAlert('Error', msg);
    } finally { setInviteLoading(false); }
  };

  // ── Derived data ──────────────────────────
  const pendingCount = posts.length + comments.length;
  const flaggedCount = posts.filter(p => p.moderationStatus === 'FLAGGED').length
    + comments.filter(c => c.moderationStatus === 'FLAGGED').length;
  const unusedCodes = inviteCodes.filter((c) => !c.used);
  const usedCodes = inviteCodes.filter((c) => c.used);

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
      <Text style={s.statValue}>{value}</Text>
    </View>
  );

  const renderReviewCard = (item: Post | Comment, type: 'post' | 'comment') => {
    const isBusy = acting === item.id;
    const author = item.user?.displayName ?? 'Anonymous';
    const isAnonymous = (item as any).isAnonymous;
    const displayAuthor = isAnonymous ? (item as any).anonDisplayName ?? 'Anonymous Member' : author;
    const tags = type === 'post' ? ((item as Post).tags ?? []) : [];
    const postRef = type === 'comment' ? (item as Comment).post : null;
    const isFlagged = item.moderationStatus === 'FLAGGED';

    return (
      <View key={item.id} style={s.reviewCard}>
        {/* Header */}
        <View style={s.reviewHeader}>
          <View style={s.reviewAuthorRow}>
            <View style={s.reviewAvatar}>
              <Ionicons name="person-outline" size={16} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.authorStatusRow}>
                <Text style={s.reviewAuthor}>{displayAuthor}</Text>
                {isFlagged && (
                  <View style={s.flaggedBadge}>
                    <Ionicons name="flag" size={10} color={colors.danger} />
                    <Text style={s.flaggedBadgeText}>FLAGGED</Text>
                  </View>
                )}
              </View>
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
          {isFlagged ? (
            <>
              <TouchableOpacity
                onPress={() => type === 'post' ? deletePost(item.id) : deleteComment(item.id, (item as Comment).postId)}
                disabled={isBusy}
                style={s.deleteBtn}
              >
                {isBusy ? <ActivityIndicator size="small" color={colors.danger} /> : (
                  <Text style={s.deleteBtnText}>Delete</Text>
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
            </>
          ) : (
            <>
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
            </>
          )}
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
            {(() => {
              const tags = (stats?.trendingTags ?? []).slice(0, 3);
              const maxCount = Math.max(...tags.map((t) => t.count), 1);
              return tags.map((item) => {
                const tc = getTagColor(item.tag);
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <View key={item.tag} style={s.sentimentRow}>
                    <Text style={[s.sentimentTag, { color: tc.text }]}>#{item.tag}</Text>
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
              });
            })()}
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
          onPress={() => (navigation as any).navigate('SpazeConversations')}
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
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allItems = [
    ...posts.map(p => ({ ...p, _type: 'post' as const })),
    ...comments.map(c => ({ ...c, _type: 'comment' as const })),
  ].sort((a, b) => {
    // REVIEW items first, FLAGGED items last
    const aFlagged = a.moderationStatus === 'FLAGGED' ? 1 : 0;
    const bFlagged = b.moderationStatus === 'FLAGGED' ? 1 : 0;
    if (aFlagged !== bFlagged) return aFlagged - bFlagged;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // ── Main render ───────────────────────────

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

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
              'Flagged Content',
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
          </View>

          {allItems.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Ionicons name="checkmark-done-outline" size={28} color={colors.onPrimary} />
              </View>
              <Text style={s.emptyTitle}>All clear!</Text>
              <Text style={s.emptySubtitle}>No posts or comments waiting for review.</Text>
            </View>
          ) : (
            allItems.map((item) => renderReviewCard(item, item._type))
          )}

          {/* ── Recovery Requests ── */}
          {recoveryRequests.length > 0 && (
            <>
              <View style={s.queueHeader}>
                <View style={s.queueTitleRow}>
                  <Text style={[s.queueTitle, isNarrow && s.queueTitleNarrow]}>Account Recovery</Text>
                  <View style={[s.queueBadge, { backgroundColor: colors.warningBg }]}>
                    <Text style={[s.queueBadgeText, { color: colors.warningText }]}>{recoveryRequests.length} Pending</Text>
                  </View>
                </View>
              </View>
              {recoveryRequests.map((req) => {
                const isBusy = acting === req.id;
                const history = req.userHistory;
                return (
                  <View key={req.id} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <View style={s.reviewAuthorRow}>
                        <View style={[s.reviewAvatar, { backgroundColor: colors.warningBg }]}>
                          <Ionicons name="key-outline" size={16} color={colors.warningText} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.reviewAuthor}>{req.displayName}</Text>
                          <Text style={s.reviewTime}>
                            Requested {formatRelativeTime(req.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.reviewContent}>"{req.reason}"</Text>

                    {/* Identity verification: user's post/journal history */}
                    {history && (history.posts.length > 0 || history.journals.length > 0) && (
                      <View style={s.recoveryHistory}>
                        <Text style={s.recoveryHistoryTitle}>
                          <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                          {' '}Identity Verification
                        </Text>
                        {history.accountAge && (
                          <Text style={s.recoveryHistoryItem}>
                            Account created: {new Date(history.accountAge).toLocaleDateString()}
                          </Text>
                        )}
                        {history.posts.length > 0 && (
                          <>
                            <Text style={s.recoveryHistoryLabel}>Recent posts:</Text>
                            {history.posts.slice(0, 3).map((p, i) => (
                              <Text key={i} style={s.recoveryHistoryItem} numberOfLines={2}>
                                • "{p.content.slice(0, 80)}{p.content.length > 80 ? '…' : ''}"
                              </Text>
                            ))}
                          </>
                        )}
                        {history.journals.length > 0 && (
                          <>
                            <Text style={s.recoveryHistoryLabel}>Recent journals:</Text>
                            {history.journals.slice(0, 3).map((j, i) => (
                              <Text key={i} style={s.recoveryHistoryItem}>
                                • {j.title} {j.mood ? `(${j.mood})` : ''}
                              </Text>
                            ))}
                          </>
                        )}
                      </View>
                    )}

                    <View style={s.reviewActions}>
                      <TouchableOpacity
                        onPress={() => handleRecovery(req.id, 'deny')}
                        disabled={isBusy}
                        style={s.flagBtn}
                      >
                        {isBusy ? <ActivityIndicator size="small" color={colors.onSurface} /> : (
                          <Text style={s.flagBtnText}>Deny</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRecovery(req.id, 'approve')}
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
              })}
            </>
          )}

          {/* ── Invite Coaches (Admin only) ── */}
          {isAdmin && (
            <>
              <View style={s.queueHeader}>
                <View style={s.queueTitleRow}>
                  <Text style={[s.queueTitle, isNarrow && s.queueTitleNarrow]}>Invite Coaches</Text>
                  <View style={[s.queueBadge, { backgroundColor: colors.secondaryFixed }]}>
                    <Text style={[s.queueBadgeText, { color: colors.onSecondaryFixed }]}>
                      {unusedCodes.length} available
                    </Text>
                  </View>
                </View>
              </View>

              {/* Send invite by email */}
              <View style={s.inviteCard}>
                <View style={s.inviteCardHeader}>
                  <View style={[s.inviteIconWrap, { backgroundColor: colors.primary + '18' }]}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={s.inviteCardTitle}>Send Invite by Email</Text>
                </View>
                <View style={s.inviteEmailRow}>
                  <TextInput
                    style={[s.inviteEmailInput, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface }]}
                    placeholder="coach@example.com"
                    placeholderTextColor={colors.muted4}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!inviteLoading}
                  />
                  <TouchableOpacity
                    style={[s.inviteSendBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSendInviteEmail}
                    disabled={inviteLoading}
                    activeOpacity={0.8}
                  >
                    {inviteLoading ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <>
                        <Ionicons name="send" size={14} color={colors.onPrimary} />
                        <Text style={[s.inviteSendBtnText, { color: colors.onPrimary }]}>Send</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Generate code */}
              <View style={s.inviteCard}>
                <View style={s.inviteCardHeader}>
                  <View style={[s.inviteIconWrap, { backgroundColor: colors.secondary + '18' }]}>
                    <Ionicons name="key-outline" size={20} color={colors.secondary} />
                  </View>
                  <Text style={s.inviteCardTitle}>Generate Invite Code</Text>
                </View>
                <Text style={s.inviteHint}>
                  Generate a code to share manually with a new coach.
                </Text>
                <TouchableOpacity
                  style={[s.inviteGenerateBtn, { borderColor: colors.primary }]}
                  onPress={handleGenerateCode}
                  disabled={inviteLoading}
                  activeOpacity={0.8}
                >
                  {inviteLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                      <Text style={[s.inviteGenerateBtnText, { color: colors.primary }]}>Generate Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Code list toggle */}
              {inviteCodes.length > 0 && (
                <TouchableOpacity
                  style={s.inviteToggle}
                  onPress={() => setShowInviteCodes((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showInviteCodes ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[s.inviteToggleText, { color: colors.primary }]}>
                    {showInviteCodes ? 'Hide' : 'Show'} all codes ({inviteCodes.length})
                  </Text>
                </TouchableOpacity>
              )}

              {showInviteCodes && inviteCodes.length > 0 && (
                <View style={s.inviteCodeList}>
                  {inviteCodes.map((code) => (
                    <View
                      key={code.id}
                      style={[
                        s.inviteCodeRow,
                        { backgroundColor: code.used ? colors.surfaceContainerHigh : colors.surface },
                      ]}
                    >
                      <Text
                        style={[
                          s.inviteCodeText,
                          { color: code.used ? colors.muted4 : colors.onSurface },
                          code.used && s.inviteCodeUsed,
                        ]}
                      >
                        {code.code}
                      </Text>
                      {code.used ? (
                        <View style={[s.inviteStatusBadge, { backgroundColor: colors.surfaceVariant }]}>
                          <Text style={[s.inviteStatusText, { color: colors.muted5 }]}>Used</Text>
                        </View>
                      ) : (
                        <View style={[s.inviteStatusBadge, { backgroundColor: colors.safe + '20' }]}>
                          <Text style={[s.inviteStatusText, { color: colors.safe }]}>Available</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
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
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
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
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  statCard: {
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
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
  authorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flaggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.danger + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  flaggedBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: colors.danger,
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
  deleteBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.danger + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.danger,
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

  // ── Recovery history ──────────────────────
  recoveryHistory: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  recoveryHistoryTitle: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 6,
  },
  recoveryHistoryLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurface,
    marginTop: 6,
    marginBottom: 2,
  },
  recoveryHistoryItem: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
    marginLeft: 4,
  },

  // ── Invite Coaches (admin) ────────────────
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 12,
    ...ambientShadow,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  inviteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCardTitle: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  inviteEmailRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inviteEmailInput: {
    flex: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
  },
  inviteSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  inviteSendBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  inviteHint: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginBottom: 12,
    lineHeight: 19,
  },
  inviteGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  inviteGenerateBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  inviteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 4,
  },
  inviteToggleText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  inviteCodeList: {
    gap: 6,
    marginBottom: 16,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inviteCodeText: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    letterSpacing: 1,
  },
  inviteCodeUsed: {
    textDecorationLine: 'line-through',
  },
  inviteStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  inviteStatusText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
  },
});
