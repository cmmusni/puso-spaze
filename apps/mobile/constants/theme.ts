/**
 * Brand color palette — single source of truth.
 * Mirrors the `brand-*` tokens in tailwind.config.js exactly.
 * Use these constants in every StyleSheet.create block so hex values
 * never appear inline outside this file.
 */
export const colors = {
  /** Deep teal gradient start / darkest background */
  darkest: '#0B2A2A',
  /** Deep teal — gradient step 2 */
  deep: '#11423C',
  /** Mid-teal — gradient step 3 / ink */
  ink: '#1D5D54',
  /** Primary brand teal */
  primary: '#2F7A6D',
  /** Warm coral-orange accent */
  fuchsia: '#C56245',
  /** Warm coral highlight */
  hot: '#E07A4E',
  /** Soft warm accent */
  accent: '#F4B267',
  /** Light teal — accent light variant */
  lightPrimary: '#8AB8AD',
  /** Light coral — accent light variant */
  lightFuchsia: '#E6A08C',
  /** Light warm coral — highlight light variant */
  lightHot: '#F2B191',
  /** Light warm sand — accent light variant */
  lightAccent: '#F8D8A8',
  /** Light error — red-300 */
  lightDanger: '#FCA5A5',
  /** Light success — green-300 */
  lightSafe: '#86EFAC',
  /** Lightest background (canvas) */
  canvas: '#F8FCFB',
  /** Surface — chip / tag backgrounds */
  surface: '#EDF7F5',
  /** Muted-1 — picker borders / subtle fills */
  muted1: '#D7ECE7',
  /** Muted-2 — tag chip borders */
  muted2: '#BDDCD5',
  /** Muted-3 — card borders / dividers */
  muted3: '#E6F3F0',
  /** Muted-4 — placeholder text */
  muted4: '#9EC8BE',
  /** Muted-5 — subtle labels / secondary text */
  muted5: '#6FA899',
  /** Body copy */
  text: '#2F3E3B',
  /** Names / headings */
  heading: '#1F2C2A',
  /** Muted / disabled labels */
  subtle: '#5F6F6B',
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
  /** Placeholder/disabled text — muted teal-gray */
  placeholder: '#8FA09C',
} as const;

export type ColorKey = keyof typeof colors;
