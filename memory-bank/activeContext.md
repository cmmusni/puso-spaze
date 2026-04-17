# Active Context — PUSO Spaze

**Last Updated:** April 18, 2026

## Current Work Focus
- Profile expansion: banner uploads, editable bio, and saved contact fields
- Journal sharing controls: private/public toggle and public journal feed endpoint
- Mobile UX refinements: notifications responsive polish and shared scroll-to-top trigger
- Scroll-direction hide/show bars: top bar + bottom tab bar auto-hide on scroll down, reveal on scroll up
- Refresh UX parity: native pull-to-refresh coverage + mobile web pull-to-refresh behavior
- Streak system overhaul: visit-based streak counting + push reminders
- Coach follow-up automation: pending chat reminders for unreplied member messages
- App entry polish: animated splash flow + refreshed icon/splash asset set
- Pre-deployment documentation update (memory bank + AGENTS.md sync)
- Deploy agent enhanced with Step -1 (memory bank update before deploy)
- Full QA test suite created and passing

## Recent Changes

### Profile, Contacts, and Public Journal Expansion (April 18, 2026)
- **SCHEMA**: Added user profile/contact fields: `bannerUrl`, `bio`, `phone`, `contactEmail`, `facebook`, `instagram`, `linkedin`, `twitter`, `tiktok`, `youtube`
- **SCHEMA**: Added `journals.isPublic` (default `false`) for optional public sharing
- **MIGRATIONS**:
  - `20260417173529_add_banner_url`
  - `20260417183236_add_journal_is_public`
  - `20260417184654_add_bio`
  - `20260417185940_add_contact_fields`
- **USER API**: Added `POST /api/users/:userId/banner`, `PATCH /api/users/:userId/bio`, `GET /api/users/:userId/contacts`, `PATCH /api/users/:userId/contacts`
- **JOURNAL API**: Added `GET /api/journals/public` (no auth), and `isPublic` support in create/update routes + controller
- **SHARED TYPES**: `packages/types/index.ts` now includes `ContactInfo`, user contact/profile fields, and `Journal.isPublic`
- **CLIENT STORE/API**: `UserContext` persists `bannerUrl`, `bio`, and `contacts`; API layer updated to consume new user/journal fields
- **UI SCOPE**: `ProfileScreen.tsx` significantly expanded (new profile/social/contact surfaces) and linked to new backend fields

### Notifications + Shared Scroll Trigger (April 18, 2026)
- **HOOK**: `useScrollBarVisibility` now includes `scrollToTopTrigger` and `triggerScrollToTop()`
- **NOTIFICATIONS SCREEN**: Added `SectionList` ref + trigger-based scroll-to-top handling
- **RESPONSIVE POLISH**: Notifications UI now applies mobile-specific sizing for card spacing, avatar/badge sizes, header, search row, and unread indicators

### Scroll-Direction Bar Auto-Hide (April 17, 2026)
- **NEW HOOK**: `apps/mobile/hooks/useScrollBarVisibility.ts` — Zustand store holding `barsVisible` boolean shared between HomeScreen and BottomTabBar
- **HOME SCREEN**: `handleScroll` now tracks scroll direction; hides top bar + signals BottomTabBar to slide down after 10px downward scroll; restores on upward scroll or scroll-to-top; bars reset to visible on screen blur
- **BOTTOM TAB BAR**: Consumes `barsVisible` store, animates `translateY` to 80 on hide and back to 0 on show; changed container to `position: absolute` for proper animation on web+native
- **POST CARD**: Mobile layout polish — full-bleed card at `borderRadius: 0`, `marginHorizontal: 0` on narrow screens; latest-comment strip updated with shadow, tighter spacing, and dot separator; comment text label removed when count is 0
- **CONVERSATION CONTROLLER**: Updated to include new fields
- **SCOPE**: Auto-hide only activates on mobile/narrow web; wide desktop (`isWide`) always shows bars

### PWA Input Focus Zoom Guard (April 17, 2026)
- **BUG-017**: iPhone Safari/PWA auto-zoomed focused TextInputs under 16px
- **WEB SHELL**: Added touch-web CSS guard to force `input`, `textarea`, `select`, and `[contenteditable=true]` to 16px; added `-webkit-text-size-adjust: 100%`
- **TASK**: TASK004 created and completed

### PWA Notification Deep-Link Fix (April 17, 2026)
- **BUG-016**: Web push notification taps opened blank/broken screens
- **SW.JS**: Chat notifications now open `/chat/:conversationId`; post notifications open `/post/:postId?openedFrom=notifications&highlightCommentId=...`
- **APP NAVIGATOR**: Chat linking config updated to `chat/:conversationId?`
- **CHAT SCREEN**: Recovers `conversationId` from web URL pathname when route params absent; shows safe fallback state instead of crashing
- **POST DETAIL**: Fixed web URL regex from `/PostDetail/` to `/post/`; wired `highlightCommentId` query param
- **TASK**: TASK003 created and completed

### Pull-to-Refresh Parity + Web Refresh Flow (April 17, 2026)
- **JOURNAL SCREEN**: Added `RefreshControl` to `JournalScreen` `ScrollView` using existing `refreshing` + `onRefresh` state/actions
- **WEB SHELL**: Added touch pull-to-refresh indicator/gesture support on web touch devices (`WebShell.tsx`) with guardrails for form fields and nested scroll containers
- **SPLASH HANDOFF**: Added one-time session key (`puso-skip-splash-once`) so manual pull-to-refresh reload on web skips the startup splash once
- **TASK TRACKING**: Logged and completed native pull-to-refresh audit in `TASK002`

### Streak System Overhaul (April 17, 2026)
- **SCHEMA**: Added `streakCount` (Int, default 0) and `lastStreakDate` (DateTime?) to User model
- **MIGRATION**: `20260417083314_add_streak_fields`
- **NEW ENDPOINT**: `POST /api/users/:userId/record-visit` — records HomeScreen visit, increments streak if consecutive day, resets to 1 if gap
- **UPDATED**: `getUserStats` — now returns stored `streakCount` instead of computing from post/journal dates; auto-resets if expired (>1 day gap)
- **CLIENT**: `apiRecordVisit()` in `services/api.ts`; called from HomeScreen's `useFocusEffect`
- **SCHEDULER**: `streakReminderScheduler.ts` — cron at 9 PM PHT (1 PM UTC), sends push to users with active streaks who haven't visited today
- **NOTIFICATION**: Streak reminder sends `data: { screen: 'Home' }` → clicking navigates to HomeScreen (native via `handleNotificationNavigation`, web via `sw.js`)
- **SW.JS**: Added `data.screen` handling for Home/Journal/Notifications routes

### Pending Chat Reminder Scheduler (April 17, 2026)
- **NEW SERVICE**: `server/src/services/pendingChatReminderScheduler.ts`
- **LOGIC**: Runs every 15 minutes, checks conversations where the latest message came from a member and is older than 1 hour, then notifies the assigned coach
- **ANTI-SPAM**: Uses in-memory `remindedSet` keyed by `conversationId:messageId` to avoid duplicate reminders for the same waiting message
- **STARTUP**: Registered in `server/src/index.ts` alongside reflection/streak schedulers

### Splash + Branding Asset Refresh (April 17, 2026)
- **NEW SCREEN**: `apps/mobile/screens/SplashScreen.tsx` with animated logo, glow, tagline, and auto-transition
- **NAVIGATION**: `AppNavigator` now overlays splash on app startup before handing off to auth/main flow
- **ASSETS**: Updated app/web icon set and splash assets (`assets/`, `public/`, iOS app icon)

### Deploy Agent Enhancement (April 17, 2026)
- **UPDATED**: `.github/agents/deploy.agent.md` — added Step -1: mandatory memory bank & AGENTS.md update before any git/deploy actions
- Reads all 7 memory bank files, identifies changes via `git diff`, updates each doc as needed, and produces a summary before proceeding to deployment checks

### Persistent Anonymous Display Name (April 16–17, 2026)
- **NEW**: `anonDisplayName` field on User, Post, and Comment models in Prisma schema
- **Migration**: `20250416_add_anon_display_name` adds column to User table
- **Logic**: When anonymous user creates first post/comment, `generateAnonUsername()` generates a name and persists it on the User record. All subsequent anonymous posts/comments reuse the same name.
- **PostCard/Screens**: Updated to display `anonDisplayName` for anonymous content; `realUser` field returned only to the post author (not in feed/single-post for public)

### Cloudinary Image Upload Migration (April 15–16, 2026)
- **NEW**: `server/src/config/cloudinary.ts` — Cloudinary SDK configuration
- **UPDATED**: `postController.ts` and `userController.ts` — image uploads now go to Cloudinary instead of local `uploads/` folder
- **Reason**: Railway uses ephemeral filesystem; local uploads were lost on redeploys
- **Env vars**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Coach Controller Expansion (April 16, 2026)
- **EXPANDED**: `server/src/controllers/coachController.ts` — added `getReviewQueue()`, `moderatePost()`, `moderateComment()`, `flagPost()`, `flagComment()`, `getMembers()`
- **UPDATED**: `server/src/api/coachRoutes.ts` — wired all new coach endpoints
- Moderation actions now send notifications to the post/comment author

### Full QA Test Suite (April 16–17, 2026)
- **NEW**: `quality/qa-tests/full-qa-pass.mjs` — 100+ test comprehensive QA script (18 sections: smoke, registration, validation, CRUD, comments, reactions, auth, anon, journals, notifications, profile, coach, flagging, duplicates, errors, recovery, stress, cross-feature)
- **NEW**: `quality/qa-tests/new-features-qa.mjs` — focused tests for persistent anon names and encouragement stats

### Dashboard & Stats Endpoints (April 13–16, 2026)
- **NEW**: `GET /api/stats/dashboard` — totalMembers, dailyStories, onlineCount, trendingTags, dailyReflection
- **NEW**: `GET /api/users/:userId/stats` — encouragementsGiven, totalReflections, streak
- **Client**: `apiGetDashboardStats()`, `apiGetUserStats()` in `services/api.ts`

### Encouragement System Refactor (April 13–16, 2026)
- **DELETED**: `encouragementScheduler.ts`, `appConfigService.ts`, `ENCOURAGEMENT_FEATURE.md`
- **NEW**: `biblicalEncouragementService.ts`, `dailyReflectionService.ts`, `reflectionReminderScheduler.ts`
- **Architecture shift**: "Hourly Hope" → "Daily Reflections" with personalized content + push reminders

### Security Audit — 15 Bug Fixes (April 13, 2026)
- BUG-001 through BUG-015: Race conditions, validation gaps, XSS, null bytes, IDOR, error handling (see `memory-bank/bug-fixes.md` for details)

## Next Steps
- Deploy all changes to production (set `JWT_SECRET`, `ADMIN_SECRET`, Cloudinary env vars)
- Verify scheduler behavior in production logs (streak 9 PM PHT, pending chat every 15 min)
- Validate pull-to-refresh UX on mobile web and iOS/Android devices (gesture threshold + splash skip-once behavior)
- Complete Android APK build and test on physical tablet
- Add functional tests for daily reflection, user stats, and security fixes to `quality/functional.test.ts`
- Update QUALITY.md with new scenarios for daily reflections and Cloudinary uploads

## Active Decisions
- Image uploads moved to Cloudinary (Railway ephemeral filesystem fix)
- Anonymous display names are persistent per-user (frozen on first anonymous action)
- "Hourly Hope" replaced by "Daily Reflections" (personalized, cached per-day, push notifications)
- All write API endpoints require JWT auth; read endpoints remain public
- Deploy agent runs memory bank update as Step -1 before every deployment
