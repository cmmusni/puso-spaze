/**
 * Brand color palette — single source of truth.
 * Mirrors the `brand-*` tokens in tailwind.config.js exactly.
 * Use these constants in every StyleSheet.create block so hex values
 * never appear inline outside this file.
 */
export const colors = {
  /** Deep-space gradient start / darkest background */
  darkest: '#1A0533',
  /** Deep violet — gradient step 2 */
  deep: '#4C1D95',
  /** Purple-700 — gradient step 3 / ink */
  ink: '#7E22CE',
  /** Primary brand purple */
  primary: '#9333EA',
  /** Active / focused / fuchsia accent */
  fuchsia: '#C026D3',
  /** Hot-pink — gradient end / highlights */
  hot: '#F018A0',
  /** Gold / tagline accent */
  accent: '#FACC15',
  /** Light purple — accent light variant */
  lightPrimary: '#D8B4FE',
  /** Light fuchsia — pink accent light */
  lightFuchsia: '#F0ABFC',
  /** Light hot pink — rose accent light */
  lightHot: '#FB7185',
  /** Light golden yellow — accent light variant */
  lightAccent: '#FEF08A',
  /** Light error — red-300 */
  lightDanger: '#FCA5A5',
  /** Light success — green-300 */
  lightSafe: '#86EFAC',
  /** Lightest background (canvas) */
  canvas: '#FDF4FF',
  /** Surface — chip / tag backgrounds */
  surface: '#F5F3FF',
  /** Muted-1 — picker borders / subtle fills */
  muted1: '#EDE9FE',
  /** Muted-2 — tag chip borders */
  muted2: '#DDD6FE',
  /** Muted-3 — card borders / dividers */
  muted3: '#F3E8FF',
  /** Muted-4 — placeholder text */
  muted4: '#C4B5FD',
  /** Muted-5 — subtle labels / secondary text */
  muted5: '#A78BFA',
  /** Body copy */
  text: '#374151',
  /** Names / headings */
  heading: '#1F2937',
  /** Muted / disabled labels */
  subtle: '#6B7280',
  /** Card / white surfaces */
  card: '#FFFFFF',
  /** Destructive / error */
  danger: '#EF4444',
  /** Success / safe */
  safe: '#22C55E',
  /** Dark destructive / error — red-700 */
  dangerDark: '#B91C1C',
  /** Dark success / safe — green-700 */
  safeDark: '#15803D',
  /** Light card background — gray-50 */
  cardLight: '#F9FAFB',
  /** Light error background — red-100 */
  dangerLight: '#FEE2E2',
  /** Light success background — green-100 */
  safeLight: '#DCFCE7',

  // ── Semantic state colours (error / warning) ──────────────────────────
  /** Error background — red-50 */
  errorBg: '#FEF2F2',
  /** Error light background — red-100 */
  errorLight: '#FEE2E2',
  /** Error border — red-200 */
  errorBorder: '#FECACA',
  /** Error body text — red-600 */
  errorText: '#DC2626',
  /** Warning background — amber-50 */
  warningBg: '#FFFBEB',
  /** Warning border — amber-200 */
  warningBorder: '#FDE68A',
  /** Warning body text — amber-800 */
  warningText: '#92400E',
  /** Placeholder/disabled text — gray-400 */
  placeholder: '#9CA3AF',
} as const;

export type ColorKey = keyof typeof colors;
