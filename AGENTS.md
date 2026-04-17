# AGENTS.md — PUSO Spaze

> Read this file first before making any changes to this project.

## Project Description

**PUSO Spaze** is a faith-based mental wellness community app for everyone, especially Gen Z and younger generations. Users share emotional struggles (anonymously or publicly), receive AI-moderated biblical encouragement, and connect with trained coaches. The app runs on web and mobile (Expo/React Native) with an Express+Prisma+PostgreSQL backend.

**One-sentence summary:** A safe, AI-moderated community space where anyone — especially Gen Z and younger generations — can share feelings, get biblical encouragement, and talk to coaches — with content moderation, anonymous posting, PIN-based cross-device login, account recovery, and push notifications.

## Quick Setup

### Server
```bash
cd server
npm install
cp .env.example .env          # Set DATABASE_URL (required), OPENAI_API_KEY (optional)
npx prisma migrate dev
npx prisma db seed             # Optional: seed test data
npm run dev                    # Starts on port 4000
```

### Mobile App
```bash
cd apps/mobile
npm install
npx expo start                 # Web: press w, iOS: press i
```

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or Railway)
- Optional: OpenAI API key (moderation + encouragement), Resend API key (emails)

## Build & Test

```bash
# Server tests (Node built-in test runner)
cd server && npm test

# Quality playbook functional tests
npx tsx --test quality/functional.test.ts

# Server build
cd server && npm run build

# Prisma operations
cd server && npx prisma studio      # Visual DB browser
cd server && npx prisma migrate dev  # Run migrations
```

## Architecture Overview

```
apps/mobile/          — Expo/React Native universal app (web + iOS + Android)
  screens/            — 13 screens (Home, Post, Profile, Journal, Chat, Coach, etc.)
  components/         — Shared UI (PostCard, WebSidebar, BottomTabBar, etc.)
  services/api.ts     — API client (Axios-based)
  context/            — UserContext (Zustand), ThemeContext
  hooks/              — usePosts, useUser, useNotifications
  constants/theme.ts  — Design tokens (colors, fonts, spacing, shadows)
  navigation/         — Drawer navigator + web layout wrapper

server/               — Express + Prisma + PostgreSQL
  src/controllers/    — Route handlers (post, comment, user, reaction, admin, coach, journal, notification, conversation, auth, recovery)
  src/services/       — Business logic (moderation, biblicalEncouragement, dailyReflection, reflectionReminder, streakReminder, pendingChatReminder, notifications, mentions)
  src/config/         — env.ts (env vars), db.ts (Prisma client), cloudinary.ts (image hosting)
  src/middlewares/    — Logger, validation, requireAuth (JWT)
  src/utils/          — jwt.ts, sanitize.ts, generateAnonUsername, validateImageMagicBytes
  prisma/             — Schema, migrations, seed

packages/types/       — Shared TypeScript types (User, Post, Comment, etc.)
packages/core/        — Shared utilities (generateAnonUsername)
```

### Data Flow
```
User Input → Client Validation → API Request → Express Router
  → Controller → Moderation Service (local keyword + OpenAI) → Prisma → PostgreSQL
  → Response (filtered by moderationStatus) → Client renders
```

### External Services
- **OpenAI**: Content moderation API + chat completions for daily reflections & encouragement
- **Cloudinary**: Image hosting for post images and avatars (replaced local disk storage for Railway compatibility)
- **Resend**: Email delivery (new user alerts, invite codes)
- **Expo Push / Web Push**: Push notifications (native + web)
- **Railway**: PostgreSQL hosting (production)
- **Vercel**: Web frontend hosting

## Key Design Decisions

1. **Moderation-first**: Every post and comment is AI-moderated before publishing. Content defaults to REVIEW on moderation failure — never silently approved.
2. **Anonymous mode**: Users can toggle anonymous posting. Anonymous posts get a persistent randomly generated display name stored on the User record (`anonDisplayName`). The same name is reused across all anonymous posts and comments.
3. **Daily Reflections**: Personalized AI-generated biblical reflections (replaces Hourly Hope). Cached per-day, personalized to user's recent emotional context. Daily push notification reminders to opted-in users.
4. **Device binding + PIN auth**: Usernames are bound to device IDs. Users get a unique 6-digit PIN for cross-device login. Locked-out users can submit recovery requests reviewed by coaches.
5. **JWT auth**: All write endpoints require JWT Bearer tokens (7-day expiry). Read endpoints are public.
6. **Multi-platform**: Same codebase serves web (via Vercel) and native (via Expo). Navigation uses drawer on native, sidebar/bottom tabs on web.
7. **Visit-based streaks**: Streaks are updated from Home screen visits (`POST /api/users/:userId/record-visit`) rather than inferred from posting/journal activity; reminders are sent before local day-end.
8. **Coach response nudges**: Pending member messages trigger coach reminders every 15 minutes once a 1-hour reply threshold is crossed.

## Known Quirks

- `OPENAI_API_KEY` not set → moderation returns SAFE for everything (dangerous in production — see `quality/QUALITY.md` Scenario 2)
- `ADMIN_SECRET` has a hardcoded default `pusocoach_admin_2026` — must be overridden in production (Scenario 6)
- `JWT_SECRET` has a hardcoded default in dev — must be overridden in production (startup warning logged)
- Encouragement system refactored: `encouragementScheduler.ts` replaced by `biblicalEncouragementService.ts`, `dailyReflectionService.ts`, and `reflectionReminderScheduler.ts`
- File uploads: All images uploaded to Cloudinary. Avatar uploads validate magic bytes; post image uploads use header-based MIME check only (Scenario 8)
- Anonymous mode leaks real `displayName` in notification payloads (Scenario 4)
- Device ownership check is bypassable by omitting `deviceId` — mitigated by JWT auth + PIN (Scenario 5)
- `getPosts`, `getComments`, `getJournals`, `getConversations`, `getMessages` have no pagination limits (Scenario 10)
- Coach review queue exists (`GET /api/coach/review`) but has no automated escalation for stale REVIEW posts (Scenario 7)
- Notification delivery is fire-and-forget — push failures are logged but not retried (Scenario 9)
- PIN login has no rate limiting — brute-force risk for 6-digit PINs (Scenario 11)
- Recovery request endpoint is public (no auth) — potential spam vector (Scenario 12)

## Quality Docs

This project has a quality playbook. Read these before making changes:

- [`quality/QUALITY.md`](quality/QUALITY.md) — Quality constitution (12 fitness scenarios, coverage targets, theater prevention)
- [`quality/functional.test.ts`](quality/functional.test.ts) — Automated functional tests (run: `npx tsx --test quality/functional.test.ts`)
- [`quality/qa-tests/full-qa-pass.mjs`](quality/qa-tests/full-qa-pass.mjs) — Full QA pass (100+ API tests, 18 sections — run: `node quality/qa-tests/full-qa-pass.mjs`)
- [`quality/qa-tests/new-features-qa.mjs`](quality/qa-tests/new-features-qa.mjs) — New feature tests (anon names, stats)
- [`quality/RUN_CODE_REVIEW.md`](quality/RUN_CODE_REVIEW.md) — Code review protocol with guardrails
- [`quality/RUN_INTEGRATION_TESTS.md`](quality/RUN_INTEGRATION_TESTS.md) — Integration test protocol
- [`quality/RUN_SPEC_AUDIT.md`](quality/RUN_SPEC_AUDIT.md) — Council of Three spec audit protocol

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OPENAI_API_KEY` | No | `''` | Content moderation + encouragement generation |
| `ADMIN_SECRET` | No | `pusocoach_admin_2026` | Admin endpoint auth (MUST override in prod) |
| `JWT_SECRET` | No | Hardcoded dev default | JWT signing secret (MUST override in prod) |
| `RESEND_API_KEY` | No | `''` | Email sending (new user alerts, invite codes) |
| `PORT` | No | `4000` | Server port |
| `ALLOWED_ORIGINS` | No | Production URLs | CORS allowed origins |
| `CLOUDINARY_CLOUD_NAME` | No | `''` | Cloudinary cloud name for image uploads |
| `CLOUDINARY_API_KEY` | No | `''` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | `''` | Cloudinary API secret |
| `HOURLY_HOPE_AUTO_COMMENT_ENABLED` | No | `true` | Auto-comment on user posts with encouragement |
| `NEW_USER_ALERT_TO` | No | `''` | Comma-separated emails for signup alerts |
