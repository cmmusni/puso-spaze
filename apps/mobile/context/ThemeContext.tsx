// ─────────────────────────────────────────────
// context/ThemeContext.tsx
// Global dark-mode state using Zustand
// Persists preference to AsyncStorage / SecureStore
// ─────────────────────────────────────────────

import { Platform } from "react-native";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as lightColors } from "../constants/theme";

const THEME_KEY = "puso_dark_mode";

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};

/**
 * Dark color palette — mapped from the light Sacred Journal tokens.
 * Surfaces become deep plum; text inverts to light tones.
 */
export const darkColors: typeof lightColors = {
  ...lightColors,

  // ── Primary Berry (same hue, brighter for dark bg) ──
  primary: "#E86BA0",
  primaryContainer: "#A60550",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#FFD9E2",

  // ── Secondary Purple ──
  secondary: "#C89BE8",
  secondaryFixed: "#3A1A52",
  onSecondaryFixed: "#F4DAFF",

  // ── Tertiary ──
  tertiary: "#A89CFF",

  // ── Surface Hierarchy (dark tonal layering) ──
  background: "#1A1620",
  surface: "#1A1620",
  surfaceContainerLow: "#211D28",
  surfaceContainer: "#282430",
  surfaceContainerHigh: "#332F3A",
  surfaceContainerLowest: "#1E1A24",
  surfaceBright: "#3A3542",
  surfaceVariant: "#332F3A",

  // ── On-Surface Text ──
  onSurface: "#E8E0F0",
  onSurfaceVariant: "#C0B0C5",

  // ── Outline ──
  outline: "#8C7076",
  outlineVariant: "#4A3D45",

  // ── Gradients ──
  gradientStart: "#2A0E20",
  gradientMid: "#5A0235",
  gradientEnd: "#4A2870",

  // ── Semantic ──
  danger: "#FF5C5C",
  safe: "#4ADE80",
  errorBg: "#3A1A1A",
  errorLight: "#4A2020",
  errorText: "#FF8080",
  warningText: "#F0C060",

  // ── Legacy aliases ──
  darkest: "#2A0E20",
  deep: "#3A1028",
  ink: "#4A1838",
  fuchsia: "#C89BE8",
  hot: "#9B6DBB",
  accent: "#A89CFF",
  lightPrimary: "#E86BA0",
  lightFuchsia: "#A577C0",
  lightHot: "#BEA0D4",
  lightAccent: "#8070D0",
  canvas: "#1A1620",
  card: "#1E1A24",
  heading: "#E8E0F0",
  text: "#E8E0F0",
  subtle: "#C0B0C5",
  muted1: "#332F3A",
  muted2: "#4A3D45",
  muted3: "#332F3A",
  muted4: "#8C7076",
  muted5: "#C0B0C5",
  placeholder: "#8C7076",
  surface_legacy: "#211D28",
  dangerDark: "#FF5C5C",
  safeDark: "#4ADE80",
  cardLight: "#1E1A24",
  dangerLight: "#4A2020",
  safeLight: "#1A3A2A",
  lightDanger: "#FF8080",
  lightSafe: "#50D090",
  errorBorder: "#5A2020",
  warningBg: "#3A3010",
  warningBorder: "#6A5020",
};

interface ThemeState {
  isDark: boolean;
  colors: typeof lightColors;
  toggleDarkMode: (value: boolean) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: false,
  colors: lightColors,

  toggleDarkMode: async (value: boolean) => {
    set({ isDark: value, colors: value ? darkColors : lightColors });
    await storage.setItem(THEME_KEY, String(value));
  },

  loadTheme: async () => {
    const saved = await storage.getItem(THEME_KEY);
    const isDark = saved === "true";
    set({ isDark, colors: isDark ? darkColors : lightColors });
  },
}));
