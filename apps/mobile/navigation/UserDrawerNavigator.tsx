// ─────────────────────────────────────────────
// navigation/UserDrawerNavigator.tsx
// Drawer navigator for regular users (non-coaches)
// Screens: Home (Community Feed), Profile
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
import { useUserStore } from '../context/UserContext';
import { colors } from '../constants/theme';

// ── Param list ────────────────────────────────
export type UserDrawerParamList = {
  Home: undefined;
  Profile: undefined;
};

const Drawer = createDrawerNavigator<UserDrawerParamList>();

// ── Custom drawer content ─────────────────────
function CustomDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { username, logoutUser } = useUserStore();
  const currentRoute = state.routes[state.index].name;

  const NavItem = ({
    icon,
    label,
    routeName,
  }: {
    icon: string;
    label: string;
    routeName: keyof UserDrawerParamList;
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
        <View style={[styles.roleBadge, styles.roleBadgeUser]}>
          <Text style={styles.roleBadgeText}>👤 Community Member</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Navigation items ── */}
      <View style={styles.navSection}>
        <NavItem icon="👤" label="Profile" routeName="Profile" />
        <NavItem icon="🕊️" label="Community Feed" routeName="Home" />
      </View>

      <View style={styles.divider} />

      {/* ── Sign Out ── */}
      <View style={{ flex: 1 }} />
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
export default function UserDrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: 280, backgroundColor: 'transparent' },
        overlayColor: 'rgba(0,0,0,0.55)',
        drawerType: 'slide',
        swipeEdgeWidth: 60,
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'PUSO Spaze — Feed' }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'PUSO Spaze — Feed' }}
      />
    </Drawer.Navigator>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
  },

  // ── User header ──────────────────────────
  userHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '4d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.primary + '80',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.muted5,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.card,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleBadgeUser: {
    backgroundColor: colors.primary + '33',
    borderWidth: 1,
    borderColor: colors.primary + '80',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted5,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },

  // ── Navigation section ────────────────────
  navSection: {
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 0,
    borderRadius: 0,
  },
  navItemActive: {
    backgroundColor: colors.primary + '26',
    borderRightWidth: 4,
    borderRightColor: colors.muted5,
  },
  navItemIcon: {
    fontSize: 20,
  },
  navItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted5,
  },
  navItemTextActive: {
    color: colors.muted5,
    fontWeight: '700',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted5,
  },

  // ── Sign out ──────────────────────────────
  signOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.danger + '26',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger + '4d',
  },
  signOutIcon: {
    fontSize: 18,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
});
