// ─────────────────────────────────────────────
// screens/NotificationsScreen.tsx
// Display user notifications with read/unread states
// ─────────────────────────────────────────────

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  SectionList,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useUser } from '../hooks/useUser';
import { 
  apiGetNotifications, 
  apiMarkNotificationRead, 
  apiMarkAllNotificationsRead,
  apiGetPostById,
  resolveAvatarUrl,
} from '../services/api';
import type { Notification, Post } from '../../../packages/types';
import { colors as defaultColors, fonts, spacing, radii, ambientShadow } from '../constants/theme';
import { useThemeStore } from '../context/ThemeContext';
import { useScrollBarVisibility } from '../hooks/useScrollBarVisibility';
import { useBadgeStore } from '../hooks/useNotifications';

type NavigationType = DrawerNavigationProp<any>;

// ── Helpers ────────────────────────────────────────────────────

const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'REACTION':
      return 'heart';
    case 'COMMENT':
      return 'chatbubble';
    case 'ENCOURAGEMENT':
      return 'sparkles';
    case 'SYSTEM':
      return 'megaphone';
    case 'MESSAGE':
      return 'chatbubbles';
    default:
      return 'notifications';
  }
};

const getNotificationIconColor = (type: string): string => {
  switch (type) {
    case 'REACTION':
      return defaultColors.primary;
    case 'COMMENT':
      return defaultColors.secondary;
    case 'ENCOURAGEMENT':
      return defaultColors.tertiary;
    case 'SYSTEM':
      return defaultColors.onSurfaceVariant;
    case 'MESSAGE':
      return defaultColors.secondary;
    default:
      return defaultColors.primary;
  }
};

const getAvatarColor = (type: string): string => {
  switch (type) {
    case 'REACTION':
      return defaultColors.outlineVariant;
    case 'COMMENT':
      return defaultColors.secondaryFixed;
    case 'ENCOURAGEMENT':
      return defaultColors.surfaceContainerHigh;
    case 'MESSAGE':
      return defaultColors.secondaryFixed;
    default:
      return defaultColors.surfaceVariant;
  }
};

const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
};

const getDateSection = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return 'TODAY';
  if (itemDate.getTime() === yesterday.getTime()) return 'YESTERDAY';

  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / 86400000);
  if (diffDays < 7) return 'THIS WEEK';
  return 'EARLIER';
};

// ── Component ──────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { userId } = useUser();
  const navigation = useNavigation<NavigationType>();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setUnreadCount = useBadgeStore((s) => s.setUnreadCount);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900;
  const isMedium = width >= 600;
  const isSmall = width < 600;
  const sectionListRef = useRef<SectionList<Notification, { title: string; data: Notification[] }>>(null);
  const scrollToTopTrigger = useScrollBarVisibility((s) => s.scrollToTopTrigger);
  const scrollToTopRef = useRef(scrollToTopTrigger);

  useEffect(() => {
    if (scrollToTopTrigger > 0 && scrollToTopTrigger !== scrollToTopRef.current) {
      sectionListRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 0 });
    }
    scrollToTopRef.current = scrollToTopTrigger;
  }, [scrollToTopTrigger]);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const { notifications: data } = await apiGetNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    try {
      await apiMarkNotificationRead(notificationId, { userId });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await apiMarkAllNotificationsRead({ userId });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // MESSAGE notifications navigate directly to the conversation
    if (notification.type === 'MESSAGE') {
      const conversationId = notification.data?.conversationId;
      if (conversationId) {
        navigation.navigate('Chat', { conversationId });
      }
      return;
    }

    // Flagged content or targeted screen notifications → navigate directly
    const screen = notification.data?.screen;
    if (screen) {
      const target = screen === 'Journal' ? 'Home' : screen;
      navigation.navigate(target as any);
      return;
    }

    const postId = notification.data?.postId;
    if (postId) {
      try {
        const { post } = await apiGetPostById(postId);
        const navParams: any = {
          postId: post.id,
          openedFrom: 'notifications',
        };
        if (notification.data?.commentId) {
          navParams.highlightCommentId = notification.data.commentId;
        }
        navigation.navigate('PostDetail', navParams);
      } catch (error) {
        console.error('Failed to fetch post:', error);
        Alert.alert('Error', 'Could not load this post. It may have been removed.');
      }
      return;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;
    const q = searchQuery.toLowerCase();
    return notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
    );
  }, [notifications, searchQuery]);

  const sections = useMemo(() => {
    const grouped: Record<string, Notification[]> = {};
    const order = ['TODAY', 'YESTERDAY', 'THIS WEEK', 'EARLIER'];

    for (const n of filteredNotifications) {
      const section = getDateSection(n.createdAt);
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(n);
    }

    return order
      .filter((key) => grouped[key]?.length)
      .map((key) => ({ title: key, data: grouped[key] }));
  }, [filteredNotifications]);

  // ── Render notification card ─────────────────────────────────

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconName = getNotificationIcon(item.type);
    const iconColor = getNotificationIconColor(item.type);
    const avatarBg = getAvatarColor(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isSmall && styles.notificationCardSmall, isMedium && styles.notificationCardMd]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Avatar with badge icon */}
        <View style={styles.avatarContainer}>
          {item.data?.actorAvatarUrl ? (
            <Image
              source={{ uri: resolveAvatarUrl(item.data.actorAvatarUrl) }}
              style={[styles.avatar, { borderColor: colors.outlineVariant }, isSmall && styles.avatarSmall]}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatarBg }, isSmall && styles.avatarSmall]}>
              <Ionicons
                name={item.type === 'ENCOURAGEMENT' ? 'sparkles' : 'person'}
                size={isSmall ? 20 : 24}
                color={item.type === 'ENCOURAGEMENT' ? colors.tertiary : colors.onSurfaceVariant}
              />
            </View>
          )}
          <View style={[styles.avatarBadge, { backgroundColor: iconColor }, isSmall && styles.avatarBadgeSmall]}>
            <Ionicons name={iconName} size={isSmall ? 8 : 10} color="#FFFFFF" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.bodyText, !item.read && styles.bodyTextUnread, isSmall && styles.bodyTextSmall]} numberOfLines={2}>
            <Text style={[styles.titleBold, isSmall && styles.titleBoldSmall]}>{item.title}</Text>
            {' '}{item.body}
          </Text>
          <Text style={[styles.time, isSmall && styles.timeSmall]}>{formatRelativeTime(item.createdAt)}</Text>
        </View>

        {/* Unread dot */}
        {!item.read && <View style={[styles.unreadDot, isSmall && styles.unreadDotSmall]} />}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, isWide && styles.centeredContent, isSmall && styles.headerSmall]}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: colors.onSurface }, isSmall && styles.headerTitleSmall]}>Notifications</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, isWide && styles.centeredContent, isSmall && styles.headerSmall]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }, isSmall && styles.headerTitleSmall]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, isSmall && styles.badgeSmall]}>
              <Text style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>{unreadCount} New</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
        </View>

        {/* Search + actions row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, isSmall && styles.searchContainerSmall]}>
            <Ionicons name="search-outline" size={isSmall ? 14 : 16} color={colors.placeholder} />
            <TextInput
              style={[styles.searchInput, isSmall && styles.searchInputSmall]}
              placeholder="Search notification history..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity style={[styles.iconButton, isSmall && styles.iconButtonSmall]} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={isSmall ? 18 : 20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.iconButton, isSmall && styles.iconButtonSmall]}
              onPress={markAllAsRead}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done-outline" size={isSmall ? 18 : 20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={32} color={colors.card} />
          </View>
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll see reactions, comments, and encouragements here
          </Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={32} color={colors.placeholder} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>No results</Text>
          <Text style={styles.emptySubtext}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderNotification}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, isSmall && styles.listSmall]}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerSmall: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  headerTitleSmall: {
    fontSize: 24,
    marginBottom: 0,
  },
  badge: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: '#FFFFFF',
  },
  badgeTextSmall: {
    fontSize: 10,
  },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
  },
  searchContainerSmall: {
    height: 36,
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  searchInputSmall: {
    fontSize: 13,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.2,
    marginRight: 12,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.outlineVariant,
  },

  // Loading & empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Centered content for wide web
  centeredContent: {
    maxWidth: 900,
    alignSelf: 'center' as any,
    width: '100%' as any,
  },

  // List
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 80,
    ...(Platform.OS === 'web' ? { maxWidth: 900, alignSelf: 'center' as any, width: '100%' as any } : {}),
  },
  listSmall: {
    paddingHorizontal: spacing.md,
    paddingBottom: 70,
  },

  // Notification card
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  notificationCardSmall: {
    padding: 10,
    borderRadius: 16,
    marginBottom: 6,
  },
  notificationCardMd: {
    padding: 16,
  },

  // Avatar
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  avatarSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
  avatarBadgeSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  // Content
  content: {
    flex: 1,
  },
  bodyText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  bodyTextUnread: {
    color: colors.onSurface,
  },
  bodyTextSmall: {
    fontSize: 13,
    lineHeight: 18,
  },
  titleBold: {
    fontFamily: fonts.bodyBold,
    color: colors.onSurface,
  },
  titleBoldSmall: {
    fontSize: 13,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  timeSmall: {
    fontSize: 11,
    marginTop: 2,
  },

  // Unread dot
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: 10,
  },
  unreadDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
