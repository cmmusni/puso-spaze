# Active Context — PUSO Spaze

**Last Updated:** April 17, 2026

## Current Work Focus
- Pre-deployment documentation update (memory bank + AGENTS.md sync)
- Deploy agent enhanced with Step -1 (memory bank update before deploy)
- Full QA test suite created and passing

## Recent Changes

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
- Complete Android APK build and test on physical tablet
- Add functional tests for daily reflection, user stats, and security fixes to `quality/functional.test.ts`
- Update QUALITY.md with new scenarios for daily reflections and Cloudinary uploads

## Active Decisions
- Image uploads moved to Cloudinary (Railway ephemeral filesystem fix)
- Anonymous display names are persistent per-user (frozen on first anonymous action)
- "Hourly Hope" replaced by "Daily Reflections" (personalized, cached per-day, push notifications)
- All write API endpoints require JWT auth; read endpoints remain public
- Deploy agent runs memory bank update as Step -1 before every deployment
