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
      // Primary: Berry
      // Accent: Purple · Indigo
      // Danger: Red
      // Background: White
      colors: {
        brand: {
          // ── Gradient anchors ────────────────────
          darkest:  '#4A0230',   // gradient start — darkest berry
          deep:     '#6B0340',   // dark berry
          ink:      '#880448',   // mid-berry
          primary:  '#A60550',   // Berry
          fuchsia:  '#8149A6',   // Purple — vibrant accent
          hot:      '#9B6DBB',   // lighter purple highlight

          // ── Accent ──────────────────────────────
          accent:   '#4D3BBF',   // Indigo

          // ── Light Accent Colors ──────────────────
          'light-primary':   '#C94D88', // light berry
          'light-fuchsia':   '#A577C0', // light purple
          'light-hot':       '#BEA0D4', // lighter purple
          'light-accent':    '#8070D0', // light indigo
          'light-danger':    '#FCA5A5', // red-300 — light error
          'light-safe':      '#86EFAC', // green-300 — light success

          // ── White-forward neutrals (surface / border / text) ──
          'canvas':   '#FBF8FE', // near-white purple-tint canvas
          'surface':  '#F3EEFA', // white-purple surface
          'muted-1':  '#E5DAF0', // subtle border
          'muted-2':  '#D8CCE8', // chip border
          'muted-3':  '#EBE3F4', // card border / divider
          'muted-4':  '#A088B0', // placeholder text
          'muted-5':  '#7E638E', // subtle / secondary text

          // ── Text ────────────────────────────────
          'text':     '#2D1B33', // body content
          'heading':  '#1A0F22', // author names / headings
          'subtle':   '#6A4D75', // muted labels / counts

          // ── Semantic ────────────────────────────
          card:    '#FFFFFF',
          danger:  '#D92929',
          safe:    '#22C55E',

          // ── Semantic Light variants ──────────────
          'card-light':    '#FFFFFF',  // light card background
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
