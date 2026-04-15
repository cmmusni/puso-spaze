# Progress — PUSO Spaze

**Last Updated:** April 16, 2026

## What Works
- **Authentication** — Username-based login (custom or anonymous), coach login via invite codes, device binding (native + web), **JWT token auth on all protected endpoints**, **PIN-based cross-device login** (6-digit PIN auto-generated, used for login from new devices)
- **Account Recovery** — Coach-reviewed recovery requests for locked-out users; coaches see user's post/journal history for identity verification; approval clears device binding
- **Posting** — Create posts with text + optional image, tags, anonymous mode
- **Reactions** — Pray, Care, Support reactions on posts (race-condition hardened)
- **Comments** — Threaded comments with @mentions, edit/delete support (min 3 chars enforced)
- **Moderation** — AI auto-moderation (OpenAI), coach review dashboard with approve/reject, Unicode homoglyph normalization, zero-width stripping, 97 blocked terms + 10 contextual phrase patterns
- **Notifications** — In-app notification system, push notifications (native + web push subscription support)
- **Journal** — Private entries with mood tracking, calendar view, streak tracking, mood bloom stats (ownership-verified)
- **1:1 Chat** — Conversations between users and coaches
- **Daily Reflections** — AI-generated personalized biblical reflections (replaces Hourly Hope); cached per-day; personalized to user's recent emotional context; daily push notification reminders
- **Dashboard Stats** — `GET /api/stats/dashboard` with totalMembers, dailyStories, onlineCount, trendingTags, dailyReflection; `GET /api/users/:userId/stats` with user engagement stats
- **Profile** — Avatar, anonymous toggle, notification settings, **PIN display/edit**
- **Admin** — Invite code management, post pinning, content deletion, **device reset**
- **Security** — Magic bytes validation for image uploads (JPEG, PNG, GIF, WebP), MIME allowlist, JWT auth, IDOR protection on all user-scoped endpoints, XSS sanitization (posts, comments, journals), null byte injection prevention, JSON depth limiting, payload size limiting
- **Dark Mode** — Theme toggle with persistence
- **Web deployment** — Vercel (frontend), Railway (server + database)
- **Responsive UI** — Mobile-first design with breakpoints for tablet and wide web
- **User reporting** — `POST /api/posts/:postId/report` allows any user to flag content for review

## Quality Status (April 16, 2026)
- **Functional tests**: 56/56 passing — spec requirements (13), fitness scenarios (24), boundary tests (19)
- **Server unit tests**: 2/2 passing (commentController)
- **Playwright webapp tests**: 20/20 passing (login edge cases)
- **Dark mode audit**: Available (quality/dark-mode-audit.spec.ts)
- **Security audit**: 15 bugs fixed (3 critical, 2 high, 8 medium, 2 low) — all IDOR, XSS, null byte, and validation issues resolved
- **Test-to-source sync**: Replicated moderation logic fully synced with production moderationService.ts (April 12, 2026)
- **Needs update**: Functional tests need daily reflection, user stats, and security hardening tests

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
The platform is **functional and deployed** on web. Native builds are being set up. Core features (posts, comments, reactions, moderation, journal, chat, daily reflections) are complete. JWT auth + PIN-based cross-device login + account recovery protect all write endpoints and enable device migration. A comprehensive security audit fixed 15 vulnerabilities. The encouragement system has been refactored from "Hourly Hope" (automated posts every hour) to "Daily Reflections" (personalized, cached daily, with push reminders). Focus is on native deployment, quality tests for new features, and UI polish.

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
