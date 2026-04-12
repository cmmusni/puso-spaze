# AGENTS.md — PUSO Spaze

> Read this file first before making any changes to this project.

## Project Description

**PUSO Spaze** is a faith-based mental wellness community app for Filipino youth. Users share emotional struggles (anonymously or publicly), receive AI-moderated biblical encouragement, and connect with trained coaches. The app runs on web and mobile (Expo/React Native) with an Express+Prisma+PostgreSQL backend.

**One-sentence summary:** A safe, AI-moderated community space where Filipino Gen Z can share feelings, get biblical encouragement, and talk to coaches — with content moderation, anonymous posting, and push notifications.

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
  services/api.ts     — API client (fetch-based)
  context/            — UserContext (Zustand), ThemeContext
  hooks/              — usePosts, useUser, useNotifications
  constants/theme.ts  — Design tokens (colors, fonts, spacing, shadows)
  navigation/         — Drawer navigator + web layout wrapper

server/               — Express + Prisma + PostgreSQL
  src/controllers/    — Route handlers (post, comment, user, reaction, admin, coach, journal, notification, conversation, auth)
  src/services/       — Business logic (moderation, encouragement, notifications, mentions)
  src/config/         — env.ts (env vars), db.ts (Prisma client)
  src/middlewares/    — Logger, validation
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
- **OpenAI**: Content moderation API + chat completions for biblical encouragement
- **Resend**: Email delivery (new user alerts, invite codes)
- **Expo Push**: Mobile push notifications
- **Railway**: PostgreSQL hosting (production)
- **Vercel**: Web frontend hosting

## Key Design Decisions

1. **Moderation-first**: Every post and comment is AI-moderated before publishing. Content defaults to REVIEW on moderation failure — never silently approved.
2. **Anonymous mode**: Users can toggle anonymous posting. Anonymous posts get a randomly generated display name frozen at creation time.
3. **Hourly Hope**: A cron-based scheduler generates biblical encouragement posts every hour using OpenAI, with contextual auto-comments on user posts.
4. **Device binding**: Usernames are bound to device IDs to prevent impersonation. No passwords — login is by device + display name.
5. **Multi-platform**: Same codebase serves web (via Vercel) and native (via Expo). Navigation uses drawer on native, sidebar/bottom tabs on web.

## Known Quirks

- `OPENAI_API_KEY` not set → moderation returns SAFE for everything (dangerous in production — see `quality/QUALITY.md` Scenario 2)
- `ADMIN_SECRET` has a hardcoded default `pusocoach_admin_2026` — must be overridden in production (Scenario 6)
- Encouragement scheduler catches moderation failures and sets status to SAFE — should be REVIEW (Scenario 3)
- File uploads validate MIME type via allowlist (JPEG/PNG/GIF/WebP) but check is header-based, not magic-byte (Scenario 8)
- Anonymous mode leaks real `displayName` in notification payloads (Scenario 4)
- Device ownership check is bypassable by omitting `deviceId` from request body (Scenario 5)
- `getPosts`, `getComments`, `getJournals`, `getConversations`, `getMessages` have no pagination limits (Scenario 10)
- Coach review queue exists (`GET /api/coach/review`) but has no automated escalation for stale REVIEW posts (Scenario 7)
- Notification delivery is fire-and-forget — push failures are logged but not retried (Scenario 9)

## Quality Docs

This project has a quality playbook. Read these before making changes:

- [`quality/QUALITY.md`](quality/QUALITY.md) — Quality constitution (10 fitness scenarios, coverage targets, theater prevention)
- [`quality/functional.test.ts`](quality/functional.test.ts) — Automated functional tests (run: `npx tsx --test quality/functional.test.ts`)
- [`quality/RUN_CODE_REVIEW.md`](quality/RUN_CODE_REVIEW.md) — Code review protocol with guardrails
- [`quality/RUN_INTEGRATION_TESTS.md`](quality/RUN_INTEGRATION_TESTS.md) — Integration test protocol
- [`quality/RUN_SPEC_AUDIT.md`](quality/RUN_SPEC_AUDIT.md) — Council of Three spec audit protocol

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OPENAI_API_KEY` | No | `''` | Content moderation + encouragement generation |
| `ADMIN_SECRET` | No | `pusocoach_admin_2026` | Admin endpoint auth (MUST override in prod) |
| `RESEND_API_KEY` | No | `''` | Email sending (new user alerts, invite codes) |
| `PORT` | No | `4000` | Server port |
| `ALLOWED_ORIGINS` | No | Production URLs | CORS allowed origins |
| `HOURLY_HOPE_AUTO_COMMENT_ENABLED` | No | `true` | Auto-comment on user posts with encouragement |
| `NEW_USER_ALERT_TO` | No | `''` | Comma-separated emails for signup alerts |
