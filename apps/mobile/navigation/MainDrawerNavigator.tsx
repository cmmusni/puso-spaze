// ─────────────────────────────────────────────
// navigation/MainDrawerNavigator.tsx
// Unified drawer navigator for all users
// Shows/hides navigation items based on user role
// On web: adds bottom tab bar for quick navigation
// ─────────────────────────────────────────────

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import BottomTabBar from "../components/BottomTabBar";
import WebSidebar from "../components/WebSidebar";
import WebRightPanel from "../components/WebRightPanel";
import { useUserStore } from "../context/UserContext";
import { colors, fonts, radii } from "../constants/theme";
import type { Post } from "../../../packages/types";

// ── Param list ────────────────────────────────
export type MainDrawerParamList = {
  Home: undefined;
  Profile: undefined;
  ReviewQueue: undefined;
  SendInvite: undefined;
  Post: undefined;
  PostDetail: { postId?: string; post?: Post; openedFrom?: "notifications" };
  Notifications: undefined;
};

const Drawer = createDrawerNavigator<MainDrawerParamList>();

// ── Custom drawer content ─────────────────────
function CustomDrawerContent({
  navigation,
  state,
}: DrawerContentComponentProps) {
  const { username, role, logoutUser } = useUserStore();
  const isCoach = role === "COACH" || role === "ADMIN";
  const isAdmin = role === "ADMIN";
  const currentRoute = state.routes[state.index].name;

  const NavItem = ({
    icon,
    label,
    routeName,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    routeName: keyof MainDrawerParamList;
  }) => {
    const active = currentRoute === routeName;
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate(routeName)}
        style={[styles.navItem, active && styles.navItemActive]}
        activeOpacity={0.75}
      >
        <View style={styles.navItemIconWrap}>
          <Ionicons
            name={icon}
            size={18}
            color={active ? colors.card : colors.muted5}
          />
        </View>
        <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
          {label}
        </Text>
        {active && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    );
  };

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.drawerRoot}
      scrollEnabled={false}
    >
      {/* Gradient fill */}
      <LinearGradient
        colors={[colors.primaryContainer, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── User header ── */}
      <View style={styles.userHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          activeOpacity={0.75}
        >
          <Image
            source={require("../assets/logo.png")}
            style={styles.drawerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.userName} numberOfLines={1}>
          {username ?? "User"}
        </Text>
        <View
          style={[
            styles.roleBadge,
            isAdmin
              ? styles.roleBadgeAdmin
              : isCoach
                ? styles.roleBadgeCoach
                : styles.roleBadgeUser,
          ]}
        >
          <View style={styles.roleBadgeContent}>
            <Ionicons
              name={isAdmin ? "shield-checkmark-outline" : isCoach ? "shield-outline" : "person-outline"}
              size={12}
              color={colors.card}
            />
            <Text style={styles.roleBadgeText}>
              {isAdmin ? "Admin" : isCoach ? "Coach" : "Spaze Member"}
            </Text>
          </View>
        </View>
        <View style={styles.activeNowBadge}>
          <View style={styles.activeNowDot} />
          <Text style={styles.activeNowText}>ACTIVE NOW</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Navigation items ── */}
      <View style={styles.navSection}>
        {/* Common items */}
        <NavItem icon="person-outline" label="Profile" routeName="Profile" />
        <NavItem icon="notifications-outline" label="Notifications" routeName="Notifications" />
        <NavItem icon="newspaper-outline" label="Community Feed" routeName="Home" />

        {/* Coach/Admin items */}
        {isCoach && (
          <NavItem icon="list-outline" label="Review Queue" routeName="ReviewQueue" />
        )}
        {isAdmin && (
          <NavItem icon="settings-outline" label="Admin Settings" routeName="SendInvite" />
        )}
      </View>

      <View style={styles.divider} />

      {/* ── Sign Out ── */}
      <View style={{ flex: 1 }} />
      <View style={styles.divider} />
      <TouchableOpacity
        onPress={logoutUser}
        style={styles.signOutItem}
        activeOpacity={0.75}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.card} style={styles.signOutIcon} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

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
  const isCoach = role === "COACH" || role === "ADMIN";
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <WebSidebar
          currentRoute={currentRoute}
          onNavigate={(route) => navigation.navigate(route)}
        />
        <View style={{ flex: 100, minWidth: 600 }}>{children}</View>
        {width >= 1200 && <WebRightPanel />}
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
      />
    </View>
  );
}

function withTabs(Screen: React.ComponentType<any>, routeName: string) {
  return function TabWrappedScreen(props: any) {
    if (Platform.OS !== "web") return <Screen {...props} />;
    return (
      <ScreenWithTabs currentRoute={routeName} navigation={props.navigation}>
        <Screen {...props} />
      </ScreenWithTabs>
    );
  };
}

// ── Drawer navigator ──────────────────────────
export default function MainDrawerNavigator() {
  const role = useUserStore((s) => s.role);
  const isCoach = role === "COACH" || role === "ADMIN";

  return (
    <Drawer.Navigator
      initialRouteName={isCoach ? "ReviewQueue" : "Home"}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: 280, backgroundColor: "transparent" },
        overlayColor: "rgba(0,0,0,0.55)",
        drawerType: "slide",
        swipeEdgeWidth: 60,
      }}
    >
      {/* All screens are always defined - shown/hidden via drawer content */}
      <Drawer.Screen
        name="Home"
        component={withTabs(HomeScreen, "Home")}
        options={{ title: "PUSO Spaze \u2014 Feed" }}
      />
      <Drawer.Screen
        name="Profile"
        component={withTabs(ProfileScreen, "Profile")}
        options={{ title: "PUSO Spaze \u2014 Profile" }}
      />
      <Drawer.Screen
        name="ReviewQueue"
        component={withTabs(CoachDashboard, "ReviewQueue")}
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
          title: "PUSO Spaze \u2014 Create Post",
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.deep,
          },
          headerTintColor: colors.card,
          headerTitleStyle: {
            fontWeight: "bold",
            color: colors.card,
          },
        }}
      />
      <Drawer.Screen
        name="Notifications"
        component={withTabs(NotificationsScreen, "Notifications")}
        options={{
          title: "PUSO Spaze \u2014 Notifications",
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
  },

  // ── User header ──────────────────────────
  userHeader: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "flex-start",
    gap: 8,
  },
  drawerLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  userName: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
    maxWidth: 220,
  },

  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  roleBadgeAdmin: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  roleBadgeCoach: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  roleBadgeUser: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onPrimary,
  },
  roleBadgeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeNowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  activeNowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.safe,
  },
  activeNowText: {
    fontSize: 10,
    fontFamily: fonts.displaySemiBold,
    color: colors.safe,
    letterSpacing: 1,
  },

  divider: {
    height: 16,
    marginHorizontal: 24,
  },

  // ── Navigation items ─────────────────────
  navSection: {
    paddingHorizontal: 16,
    gap: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  navItemIconWrap: {
    marginRight: 14,
    width: 24,
    alignItems: "center",
    textAlign: "center",
  },
  navItemText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: "rgba(255,255,255,0.55)",
    flex: 1,
  },
  navItemTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bodySemiBold,
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    width: 4,
    height: 24,
    backgroundColor: colors.onPrimary,
    borderRadius: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  // ── Sign out ─────────────────────────────
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  signOutIcon: {
    marginRight: 14,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: "rgba(255,255,255,0.6)",
  },
});
