// ─────────────────────────────────────────────
// components/BottomTabBar.tsx
// Bottom tab bar for web navigation
// Full-width bar with centered tab items
// ─────────────────────────────────────────────

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";

interface Tab {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
}

const TABS: Tab[] = [
  { key: "feed", label: "Feed", icon: "newspaper-outline", iconActive: "newspaper", route: "Home" },
  { key: "journal", label: "Journal", icon: "book-outline", iconActive: "book", route: "Journal" },
  { key: "coach", label: "Coach", icon: "chatbubbles-outline", iconActive: "chatbubbles", route: "SpazeCoach" },
  { key: "conversations", label: "Convos", icon: "people-outline", iconActive: "people", route: "SpazeConversations" },
  { key: "alerts", label: "Alerts", icon: "notifications-outline", iconActive: "notifications", route: "Notifications" },
  { key: "review", label: "Review", icon: "clipboard-outline", iconActive: "clipboard", route: "ReviewQueue" },
  { key: "profile", label: "Profile", icon: "person-outline", iconActive: "person", route: "Profile" },
];

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isCoach?: boolean;
}

export default function BottomTabBar({ currentRoute, onNavigate, isCoach }: Props) {
  const { colors: themeColors } = useThemeStore();
  if (Platform.OS !== "web") return null;

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === "review" && !isCoach) return false;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderTopColor: themeColors.muted3 }]}>
      <View style={styles.inner}>
        {visibleTabs.map((tab) => {
          const active = currentRoute === tab.route;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onNavigate(tab.route)}
              activeOpacity={0.7}
              style={styles.tab}
            >
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? themeColors.primary : themeColors.muted5}
              />
              <Text style={[styles.label, { color: themeColors.muted5 }, active && { color: themeColors.primary, fontWeight: "700" }]}>
                {tab.label}
              </Text>
              {active && <View style={[styles.activeDot, { backgroundColor: themeColors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.muted3,
    paddingBottom: 8,
    paddingTop: 8,
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
});
