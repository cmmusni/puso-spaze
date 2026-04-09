/**
 * Design System: "The Sacred Journal"
 *
 * Color palette mapped from the Material-3 design tokens.
 * Surface hierarchy uses tonal layering — no 1px borders.
 * Colors are emotional signals, not just UI markers.
 */
export const colors = {
  // ── Primary Berry ────────────────────────────────────────────
  /** Primary brand — deep berry */
  primary: '#7C003A',
  /** Primary container — gradient CTA/nav start */
  primaryContainer: '#A60550',
  /** On-primary — text/icons on primary surfaces */
  onPrimary: '#FFFFFF',
  /** On-primary-container — text/icons on primary container */
  onPrimaryContainer: '#FFD9E2',

  // ── Secondary Purple ─────────────────────────────────────────
  /** Secondary — purple accent */
  secondary: '#7D45A2',
  /** Secondary fixed — chip/tag backgrounds */
  secondaryFixed: '#F4DAFF',
  /** On-secondary-fixed — chip/tag text */
  onSecondaryFixed: '#2F004C',

  // ── Tertiary Indigo ──────────────────────────────────────────
  /** Tertiary — links, special accents */
  tertiary: '#371FA9',

  // ── Surface Hierarchy (tonal layering) ───────────────────────
  /** Base background — lightest lavender-white */
  background: '#FCF8FF',
  /** Surface — same as background in M3 */
  surface: '#FCF8FF',
  /** Surface container low — secondary sections */
  surfaceContainerLow: '#F7F1FE',
  /** Surface container — default container */
  surfaceContainer: '#F1EBF9',
  /** Surface container high — input backgrounds */
  surfaceContainerHigh: '#EBE6F2',
  /** Surface container lowest — cards, "fresh pages" */
  surfaceContainerLowest: '#FFFFFF',
  /** Surface bright — hover/active state */
  surfaceBright: '#FEF7FF',
  /** Surface variant — inactive/deep-nested */
  surfaceVariant: '#E5E0EC',

  // ── On-Surface Text ──────────────────────────────────────────
  /** Primary text — deep plum, never pure black */
  onSurface: '#1C1B23',
  /** Secondary text — muted plum */
  onSurfaceVariant: '#584046',

  // ── Outline ──────────────────────────────────────────────────
  /** Outline — soft rose, used at 15% opacity ("ghost border") */
  outline: '#8C7076',
  /** Outline variant — border fallback at 15% opacity */
  outlineVariant: '#DFC0C5',

  // ── Gradient endpoints ───────────────────────────────────────
  /** Darkest berry — gradient start for nav drawer */
  gradientStart: '#4A0230',
  /** Mid berry — gradient middle */
  gradientMid: '#A60550',
  /** Purple — gradient end for nav drawer */
  gradientEnd: '#7D45A2',

  // ── Semantic state colours ───────────────────────────────────
  /** Destructive / error */
  danger: '#D92929',
  /** Success / safe */
  safe: '#22C55E',
  /** Error background */
  errorBg: '#FEF2F2',
  /** Error light background */
  errorLight: '#FEE2E2',
  /** Error text */
  errorText: '#D92929',
  /** Warning text */
  warningText: '#92400E',

  // ── Legacy aliases (backwards compat) ────────────────────────
  /** @deprecated use primary */
  darkest: '#4A0230',
  deep: '#6B0340',
  ink: '#880448',
  fuchsia: '#7D45A2',
  hot: '#9B6DBB',
  accent: '#371FA9',
  lightPrimary: '#C94D88',
  lightFuchsia: '#A577C0',
  lightHot: '#BEA0D4',
  lightAccent: '#8070D0',
  canvas: '#FCF8FF',
  card: '#FFFFFF',
  heading: '#1C1B23',
  text: '#1C1B23',
  subtle: '#584046',
  muted1: '#E5E0EC',
  muted2: '#DFC0C5',
  muted3: '#E5E0EC',
  muted4: '#8C7076',
  muted5: '#584046',
  placeholder: '#8C7076',
  /** @deprecated use surfaceContainerLow */
  surface_legacy: '#F7F1FE',
  /** @deprecated use danger */
  dangerDark: '#A31F1F',
  /** @deprecated use safe */
  safeDark: '#15803D',
  /** @deprecated */
  cardLight: '#FFFFFF',
  dangerLight: '#FEE2E2',
  safeLight: '#DCFCE7',
  lightDanger: '#FCA5A5',
  lightSafe: '#86EFAC',
  errorBorder: '#FECACA',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
};

export type Colors = typeof colors;
export type ColorKey = keyof typeof colors;

/**
 * Font family tokens — "The Sacred Journal" typography.
 *
 * Display / headings: Plus Jakarta Sans — bold, modern, warm
 * Body / UI text: Be Vietnam Pro — humanist geometry, airy
 *
 * Loaded in App.tsx via expo-font + @expo-google-fonts/*
 */
export const fonts = {
  // ── Display scale (Plus Jakarta Sans) ──
  /** Display — regular */
  displayRegular: 'PlusJakartaSans_400Regular',
  /** Display — medium */
  displayMedium: 'PlusJakartaSans_500Medium',
  /** Display — semibold */
  displaySemiBold: 'PlusJakartaSans_600SemiBold',
  /** Display — bold (headings, greeting) */
  displayBold: 'PlusJakartaSans_700Bold',
  /** Display — extra bold (hero, display-lg) */
  displayExtraBold: 'PlusJakartaSans_800ExtraBold',

  // ── Body scale (Be Vietnam Pro) ──
  /** Body — regular */
  bodyRegular: 'BeVietnamPro_400Regular',
  /** Body — italic */
  bodyItalic: 'BeVietnamPro_400Regular_Italic',
  /** Body — medium */
  bodyMedium: 'BeVietnamPro_500Medium',
  /** Body — semibold */
  bodySemiBold: 'BeVietnamPro_600SemiBold',
  /** Body — bold */
  bodyBold: 'BeVietnamPro_700Bold',

  // ── Legacy aliases ──
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semiBold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
  serifBold: 'PlusJakartaSans_700Bold',
  serifExtraBold: 'PlusJakartaSans_800ExtraBold',
  serifBoldItalic: 'PlusJakartaSans_700Bold',
} as const;

/**
 * Spacing & radius tokens from the design system.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Shadow preset — "Ambient Shadows" per design system.
 * Blur: 40px, Spread: -5px, Opacity: 4-6%
 * Color: tint of onSurface, never pure black.
 */
export const ambientShadow = {
  shadowColor: colors.onSurface,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 40,
  elevation: 3,
} as const;
