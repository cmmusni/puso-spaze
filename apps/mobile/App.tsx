// ─────────────────────────────────────────────
// App.tsx — PUSO Spaze entry point
// Bootstraps secure session, loads Sacred Journal fonts,
// then renders navigation.
// ─────────────────────────────────────────────

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_400Regular_Italic,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import { useUserStore } from './context/UserContext';
import { useThemeStore } from './context/ThemeContext';
import WebShell from './components/WebShell';
import CustomAlertModal from './components/CustomAlertModal';
import { installContextMenuSuppressor } from './utils/suppressWebMenu';

// Hold the native splash until fonts are loaded
ExpoSplashScreen.preventAutoHideAsync();

export default function App() {
  const loadUser = useUserStore((s) => s.loadUser);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const isDark = useThemeStore((s) => s.isDark);
  const themeColors = useThemeStore((s) => s.colors);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    BeVietnamPro_400Regular,
    BeVietnamPro_400Regular_Italic,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });

  // ── On mount: restore session from SecureStore ──
  useEffect(() => {
    loadUser();
    loadTheme();
    // Web only: install a single document-level contextmenu suppressor that
    // blocks the browser context menu / inspect element popup for any element
    // tagged with data-no-context (e.g. the reaction long-press buttons).
    installContextMenuSuppressor();
  }, [loadUser, loadTheme]);

  // ── Hide native splash once fonts are ready ──
  useEffect(() => {
    if (fontsLoaded) {
      ExpoSplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // ── Inject apple-touch-icon link tag on web ──
  useEffect(() => {
    if (Platform.OS === 'web') {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = '/apple-touch-icon.png';
      document.head.appendChild(link);
    }
  }, []);

  // Native splash is still visible while fonts load — return null to keep it up
  if (!fontsLoaded) return null;

  // ── Main app ──────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <WebShell>
          <AppNavigator />
        </WebShell>
        <CustomAlertModal />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
