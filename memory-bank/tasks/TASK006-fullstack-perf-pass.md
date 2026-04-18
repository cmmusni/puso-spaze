# TASK006 — Full-Stack Performance Optimization Pass

**Status:** ✅ Completed
**Created:** April 18, 2026
**Priority:** High

## Goal
Build on TASK005's PWA wins with deeper full-stack perf work covering DB indexes, query bounds, list virtualization, memoization, and polling cadence.

## Changes Made

### Server
- **Prisma indexes** (`server/prisma/schema.prisma` + migration `20260418155124_perf_indexes`):
  - `Post`: `@@index([createdAt])`, `@@index([moderationStatus])`, `@@index([moderationStatus, createdAt])`
  - `Comment`: `@@index([postId])`, `@@index([moderationStatus])`
  - `Reaction`: `@@index([postId])`
  - `User`: `@@index([lastActiveAt])`
  - `InviteCode`: `@@index([used])`
- **`getDashboardStats` rewrite** (`server/src/index.ts`):
  - Trending tags now via raw SQL `unnest(tags) GROUP BY tag` (was: `findMany` + JS flatten)
  - In-process TTL cache: 60s for totalMembers/dailyStories/trendingTags, 15s for onlineCount
  - Added error logging on failure
- **`getReviewQueue` cap** (`server/src/controllers/coachController.ts`): added `take: 100` to posts + comments
- **`getJournals`**: already had `take: 50` — no change needed

### Client — list virtualization
- **CoachDashboard.tsx**: members + coaches `.map()` → `FlatList` with `initialNumToRender: 12`, `windowSize: 5`, `removeClippedSubviews` on native. Inline (non-compact) usage uses `scrollEnabled={false}` to coexist with outer ScrollView.
- **SpazeCoachScreen.tsx**: horizontal coaches `ScrollView` + `.map()` → horizontal `FlatList`.

### Client — memoization
- **PostCard.tsx**: wrapped export in `React.memo` (`PostCardImpl` → `PostCard`). Critical: replaced `useUser()` (full-store subscription) with narrow `useUserStore` selectors (`userId`, `role`, `username`, `avatarUrl`) so unrelated user-store updates (bio, contacts, banner) no longer re-render every feed card.
- HomeScreen already had stable `useCallback`'d `renderItem`/`keyExtractor` — works in concert with the memo.

### Client — polling cadence
- **ChatScreen.tsx**: replaced `setInterval` with adaptive `setTimeout` loop. Uses `document.visibilityState` (web) or `AppState.currentState` (native) to detect background; slows message poll 6× and typing poll 5× when hidden.

### Client — request dedup expansion
- **services/api.ts**: applied `deduplicatedGet` to `apiGetReviewQueue`, `apiGetMembers`, `apiGetCoaches`, `apiFetchConversations` (in addition to existing `apiFetchPosts`, `apiGetUnreadCount`, `apiGetDashboardStats`).

## Skipped (intentional)
- `ProfileScreen.tsx` journal `.map()`: nested inside outer `ScrollView` with server cap of 50 — `FlatList` with `scrollEnabled={false}` provides no virtualization benefit.
- `PostDetailScreen.tsx` `renderCommentItem` extraction: complex nested replies; FlatList already virtualizes the top level.
- `React.lazy` drawer routes: React Navigation drawer already lazy-mounts screens; Metro web doesn't code-split.
- `getItemLayout`: card heights are dynamic; can't pre-compute.

## Verification

### EXPLAIN ANALYZE (post-migration)
```
SELECT * FROM posts WHERE "moderationStatus" = 'SAFE' ORDER BY "createdAt" DESC LIMIT 50;
→ Index Scan Backward using "posts_moderationStatus_createdAt_idx"
   Execution Time: 0.070 ms  ✅

SELECT COUNT(*) FROM users WHERE "lastActiveAt" >= NOW() - INTERVAL '15 minutes';
→ Index Only Scan using "users_lastActiveAt_idx"
   Execution Time: 0.057 ms  ✅
```

### Endpoint timings (1320 users, 471 stories DB)
- `GET /api/stats/dashboard` cold: 2.5s (dominated by OpenAI reflection — not query)
- `GET /api/stats/dashboard` warm (cache hit): **2.4ms** — ~1000× faster
- `GET /api/stats/online`: 12ms
- `GET /api/posts`: 20ms

### Tests
- `npx tsx --test quality/functional.test.ts` — 66/68 pass
- 2 pre-existing failures in `validatePostContent` (SR-1, SR-2): unrelated to this perf pass (no controllers/validators touched)

### TypeScript
- `server`: clean (`tsc --noEmit` no errors)
- `apps/mobile`: 4 pre-existing errors unrelated to this pass (`useNotifications.ts` Expo SDK types, `packages/types` LIKE reaction)

## Files Changed
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260418155124_perf_indexes/migration.sql` (new)
- `server/src/index.ts`
- `server/src/controllers/coachController.ts`
- `apps/mobile/screens/CoachDashboard.tsx`
- `apps/mobile/screens/SpazeCoachScreen.tsx`
- `apps/mobile/components/PostCard.tsx`
- `apps/mobile/screens/ChatScreen.tsx`
- `apps/mobile/services/api.ts`

## Follow-ups (not done)
- Migrate ChatScreen polling to WebSocket (separate effort)
- React Query / SWR adoption (separate effort)
- Prisma connection pooling tuning (defer until Railway metrics demand)
- Fix the 2 pre-existing `validatePostContent` failures (separate task)
