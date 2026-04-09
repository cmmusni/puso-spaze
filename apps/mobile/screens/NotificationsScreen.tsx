// ─────────────────────────────────────────────
// screens/NotificationsScreen.tsx
// Display user notifications with read/unread states
// ─────────────────────────────────────────────

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  SectionList,
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
} from '../services/api';
import type { Notification, Post } from '../../../packages/types';
import { colors, fonts } from '../constants/theme';

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
    default:
      return 'notifications';
  }
};

const getNotificationIconColor = (type: string): string => {
  switch (type) {
    case 'REACTION':
      return colors.primary;
    case 'COMMENT':
      return colors.secondary;
    case 'ENCOURAGEMENT':
      return colors.tertiary;
    case 'SYSTEM':
      return colors.onSurfaceVariant;
    default:
      return colors.primary;
  }
};

const getAvatarColor = (type: string): string => {
  switch (type) {
    case 'REACTION':
      return colors.outlineVariant;
    case 'COMMENT':
      return colors.secondaryFixed;
    case 'ENCOURAGEMENT':
      return colors.surfaceContainerHigh;
    default:
      return colors.surfaceVariant;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    const postId = notification.data?.postId;
    if (!postId) return;

    try {
      const { post } = await apiGetPostById(postId);
      navigation.navigate('PostDetail', {
        postId: post.id,
        openedFrom: 'notifications',
      });
    } catch (error) {
      console.error('Failed to fetch post:', error);
      Alert.alert('Error', 'Could not load this post. It may have been removed.');
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
        style={styles.notificationCard}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Avatar with badge icon */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Ionicons
              name={item.type === 'ENCOURAGEMENT' ? 'sparkles' : 'person'}
              size={24}
              color={item.type === 'ENCOURAGEMENT' ? colors.tertiary : colors.onSurfaceVariant}
            />
          </View>
          <View style={[styles.avatarBadge, { backgroundColor: iconColor }]}>
            <Ionicons name={iconName} size={10} color="#FFFFFF" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.bodyText, !item.read && styles.bodyTextUnread]} numberOfLines={2}>
            <Text style={styles.titleBold}>{item.title}</Text>
            {' '}{item.body}
          </Text>
          <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
        </View>

        {/* Unread dot */}
        {!item.read && <View style={styles.unreadDot} />}
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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount} New</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
        </View>

        {/* Search + actions row */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={16} color={colors.placeholder} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notification history..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={markAllAsRead}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={colors.onSurfaceVariant} />
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
          sections={sections}
          renderItem={renderNotification}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.background,
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
  badge: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: '#FFFFFF',
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
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

  // List
  list: {
    padding: 16,
    paddingBottom: 32,
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
  titleBold: {
    fontFamily: fonts.bodyBold,
    color: colors.onSurface,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },

  // Unread dot
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: 10,
  },
});
