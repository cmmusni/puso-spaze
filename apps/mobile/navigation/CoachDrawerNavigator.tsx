// ─────────────────────────────────────────────
// navigation/CoachDrawerNavigator.tsx
// Slide-out drawer for COACH / ADMIN users
//   • Review Queue    — moderation dashboard
//   • Community Feed  — browse posts
//   • Send Invite     — ADMIN only
//   • Sign Out
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

import CoachDashboard from '../screens/CoachDashboard';
import SendInviteScreen from '../screens/SendInviteScreen';
import HomeScreen from '../screens/HomeScreen';
import { useUserStore } from '../context/UserContext';
import { colors } from '../constants/theme';

// ── Param list ────────────────────────────────
export type CoachDrawerParamList = {
  ReviewQueue: undefined;
  SendInvite:  undefined;
  Home:        undefined;
};

const Drawer = createDrawerNavigator<CoachDrawerParamList>();

// ── Custom drawer content ─────────────────────
function CustomDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { username, role, logoutUser } = useUserStore();
  const isAdmin       = role === 'ADMIN';
  const currentRoute  = state.routes[state.index].name;

  const NavItem = ({
    icon,
    label,
    routeName,
  }: {
    icon: string;
    label: string;
    routeName: keyof CoachDrawerParamList;
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
        <Text style={styles.userName} numberOfLines={1}>{username ?? 'Coach'}</Text>
        <View style={[
          styles.roleBadge,
          isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeCoach,
        ]}>
          <Text style={styles.roleBadgeText}>
            {isAdmin ? '⭐ Admin' : '🛡️ Coach'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Navigation items ── */}
      <View style={styles.navSection}>
        <NavItem icon="📋" label="Review Queue" routeName="ReviewQueue" />
        <NavItem icon="🕊️" label="Community Feed" routeName="Home" />
        {isAdmin && (
          <NavItem icon="📧" label="Send Invite" routeName="SendInvite" />
        )}
      </View>

      <View style={styles.divider} />

      {/* ── Sign Out ── */}
      <View style={{ flex: 1 }} />
      <View style={styles.divider} />
      <TouchableOpacity
        onPress={logoutUser}
        style={styles.signOutItem}
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
export default function CoachDrawerNavigator() {
  const role    = useUserStore((s) => s.role);
  const isAdmin = role === 'ADMIN';

  return (
    <Drawer.Navigator
      initialRouteName="ReviewQueue"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown:    false,
        drawerStyle:    { width: 280, backgroundColor: 'transparent' },
        overlayColor:   'rgba(0,0,0,0.55)',
        drawerType:     'slide',
        swipeEdgeWidth: 60,
      }}
    >
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
        name="Home"
        component={HomeScreen}
        options={{ title: 'PUSO Spaze — Community Feed' }}
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
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  roleBadgeCoach: {
    backgroundColor: colors.primary + '40',
    borderWidth: 1,
    borderColor: colors.primary + '66',
  },
  roleBadgeAdmin: {
    backgroundColor: colors.accent + '33',
    borderWidth: 1,
    borderColor: colors.accent + '59',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
    letterSpacing: 0.3,
  },

  // ── Divider ───────────────────────────────
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginVertical: 8,
  },

  // ── Nav items ─────────────────────────────
  navSection: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navItemIcon: {
    fontSize: 18,
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
  },
  activeIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: colors.fuchsia,
    position: 'absolute',
    right: 0,
    top: 10,
  },

  // ── Sign Out ──────────────────────────────
  signOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  signOutIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
  },
});
