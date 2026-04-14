// ─────────────────────────────────────────────
// components/BottomTabBar.tsx
// Bottom tab bar for web navigation
// Full-width bar with centered tab items
// ─────────────────────────────────────────────

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as defaultColors } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";

interface Tab {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  memberOnly?: boolean;
  coachOnly?: boolean;
}

const TABS: Tab[] = [
  { key: "feed", label: "Feed", icon: "newspaper-outline", iconActive: "newspaper", route: "Home" },
  { key: "journal", label: "Journal", icon: "book-outline", iconActive: "book", route: "Journal" },
  { key: "coach", label: "Coach", icon: "chatbubbles-outline", iconActive: "chatbubbles", route: "SpazeCoach", memberOnly: true },
  { key: "conversations", label: "Convos", icon: "people-outline", iconActive: "people", route: "SpazeConversations", coachOnly: true },
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
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const visibleTabs = TABS.filter((tab) => {
    if (tab.coachOnly && !isCoach) return false;
    if (tab.memberOnly && isCoach) return false;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.muted3 }, isTablet && styles.containerTablet]}>
      <View style={[styles.inner, isTablet && styles.innerTablet]}>
        {visibleTabs.map((tab) => {
          const active = currentRoute === tab.route;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onNavigate(tab.route)}
              activeOpacity={0.7}
              style={styles.tab}
            >
              <View style={{ position: 'relative' }}>
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
              <Text style={[styles.label, { color: colors.muted5 }, active && { color: colors.primary, fontWeight: "700" }]}>
                {tab.label}
              </Text>
              {active && <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.muted3,
    paddingBottom: 8,
    paddingTop: 8,
    ...(Platform.OS === "web" ? { position: "sticky" as any, bottom: 0, left: 0, right: 0, zIndex: 100 } : {}),
  },
  containerTablet: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 10,
  },
  inner: {
    flexDirection: "row",
    maxWidth: 680,
    width: "100%" as any,
    alignSelf: "center" as any,
  },
  innerTablet: {
    maxWidth: 560,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    position: "relative",
    ...(Platform.OS === "web" ? { cursor: "pointer" } : {}),
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted5,
    marginTop: 2,
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
  badge: {
    position: 'absolute' as const,
    top: -6,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
});
