// ─────────────────────────────────────────────
// navigation/MainDrawerNavigator.tsx
// Unified drawer navigator for all users
// Shows/hides navigation items based on user role
// On web: adds bottom tab bar for quick navigation
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CoachDashboard from "../screens/CoachDashboard";
import SendInviteScreen from "../screens/SendInviteScreen";
import PostScreen from "../screens/PostScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import JournalScreen from "../screens/JournalScreen";
import SpazeCoachScreen from "../screens/SpazeCoachScreen";
import SpazeConversationsScreen from "../screens/SpazeConversationsScreen";
import ChatScreen from "../screens/ChatScreen";
import BottomTabBar from "../components/BottomTabBar";
import WebSidebar from "../components/WebSidebar";
import { useUserStore } from "../context/UserContext";
import { useNotifications } from "../hooks/useNotifications";
import { useBadgeStore } from "../hooks/useNotifications";
import { apiGetReviewQueue } from "../services/api";
import { colors, fonts, radii } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import type { Post } from "../../../packages/types";

// ── Param list ────────────────────────────────
export type MainDrawerParamList = {
  Home: { highlightPostId?: string } | undefined;
  Profile: { userId?: string } | undefined;
  ReviewQueue: undefined;
  SendInvite: undefined;
  Post: undefined;
  PostDetail: { postId?: string; post?: Post; openedFrom?: "notifications" };
  Notifications: undefined;
  Journal: { highlightJournalId?: string; scrollToPastEntries?: boolean } | undefined;
  SpazeCoach: undefined;
  SpazeConversations: undefined;
  Chat: { conversationId: string };
};

const Drawer = createDrawerNavigator<MainDrawerParamList>();

// ── Drawer nav items (mirrors WebSidebar) ─────
const DRAWER_NAV_ITEMS = [
  { key: "feed", label: "Feed", icon: "newspaper-outline" as const, iconActive: "newspaper" as const, route: "Home" as keyof MainDrawerParamList, isDefault: true },
  { key: "journal", label: "Journal", icon: "book-outline" as const, iconActive: "book" as const, route: "Journal" as keyof MainDrawerParamList },
  { key: "coach", label: "Spaze Coach", icon: "chatbubbles-outline" as const, iconActive: "chatbubbles" as const, route: "SpazeCoach" as keyof MainDrawerParamList, memberOnly: true },
  { key: "conversations", label: "Spaze Conversations", icon: "people-outline" as const, iconActive: "people" as const, route: "SpazeConversations" as keyof MainDrawerParamList, coachOnly: true },
  { key: "review", label: "Coach Dashboard", icon: "clipboard-outline" as const, iconActive: "clipboard" as const, route: "ReviewQueue" as keyof MainDrawerParamList, coachOnly: true },
  { key: "notifications", label: "Notifications", icon: "notifications-outline" as const, iconActive: "notifications" as const, route: "Notifications" as keyof MainDrawerParamList },
  { key: "profile", label: "Profile", icon: "person-outline" as const, iconActive: "person" as const, route: "Profile" as keyof MainDrawerParamList },
];

// ── Custom drawer content ─────────────────────
function CustomDrawerContent({
  navigation,
  state,
}: DrawerContentComponentProps) {
  const { role, logoutUser } = useUserStore();
  const { colors: themeColors } = useThemeStore();
  const isCoach = role === "COACH" || role === "ADMIN";
  const currentRoute = state.routes[state.index].name;

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.drawerRoot}
      scrollEnabled={false}
    >
      {/* Gradient fill */}
      <LinearGradient
        colors={[themeColors.primaryContainer, themeColors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Brand header ── */}
      <View style={styles.brandSection}>
        <View>
          <Text style={styles.brandName}>PUSO Spaze</Text>
          <Text style={styles.brandSub}>YOUR ANONYMOUS HEART SPACE</Text>
        </View>
      </View>

      {/* ── Navigation items ── */}
      <View style={styles.navSection}>
        {DRAWER_NAV_ITEMS.filter((item) => {
          if (item.coachOnly && !isCoach) return false;
          if (item.memberOnly && isCoach) return false;
          return true;
        }).map((item) => {
          const active = item.isDefault
            ? currentRoute === "Home"
            : currentRoute === item.route;
          return (
            <Pressable
              key={item.key}
              onPress={() => navigation.navigate(item.route)}
              style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && { opacity: 0.7 }]}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={18}
                color={active ? colors.card : "rgba(255,255,255,0.6)"}
              />
              <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Sign Out ── */}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={logoutUser}
        style={({ pressed }) => [styles.signOutItem, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.5)" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* Bottom safe-area padding */}
      <View style={{ height: Platform.OS === "ios" ? 24 : 12 }} />
    </DrawerContentScrollView>
  );
}

// ── Screen wrapper with bottom tabs (web only) ──
function ScreenWithTabs({
  children,
  currentRoute,
  navigation,
}: {
  children: React.ReactNode;
  currentRoute: string;
  navigation: any;
}) {
  const role = useUserStore((s) => s.role);
  const userId = useUserStore((s) => s.userId);
  const isCoach = role === "COACH" || role === "ADMIN";
  const { unreadCount } = useNotifications(userId);
  const reviewCount = useBadgeStore((s) => s.reviewCount);
  const setReviewCount = useBadgeStore((s) => s.setReviewCount);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  // Fetch review queue count for coaches
  useEffect(() => {
    if (!isCoach || !userId) return;
    let active = true;
    const fetchCount = () => {
      apiGetReviewQueue(userId)
        .then((res) => { if (active) setReviewCount(res.posts.length + res.comments.length); })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, [isCoach, userId]);

  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <WebSidebar
          currentRoute={currentRoute}
          onNavigate={(route) => navigation.navigate(route)}
        />
        <View style={{ flex: 100, minWidth: 600 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      <BottomTabBar
        currentRoute={currentRoute}
        onNavigate={(route) => navigation.navigate(route)}
        isCoach={isCoach}
        unreadCount={unreadCount}
        reviewCount={reviewCount}
      />
    </View>
  );
}

function withTabs(Screen: React.ComponentType<any>, routeName: string) {
  return function TabWrappedScreen(props: any) {
    return (
      <ScreenWithTabs currentRoute={routeName} navigation={props.navigation}>
        <Screen {...props} />
      </ScreenWithTabs>
    );
  };
}

// ── Pre-built wrapped screens (stable references) ──
// Called at module level so component identity never changes on re-render.
// This prevents screens from unmounting/remounting when the navigator
// re-renders (e.g. keyboard open changes viewport height on mobile web).
const HomeWithTabs = withTabs(HomeScreen, "Home");
const ProfileWithTabs = withTabs(ProfileScreen, "Profile");
const CoachDashboardWithTabs = withTabs(CoachDashboard, "ReviewQueue");
const NotificationsWithTabs = withTabs(NotificationsScreen, "Notifications");
const JournalWithTabs = withTabs(JournalScreen, "Journal");
const SpazeCoachWithTabs = withTabs(SpazeCoachScreen, "SpazeCoach");
const SpazeConversationsWithTabs = withTabs(SpazeConversationsScreen, "SpazeConversations");

// ── Drawer navigator ──────────────────────────
export default function MainDrawerNavigator() {
  const role = useUserStore((s) => s.role);
  const isCoach = role === "COACH" || role === "ADMIN";
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= 900;

  return (
    <Drawer.Navigator
      initialRouteName={isCoach ? "ReviewQueue" : "Home"}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: isWideWeb
          ? { width: 0 }
          : { width: 280, backgroundColor: "transparent" },
        overlayColor: "rgba(0,0,0,0.55)",
        drawerType: "slide",
        swipeEdgeWidth: isWideWeb ? 0 : 60,
      }}
    >
      {/* All screens are always defined - shown/hidden via drawer content */}
      <Drawer.Screen
        name="Home"
        component={HomeWithTabs}
        options={{ title: "PUSO Spaze \u2014 Feed" }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileWithTabs}
        options={{ title: "PUSO Spaze \u2014 Profile" }}
      />
      <Drawer.Screen
        name="ReviewQueue"
        component={CoachDashboardWithTabs}
        options={{ title: "PUSO Spaze \u2014 Coach Dashboard" }}
      />
      <Drawer.Screen
        name="SendInvite"
        component={SendInviteScreen}
        options={{ title: "PUSO Spaze \u2014 Admin Settings" }}
      />
      <Drawer.Screen
        name="Post"
        component={PostScreen}
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsWithTabs}
        options={{
          title: "PUSO Spaze \u2014 Notifications",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Journal"
        component={JournalWithTabs}
        options={{
          title: "PUSO Spaze \u2014 My Journal",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="SpazeCoach"
        component={SpazeCoachWithTabs}
        options={{
          title: "PUSO Spaze \u2014 Spaze Coach",
          headerShown: false,
        }}
      />
      {isCoach && (
        <Drawer.Screen
          name="SpazeConversations"
          component={SpazeConversationsWithTabs}
          options={{
            title: "PUSO Spaze \u2014 Spaze Conversations",
            headerShown: false,
          }}
        />
      )}
      <Drawer.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "PUSO Spaze \u2014 Chat",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: "PUSO Spaze \u2014 Post Detail",
          headerShown: false,
        }}
      />
    </Drawer.Navigator>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 48 : 32,
    paddingHorizontal: 16,
  },

  // ── Brand header ─────────────────────────
  brandSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  brandName: {
    fontSize: 17,
    fontFamily: fonts.displayExtraBold,
    color: colors.onPrimary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 2,
    marginTop: 2,
  },

  // ── Navigation items ─────────────────────
  navSection: {
    gap: 6,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  navItemText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: "rgba(255,255,255,0.6)",
  },
  navItemTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Sign out ─────────────────────────────
  signOutItem: {
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
