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
│  │   ├── moderationService                   │
│  │   ├── biblicalEncouragementService        │
│  │   ├── dailyReflectionService              │
│  │   ├── reflectionReminderScheduler         │
│  │   ├── notificationService                 │
│  │   └── mentionService                      │
│  ├── middlewares/     (logger, auth, etc.)    │
│  ├── config/         (env, db)               │
│  └── utils/          (jwt, sanitize, etc.)   │
│                                              │
├──────────────────────────────────────────────┤
│  PostgreSQL (Prisma ORM)                     │
│  OpenAI API (moderation + reflections)       │
│  Resend (email)                              │
│  Expo Push / Web Push (notifications)        │
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
- Server enforces device-username binding (native + web)
- Device owner binding persisted in SecureStore/AsyncStorage
- Roles: USER, COACH, ADMIN (COACH via invite code redemption)
- **JWT auth**: All write endpoints require `Authorization: Bearer <token>` via `requireAuth` middleware; tokens signed with `JWT_SECRET` (7-day expiry, payload: `{ userId, role }`)
- **PIN-based cross-device login**: Each user gets a unique 6-digit PIN (auto-generated on first login); presenting username + PIN from a different device allows migration
- **Account recovery**: Locked-out users submit recovery request (public, no auth) → coaches review with user's post/journal history → approval clears device binding

### API Communication
- Axios-based API client in `services/api.ts`
- `getBaseUrl()` handles platform-specific URL resolution
- All API functions prefixed with `api*` (e.g., `apiCreateUser`, `apiFetchPosts`)

### Moderation Flow
- Posts/comments enter with `REVIEW` status
- OpenAI auto-moderates → `SAFE` or `FLAGGED`
- Coaches review via dashboard → approve or reject
- Three statuses: `SAFE`, `FLAGGED`, `REVIEW`
- Users can report content: SAFE → REVIEW via `POST /api/posts/:postId/report`

### Daily Reflection System (replaces Hourly Hope)
- **Architecture**: Three separate services replacing the old monolithic `encouragementScheduler.ts`
  - `biblicalEncouragementService.ts` — OpenAI-powered Taglish encouragement generator (standalone, reusable)
  - `dailyReflectionService.ts` — generates daily biblical reflections with in-memory per-day caching
  - `reflectionReminderScheduler.ts` — daily cron push notification to opted-in users
- **Personalization**: If userId provided, fetches user's last 5 SAFE posts (7 days) and generates contextually relevant reflection via OpenAI
- **Caching**: Generic reflection cached per calendar day (YYYY-MM-DD key); personalized reflections cached per `userId:dateKey`
- **Fallbacks**: Curated static reflections used when `OPENAI_API_KEY` is missing
- **Dashboard integration**: Daily reflection served via `GET /api/stats/dashboard` (personalized when userId query param provided)

### Security Middleware Stack
- **Null byte stripping**: Global middleware strips `\u0000` from `req.body` (deep recursive) and `req.query` values
- **JSON depth limiting**: Rejects payloads with nesting >10 levels (400 error)
- **Body size limiting**: `express.json()` and `express.urlencoded()` limited to 100kb
- **HTML sanitization**: `stripHtmlTags()` applied at controller level to all user content before storage
- **IDOR protection**: All user-scoped endpoints verify `req.user.userId === req.params.userId`
- **Error classification**: Global error handler differentiates body-parser errors (400/413) from server errors (500)

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
- Magic bytes validation for avatar uploads (JPEG, PNG, GIF, WebP)
- **Cloudinary**: All image uploads (posts + avatars) stored on Cloudinary via `uploadBuffer()` in `server/src/config/cloudinary.ts`
- Local `uploads/` folder deprecated — Railway ephemeral filesystem made local storage unreliable
- Web blob URIs → fetch blob → read MIME type (no extension parsing)

### Anonymous Identity
- Users toggle anonymous mode via `PATCH /api/users/:userId/anonymous`
- On first anonymous post/comment, `generateAnonUsername()` generates a display name and persists it on the User record (`anonDisplayName` field)
- All subsequent anonymous posts/comments reuse the same `anonDisplayName` — consistency across the platform
- `realUser` field returned only to the post/comment author (not leaked in feed or single-post public API)

### Coach Moderation
- `GET /api/coach/review` — review queue of REVIEW + FLAGGED posts/comments
- `PATCH /api/coach/posts/:id/moderate` — approve or reject posts
- `PATCH /api/coach/comments/:id/moderate` — approve or reject comments
- `PATCH /api/coach/posts/:id/flag` / `comments/:id/flag` — coaches can flag SAFE content for re-review
- `GET /api/coach/members` — view all platform members
- Moderation actions send notifications to the content author

## Component Relationships
- `AppNavigator` → Auth stack (`Login`, `CoachLogin`) or `MainDrawer`
- `MainDrawerNavigator` → All app screens wrapped with `withTabs()`
- `WebShell` → `WebSidebar` + `BottomTabBar` (web layout)
- `PostCard` → reusable post display with reactions, comments, mentions
- `CustomAlertModal` → cross-platform alert replacement
