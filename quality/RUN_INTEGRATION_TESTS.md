# Integration Test Protocol — PUSO Spaze

## Working Directory

All commands run from the project root (`puso-spaze/`) using relative paths.

## Safety Constraints

- [ ] Use a **test database** — never run against production PostgreSQL
- [ ] Use test/staging OpenAI API key (or skip AI tests if no key)
- [ ] Use test Resend API key (or mock email sending)
- [ ] Do NOT send real push notifications to real users during tests
- [ ] Maximum estimated cost per full test run: ~$0.10 (OpenAI moderation + chat completion calls)
- [ ] Clean up test users, posts, and notifications after each run

## Pre-Flight Checks

```bash
# 1. Verify database is accessible
cd server && npx prisma db push --accept-data-loss 2>&1 | head -5

# 2. Verify server dependencies
cd server && npm ls express @prisma/client openai 2>&1 | head -10

# 3. Verify environment variables
cd server && node -e "
  const vars = ['DATABASE_URL'];
  const optional = ['OPENAI_API_KEY', 'RESEND_API_KEY', 'ADMIN_SECRET'];
  vars.forEach(v => console.log(v + ':', process.env[v] ? '✓ SET' : '✗ MISSING (required)'));
  optional.forEach(v => console.log(v + ':', process.env[v] ? '✓ SET' : '⚠ NOT SET (some tests will be skipped)'));
"

# 4. Verify clean state (no leftover test data)
cd server && npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users WHERE id LIKE 'test-%';"
```

## Test Matrix

| # | Test Group | What It Exercises | Pass Criteria | Est. Duration |
|---|-----------|-------------------|---------------|---------------|
| 1 | Health check | Server startup, DB connection | `GET /health` returns `{ status: "ok" }` | ~2s |
| 2 | User creation flow | Signup, device binding, duplicate handling | User created with correct role, deviceId saved | ~3s |
| 3 | Post creation + moderation | Create post → AI moderation → save with status | Post saved, clean content = SAFE, profanity = FLAGGED | ~5s |
| 4 | Comment flow | Comment on post → moderation → notification | Comment created, notification record exists | ~4s |
| 5 | Reaction toggle | Add/change/remove reaction | Correct upsert/delete behavior, counts accurate | ~3s |
| 6 | Anonymous mode | Create post/comment as anonymous user | Response uses anonDisplayName, real name hidden | ~3s |
| 7 | Admin endpoints | Generate invite codes, review queue | Codes generated, auth required, format correct | ~3s |
| 8 | Moderation keyword check | Local blocklist vs. clean content | All BLOCKED_TERMS variants caught, clean text passes | ~2s |
| 9 | Search + pagination | User search with limit, post listing | Limits enforced, results ordered correctly | ~3s |
| 10 | Coach review queue | REVIEW/FLAGGED post retrieval | Queue returns posts, requires coach role | ~3s |
| 11 | File upload MIME check | Upload with valid/invalid MIME types | Valid images accepted, non-images rejected | ~3s |

## Execution UX

### Phase 1: Show the Plan

Before running anything, display:

```
Integration Test Plan — PUSO Spaze

| # | Test | Status |
|---|------|--------|
| 1 | Health check | ⧖ pending |
| 2 | User creation flow | ⧖ pending |
| 3 | Post creation + moderation | ⧖ pending |
| 4 | Comment flow | ⧖ pending |
| 5 | Reaction toggle | ⧖ pending |
| 6 | Anonymous mode | ⧖ pending |
| 7 | Admin endpoints | ⧖ pending |
| 8 | Moderation keyword check | ⧖ pending |
| 9 | Search + pagination | ⧖ pending |
| 10 | Coach review queue | ⧖ pending |
| 11 | File upload MIME check | ⧖ pending |
```

### Phase 2: Progress Updates

```
✓ Test 1: Health check (0.3s)
✓ Test 2: User creation flow (1.2s)
✗ Test 3: Post creation + moderation (FAILED: OpenAI key not set)
⧗ Test 4: Comment flow (running...)
```

### Phase 3: Summary

```
Integration Test Results — PUSO Spaze

| # | Test | Result | Duration |
|---|------|--------|----------|
| 1 | Health check | ✓ PASS | 0.3s |
| ...

Passed: N/11
Failed: N/11
Skipped: N/11

Recommendation: [PASS / INVESTIGATE / FAIL]
```

## Quality Gates — Field Reference Table

Built from `server/prisma/schema.prisma`:

| Model | Field Name | Type | Constraints | Test Check |
|-------|-----------|------|-------------|------------|
| User | `id` | String | `@id @default(uuid())` | UUID format |
| User | `displayName` | String | `@unique` | Non-empty, unique |
| User | `deviceId` | String? | optional | Null or non-empty |
| User | `role` | UserRole | `@default(USER)` | One of: USER, COACH, ADMIN |
| User | `isAnonymous` | Boolean | `@default(false)` | Boolean |
| User | `expoPushToken` | String? | optional | Null or valid Expo token format |
| User | `lastActiveAt` | DateTime | `@default(now())` | Recent timestamp |
| Post | `id` | String | `@id @default(uuid())` | UUID format |
| Post | `content` | String | required | Non-empty |
| Post | `imageUrl` | String? | optional | Null or starts with `/uploads/` |
| Post | `userId` | String | FK → User.id | Valid user UUID |
| Post | `moderationStatus` | ModerationStatus | `@default(REVIEW)` | One of: SAFE, FLAGGED, REVIEW |
| Post | `tags` | String[] | default `[]` | Array of strings |
| Post | `pinned` | Boolean | `@default(false)` | Boolean |
| Post | `isAnonymous` | Boolean | `@default(false)` | Boolean |
| Post | `anonDisplayName` | String? | optional | Null or non-empty when isAnonymous |
| Comment | `id` | String | `@id @default(uuid())` | UUID format |
| Comment | `postId` | String | FK → Post.id | Valid post UUID |
| Comment | `userId` | String | FK → User.id | Valid user UUID |
| Comment | `content` | String | required | Non-empty, ≤ 500 chars |
| Comment | `moderationStatus` | ModerationStatus | `@default(REVIEW)` | One of: SAFE, FLAGGED, REVIEW |
| Comment | `parentId` | String? | FK → Comment.id | Null or valid comment UUID |
| Reaction | `postId` | String | FK, `@@unique([postId, userId])` | Valid post UUID |
| Reaction | `userId` | String | FK | Valid user UUID |
| Reaction | `type` | ReactionType | required | One of: PRAY, CARE, SUPPORT, LIKE |
| Notification | `userId` | String | FK → User.id | Valid user UUID |
| Notification | `type` | NotificationType | required | One of: REACTION, COMMENT, ENCOURAGEMENT, SYSTEM, MESSAGE |
| Notification | `title` | String | required | Non-empty |
| Notification | `body` | String | required | Non-empty |
| Notification | `data` | Json? | optional | Null or valid JSON |
| Notification | `read` | Boolean | `@default(false)` | Boolean |
| Journal | `userId` | String | FK → User.id | Valid user UUID |
| Journal | `title` | String | required | Non-empty |
| Journal | `content` | String | required | Non-empty |
| Journal | `mood` | String? | optional | Null or one of mood values |
| Journal | `tags` | String[] | default `[]` | Array of strings |
| InviteCode | `code` | String | `@unique` | Format: XXXXX-XXXXX |
| InviteCode | `used` | Boolean | `@default(false)` | Boolean |
| AppConfig | `hourlyHopePostingEnabled` | Boolean | `@default(true)` | Boolean |
| AppConfig | `hourlyHopeVisible` | Boolean | `@default(true)` | Boolean |

## Per-Test Verification

### Test 1: Health Check
```bash
curl -s http://localhost:4000/health | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.assert(d.status==='ok','Health status should be ok');
  console.assert(d.timestamp,'Should include timestamp');
  console.log('✓ Health check passed');
"
```

### Test 2: User Creation
```bash
# Create test user
curl -s -X POST http://localhost:4000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"IntegTest_User_'$(date +%s)'","deviceId":"test-device-001"}' | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.assert(d.userId,'Should return userId');
  console.assert(d.displayName.startsWith('IntegTest_'),'Name should match');
  console.assert(d.role==='USER','Default role should be USER');
  console.log('✓ User created:', d.userId);
"
```

### Test 3: Post Creation + Moderation
```bash
# Create post with clean content
curl -s -X POST http://localhost:4000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"userId":"'$TEST_USER_ID'","content":"God bless everyone today. Praying for you all.","tags":["prayer"]}' | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.assert(d.post,'Should return post object');
  console.assert(d.post.moderationStatus==='SAFE' || d.post.moderationStatus==='REVIEW','Clean content status');
  console.assert(d.post.tags.includes('prayer'),'Tags preserved');
  console.log('✓ Clean post created:', d.post.moderationStatus);
"

# Create post with profanity (should be FLAGGED)
curl -s -X POST http://localhost:4000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"userId":"'$TEST_USER_ID'","content":"putangina mo gago"}' | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.assert(d.post.moderationStatus==='FLAGGED','Profanity should be FLAGGED');
  console.assert(d.flagged===true,'flagged should be true');
  console.log('✓ Profanity post flagged correctly');
"
```

### Test 8: Moderation Keyword Check
```bash
cd server && npx tsx -e "
  import { moderateContent } from './src/services/moderationService';
  const tests = [
    ['gago ka', 'FLAGGED'],
    ['f*ck you', 'FLAGGED'],
    ['putangina', 'FLAGGED'],
    ['God bless you', 'SAFE'],
    ['I love this community', 'SAFE'],
    ['kms', 'FLAGGED'],
    ['unalive myself', 'FLAGGED'],
  ];
  (async () => {
    for (const [input, expected] of tests) {
      const result = await moderateContent(input);
      const pass = result === expected;
      console.log(pass ? '✓' : '✗', JSON.stringify(input), '=>', result, pass ? '' : '(expected ' + expected + ')');
    }
  })();
"
```

## Cleanup

```bash
# Remove test users and their cascaded data
cd server && npx prisma db execute --stdin <<< "
  DELETE FROM users WHERE display_name LIKE 'IntegTest_%';
"

# Verify cleanup
cd server && npx prisma db execute --stdin <<< "
  SELECT COUNT(*) as remaining FROM users WHERE display_name LIKE 'IntegTest_%';
"
```

## Structured Report

Save results to `quality/results/integration_YYYY-MM-DD.md`.
