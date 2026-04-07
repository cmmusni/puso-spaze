import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useUserStore } from "../context/UserContext";

const NAV_ITEMS = [
  { key: "feed", label: "Feed", icon: "newspaper-outline" as any, iconActive: "newspaper" as any, route: "Home" },
  { key: "community", label: "Community", icon: "people-outline" as any, iconActive: "people" as any, route: "Home" },
  { key: "review", label: "Review Queue", icon: "clipboard-outline" as any, iconActive: "clipboard" as any, route: "ReviewQueue", coachOnly: true },
  { key: "profile", label: "Profile", icon: "person-outline" as any, iconActive: "person" as any, route: "Profile" },
];

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export default function WebSidebar({ currentRoute, onNavigate }: Props) {
  const { role, logoutUser } = useUserStore();
  const isCoach = role === "COACH" || role === "ADMIN";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.darkest, colors.deep]}
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
          <Text style={styles.brandName}>PUSOSpaze</Text>
          <Text style={styles.brandSub}>YOUR SACRED SPACE</Text>
        </View>
      </View>

      <View style={styles.navSection}>
        {NAV_ITEMS.filter((item) => {
          if (item.coachOnly && !isCoach) return false;
          return true;
        }).map((item) => {
          const active = currentRoute === item.route && item.key !== "community";
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
    width: 200,
    height: "100%" as any,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 12,
  },
  brandSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  brandLogo: { width: 32, height: 32 },
  brandName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.card,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    marginTop: 1,
  },
  navSection: { gap: 2 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  navItemActive: { backgroundColor: colors.primary },
  navLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  navLabelActive: { color: colors.card, fontWeight: "700" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
});
