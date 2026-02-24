// ─────────────────────────────────────────────
// App.tsx — PUSO Spaze entry point
// Bootstraps secure session, then renders navigation
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AppNavigator from './navigation/AppNavigator';
import { useUserStore } from './context/UserContext';
import { colors } from './constants/theme';

export default function App() {
  const loadUser = useUserStore((s) => s.loadUser);
  const [appReady, setAppReady] = useState(false);

  // ── On mount: restore session from SecureStore ──
  useEffect(() => {
    (async () => {
      await loadUser();
      setAppReady(true);
    })();
  }, [loadUser]);

  // ── Splash / loading state ──────────────────
  if (!appReady) {
    return (
      <LinearGradient
        colors={[colors.darkest, colors.deep, colors.ink, colors.fuchsia, colors.hot]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ fontSize: 36, marginBottom: 16 }}>🕊️</Text>
        <Text style={{ color: colors.card, fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 }}>
          Spaze
        </Text>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 32 }}>
          Your anonymous heart space
        </Text>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
      </LinearGradient>
    );
  }

  // ── Main app ──────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={colors.darkest} />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
