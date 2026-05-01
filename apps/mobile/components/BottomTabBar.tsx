// ─────────────────────────────────────────────
// components/BottomTabBar.tsx
// Bottom tab bar for web navigation
// Full-width bar with centered tab items
// ─────────────────────────────────────────────

import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors as defaultColors, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useScrollBarVisibility } from "../hooks/useScrollBarVisibility";

interface Tab {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  memberOnly?: boolean;
  coachOnly?: boolean;
}

const FEED_TAB: Tab = { key: "feed", label: "Feed", icon: "newspaper-outline", iconActive: "newspaper", route: "Home" };

// Tabs rendered to the LEFT of the centered Feed tab
const LEFT_TABS: Tab[] = [
  { key: "journal", label: "Journal", icon: "book-outline", iconActive: "book", route: "Journal" },
  { key: "coach", label: "Coach", icon: "chatbubbles-outline", iconActive: "chatbubbles", route: "SpazeCoach", memberOnly: true },
  { key: "conversations", label: "Convos", icon: "people-outline", iconActive: "people", route: "SpazeConversations", coachOnly: true },
];

// Tabs rendered to the RIGHT of the centered Feed tab
const RIGHT_TABS: Tab[] = [
  { key: "review", label: "Review", icon: "clipboard-outline", iconActive: "clipboard", route: "ReviewQueue", coachOnly: true },
  { key: "notifications", label: "Alerts", icon: "notifications-outline" as any, iconActive: "notifications" as any, route: "Notifications" },
  { key: "profile", label: "Profile", icon: "person-outline", iconActive: "person" as any, route: "Profile" },
];

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isCoach?: boolean;
  unreadCount?: number;
  reviewCount?: number;
}

export default function BottomTabBar({ currentRoute, onNavigate, isCoach, unreadCount = 0, reviewCount = 0 }: Props) {
  const colors = useThemeStore((s) => s.colors);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const barsVisible = useScrollBarVisibility((s) => s.barsVisible);
  const triggerScrollToTop = useScrollBarVisibility((s) => s.triggerScrollToTop);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: barsVisible ? 0 : 80,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [barsVisible, translateY]);

  const visibleTabs = useMemo(() => {
    const filterFn = (tab: Tab) => {
      if (tab.coachOnly && !isCoach) return false;
      if (tab.memberOnly && isCoach) return false;
      return true;
    };
    const left = LEFT_TABS.filter(filterFn);
    const right = RIGHT_TABS.filter(filterFn);

    // Coaches/admins: Feed sits at the first position (no centered FAB)
    if (isCoach) {
      return [FEED_TAB, ...left, ...right];
    }

    // Members: balance left/right so Feed stays visually centered
    const diff = left.length - right.length;
    if (diff > 0) {
      const moved = left.splice(left.length - Math.floor(diff / 2), Math.floor(diff / 2));
      return [...left, FEED_TAB, ...moved, ...right];
    }
    if (diff < 0) {
      const moved = right.splice(0, Math.floor(-diff / 2));
      return [...left, ...moved, FEED_TAB, ...right];
    }
    return [...left, FEED_TAB, ...right];
  }, [isCoach]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.muted3, paddingBottom: Math.max(8, insets.bottom), transform: [{ translateY }] }]}>
      <View style={styles.inner}>
        {visibleTabs.map((tab) => {
          const active = currentRoute === tab.route;
          const isFeed = tab.key === 'feed';
          const handlePress = () => {
            if (active) {
              if (tab.route === "Profile") {
                onNavigate(tab.route);
              } else {
                triggerScrollToTop();
              }
            } else {
              onNavigate(tab.route);
            }
          };

          if (isFeed && !isCoach) {
            return (
              <View key={tab.key} style={[styles.tab, styles.feedTab]}>
                <TouchableOpacity
                  onPress={handlePress}
                  activeOpacity={0.85}
                  style={styles.feedFabWrapper}
                >
                  <LinearGradient
                    colors={[colors.primaryContainer, colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.feedFab, { borderColor: colors.card }]}
                  >
                    <Ionicons
                      name={active ? tab.iconActive : tab.icon}
                      size={26}
                      color={colors.onPrimary}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={handlePress}
              activeOpacity={0.7}
              style={styles.tab}
            >
              <View style={[styles.iconWrap, active && { backgroundColor: colors.primaryContainer + '1A' }]}>
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={22}
                  color={active ? colors.primary : colors.muted5}
                />
                {tab.key === 'notifications' && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
                {tab.key === 'review' && reviewCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {reviewCount > 99 ? '99+' : reviewCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: colors.muted5 },
                  active && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    paddingBottom: 8,
    paddingTop: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'visible' as const,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#1A0010',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
  inner: {
    flexDirection: "row",
    maxWidth: 680,
    width: "100%" as any,
    alignSelf: "center" as any,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    position: "relative",
    ...(Platform.OS === "web" ? { cursor: "pointer" } : {}),
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted5,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
  feedTab: {
    overflow: 'visible' as const,
  },
  feedFabWrapper: {
    marginTop: -36,
    borderRadius: 32,
    ...ambientShadow,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  feedFab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 4,
  },
  badge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
});
