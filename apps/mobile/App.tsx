// ─────────────────────────────────────────────
// App.tsx — PUSO Spaze entry point
// Bootstraps secure session, then renders navigation
// ─────────────────────────────────────────────

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './navigation/AppNavigator';
import { useUserStore } from './context/UserContext';
import { colors } from './constants/theme';
import WebShell from './components/WebShell';

export default function App() {
  const loadUser = useUserStore((s) => s.loadUser);

  // ── On mount: restore session from SecureStore ──
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ── Main app ──────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={colors.darkest} />
      <WebShell>
        <AppNavigator />
      </WebShell>
    </GestureHandlerRootView>
  );
}
