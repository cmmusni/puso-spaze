# Active Context — PUSO Spaze

**Last Updated:** April 16, 2026

## Current Work Focus
- Memory bank & documentation update
- Android build & testing (Expo EAS + Android Studio)
- Security hardening (15 bug fixes completed)

## Recent Changes

### Encouragement System Refactor (April 13–16, 2026)
- **DELETED**: `encouragementScheduler.ts`, `appConfigService.ts`, `ENCOURAGEMENT_FEATURE.md`
- **NEW**: `biblicalEncouragementService.ts` — standalone OpenAI-powered encouragement generator (Taglish, Gen Z tone, 1-3 sentences)
- **NEW**: `dailyReflectionService.ts` — daily biblical reflection with in-memory per-day caching + personalization based on user's recent posts
- **NEW**: `reflectionReminderScheduler.ts` — daily push notification scheduler (replaces hourly cron with daily reminders)
- **Architecture shift**: "Hourly Hope" automated posts → "Daily Reflections" with personalized content + push reminders

### Dashboard Stats Endpoint (April 13–16, 2026)
- **NEW**: `GET /api/stats/dashboard` — returns `totalMembers`, `dailyStories`, `onlineCount`, `trendingTags`, `dailyReflection` (personalized if userId provided)
- **NEW**: `GET /api/users/:userId/stats` — returns `encouragementsGiven`, `totalReflections`, `streak`
- **Client**: `apiGetDashboardStats()`, `apiGetUserStats()` added to `services/api.ts`

### Security Audit — 15 Bug Fixes (April 13, 2026)
- **BUG-001**: Race condition on concurrent reactions → try/catch P2002/P2025
- **BUG-002**: POST_MAX_LENGTH 1000→500 (server/client sync)
- **BUG-003**: Comment min length 1→3
- **BUG-004**: Malformed JSON 500→400
- **BUG-005**: Journal PATCH fields made optional
- **BUG-006**: User-facing `POST /api/posts/:postId/report` endpoint
- **BUG-007**: XSS — `stripHtmlTags()` on all content entry points
- **BUG-008**: Null byte injection — global middleware strips from body+query
- **BUG-009–011**: IDOR on PIN read/write, username change (ownership checks)
- **BUG-012**: IDOR on anonymous toggle + notifications + avatar
- **BUG-013**: XSS in journal entries
- **BUG-014**: Nested JSON depth check (>10 levels → 400)
- **BUG-015**: Journal read authorization gap (ownership check on GET)
- **Hardening**: JSON body limit 1mb→100kb, error handler uses `err.status`, null byte sanitization on keys+query params

### Schema Additions
- `webPushSubscription` (Json?) — Web Push API subscription on User model
- `lastActiveAt` (DateTime) — tracks user activity for online count
- `AppConfig` model — minimal config container (id, createdAt, updatedAt)

### SendInviteScreen Cleanup (April 16, 2026)
- Removed all Hourly Hope references; now purely an admin invite management tool

### Previous Session (April 12, 2026)
- PIN-based cross-device login + account recovery system
- JWT authentication on all write endpoints
- Magic bytes upload validation
- Web deviceId persistence

## Next Steps
- Complete Android APK build and test on physical tablet
- Deploy all changes to production (set `JWT_SECRET`, `ADMIN_SECRET` env vars)
- Add functional tests for daily reflection, user stats, and security fixes
- Update QUALITY.md with new scenarios for daily reflections and security hardening

## Active Decisions
- "Hourly Hope" replaced by "Daily Reflections" (personalized, cached per-day, push notifications)
- All write API endpoints require JWT auth; read endpoints remain public
- PIN-based cross-device login as alternative to device-bound identity
- Recovery requests require coach review with user history verification
- Global middleware strips null bytes from all request bodies + query params
- JSON body limit set to 100kb; nesting depth limited to 10 levels
- All user-scoped mutation AND read endpoints verify ownership via JWT userId
