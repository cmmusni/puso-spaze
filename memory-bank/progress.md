# Progress — PUSO Spaze

**Last Updated:** April 17, 2026

## What Works
- **Authentication** — Username-based login (custom or anonymous), coach login via invite codes, device binding (native + web), **JWT token auth on all protected endpoints**, **PIN-based cross-device login** (6-digit PIN auto-generated, used for login from new devices)
- **Account Recovery** — Coach-reviewed recovery requests for locked-out users; coaches see user's post/journal history for identity verification; approval clears device binding
- **Posting** — Create posts with text + optional image (uploaded to Cloudinary), tags, anonymous mode
- **Persistent Anonymous Names** — Users get a randomly generated anonymous display name on first anonymous action; the same name is reused across all anonymous posts and comments
- **Reactions** — Pray, Care, Support reactions on posts (race-condition hardened)
- **Comments** — Threaded comments with @mentions, edit/delete support (min 3 chars enforced)
- **Moderation** — AI auto-moderation (OpenAI), coach review dashboard with approve/reject/flag, Unicode homoglyph normalization, zero-width stripping, 97 blocked terms + 10 contextual phrase patterns
- **Coach Dashboard** — Review queue (`getReviewQueue`), moderate posts/comments (`moderatePost`, `moderateComment`), flag content, view members list
- **Notifications** — In-app notification system, push notifications (native + web push subscription support), moderation action notifications to authors
- **Journal** — Private entries with mood tracking, calendar view, streak tracking, mood bloom stats (ownership-verified)
- **1:1 Chat** — Conversations between users and coaches
- **Daily Reflections** — AI-generated personalized biblical reflections (replaces Hourly Hope); cached per-day; personalized to user's recent emotional context; daily push notification reminders
- **Dashboard Stats** — `GET /api/stats/dashboard` with totalMembers, dailyStories, onlineCount, trendingTags, dailyReflection; `GET /api/users/:userId/stats` with encouragementsGiven, totalReflections, streak
- **Image Uploads** — Cloudinary-hosted (migrated from local disk to fix Railway ephemeral filesystem); avatar + post image upload; magic bytes validation for avatars
- **Profile** — Avatar, anonymous toggle, notification settings, **PIN display/edit**
- **Admin** — Invite code management, post pinning, content deletion, **device reset**
- **Security** — Magic bytes validation for avatars, MIME allowlist, JWT auth, IDOR protection on all user-scoped endpoints, XSS sanitization (posts, comments, journals), null byte injection prevention, JSON depth limiting, payload size limiting
- **Dark Mode** — Theme toggle with persistence
- **Web deployment** — Vercel (frontend), Railway (server + database)
- **Responsive UI** — Mobile-first design with breakpoints for tablet and wide web
- **User reporting** — `POST /api/posts/:postId/report` allows any user to flag content for review
- **Deploy Agent** — Pre-deploy checklist with Step -1 memory bank update, 12 deployment validation checks
- **QA Test Suites** — `full-qa-pass.mjs` (100+ tests, 18 sections), `new-features-qa.mjs` (anon names + stats), `functional.test.ts` (56 spec tests)

## Quality Status (April 17, 2026)
- **Functional tests**: 56/56 passing — spec requirements (13), fitness scenarios (24), boundary tests (19)
- **Full QA pass**: 100+ API tests across 18 sections (smoke, auth, CRUD, security, stress, cross-feature)
- **Server unit tests**: 2/2 passing (commentController)
- **Playwright webapp tests**: 20/20 passing (login edge cases)
- **Dark mode audit**: Available (quality/dark-mode-audit.spec.ts)
- **Security audit**: 15 bugs fixed (3 critical, 2 high, 8 medium, 2 low) — all IDOR, XSS, null byte, and validation issues resolved
- **Needs update**: Functional tests need daily reflection, user stats, Cloudinary, and persistent anon name tests

## What's Left to Build
- Android APK build (in progress — EAS build + Android Studio)
- iOS build and testing
- Performance optimization for large post feeds
- Offline support / caching
- Email notifications for coaches
- Automated REVIEW post escalation (Scenario 7)
- Pagination on `getPosts`, `getComments`, `getJournals`, `getConversations`, `getMessages`
- Rate limiting on PIN login and recovery requests

## Current Status
The platform is **functional and deployed** on web. All core features are complete: posts, comments, reactions, moderation, journal, chat, daily reflections, Cloudinary image uploads, persistent anonymous names, comprehensive coach moderation dashboard, and full QA coverage. JWT auth + PIN-based cross-device login + account recovery protect all write endpoints. A comprehensive security audit fixed 15 vulnerabilities. Image uploads migrated to Cloudinary (Railway ephemeral filesystem fix). Focus is on native deployment, production env var setup, and UI polish.

## Known Issues
- `JWT_SECRET` uses a hardcoded default in dev — must be overridden in production (startup warning logged)
- `ADMIN_SECRET` has hardcoded default `pusocoach_admin_2026` — must be overridden in production
- EAS local build failed (environment/dependency issue) — using Android Studio prebuild as alternative
- `flexWrap` with `flex: 1` spacer doesn't push items right on mobile — use separate rows or `marginLeft: 'auto'`
- PIN collision: `generateUniquePin()` retries 10× with 8-digit fallback — low risk but not zero
- Recovery requests have no rate limiting — potential spam vector for unauthenticated endpoint
- PIN login has no rate limiting — brute-force risk for 6-digit PINs
- `AppConfig` model exists in schema but has no corresponding service (unused)
- `OPENAI_API_KEY` not set → moderation returns SAFE for everything (dangerous in prod)
- Post image uploads use header-based MIME check only (no magic bytes like avatars)
