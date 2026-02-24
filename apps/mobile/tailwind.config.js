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
      // Primary: deep spiritual purple
      // Accent: warm gold / sunrise orange
      // Background: soft off-white / linen
      colors: {
        brand: {
          // ── Gradient anchors ────────────────────
          darkest:  '#1A0533',   // gradient start — darkest purple
          deep:     '#4C1D95',   // deep blue-purple — logo shadow
          ink:      '#7E22CE',   // purple-700
          primary:  '#9333EA',   // vivid purple — logo centre
          fuchsia:  '#C026D3',   // fuchsia — focus borders, active states
          hot:      '#F018A0',   // hot magenta-pink — logo left glow

          // ── Accent ──────────────────────────────
          accent:   '#FACC15',   // golden yellow — tagline colour

          // ── Light Accent Colors ──────────────────
          'light-primary':   '#D8B4FE', // violet-300 — light purple
          'light-fuchsia':   '#F0ABFC', // fuchsia-200 — light fuchsia/pink
          'light-hot':       '#FB7185', // rose-400 — light hot pink
          'light-accent':    '#FEF08A', // yellow-100 — light golden yellow
          'light-danger':    '#FCA5A5', // red-300 — light error
          'light-safe':      '#86EFAC', // green-300 — light success

          // ── Violet neutrals (surface / border / text) ──
          'canvas':   '#FDF4FF', // ultra-light lavender canvas (bg)
          'surface':  '#F5F3FF', // violet-50 — chip / tag backgrounds
          'muted-1':  '#EDE9FE', // violet-100 — picker border
          'muted-2':  '#DDD6FE', // violet-200 — tag chip border
          'muted-3':  '#F3E8FF', // purple-100 — card border / divider
          'muted-4':  '#C4B5FD', // violet-300 — placeholder text
          'muted-5':  '#A78BFA', // violet-400 — subtle / secondary text

          // ── Grays ───────────────────────────────
          'text':     '#374151', // gray-700 — body content
          'heading':  '#1F2937', // gray-800 — author names / headings
          'subtle':   '#6B7280', // gray-500 — muted labels / counts

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
