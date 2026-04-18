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
- **PIN-based cross-device login**: Each user gets a 6-digit PIN (auto-generated on first login); login validates display name + PIN pair and allows device migration when valid
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

### Engagement Reminder Schedulers
- **streakReminderScheduler.ts** runs daily at 1:00 PM UTC (9:00 PM PHT) to warn users whose streak is at risk
- **pendingChatReminderScheduler.ts** runs every 15 minutes to remind coaches when member messages are waiting over 1 hour
- Streak reminders deep-link to Home (`data.screen = Home`); pending chat reminders deep-link to the conversation (`data.conversationId`)

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
- Web touch devices support custom pull-to-refresh in `WebShell.tsx`; refresh sets a one-time session flag to skip splash on immediate reload
- Web touch input controls (`input`, `textarea`, `select`, `[contenteditable=true]`) are globally forced to 16px in `WebShell.tsx` to prevent iOS Safari PWA focus zoom

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
- `GET /api/coach/coaches` — coach/admin roster for dashboard directory panel
- `PATCH /api/coach/posts/:id/moderate` — approve or reject posts
- `PATCH /api/coach/comments/:id/moderate` — approve or reject comments
- `PATCH /api/coach/posts/:id/flag` / `comments/:id/flag` — coaches can flag SAFE content for re-review
- `GET /api/coach/members` — view all platform members
- Moderation actions send notifications to the content author

### Coach Dashboard Panel Pattern
- Wide layouts use a scrollable right rail to host secondary dashboard cards (sentiment, chats, members, coaches)
- Coach/admin roster panels are informational lists sourced from dedicated endpoints rather than derived from conversation membership

### Profile Enrichment
- User model supports richer public profile fields: `bannerUrl`, `bio`, `phone`, `contactEmail`, `facebook`, `instagram`, `linkedin`, `twitter`, `tiktok`, `youtube`, `website`
- New user endpoints:
  - `POST /api/users/:userId/banner` (multipart image upload)
  - `PATCH /api/users/:userId/bio`
  - `GET /api/users/:userId/contacts`
  - `PATCH /api/users/:userId/contacts`
- `GET /api/users/:userId` serves public profile data used for viewing another user's profile screen
- Client store persists banner/bio/contacts for session continuity

### Profile Screen Routing Pattern
- `Profile` route can receive optional `userId`
- Owner view (`route userId` absent or equals session user) shows editable controls (avatar/banner upload, contacts editor, preferences)
- Non-owner view fetches public profile data and hides owner-only actions

### Public Journal Sharing
- Journal model includes `isPublic` (default false)
- `POST /api/journals` and `PATCH /api/journals/:journalId` accept optional `isPublic`
- `GET /api/journals/public` returns latest public journal entries (optional `userId` filter, no auth)
- Private journal endpoints still require ownership checks

## Component Relationships
- `AppNavigator` → Auth stack (`Login`, `CoachLogin`) or `MainDrawer`
- `MainDrawerNavigator` → All app screens wrapped with `withTabs()`
- `WebShell` → `WebSidebar` + `BottomTabBar` (web layout)
- `PostCard` → reusable post display with reactions, comments, mentions
- `CustomAlertModal` → cross-platform alert replacement
