# Progress — PUSO Spaze

**Last Updated:** April 12, 2026

## What Works
- **Authentication** — Username-based login (custom or anonymous), coach login via invite codes, device binding (native + web), **JWT token auth on all protected endpoints**, **PIN-based cross-device login** (6-digit PIN auto-generated, used for login from new devices)
- **Account Recovery** — Coach-reviewed recovery requests for locked-out users; coaches see user's post/journal history for identity verification; approval clears device binding
- **Posting** — Create posts with text + optional image, tags, anonymous mode
- **Reactions** — Pray, Care, Support reactions on posts
- **Comments** — Threaded comments with @mentions, edit/delete support
- **Moderation** — AI auto-moderation (OpenAI), coach review dashboard with approve/reject, Unicode homoglyph normalization, zero-width stripping, 97 blocked terms + 10 contextual phrase patterns
- **Notifications** — In-app notification system, push notifications (native)
- **Journal** — Private entries with mood tracking, calendar view, streak tracking, mood bloom stats
- **1:1 Chat** — Conversations between users and coaches
- **Encouragement** — Hourly AI-generated biblical encouragement posts (Taglish, Gen Z tone)
- **Profile** — Avatar, anonymous toggle, notification settings, **PIN display/edit**
- **Admin** — Invite code management, post pinning, content deletion, **device reset**
- **Security** — Magic bytes validation for image uploads (JPEG, PNG, GIF, WebP), MIME allowlist, JWT auth
- **Dark Mode** — Theme toggle with persistence
- **Web deployment** — Vercel (frontend), Railway (server + database)
- **Responsive UI** — Mobile-first design with breakpoints for tablet and wide web

## Quality Status (April 12, 2026)
- **Functional tests**: 56/56 passing — spec requirements (13), fitness scenarios (24), boundary tests (19)
- **Server unit tests**: 2/2 passing (commentController)
- **Playwright webapp tests**: 20/20 passing (login edge cases)
- **Dark mode audit**: Available (quality/dark-mode-audit.spec.ts)
- **QUALITY.md**: Scenarios 1, 5, 8 updated with mitigation status; new scenarios needed for PIN/recovery
- **Test-to-source sync**: Replicated moderation logic fully synced with production moderationService.ts (April 12, 2026)
- **Needs update**: Functional tests need PIN validation, recovery request flow, and magic bytes validation tests

## What's Left to Build
- Android APK build (in progress — Gradle project importing in Android Studio)
- iOS build and testing
- Performance optimization for large post feeds
- Offline support / caching
- Email notifications for coaches
- Automated REVIEW post escalation (Scenario 7)

## Current Status
The platform is **functional and deployed** on web. Native builds are being set up. Core features (posts, comments, reactions, moderation, journal, chat) are complete. JWT auth + PIN-based cross-device login + account recovery protect all write endpoints and enable device migration. Focus is on native deployment, quality playbook update, and UI polish.

## Known Issues
- `JWT_SECRET` uses a hardcoded default in dev — must be overridden in production (startup warning logged)
- EAS local build failed (environment/dependency issue) — using Android Studio prebuild as alternative
- `flexWrap` with `flex: 1` spacer doesn't push items right on mobile — use separate rows or `marginLeft: 'auto'`
- PIN collision: `generateUniquePin()` retries 10× with 8-digit fallback — low risk but not zero
- Recovery requests have no rate limiting — potential spam vector for unauthenticated endpoint
