// ─────────────────────────────────────────────
// navigation/AppNavigator.tsx
// Root navigation stack: Login → Home or CoachDrawer
// PUSO Coaches land on CoachDashboard
// Regular users land on UserDrawer (Home + Profile)
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import PostScreen from '../screens/PostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import MainDrawerNavigator from './MainDrawerNavigator';
import { useUserStore } from '../context/UserContext';
import { colors } from '../constants/theme';

// ── Route param types ────────────────────────
export type RootStackParamList = {
  Login:      { code?: string };
  MainDrawer: undefined;
  Post:       undefined;
  PostDetail: { post: import('../../../packages/types').Post };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Linking configuration for deep links ─────
const linking = {
  prefixes: ['https://puso-spaze.org', 'https://www.puso-spaze.org', 'pusospaze://'],
  config: {
    screens: {
      Login: {
        path: 'signup',
        parse: {
          code: (code: string) => code?.toUpperCase(),
        },
      },
      MainDrawer: {
        screens: {
          Home: '',
          Profile: 'Profile',
          ReviewQueue: 'ReviewQueue',
          SendInvite: 'SendInvite',
        },
      },
      Post: 'Post',
      PostDetail: 'PostDetail',
    },
  },
};

// ── Navigator component ───────────────────────
export default function AppNavigator() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // ── Navigation guard: redirect to Login if not authenticated ──
  useEffect(() => {
    const unsubscribe = navigationRef.current?.addListener('state', () => {
      const currentRoute = navigationRef.current?.getCurrentRoute();
      console.log('[Navigation Guard] Current route:', currentRoute?.name, 'isLoggedIn:', isLoggedIn);
      
      // Protected routes
      const protectedRoutes = ['MainDrawer', 'Post', 'PostDetail'];
      
      if (!isLoggedIn && currentRoute && protectedRoutes.includes(currentRoute.name)) {
        console.log('[Navigation Guard] Redirecting to Login');
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    });

    return unsubscribe;
  }, [isLoggedIn]);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.darkest }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      }
      onReady={() => {
        console.log('[Navigation] Ready');
      }}
      onStateChange={(state) => {
        console.log('[Navigation] State changed:', state?.routes?.[state?.index]?.name);
      }}
      documentTitle={{
        formatter: (options, route) => {
          const browserTitles: Record<string, string> = {
            Login:      'PUSO Spaze — Welcome',
            MainDrawer: 'PUSO Spaze — Feed',
            Post:       'PUSO Spaze — Share a Thought',
            PostDetail: 'PUSO Spaze — Post Details',
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
        initialRouteName={isLoggedIn ? 'MainDrawer' : 'Login'}
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
        {/* ── Login Screen ── */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* ── Main Drawer (for all logged-in users) ── */}
        <Stack.Screen
          name="MainDrawer"
          component={MainDrawerNavigator}
          options={{ headerShown: false, gestureEnabled: false }}
        />

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
