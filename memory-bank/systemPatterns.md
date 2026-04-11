# System Patterns — PUSO Spaze

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│              Expo Universal App              │
│         (Web + iOS + Android)                │
│                                              │
│  apps/mobile/                                │
│  ├── screens/        (screen components)     │
│  ├── components/     (shared UI)             │
│  ├── navigation/     (drawer + stack)        │
│  ├── context/        (Zustand stores)        │
│  ├── hooks/          (custom hooks)          │
│  ├── services/       (API client)            │
│  ├── constants/      (theme tokens)          │
│  └── utils/          (helpers)               │
│                                              │
├──────────────────────────────────────────────┤
│              Express API Server              │
│                                              │
│  server/src/                                 │
│  ├── api/            (route definitions)     │
│  ├── controllers/    (request handlers)      │
│  ├── services/       (business logic)        │
│  ├── middlewares/     (logger, etc.)          │
│  ├── config/         (env, db)               │
│  └── utils/          (helpers)               │
│                                              │
├──────────────────────────────────────────────┤
│  PostgreSQL (Prisma ORM)                     │
│  OpenAI API (moderation + encouragement)     │
│  Resend (email)                              │
└──────────────────────────────────────────────┘
```

## Key Design Patterns

### Navigation
- `@react-navigation/drawer` as primary navigator
- On native: swipeable drawer
- On web ≥ 900px: persistent `WebSidebar`
- On narrow web: `BottomTabBar`
- Screens wrapped with `withTabs()` in `MainDrawerNavigator.tsx`

### State Management
- **Zustand** stores in `context/` — `UserContext.tsx` (auth), `ThemeContext.tsx` (dark mode)
- Persistent storage via `expo-secure-store` (native) / `AsyncStorage` (web)
- No Redux — lightweight with Zustand

### Authentication / Identity
- No password auth — device-bound username identity
- Device ID (UUID) stored locally, sent to server on login
- Server enforces device-username binding (native only; web skips device ID)
- Device owner binding persisted in SecureStore/AsyncStorage
- Roles: USER, COACH, ADMIN (COACH via invite code redemption)

### API Communication
- Axios-based API client in `services/api.ts`
- `getBaseUrl()` handles platform-specific URL resolution
- All API functions prefixed with `api*` (e.g., `apiCreateUser`, `apiFetchPosts`)

### Moderation Flow
- Posts/comments enter with `REVIEW` status
- OpenAI auto-moderates → `SAFE` or `FLAGGED`
- Coaches review via dashboard → approve or reject
- Three statuses: `SAFE`, `FLAGGED`, `REVIEW`

### Responsive Design
- Mobile-first styles in `StyleSheet.create()`
- Breakpoints: `isMedium` (≥600), `twoCol` (≥700), `isWide` (web ≥900)
- Dynamic overrides via inline conditional styles

### Design System ("The Sacred Journal")
- All tokens in `constants/theme.ts`
- Colors, fonts, spacing, radii, shadows — never hard-coded
- `ambientShadow` preset for card elevation
- `LinearGradient` for nav/sidebar/streaks

### File Uploads
- Multer with content-type guard (multipart only)
- Web blob URIs → fetch blob → read MIME type (no extension parsing)

## Component Relationships
- `AppNavigator` → Auth stack (`Login`, `CoachLogin`) or `MainDrawer`
- `MainDrawerNavigator` → All app screens wrapped with `withTabs()`
- `WebShell` → `WebSidebar` + `BottomTabBar` (web layout)
- `PostCard` → reusable post display with reactions, comments, mentions
- `CustomAlertModal` → cross-platform alert replacement
