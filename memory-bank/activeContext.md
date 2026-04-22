# Active Context — PUSO Spaze

**Last Updated:** April 22, 2026 (9th deployment cycle)

## Current Work Focus
- Google Play production release readiness: in-app account deletion, production EAS config, Android assets/screenshots, notification permission
- Android/tablet polish: refreshed Android screenshot sets, bottom-tab/FAB clearance, dashboard/right-panel scroll padding
- Reaction model expansion: SAD reaction added end-to-end across API, schema, icons, and feed/detail UI
- Cross-screen loading UX pass: replace spinner-heavy loading states with reusable skeleton placeholders
- Web cache freshness hardening: prevent stale GET caching after writes (Safari/PWA-sensitive)
- Coach specialties feature: editable specialty tags for coaches/admins with profile display
- Profile screen redesign: skeleton loading, online status indicator, specialties UI, full contact management
- Chat/conversation enhancements: lastActiveAt tracking for online presence
- Android native build completion (TASK001)
- Public journal sharing (already implemented, needs final QA)
- iOS native build validation
- Rate limiting on PIN login and recovery requests (upcoming)

## Recent Changes

### Pull-to-Refresh Parity + Reaction Re-hydration Follow-up (April 22, 2026)
- **HOME + PROFILE PTR PARITY**: Added web/PWA touch pull-to-refresh support to `HomeScreen.tsx` and `ProfileScreen.tsx` using new hook `apps/mobile/hooks/useWebPullToRefresh.ts`; native keeps `RefreshControl`
- **ANDROID SPINNER VISIBILITY**: Added `progressViewOffset={topBarHeight}` in Home feed `RefreshControl` so Android spinner clears the absolute top bar
- **REACTION STATE RELOAD SIGNAL**: `ReactionsStore.ts` now exposes `refreshTick` + `requestRefresh()`; Home/Profile/PostDetail refresh flows trigger global reaction re-hydration for visible cards
- **COACH RIGHT PANEL FILTER FIX**: `WebRightPanel.tsx` now filters fetched conversations to those owned by the current coach (`c.coachId === userId`) before rendering side-panel previews
- **ASSET CLEANUP**: Replaced `apps/mobile/assets/favicon.png` and removed legacy placeholders `icon-old.png` and `logo-old.png`

### Play Listing Asset Finalization + Version Bump (April 22, 2026)
- **ANDROID BUILD NUMBER**: `apps/mobile/app.json` `android.versionCode` increased from `5` to `6` for the next Play submission artifact
- **PHONE SCREENSHOT REFRESH**: Updated Android phone screenshots in `apps/mobile/assets/screens/android-phone/` (`feed`, `journal`, `login`, `notifications`, `profile`, `spaze-coach`)
- **NEW PLAY LISTING ASSETS**: Added `apps/mobile/assets/feature-graphic.png`, `apps/mobile/assets/play-store-icon-512.png`, and curated feature tiles under `apps/mobile/assets/features/01-05.png`
- **ADDITIONAL OVERVIEW DOC**: Added `apps/mobile/overview/child-safety.html` for policy/compliance references alongside the existing privacy policy materials

### Google Play Release Readiness + Android Asset Refresh (April 22, 2026)
- **PLAY POLICY / ACCOUNT DELETION**: Added owner-only `DELETE /api/users/:userId` in `userController.ts` and registered it in `userRoutes.ts`; deletion hard-removes the user via Prisma transaction and explicitly clears `RecoveryRequest` rows by `displayName`
- **PROFILE DANGER ZONE**: `ProfileScreen.tsx` now exposes an in-app "Delete my account" action under Preferences using `showConfirm()` plus `apiDeleteAccount()`, then clears local session via `logoutUser()`
- **PLAY BUILD CONFIG**: `apps/mobile/eas.json` pins Android NDK `26.1.10909125` for production builds and switches submit track from `internal` to `production`; `apps/mobile/app.json` now requests `POST_NOTIFICATIONS` and bumps `versionCode` to `5`
- **ANDROID BRAND ASSETS**: Refreshed app icons/splash assets under `apps/mobile/assets/` and matching web/public icons under `apps/mobile/public/`; overview site now uses Android phone/tablet screenshots instead of iPhone/iPad imagery
- **PRIVACY POLICY**: `apps/mobile/overview/privacy-policy.html` now documents in-app account deletion (Profile -> Preferences -> Delete Account) and the immediate hard-delete behavior
- **TASK TRACKING**: Added active task `TASK007-google-play-release-readiness.md` and updated task index to track Play release work separately from the older Android native build task

### SAD Reaction + Staff Awareness Notifications (April 22, 2026)
- **REACTION MODEL**: Added `SAD` to the shared `ReactionType` union (`packages/types/index.ts`), Prisma enum (`server/prisma/schema.prisma`), and migration `server/prisma/migrations/20260421210845_add_sad_reaction/migration.sql`
- **UI ICONOGRAPHY**: New `SadIcon` in `ReactionIcons.tsx` backed by `apps/mobile/assets/sad-icon.png`; PostCard and PostDetail reaction pickers now include the SAD option with label, gradient, counts, and icon rendering
- **API VALIDATION**: Comment reaction routes in `server/src/api/postRoutes.ts` now allow `SAD`
- **NOTIFICATIONS**: Reaction notifications map `SAD` to `😢`; new `notifyCoachesOfNewMemberPost()` alerts all coaches/admins when a regular member publishes a post

### Android/Tablet Layout Polish (April 22, 2026)
- **HOME FAB**: Home screen now animates the floating action button together with the top bar and keeps it above the native BottomTabBar using platform-aware bottom spacing
- **JOURNAL FAB + SIDE PANEL**: Journal FAB bottom spacing increased to clear the BottomTabBar; side panel switched to a padded scroll-content container; ruled lines are now `pointerEvents="none"`
- **COACH DASHBOARD**: Replaced nested FlatLists with ScrollView-based rendering in member/coach cards to avoid virtualized-list warnings inside the outer ScrollView; mobile card spacing and bottom clearance adjusted
- **WEB RIGHT PANEL / SPAZE COACH**: Added extra native bottom padding for right-rail content and adjusted coach carousel padding for tablet/native comfort

### Loading Skeleton System + GET Cache Freshness Hardening (April 19, 2026)
- **NEW COMPONENT**: Added `apps/mobile/components/LoadingSkeletons.tsx` with reusable skeleton presets for feed posts, journal cards, notifications, conversations, coach cards, chat bubbles, and post detail placeholders
- **HOME FEED**: Replaced initial `ActivityIndicator` with `PostFeedSkeleton`; loading overlay now aligns below top bar; composer feeling picker now anchors to the pressed button via `measureInWindow` instead of always centering
- **JOURNAL/NOTIFICATIONS/CHAT/CONVERSATIONS/COACH**: Replaced loading spinners with matching skeleton UIs and updated loading container alignment to top-stacked layouts
- **POST DETAIL**: Replaced full-screen spinner with `PostDetailSkeleton`
- **POSTCARD MODAL**: Made picker backdrop fully transparent and increased role badge vertical padding (`2 -> 4`) for better readability
- **API CLIENT HARDENING** (`apps/mobile/services/api.ts`):
  - Adds `Cache-Control: no-cache` + `Pragma: no-cache` headers to all GET requests to avoid stale browser cache responses after writes
  - Adds `invalidateInflight(urlPrefix)` helper and applies it after create/update/delete post actions so next reads always refetch fresh data
- **SERVER CORS UPDATE** (`server/src/index.ts`): Allows `Cache-Control` and `Pragma` headers in CORS `allowedHeaders`
- **DEPLOY GUARDRAIL**: Restored `apps/mobile/app.json` `extra.apiUrl` back to production (`https://api.puso-spaze.org`) after local dev override to `http://localhost:4000`

### Coach Specialties + Profile Redesign (April 19, 2026)
- **SCHEMA**: Added `users.specialties TEXT[]` for storing coach/admin specialty tags (e.g., ["Wellness", "Support"])
- **MIGRATION**: New `server/prisma/migrations/20260419125058_add_specialties/migration.sql` to add specialties column
- **USER API**: New `PATCH /api/users/:userId/specialties` endpoint in `userController.ts` that validates, trims, and stores up to 10 specialties (max 30 chars each)
- **TYPES**: `CoachProfile` now includes `lastActiveAt` and `specialties`; `GetMessagesResponse` includes `otherLastActiveAt`
- **PROFILE SCREEN REDESIGN** (`ProfileScreen.tsx` — 812 lines changed):
  - Added `SkeletonBox` component for animated loading states (new file)
  - Owner profile: Specialties editing UI (add/remove tags, save to API)
  - Non-owner profile: Read-only specialties display
  - Online status indicator: Shows "online" if user was active in last 15 min (non-owner only)
  - Contact info visibility check: Only shows contact section if user has filled any contact fields
  - Full profile restructure: Improved layout for specialties, updated data fetching to include user info
- **USER CONTEXT**: Added `specialties: string[]` state and `updateSpecialties()` method; storage key `puso_specialties`
- **API CLIENT**: New `apiUpdateSpecialties(userId, specialties)` function; updated `apiGetUserById()` call to fetch specialties
- **CHAT SCREEN**: 95 lines updated to handle `otherLastActiveAt` for online presence display
- **CONVERSATION CONTROLLER**: 13 lines updated to return `otherLastActiveAt` in message responses
- **UI POLISH**: CoachDashboard mobile cards now full-width (changed `false` → `true` in card render); padding adjustments

### Safari Reaction Tint Cache Fix (April 19, 2026)
- **ICON REMOUNT SAFEGUARD**: `renderReactionIcon()` in `PostCard.tsx` and `PostDetailScreen.tsx` now assigns a stable key composed of `reactionType + color` so reaction icon components remount when tint color changes
- **WEBKIT MASK CACHE WORKAROUND**: Addresses Safari behavior where CSS mask-image tint can stay stale inside animated/composited layers after reaction select/deselect transitions
- **ANIMATION INTERACTION SAFETY**: Added `pointerEvents="none"` to the animated icon wrapper views used in the main reaction buttons to ensure overlays never intercept taps during scale animations

### Facebook-Style Reaction Picker + Haptics + Press Animation (April 19, 2026)
- **REACTION PICKER REDESIGN**: `PostCard.tsx` and `PostDetailScreen.tsx` now use anchor-positioned gradient bubble pickers (Facebook-style). Long-press measures `measureInWindow` on the reaction button to place the picker just above it; fallbacks center-above for unknown positions
- **GRADIENT BUBBLES**: Each reaction type has its own LinearGradient (using theme tokens), replacing the flat icon/label rows. Active state adds a 2px primary border ring. Pressed bubble animates scale-up + translate-up with a tooltip label
- **STAGGER ANIMATION**: Picker entrance uses per-item staggered interpolation (opacity + scale + translateY), plus a combined scale+translateY spring on the pill itself
- **HAPTICS**: New `apps/mobile/utils/haptics.ts` wraps `expo-haptics` with Platform guards (`tapLight`, `tapMedium`); `expo-haptics` added to `apps/mobile/package.json`
- **PRESS ANIMATION**: New `apps/mobile/hooks/usePressAnimation.ts` provides `scale` + `bgOpacity` Animated values for reaction button press feedback; `reactionPressBg` overlay fades in for web where haptics are unavailable
- **CONTEXT MENU SUPPRESSOR**: New `apps/mobile/utils/suppressWebMenu.ts` provides `installContextMenuSuppressor()` (document-level listener) and `suppressWebMenu()` / `noSelectStyle` helpers; installed in `App.tsx` on mount; applied to PostCard long-press and PostDetail comment rows to prevent browser right-click/context popup
- **DEPS**: `expo-haptics ~55.0.14` added and installed

### PostCard & PostDetail Reaction UX Fix + Break-It Adversarial QA (April 19, 2026)
- **POSTCARD CLEANUP**: Removed unused `reactionLoading` state; guard `closePicker()` only when picker is open (prevents close-on-every-reaction calls)
- **POST DETAIL STYLE**: Compacted `reactionBtn` padding (`16/8 → 4/4`), removed pill shape (borderRadius/backgroundColor) for a tighter icon-only interaction target
- **NEW QA TOOL**: `quality/qa-tests/break-it.mjs` — 631-line adversarial OWASP Top 10 (2021) test suite targeting authentication, access control, injection, rate limiting, and edge-case surfaces; results written to `quality/results/` (gitignored)

### Full-Stack Performance Pass (April 18, 2026)
- **SCHEMA + MIGRATION**: Added performance indexes in `server/prisma/schema.prisma` with migration `server/prisma/migrations/20260418155124_perf_indexes/migration.sql` for `posts(createdAt, moderationStatus)`, `comments(postId, moderationStatus)`, `reactions(postId)`, `users(lastActiveAt)`, and `invite_codes(used)`
- **DASHBOARD STATS PATH**: `server/src/index.ts` now uses lightweight in-process TTL caching for expensive aggregates and computes trending tags with SQL `unnest(tags)` grouping instead of app-layer flattening
- **COACH QUEUE BOUNDING**: `server/src/controllers/coachController.ts` review queue now caps post/comment fetches to 100 rows each to avoid large moderation payload spikes
- **REACTION SYNC MODEL**: Added global Zustand store `apps/mobile/context/ReactionsStore.ts`; `PostCard.tsx` and `PostDetailScreen.tsx` now share optimistic reaction state with rollback snapshots to prevent cross-screen desync/race clobbering
- **FEED RENDER COST REDUCTION**: `PostCard.tsx` now uses narrow `UserContext` selectors plus `React.memo` to avoid mass card rerenders from unrelated profile-store changes
- **LIST + POLLING OPTIMIZATIONS**: `CoachDashboard.tsx` and `SpazeCoachScreen.tsx` moved large mapped lists to `FlatList`; `ChatScreen.tsx` switched from fixed `setInterval` to adaptive polling cadence based on web visibility/native app state
- **API REQUEST DEDUP EXPANSION**: `apps/mobile/services/api.ts` applies `deduplicatedGet()` to coach review/members/coaches and conversations endpoints

### Coach Roster Dashboard + QA Alignment (April 18, 2026)
- **COACH API**: Added `GET /api/coach/coaches?coachId=...` in `server/src/api/coachRoutes.ts` and `getCoaches()` in `coachController.ts` to return all `COACH` + `ADMIN` users for dashboard roster display
- **COACH DASHBOARD UI**: `CoachDashboard.tsx` now loads and displays separate Members and Coaches cards, adds admin badges in the coach list, and converts the right rail into a scrollable panel for denser dashboard content
- **BADGE/SCROLL CLEANUP**: Removed coach dashboard dependencies on shared scroll-to-top and review badge stores; moderation/delete actions now update local state only
- **CLIENT API**: Added `apiGetCoaches()` and `CoachSummary` in `apps/mobile/services/api.ts`
- **QA UPDATES**: `quality/qa-tests/full-qa-pass.mjs` now reflects current behavior for optional `deviceId`, username+PIN login, notification toggle payload shape, report endpoint naming, dashboard stats path, and recovery request route/body
- **QA AGENT**: `.github/agents/qa-tester.agent.md` now explicitly instructs QA work to use architecture and memory-bank context when planning coverage

### Overview Carousel Mobile Centering Tweak (April 18, 2026)
- **OVERVIEW CSS**: Updated mobile rule for `.carousel-slide` in `apps/mobile/overview/index.html` to include `align-items: center` so mixed phone/tablet screenshots remain vertically centered on narrow screens
- **DEPLOY SCOPE**: Presentation-only web overview CSS adjustment; no runtime API, schema, or auth behavior changes

### Overview Screenshot Asset Cleanup (April 18, 2026)
- **ASSET DEDUP**: Removed accidental duplicate file `apps/mobile/assets/screens/iphone/iphone-feed.png.png`
- **PRIMARY FEED SCREENSHOT**: Updated `apps/mobile/assets/screens/iphone/iphone-feed.png` and kept `overview/index.html` pointing to the canonical filename
- **DEPLOY SCOPE**: No API/schema/runtime logic changes; this pass is content/asset cleanup for overview presentation quality

### PIN Auth Update + UI Polish Pass (April 18, 2026)
- **SCHEMA**: Removed unique constraint on `users.pin` (`server/prisma/schema.prisma`) and added migration `20260418093238_remove_pin_unique_constraint`
- **AUTH API**: `POST /api/auth/pin-login` now requires `{ displayName, pin, deviceId? }` and validates user by display name + PIN pair
- **USER CONTROLLER**: PIN generation simplified to random 6-digit generation (no collision probing/fallback length escalation)
- **NOTIFICATIONS API**: `registerWebPushSubscription` now handles Prisma `P2025` with 404 user-not-found response
- **AI SERVICES**: Encouragement generation uses `gpt-5.4-mini`; OpenAI token option switched to `max_completion_tokens`
- **UI POLISH**: Compact time chips (`m/h/d`) applied in `PostCard` and `PostDetailScreen`; Home top bar safe-area handling improved; coach and notifications badge state sync improved
- **ASSET REFRESH**: Updated iPad/iPhone screenshot assets and added notification screen variants under `apps/mobile/assets/screens/`

### Profile Routing + Website Contact + Native Splash Hold (April 18, 2026)
- **SCHEMA**: Added `users.website` in Prisma (`server/prisma/schema.prisma`) with migration `20260418090022_add_website_contact_field`
- **USER API**: `GET /api/users/:userId` now returns richer public fields (`bio`, contact links including `website`) for non-owner profile viewing
- **CONTACTS API**: `getContacts` and `updateContacts` now include `website`
- **CLIENT TYPES/API**: `ContactInfo` + auth response shapes include `website`/`bannerUrl`; API adds `apiGetUserById()`
- **PROFILE SCREEN**: `ProfileScreen.tsx` now supports route-driven profile lookup (`Profile` with optional `userId`) and owner/non-owner behavior split (edit controls hidden for non-owner)
- **POST CARD NAVIGATION**: Author row now routes to `Profile` for non-system, non-protected anonymous authors
- **SESSION SYNC**: User store now persists `bannerUrl`/`avatarUrl` when server session is revalidated
- **NATIVE SPLASH**: `App.tsx` integrates `expo-splash-screen` to hold native splash until fonts load; iOS storyboard updated accordingly
- **WEB OVERVIEW**: `apps/mobile/overview/index.html` adds “Get the App” section + PWA install instruction tabs

### PWA Performance Optimization (April 18, 2026)
- **NEW UTIL**: `apps/mobile/utils/optimizeImage.ts` — `optimizeCloudinaryUrl(url, w)` appends Cloudinary transformation params (`f_auto`, `q_auto`, `w_<n>`) for auto-format and responsive sizes
- **SERVICE WORKER**: `sw.js` gains install/activate/fetch handlers: Cloudinary images → cache-first; API GET → network-first with stale offline fallback; static bundles → stale-while-revalidate
- **API CLIENT**: `deduplicatedGet()` added to `services/api.ts` — prevents duplicate concurrent GETs (posts, notifications, stats) triggered by HomeScreen focus events
- **SERVER**: Added `compression` middleware (gzip/brotli) and `Cache-Control: public, max-age=30, stale-while-revalidate=120` header for `/api/posts` and `/api/stats` GET endpoints
- **CLOUDINARY**: Upload transformer updated to apply `quality:auto` + `fetch_format:auto` at upload time — images stored in WebP/AVIF where supported
- **expo-image**: `Image` component in `PostCard`, `HomeScreen`, `PostDetailScreen` switched from RN core `Image` to `expo-image` for disk+memory caching and fade transitions; all src urls pass through `optimizeCloudinaryUrl()`
- **DEPS**: Added `expo-image` to mobile, `compression` + `@types/compression` to server

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
- Validate pull-to-refresh behavior on Home + Profile across Android emulator and installed PWA (gesture threshold, indicator visibility, refresh trigger stability)
- Verify coach right-panel conversation filter against real multi-coach data to ensure no cross-coach leakage in previews
- Run the production Android EAS build and verify Play track submission flow with the pinned NDK setup
- Smoke-test delete-account behavior on device/emulator: account removal, logout, and inability to reauthenticate after deletion
- Review coach-notification volume from the new member-post alerts in production and confirm it is not too noisy for staff
- Finalize Google Play listing assets and store metadata using the refreshed Android screenshots
- Monitor dashboard cache hit behavior and query timings in production logs after deploy
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
