# Progress — PUSO Spaze

**Last Updated:** April 22, 2026 (10th deployment cycle)

## What Works
- **Authentication** — Username-based login (custom or anonymous), coach login via invite codes, device binding (native + web), **JWT token auth on all protected endpoints**, **PIN-based cross-device login** (6-digit PIN auto-generated, used for login from new devices)
- **PIN Auth Model** — PIN is now validated as `displayName + pin` pair (PIN no longer globally unique), reducing collision sensitivity and keeping cross-device login flow stable
- **Account Recovery** — Coach-reviewed recovery requests for locked-out users; coaches see user's post/journal history for identity verification; approval clears device binding
- **Posting** — Create posts with text + optional image (uploaded to Cloudinary), tags, anonymous mode
- **Persistent Anonymous Names** — Users get a randomly generated anonymous display name on first anonymous action; the same name is reused across all anonymous posts and comments
- **Reactions** — Pray, Care, Support reactions on posts (race-condition hardened)
- **Comments** — Threaded comments with @mentions, edit/delete support (min 3 chars enforced)
- **Moderation** — AI auto-moderation (OpenAI), coach review dashboard with approve/reject/flag, Unicode homoglyph normalization, zero-width stripping, 97 blocked terms + 10 contextual phrase patterns
- **Coach Dashboard** — Review queue (`getReviewQueue`), moderate posts/comments (`moderatePost`, `moderateComment`), flag content, view members list
- **Coach Dashboard Roster** — Dashboard now shows separate members and coaches/admin roster panels via `GET /api/coach/members` and `GET /api/coach/coaches`
- **Notifications** — In-app notification system, push notifications (native + web push subscription support), moderation action notifications to authors
- **Journal** — Private entries with mood tracking, calendar view, streak tracking, mood bloom stats (ownership-verified)
- **1:1 Chat** — Conversations between users and coaches
- **Daily Reflections** — AI-generated personalized biblical reflections (replaces Hourly Hope); cached per-day; personalized to user's recent emotional context; daily push notification reminders
- **Dashboard Stats** — `GET /api/stats/dashboard` with totalMembers, dailyStories, onlineCount, trendingTags, dailyReflection; `GET /api/users/:userId/stats` with encouragementsGiven, totalReflections, streak
- **Streak System** — Visit-based streak tracking: opening HomeScreen counts as daily activity; `POST /api/users/:userId/record-visit` bumps streak; streak resets to 0 if a day is missed; `streakReminderScheduler.ts` sends push notification 3 hours before midnight (PHT) to users at risk of losing their streak; notification navigates to HomeScreen on tap
- **Pending Chat Reminders** — `pendingChatReminderScheduler.ts` checks every 15 minutes for member messages waiting over 1 hour and nudges coaches to respond
- **Splash and Brand Assets** — Animated startup splash flow plus refreshed app/web icon assets integrated across Expo, web public files, and iOS app icon set
- **Image Uploads** — Cloudinary-hosted (migrated from local disk to fix Railway ephemeral filesystem); avatar + post image upload; magic bytes validation for avatars
- **Profile** — Avatar, anonymous toggle, notification settings, **PIN display/edit**, plus persisted banner/bio/contact fields in user store and API
- **Profile Routing** — Post author taps can open profile by `userId`; `ProfileScreen` supports owner vs non-owner rendering, with edit controls gated to owner only
- **Contact Fields** — `website` added end-to-end (Prisma, controller, shared types, API client, Profile UI)
- **Native Splash Lifecycle** — `expo-splash-screen` keeps native splash visible until fonts finish loading
- **Overview Asset Hygiene** — duplicate iPhone feed screenshot asset removed; overview now relies on canonical screenshot filename only
- **Overview Carousel Polish** — mobile carousel slides now vertically center mixed device frames for cleaner presentation in the overview page
- **Admin** — Invite code management, post pinning, content deletion, **device reset**
- **Security** — Magic bytes validation for avatars, MIME allowlist, JWT auth, IDOR protection on all user-scoped endpoints, XSS sanitization (posts, comments, journals), null byte injection prevention, JSON depth limiting, payload size limiting
- **Dark Mode** — Theme toggle with persistence
- **Web deployment** — Vercel (frontend), Railway (server + database)
- **Responsive UI** — Mobile-first design with breakpoints for tablet and wide web
- **Refresh UX Parity** — Native pull-to-refresh coverage on major data screens (including Journal) plus web touch pull-to-refresh indicator/gesture with one-time splash skip on reload
- **Home/Profile Web PTR + Android Offset Fix** — Home and Profile now have web/PWA pull-to-refresh with on-screen indicator; Home native refresh spinner is offset below the absolute top bar to keep refresh feedback visible on Android
- **Global Reaction Re-hydration on Refresh** — Pull-to-refresh now bumps a shared reaction refresh tick so PostCards re-fetch reaction counts/user state after explicit refresh requests
- **Coach Conversation Right-Panel Isolation** — Web right panel now filters conversation previews to the current coach's conversations only
- **PWA Input Zoom Guard** — Touch-web TextInput controls are forced to 16px in WebShell to prevent iPhone Safari auto-zoom on focus
- **User reporting** — `POST /api/posts/:postId/report` allows any user to flag content for review
- **PWA Performance** — SW caching (Cloudinary cache-first, API network-first/stale fallback, static stale-while-revalidate); `expo-image` in PostCard/HomeScreen/PostDetailScreen with memory-disk caching; GET dedup in api.ts; gzip/brotli compression on server; `Cache-Control` on posts+stats; Cloudinary auto-quality+format at upload time
- **Full-Stack Perf Pass** — Added DB indexes for high-traffic feed/moderation queries; dashboard stats now use SQL tag aggregation + TTL cache; coach review queue capped at 100 posts/comments; reaction state is synchronized across feed/detail via global store with optimistic rollback; chat polling is visibility/app-state adaptive; roster lists virtualized with FlatList
- **Reaction Picker UX** — Facebook-style anchor-positioned gradient bubble picker with haptics (`expo-haptics`), press-scale animation, stagger entrance, tooltip labels, and context menu suppressor for web PWA
- **Safari Reaction Tint Stability** — Reaction icons now remount on `type+color` key changes in feed/detail views, preventing stale tinted icons after select/deselect on Safari/WebKit composited layers
- **Coach Specialties** — Coaches and admins can now set and edit specialties (up to 10 tags, 30 chars each) displayed on their profiles; non-owner profile view shows specialties read-only; stored in `users.specialties TEXT[]` with new `PATCH /api/users/:userId/specialties` endpoint
- **Profile Screen Redesign** — Complete ProfileScreen overhaul with SkeletonBox loading states, online status indicator (active within 15 min), specialties editing UI, improved contact visibility logic, better owner/non-owner split, and fullProfilePage rebuild
- **Online Presence Tracking** — `lastActiveAt` now tracked in CoachProfile and GetMessagesResponse for displaying online status across chat/conversation views
- **Reusable Loading Skeletons** — Added `LoadingSkeletons.tsx` and replaced spinner-only initial loading states across Home, Journal, Notifications, Chat, Coach list, Conversations list, and PostDetail with layout-matching skeleton placeholders
- **Feed Freshness After Writes** — API client now applies `no-cache` headers for GET requests and invalidates in-flight `/api/posts` requests after create/update/delete so feed refreshes with fresh data immediately on Safari/web
- **CORS Header Compatibility** — Server CORS allowed headers now include `Cache-Control` and `Pragma` to support explicit client cache-bypass request headers
- **In-App Account Deletion** — Authenticated users can now permanently delete their own account from Profile -> Preferences; server hard-deletes the user and cascaded data, while the client logs out and clears local session state
- **Google Play Release Config** — Android app config now includes `POST_NOTIFICATIONS`, `versionCode` 7, and EAS production builds pin NDK `26.1.10909125` with submit track set to `production`
- **SAD Reaction** — Reaction model now supports `SAD` end-to-end across Prisma, shared types, validation, feed/detail reaction pickers, icons, counts, and notifications
- **Coach Alerts for New Member Posts** — Coaches/admins now receive a system notification when a regular member publishes a new post
- **Android Branding Assets** — App icons, splash art, PWA icons, overview imagery, and Android phone/tablet screenshots refreshed for release materials
- **Android/Tablet Layout Polish** — Home/Journal FAB spacing, coach dashboard/member list scrolling, right-rail bottom padding, and coach carousel spacing adjusted to clear native bottom chrome on tablets and phones
- **Play Listing Asset Pack** — Feature graphic, 512x512 Play icon, feature tiles, and refreshed Android phone screenshots prepared for Play Console submission materials
- **Android Version Bump** — `android.versionCode` advanced to `7` in app config to keep Play upload sequence moving forward
- **Production Prisma Verification** — Railway Postgres public database URL was used to run `prisma migrate deploy` and `prisma migrate status`; production schema is confirmed up to date
- **QA Test Suites** — `full-qa-pass.mjs` (100+ tests, 18 sections), `new-features-qa.mjs` (anon names + stats), `functional.test.ts` (56 spec tests), `break-it.mjs` (OWASP Top 10 adversarial suite)
- **QA Alignment** — Full QA pass script now matches current API contracts for PIN login, recovery requests, report endpoint naming, and notification toggle payloads

## Quality Status (April 17, 2026)
- **Functional tests**: 56/56 passing — spec requirements (13), fitness scenarios (24), boundary tests (19)
- **Full QA pass**: 100+ API tests across 18 sections (smoke, auth, CRUD, security, stress, cross-feature)
- **Server unit tests**: 2/2 passing (commentController)
- **Playwright webapp tests**: 20/20 passing (login edge cases)
- **Dark mode audit**: Available (quality/dark-mode-audit.spec.ts)
- **Security audit**: 15 bugs fixed (3 critical, 2 high, 8 medium, 2 low) — all IDOR, XSS, null byte, and validation issues resolved
- **Needs update**: Functional tests need daily reflection, user stats, Cloudinary, and persistent anon name tests

## What's Left to Build
- Google Play production build + submission smoke test (TASK007)
- Android APK / native build validation (TASK001)
- Validate and finalize profile expansion (banner upload, bio editing, contacts CRUD)
- Validate and finalize public journal sharing feed (`GET /api/journals/public` + `isPublic` create/update flow)
- iOS build and testing
- **Offline support / caching** ✅ (SW asset cache, API stale fallback, image cache-first)
- Email notifications for coaches
- Automated REVIEW post escalation (Scenario 7)
- Pagination on `getPosts`, `getComments`, `getJournals`, `getConversations`, `getMessages`
- Rate limiting on PIN login and recovery requests

## Current Status
The platform is **functional and deployed** on web and is now in Google Play production-readiness work. Core features remain complete across posts, comments, reactions, moderation, journal, chat, daily reflections, Cloudinary image uploads, persistent anonymous names, coach moderation tooling, and full QA coverage. Recent work adds in-app account deletion for Play policy compliance, SAD reaction support, refreshed Android branding/screenshots, and additional tablet/native spacing polish. Focus is on EAS production build validation, Play listing completion, and remaining native smoke tests.

## Known Issues
- `JWT_SECRET` uses a hardcoded default in dev — must be overridden in production (startup warning logged)
- `ADMIN_SECRET` has hardcoded default `pusocoach_admin_2026` — must be overridden in production
- EAS local build failed (environment/dependency issue) — using Android Studio prebuild as alternative
- `flexWrap` with `flex: 1` spacer doesn't push items right on mobile — use separate rows or `marginLeft: 'auto'`
- PIN values are no longer globally unique; security depends on username+PIN pair and still needs rate limiting
- Recovery requests have no rate limiting — potential spam vector for unauthenticated endpoint
- PIN login has no rate limiting — brute-force risk for 6-digit PINs
- `AppConfig` model exists in schema but has no corresponding service (unused)
- `OPENAI_API_KEY` not set → moderation returns SAFE for everything (dangerous in prod)
- Post image uploads use header-based MIME check only (no magic bytes like avatars)
- New member-post coach notifications may be noisy for staff at scale; delivery behavior needs monitoring after rollout
