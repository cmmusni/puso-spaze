// tailwind.config.js — NativeWind configuration
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './navigation/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // ── Brand Colors ──────────────────────────────────────
      // Primary: deep teal
      // Accent: warm coral-orange
      // Background: soft aqua-white / warm neutrals
      colors: {
        brand: {
          // ── Gradient anchors ────────────────────
          darkest:  '#0B2A2A',   // gradient start — deepest teal
          deep:     '#11423C',   // deep teal
          ink:      '#1D5D54',   // mid-teal
          primary:  '#2F7A6D',   // primary brand teal
          fuchsia:  '#C56245',   // warm coral-orange accent
          hot:      '#E07A4E',   // bright coral highlight

          // ── Accent ──────────────────────────────
          accent:   '#F4B267',   // warm sand accent

          // ── Light Accent Colors ──────────────────
          'light-primary':   '#8AB8AD', // light teal
          'light-fuchsia':   '#E6A08C', // light coral
          'light-hot':       '#F2B191', // light warm coral
          'light-accent':    '#F8D8A8', // light warm sand
          'light-danger':    '#FCA5A5', // red-300 — light error
          'light-safe':      '#86EFAC', // green-300 — light success

          // ── Teal neutrals (surface / border / text) ──
          'canvas':   '#F8FCFB', // aqua-white canvas (bg)
          'surface':  '#EDF7F5', // soft teal surface
          'muted-1':  '#D7ECE7', // subtle border
          'muted-2':  '#BDDCD5', // chip border
          'muted-3':  '#E6F3F0', // card border / divider
          'muted-4':  '#9EC8BE', // placeholder text
          'muted-5':  '#6FA899', // subtle / secondary text

          // ── Grays ───────────────────────────────
          'text':     '#2F3E3B', // body content
          'heading':  '#1F2C2A', // author names / headings
          'subtle':   '#5F6F6B', // muted labels / counts

          // ── Semantic ────────────────────────────
          card:    '#FFFFFF',
          danger:  '#EF4444',
          safe:    '#22C55E',

          // ── Semantic Light variants ──────────────
          'card-light':    '#F9FAFB',  // gray-50 — light card background
          'danger-light':  '#FEE2E2',  // red-100 — light error background
          'safe-light':    '#DCFCE7',  // green-100 — light success background
        },
      },
      fontFamily: {
        // TODO: load custom fonts via expo-font
        // e.g. sans: ['Inter-Regular'], heading: ['Inter-Bold']
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
};
