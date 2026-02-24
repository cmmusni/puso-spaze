// ─────────────────────────────────────────────
// navigation/AppNavigator.tsx
// Root navigation stack: Login → Home or CoachDrawer
// PUSO Coaches land on CoachDashboard
// Regular users land on UserDrawer (Home + Profile)
// ─────────────────────────────────────────────

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import PostScreen from '../screens/PostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import CoachDrawerNavigator from './CoachDrawerNavigator';
import UserDrawerNavigator from './UserDrawerNavigator';
import { useUserStore } from '../context/UserContext';
import { colors } from '../constants/theme';

// ── Route param types ────────────────────────
export type RootStackParamList = {
  Login:       { code?: string };
  UserDrawer:  undefined;
  Post:        undefined;
  PostDetail:  { post: import('../../../packages/types').Post };
  CoachDrawer: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Linking configuration for deep links ─────
const linking = {
  prefixes: ['https://puso-spaze.org', 'https://www.puso-spaze.org', 'pusospaze://'],
  config: {
    screens: {
      Login: {
        path: 'coach-signup',
        parse: {
          code: (code: string) => code?.toUpperCase(),
        },
      },
    },
  },
};

// ── Navigator component ───────────────────────
export default function AppNavigator() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const role       = useUserStore((s) => s.role);
  const isCoach    = role === 'COACH' || role === 'ADMIN';

  return (
    <NavigationContainer
      linking={linking}
      documentTitle={{
        formatter: (options, route) => {
          const browserTitles: Record<string, string> = {
            Login:       'PUSO Spaze — Welcome',
            UserDrawer:  'PUSO Spaze — Feed',
            CoachDrawer: 'PUSO Spaze — Coach Dashboard',
            Post:        'PUSO Spaze — Share a Thought',
            PostDetail:  'PUSO Spaze — Post Details',
          };

          // First check if the route has a name in our titles map
          const routeTitle = browserTitles[route?.name ?? ''];
          if (routeTitle) return routeTitle;

          // Otherwise use the title from screenOptions
          return options?.title ?? 'Spaze';
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.deep,
          },
          headerTintColor: colors.card,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        {isLoggedIn ? (
          <>
            {/* ── Coach / Admin: drawer first ── */}
            {isCoach && (
              <Stack.Screen
                name="CoachDrawer"
                component={CoachDrawerNavigator}
                options={{ headerShown: false, gestureEnabled: false }}
              />
            )}

            {/* ── Regular User: drawer first ── */}
            {!isCoach && (
              <Stack.Screen
                name="UserDrawer"
                component={UserDrawerNavigator}
                options={{ headerShown: false, gestureEnabled: false }}
              />
            )}

            {/* ── Create Post ── */}
            <Stack.Screen
              name="Post"
              component={PostScreen}
              options={{
                title: 'Post',
                headerShown: false,
              }}
            />

            {/* ── Post Detail ── */}
            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
