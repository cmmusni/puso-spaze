/**
 * Brand color palette — single source of truth.
 * Mirrors the `brand-*` tokens in tailwind.config.js exactly.
 * Use these constants in every StyleSheet.create block so hex values
 * never appear inline outside this file.
 *
 * Palette: Berry · Purple · Indigo · Red · White
 */
export const colors = {
  /** Darkest berry — gradient start */
  darkest: '#4A0230',
  /** Dark berry — gradient step 2 */
  deep: '#6B0340',
  /** Mid-berry — gradient step 3 / ink */
  ink: '#880448',
  /** Primary brand (Berry) */
  primary: '#A60550',
  /** Purple — vibrant accent */
  fuchsia: '#8149A6',
  /** Lighter purple — highlight */
  hot: '#9B6DBB',
  /** Indigo — secondary accent */
  accent: '#4D3BBF',
  /** Light berry — accent light variant */
  lightPrimary: '#C94D88',
  /** Light purple — accent light variant */
  lightFuchsia: '#A577C0',
  /** Lighter purple — highlight light variant */
  lightHot: '#BEA0D4',
  /** Light indigo — accent light variant */
  lightAccent: '#8070D0',
  /** Light error — red-300 */
  lightDanger: '#FCA5A5',
  /** Light success — green-300 */
  lightSafe: '#86EFAC',
  /** Lightest background — near-white with purple tint */
  canvas: '#FBF8FE',
  /** Surface — chip / tag backgrounds */
  surface: '#F3EEFA',
  /** Muted-1 — picker borders / subtle fills */
  muted1: '#E5DAF0',
  /** Muted-2 — tag chip borders */
  muted2: '#D8CCE8',
  /** Muted-3 — card borders / dividers */
  muted3: '#EBE3F4',
  /** Muted-4 — placeholder text */
  muted4: '#A088B0',
  /** Muted-5 — subtle labels / secondary text */
  muted5: '#7E638E',
  /** Body copy */
  text: '#2D1B33',
  /** Names / headings */
  heading: '#1A0F22',
  /** Muted / disabled labels */
  subtle: '#6A4D75',
  /** Card / white surfaces */
  card: '#FFFFFF',
  /** Destructive / error (Red from palette) */
  danger: '#D92929',
  /** Success / safe */
  safe: '#22C55E',
  /** Dark destructive / error */
  dangerDark: '#A31F1F',
  /** Dark success / safe — green-700 */
  safeDark: '#15803D',
  /** Light card background */
  cardLight: '#FFFFFF',
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
  errorText: '#D92929',
  /** Warning background — amber-50 */
  warningBg: '#FFFBEB',
  /** Warning border — amber-200 */
  warningBorder: '#FDE68A',
  /** Warning body text — amber-800 */
  warningText: '#92400E',
  /** Placeholder/disabled text — muted purple-gray */
  placeholder: '#A88CB5',
} as const;

export type ColorKey = keyof typeof colors;
