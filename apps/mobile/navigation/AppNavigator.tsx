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
import CoachLoginScreen from '../screens/CoachLoginScreen';
import MainDrawerNavigator from './MainDrawerNavigator';
import { useUserStore } from '../context/UserContext';
import { colors } from '../constants/theme';
import { useThemeStore } from '../context/ThemeContext';

// ── Route param types ────────────────────────
export type RootStackParamList = {
  Login:      { code?: string };
  CoachLogin: { code?: string };
  MainDrawer: undefined;

};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Linking configuration for deep links ─────
const linking = {
  prefixes: ['https://puso-spaze.org', 'https://www.puso-spaze.org', 'pusospaze://'],
  config: {
    screens: {
      Login: {
        path: 'login',
      },
      CoachLogin: {
        path: 'signup',
        parse: {
          code: (code: string) => code?.toUpperCase(),
        },
      },
      MainDrawer: {
        screens: {
          Home: '',
          Profile: 'profile',
          ReviewQueue: 'review-queue',
          SendInvite: 'send-invite',
          Post: 'post',
          PostDetail: {
            path: 'post/:postId?',
            parse: {
              postId: (postId: string) => postId,
            },
          },
          Notifications: 'notifications',
          Journal: 'journal',
          SpazeCoach: 'spaze-coach',
          SpazeConversations: 'conversations',
          Chat: 'chat',
        },
      },
    },
  },
};

// ── Navigator component ───────────────────────
export default function AppNavigator() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const isLoading = useUserStore((s) => s.isLoading);
  const { colors: themeColors } = useThemeStore();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [isReady, setIsReady] = React.useState(false);

  // ── Navigation guard: redirect to Login if not authenticated ──
  const checkAuth = React.useCallback(() => {
    // Don't check auth while user is still loading from storage
    if (!isReady || !navigationRef.current || isLoading) {
      console.log('[Navigation Guard] Skipping - ready:', isReady, 'loading:', isLoading);
      return;
    }
    
    const currentRoute = navigationRef.current.getCurrentRoute();
    if (!currentRoute) {
      console.log('[Navigation Guard] No current route found');
      return;
    }
    
    console.log('[Navigation Guard] Checking auth - route:', currentRoute.name, 'isLoggedIn:', isLoggedIn);
    
    // Public routes that don't require authentication
    const publicRoutes = ['Login', 'CoachLogin'];
    
    // If logged in and on Login screen, redirect to MainDrawer
    if (isLoggedIn && currentRoute.name === 'Login') {
      console.log('[Navigation Guard] User logged in, redirecting to MainDrawer');
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'MainDrawer' }],
        });
      }, 100);
      return;
    }
    
    // If not logged in and trying to access protected route, redirect to Login
    if (!isLoggedIn && currentRoute.name && !publicRoutes.includes(currentRoute.name)) {
      console.log('[Navigation Guard] Redirecting to Login from:', currentRoute.name);
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }, 100);
    }
  }, [isLoggedIn, isReady, isLoading]);

  useEffect(() => {
    // Check auth when ready or when isLoggedIn changes
    if (isReady) {
      checkAuth();
    }
  }, [isLoggedIn, isReady, checkAuth]);

  useEffect(() => {
    if (!isReady) return;
    
    // Also listen for navigation state changes
    const unsubscribe = navigationRef.current?.addListener('state', checkAuth);
    return unsubscribe;
  }, [isReady, checkAuth]);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.darkest }}>
          <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
      }
      onReady={() => {
        console.log('[Navigation] Ready');
        setIsReady(true);
      }}
      onStateChange={(state) => {
        console.log('[Navigation] State changed:', state?.routes?.[state?.index]?.name);
      }}
      documentTitle={{
        formatter: (options, route) => {
          const browserTitles: Record<string, string> = {
            Login:      'PUSO Spaze — Welcome',
            CoachLogin: 'PUSO Spaze — Coach Invitation',
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
        initialRouteName="Login"
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

        {/* ── Coach Invitation Screen ── */}
        <Stack.Screen
          name="CoachLogin"
          component={CoachLoginScreen}
          options={{ headerShown: false }}
        />

        {/* ── Main Drawer (for all logged-in users) ── */}
        <Stack.Screen
          name="MainDrawer"
          component={MainDrawerNavigator}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
