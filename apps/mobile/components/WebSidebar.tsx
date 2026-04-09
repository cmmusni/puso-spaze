import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useUserStore } from "../context/UserContext";

const NAV_ITEMS = [
  { key: "feed", label: "Feed", icon: "home-outline" as any, iconActive: "home" as any, route: "Home", isDefault: true },
  { key: "journal", label: "Journal", icon: "book-outline" as any, iconActive: "book" as any, route: "Journal" },
  // { key: "resources", label: "Resources", icon: "library-outline" as any, iconActive: "library" as any, route: "Home" },
  { key: "coach", label: "Spaze Coach", icon: "chatbubbles-outline" as any, iconActive: "chatbubbles" as any, route: "SpazeCoach" },
  { key: "conversations", label: "Conversations", icon: "people-outline" as any, iconActive: "people" as any, route: "SpazeConversations" },
  { key: "review", label: "Coach Dashboard", icon: "clipboard-outline" as any, iconActive: "clipboard" as any, route: "ReviewQueue", coachOnly: true },
  { key: "profile", label: "Profile", icon: "person-outline" as any, iconActive: "person" as any, route: "Profile" },
  { key: "notifications", label: "Notifications", icon: "notifications-outline" as any, iconActive: "notifications" as any, route: "Notifications" },
];

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export default function WebSidebar({ currentRoute, onNavigate }: Props) {
  const { role, logoutUser } = useUserStore();
  const { colors: themeColors } = useThemeStore();
  const isCoach = role === "COACH" || role === "ADMIN";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[themeColors.primaryContainer, themeColors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.brandSection}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.brandName}>PUSO Spaze</Text>
          <Text style={styles.brandSub}>YOUR SAFE SPACE</Text>
        </View>
      </View>

      <View style={styles.navSection}>
        {NAV_ITEMS.filter((item) => {
          if (item.coachOnly && !isCoach) return false;
          return true;
        }).map((item) => {
          const active = item.isDefault
            ? currentRoute === "Home"
            : currentRoute === item.route && !item.isDefault && item.key !== "feed" && item.key !== "resources";
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onNavigate(item.route)}
              activeOpacity={0.7}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={18}
                color={active ? colors.card : "rgba(255,255,255,0.6)"}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        onPress={logoutUser}
        activeOpacity={0.7}
        style={styles.signOutBtn}
      >
        <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.5)" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 250,
    height: "100%" as any,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  brandSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 40,
  },
  brandLogo: { width: 34, height: 34 },
  brandName: {
    fontSize: 17,
    fontFamily: fonts.displayExtraBold,
    color: colors.onPrimary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 8,
    fontFamily: fonts.bodySemiBold,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 2,
    marginTop: 2,
  },
  navSection: { gap: 6 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  navItemActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  navLabel: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: "rgba(255,255,255,0.6)",
  },
  navLabelActive: { color: colors.onPrimary, fontFamily: fonts.bodySemiBold },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: "rgba(255,255,255,0.45)",
  },
});
