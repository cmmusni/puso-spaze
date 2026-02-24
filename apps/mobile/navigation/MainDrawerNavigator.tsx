// ─────────────────────────────────────────────
// navigation/MainDrawerNavigator.tsx
// Unified drawer navigator for all users
// Shows/hides navigation items based on user role
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CoachDashboard from '../screens/CoachDashboard';
import SendInviteScreen from '../screens/SendInviteScreen';
import PostScreen from '../screens/PostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import { useUserStore } from '../context/UserContext';
import { colors } from '../constants/theme';
import type { Post } from '../../../packages/types';

// ── Param list ────────────────────────────────
export type MainDrawerParamList = {
  Home:        undefined;
  Profile:     undefined;
  ReviewQueue: undefined;
  SendInvite:  undefined;
  Post:        undefined;
  PostDetail:  { post: Post };
};

const Drawer = createDrawerNavigator<MainDrawerParamList>();

// ── Custom drawer content ─────────────────────
function CustomDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { username, role, logoutUser } = useUserStore();
  const isCoach = role === 'COACH' || role === 'ADMIN';
  const isAdmin = role === 'ADMIN';
  const currentRoute = state.routes[state.index].name;

  const NavItem = ({
    icon,
    label,
    routeName,
  }: {
    icon: string;
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
        <Text style={styles.navItemIcon}>{icon}</Text>
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
        colors={[colors.darkest, colors.deep, colors.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── User header ── */}
      <View style={styles.userHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {(username ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName} numberOfLines={1}>{username ?? 'User'}</Text>
        <View style={[
          styles.roleBadge,
          isAdmin ? styles.roleBadgeAdmin : isCoach ? styles.roleBadgeCoach : styles.roleBadgeUser,
        ]}>
          <Text style={styles.roleBadgeText}>
            {isAdmin ? '⭐ Admin' : isCoach ? '🛡️ Coach' : '👤 Community Member'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Navigation items ── */}
      <View style={styles.navSection}>
        {/* Coach/Admin items */}
        {isCoach && (
          <NavItem icon="📋" label="Review Queue" routeName="ReviewQueue" />
        )}
        {isAdmin && (
          <NavItem icon="📧" label="Send Invite" routeName="SendInvite" />
        )}
        
        {/* Common items */}
        <NavItem icon="🕊️" label="Community Feed" routeName="Home" />
        
        {/* Regular user items */}
        {!isCoach && (
          <NavItem icon="👤" label="Profile" routeName="Profile" />
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
        <Text style={styles.signOutIcon}>🚪</Text>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Bottom safe-area padding */}
      <View style={{ height: Platform.OS === 'ios' ? 24 : 12 }} />
    </DrawerContentScrollView>
  );
}

// ── Drawer navigator ──────────────────────────
export default function MainDrawerNavigator() {
  const role = useUserStore((s) => s.role);
  const isCoach = role === 'COACH' || role === 'ADMIN';

  return (
    <Drawer.Navigator
      initialRouteName={isCoach ? 'ReviewQueue' : 'Home'}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: 280, backgroundColor: 'transparent' },
        overlayColor: 'rgba(0,0,0,0.55)',
        drawerType: 'slide',
        swipeEdgeWidth: 60,
      }}
    >
      {/* All screens are always defined - shown/hidden via drawer content */}
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'PUSO Spaze — Feed' }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'PUSO Spaze — Profile' }}
      />
      <Drawer.Screen
        name="ReviewQueue"
        component={CoachDashboard}
        options={{ title: 'PUSO Spaze — Coach Dashboard' }}
      />
      <Drawer.Screen
        name="SendInvite"
        component={SendInviteScreen}
        options={{ title: 'PUSO Spaze — Send Invite' }}
      />
      <Drawer.Screen
        name="Post"
        component={PostScreen}
        options={{ 
          title: 'PUSO Spaze — Create Post',
          headerShown: true,
        }}
      />
      <Drawer.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ 
          title: 'PUSO Spaze — Post Detail',
          headerShown: true,
        }}
      />
    </Drawer.Navigator>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
  },

  // ── User header ──────────────────────────
  userHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'flex-start',
    gap: 6,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.fuchsia,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarLetter: {
    color: colors.card,
    fontSize: 24,
    fontWeight: '800',
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.card,
    maxWidth: 220,
  },
  
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleBadgeAdmin: {
    backgroundColor: colors.hot + '33',
  },
  roleBadgeCoach: {
    backgroundColor: colors.fuchsia + '33',
  },
  roleBadgeUser: {
    backgroundColor: colors.primary + '33',
    borderWidth: 1,
    borderColor: colors.primary + '80',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },

  divider: {
    height: 1,
    backgroundColor: colors.muted3,
    marginVertical: 12,
    marginHorizontal: 20,
  },

  // ── Navigation items ─────────────────────
  navSection: {
    paddingHorizontal: 12,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: colors.fuchsia + '26',
  },
  navItemIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  navItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted5,
    flex: 1,
  },
  navItemTextActive: {
    color: colors.card,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    width: 4,
    height: 24,
    backgroundColor: colors.fuchsia,
    borderRadius: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  // ── Sign out ─────────────────────────────
  signOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginHorizontal: 12,
    borderRadius: 10,
  },
  signOutIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted5,
  },
});
