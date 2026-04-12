# Quality Constitution — PUSO Spaze

> Quality is not an act, it is a habit. — Aristotle
> Quality means fitness for use. — Joseph Juran
> Quality is free — but only for those willing to pay for it. — Philip Crosby

## 1. Purpose

PUSO Spaze is a faith-based mental wellness community where Filipino youth share their emotional struggles, receive AI-moderated biblical encouragement, and connect with trained coaches. **"Fitness for use" here means**: harmful content never reaches the community feed, genuine cries for help are never silently discarded, user identities are protected when anonymous mode is active, and the encouragement system reliably delivers hope — not AI-generated harm. A test suite that achieves 95% coverage but fails to catch a slur bypassing obfuscation normalization, or silently drops a flagged post without review, is not a quality system — it's a liability.

This constitution defines the quality bar for PUSO Spaze. Every AI session, every code review, and every test must meet or exceed these standards. If a change would lower the bar, it requires explicit human approval and a documented reason.

### Quality Philosophy

- **Deming**: Quality is built in, not inspected in. Moderation is part of the data flow, not a bolted-on filter.
- **Juran**: Fitness for use — does the system protect vulnerable users while enabling authentic expression?
- **Crosby**: Quality is free — catching a harmful post before it reaches the feed costs nothing compared to losing community trust.

## 2. Coverage Targets

| Subsystem | Target | Rationale |
|-----------|--------|-----------|
| Moderation (`moderationService.ts`) | ≥ 95% | Core safety gate — a missed slur or bypassed obfuscation harms real people (Scenario 1, 2) |
| Auth & User (`userController.ts`, `authController.ts`) | ≥ 90% | Device ownership and invite codes protect against identity theft and unauthorized coach access (Scenario 5) |
| Post/Comment CRUD (`postController.ts`, `commentController.ts`) | ≥ 85% | Content flow with moderation integration — anonymous mode leaks are high-severity (Scenario 4) |
| Notifications (`notificationService.ts`, `mentionService.ts`) | ≥ 80% | Notification failures degrade UX but don't compromise safety |
| Encouragement scheduler (`encouragementScheduler.ts`) | ≥ 80% | System-generated content must pass moderation — fallback to SAFE on moderation failure is dangerous (Scenario 3) |
| Admin (`adminController.ts`) | ≥ 75% | Lower risk, simpler CRUD — but invite code generation collision handling needs coverage |
| Journals (`journalController.ts`) | ≥ 75% | Private user data — correctness matters but blast radius is limited to one user |

**Rules:**
- Targets are floors, not ceilings
- Coverage means meaningful assertion coverage, not line-touched coverage
- A test that runs code without asserting correctness does NOT count toward coverage

## 3. Coverage Theater Prevention

These patterns inflate coverage numbers without catching real bugs. Do not write them.

### ❌ Import Tests
```typescript
test("moderationService imports", () => {
  const mod = require("../services/moderationService");
  expect(mod).toBeDefined();
});
```
Why it's theater: proves the file parses. Catches zero moderation logic bugs.

### ❌ Tautological Moderation Tests
```typescript
test("moderateContent returns a result", async () => {
  const result = await moderateContent("hello");
  expect(result).toBeTruthy();
});
```
Why it's theater: asserts "something was returned" — doesn't check whether "hello" correctly produces SAFE.

### ❌ Mock Echo Tests
```typescript
test("calls OpenAI", async () => {
  const spy = jest.spyOn(openai.moderations, "create");
  await moderateContent("test");
  expect(spy).toHaveBeenCalled();
});
```
Why it's theater: confirms the API was called, not that the response was interpreted correctly.

### ❌ Prisma Find Assertions
```typescript
test("creates a post", async () => {
  const post = await prisma.post.create({ data: { ... } });
  expect(post).not.toBeNull();
});
```
Why it's theater: tests Prisma, not your controller logic (moderation status, anonymous mode, mention extraction).

### ✅ What Real Tests Look Like
```typescript
test("normalizeObfuscation catches f*ck variant", () => {
  const result = normalizeObfuscation("f*ck you");
  expect(result).toContain("fuck");
});

test("FLAGGED content is saved but excluded from feed", async () => {
  // Create post with known-flagged content
  // Verify post exists in DB with moderationStatus === "FLAGGED"
  // Verify GET /api/posts does NOT return it
});
```

## 4. Fitness-to-Purpose Scenarios

### Scenario 1: Unicode Homoglyphs and Novel Obfuscations Bypass Local Keyword Filter

**What happened:** `normalizeObfuscation()` (line ~185) handles a finite set of ASCII-symbol substitutions (f\*ck, sh\*t, g\*go, etc.) and common leet-speak variants like `b0b0`, `8080`, and `B0BO` are present in `BLOCKED_TERMS` (lines 82–86). However, the system does NOT handle Unicode homoglyphs — Cyrillic `а` (U+0430) looks identical to Latin `a`, Greek `ο` (U+03BF) looks like Latin `o`, and mathematical alphanumeric symbols (𝓯𝓾𝓬𝓴) bypass all pattern matching entirely. A user posting `gаgо` (with Cyrillic substitutions) bypasses both `normalizeObfuscation` and `BLOCKED_TERMS_PATTERN`. The post then goes to OpenAI moderation, which may not flag Tagalog profanity in mixed-script form — resulting in a `SAFE` verdict. Additionally, obfuscations not covered by existing regex rules (e.g., `B@B@`, `p.u.t.a`) slip through because `normalizeObfuscation` only handles specific punctuation-in-word patterns.

**Where in code:** `moderationService.ts` line ~185 (`normalizeObfuscation`): 23 regex replacement rules cover ASCII-punctuation obfuscations but not Unicode script mixing. `BLOCKED_TERMS` (lines 17–140) includes digit-letter variants (`b0b0`, `8080`, `B0B0`, `B0BO`, `BOB0`) but not homoglyph variants.

**How to verify:** Test `localKeywordCheck` with: (1) Cyrillic-substituted words like `gаgо`, (2) mathematical alphanumerics like `𝗴𝗮𝗴𝗼`, (3) zero-width characters inserted into blocked terms, (4) novel separator obfuscations like `p.u.t.a`. Expected: all bypass detection (current behavior). These demonstrate the gaps that need Unicode normalization (NFKD + script stripping) to close.

**Requirement tag:** [Req: inferred — from normalizeObfuscation() patterns and BLOCKED_TERMS list]

---

### Scenario 2: OpenAI API Failure Defaults All Content to SAFE

**What happened:** When `OPENAI_API_KEY` is not set, `moderateContent()` logs a warning and returns `SAFE` for ALL content. In development this is convenient, but if the key is accidentally unset in production (env var rotation, Railway deploy misconfiguration), every post — including hate speech that bypasses the local keyword filter — is marked SAFE and published immediately. With hourly encouragement posts generating traffic, a 6-hour outage means ~100+ unmoderated user posts reach the feed. No alert is sent; the only signal is a console.warn that nobody monitors.

**Where in code:** `moderationService.ts` line ~370: `if (!openai) { ... return "SAFE"; }` — no API key → all content auto-approved. Controllers (`postController.ts` line ~50, `commentController.ts` line ~40) correctly fall back to REVIEW on moderation exceptions, but the no-API-key path returns SAFE before any exception can be thrown.

**How to verify:** Test that when OpenAI client is null, `moderateContent` returns `REVIEW` (not `SAFE`) for non-trivially-safe content. Verify the fallback behavior is safe-by-default.

**Requirement tag:** [Req: inferred — from moderateContent() fallback logic]

---

### Scenario 3: Encouragement Scheduler Trusts Its Own AI Output

**What happened:** In `postEncouragement()`, if `moderateContent()` throws an exception, the catch block sets `moderationStatus = 'SAFE'` with the comment "Trust our AI-generated content." But `generateBiblicalEncouragement()` uses OpenAI chat completions, which can produce unexpected output — religious misquotes, culturally insensitive phrasing, or prompt injection artifacts. If the moderation API is down simultaneously (common — same provider), both the generation and the safety check fail, and the raw AI output posts as SAFE. This encouragement is then pushed to ALL users via `notifyNewEncouragement()`.

**Where in code:** `encouragementScheduler.ts` line ~55: `catch { moderationStatus = 'SAFE'; }` — moderation failure → auto-approve system-generated content. Additionally, `postController.ts` line ~103: auto-comment on user posts hardcodes `moderationStatus: 'SAFE'` without passing through `moderateContent()` at all.

**How to verify:** Test that moderation failure on encouragement content results in REVIEW status, not SAFE. Verify the notification is not sent for non-SAFE encouragement posts.

**Requirement tag:** [Req: inferred — from encouragementScheduler.ts catch block]

---

### Scenario 4: Anonymous Mode Leaks Real Identity in Notifications and Mentions

**What happened:** When a user posts in anonymous mode (`isAnonymous: true`), the post stores an `anonDisplayName`. But the notification system uses `comment.user.displayName` (the real name) when sending comment notifications, and `notifyMentionsInPost` passes `authorName: post.user.displayName` — the real display name, not the anonymous one. Any user who receives a mention or comment notification from an anonymous poster sees their real identity. In a mental health community where users share trauma anonymously, this leak is a critical safety violation.

**Where in code:** `postController.ts` line ~78: `notifyMentionsInPost({ authorName: post.user.displayName })` — uses real name even when `isAnonymous` is true. `commentController.ts` line ~60: `notifyComment({ commenterName: comment.user.displayName })`. The notification service (`mentionService.ts` line ~100) then embeds this real name directly into the notification body: `${params.authorName} mentioned you in a post.`

**How to verify:** Test that when a post/comment is created with `isAnonymous: true`, all notification payloads use the `anonDisplayName`, not the real `displayName`.

**Requirement tag:** [Req: inferred — from notification service integration with anonymous mode]

---

### Scenario 5: Device Ownership Check Is Bypassable

**What happened:** User creation in `userController.ts` checks `deviceId` for ownership — if a username is taken by a different device, it rejects. But if `deviceId` is not sent in the request (it's optional), the check is bypassed entirely: `if (existingUser.deviceId && deviceId && existingUser.deviceId !== deviceId)`. An attacker who omits `deviceId` from the request body can claim ANY existing username, gaining access to their post history and coach conversations. This is a client-side-only validation bypass.

**Where in code:** `userController.ts` line ~140: `if (existingUser.deviceId && deviceId && existingUser.deviceId !== deviceId)` — device ownership check requires BOTH `existingUser.deviceId` AND `requestBody.deviceId` to be truthy. If either is falsy, the condition short-circuits to false and login proceeds. Same pattern in `authController.ts` line ~33.

**How to verify:** Test that login/upsert without deviceId for an existing user with a deviceId is rejected (not silently allowed).

**Requirement tag:** [Req: inferred — from upsert logic in userController/authController]

---

### Scenario 6: Admin Secret Is Hardcoded as Default

**What happened:** `env.ts` defines `ADMIN_SECRET` with a default fallback: `'pusocoach_admin_2026'`. If the environment variable is not set in production, anyone who reads the source code (or guesses the predictable default) can generate invite codes, access the review queue, manage posts, and send emails via admin endpoints. The admin middleware checks `req.headers.authorization === 'Bearer ' + env.ADMIN_SECRET`, so the hardcoded default grants full admin access.

**Where in code:** `config/env.ts` line 33: `ADMIN_SECRET: optional('ADMIN_SECRET', 'pusocoach_admin_2026')`. The `requireAdmin` middleware in `adminRoutes.ts` line ~18 checks `req.headers.authorization` Bearer token against this value.

**How to verify:** Test that when `ADMIN_SECRET` env var is not set, admin endpoints reject requests (or that the startup fails/warns loudly).

**Requirement tag:** [Req: inferred — from env.ts hardcoded default]

---

### Scenario 7: REVIEW Posts Have No Timeout or Automated Escalation

**What happened:** When content is flagged for human review (`moderationStatus: REVIEW`), coaches CAN review it via `GET /api/coach/review` (`coachController.ts` line ~27) and approve/reject via PATCH endpoints (lines ~59–101). However, there is no mechanism to escalate stale REVIEW posts if no coach acts — no timeout, no push notification to coaches, no cron job to check aging reviews. A user's genuine cry for help, marked REVIEW because it mentions self-harm in a testimony context, sits invisible indefinitely if no coach checks the dashboard. The user believes they posted but gets no engagement, no response, no indication their post is pending. The review queue is passive — it only works if coaches actively poll it.

**Where in code:** `coachController.ts` line ~27: `getReviewQueue` returns REVIEW and FLAGGED posts/comments. No scheduler or notification triggers when REVIEW posts age past a threshold. The Coach Dashboard screen (`CoachDashboard.tsx`) renders the queue but has no push-based alerting.

**How to verify:** Confirm that `GET /api/coach/review` returns REVIEW posts. Then verify that NO automated mechanism exists to alert coaches about stale REVIEW content (no cron job, no notification on REVIEW creation, no aging threshold). The gap is operational, not architectural.

**Requirement tag:** [Req: inferred — from absence of review escalation automation despite existing review queue]

---

### Scenario 8: File Upload MIME Validation Is Header-Based Only

**What happened:** Both post image uploads (`postRoutes.ts` line ~35) and avatar uploads (`userRoutes.ts` line ~30) validate MIME types against an allowlist (`image/jpeg`, `image/png`, `image/gif`, `image/webp`) and enforce a 5MB size limit. This is a significant improvement over no validation. However, the check relies on the `Content-Type` header sent by the client (multer's `file.mimetype`), not on the actual file content (magic bytes). A malicious client can set `Content-Type: image/jpeg` while uploading a `.html` or `.svg` file containing JavaScript. Files are served via `express.static` (`index.ts` line ~41) without `Content-Disposition: attachment` or CSP headers, so if a browser renders the content, embedded scripts execute — a stored XSS vulnerability.

**Where in code:** `postRoutes.ts` lines 20–45: `fileFilter` checks `file.mimetype` (client-provided). `userRoutes.ts` lines 26–36: same pattern. `index.ts` line ~41: `app.use('/uploads', express.static(...))` with no content-type override or CSP.

**How to verify:** (1) Confirm that multer `fileFilter` rejects non-image MIME types (it does). (2) Test whether a file with `Content-Type: image/jpeg` but `.html` content is accepted and served as HTML. (3) Verify that `express.static` serves files with the original extension's MIME type (which could execute scripts if `.html` or `.svg` content was uploaded with a spoofed MIME type).

**Requirement tag:** [Req: inferred — from multer header-based validation and static file serving]

---

### Scenario 9: Notification Failures Are Silently Swallowed

**What happened:** Throughout the codebase, notification sending is fire-and-forget: `.catch((err) => console.error(...))`. If the Expo push notification service is down or a user's push token is invalid, the notification is lost — no retry, no fallback, no in-app indicator that the notification wasn't delivered. A coach sending an encouragement that generates 200 push notifications loses 50 due to rate limiting, and neither the coach nor the affected users know. The in-database notification record exists but the push never arrived.

**Where in code:** `notificationService.ts` line ~48: push failures are caught and logged with `console.error` but not retried. The function returns `void` — callers have no way to know if delivery succeeded. All call sites (e.g., `postController.ts` line ~80, `commentController.ts` line ~62) use `.catch(...)` fire-and-forget pattern.

**How to verify:** Test that notification creation in the database succeeds even when push delivery fails. Verify that push failures are at minimum counted (not just logged).

**Requirement tag:** [Req: inferred — from fire-and-forget notification patterns]

---

### Scenario 10: Most List Endpoints Lack Pagination Limits

**What happened:** `searchUsers` (line ~10, `userController.ts`) correctly clamps the `limit` parameter to `Math.min(Math.max(limitRaw, 1), 10)`, and `getNotifications` (`notificationController.ts` line ~18) uses `take: 50`. However, five other list endpoints have NO pagination limits: `getPosts` (`postController.ts` line ~149), `getComments` (`commentController.ts` line ~108), `getJournals` (`journalController.ts` line ~8), `getConversations` (`conversationController.ts` line ~57), and `getMessages` (`conversationController.ts` line ~188). All issue unbounded `prisma.findMany` queries. A malicious client — or simply an active community — triggers full table scans that return all matching records in a single response, consuming database memory and network bandwidth.

**Where in code:** `postController.ts` line ~149: `prisma.post.findMany` with no `take`; `commentController.ts` line ~108: `prisma.comment.findMany` with no `take`; `journalController.ts` line ~8: `prisma.journal.findMany` with no `take`; `conversationController.ts` lines ~57 and ~188: both queries have no `take`.

**How to verify:** Test that all list endpoints enforce a maximum page size (e.g., 50) regardless of client input. Currently only `searchUsers` (max 10) and `getNotifications` (max 50) enforce limits.

**Requirement tag:** [Req: inferred — from searchUsers limit clamping pattern vs. other endpoints]

## 5. AI Session Quality Discipline

Every AI session working on this project must:

1. **Read this file first** before making any changes
2. **Run existing tests** before and after changes — `cd server && npm test`
3. **Never reduce coverage** — check coverage impact before committing
4. **No placeholder tests** — every test must call project code and assert correctness
5. **No silent error swallowing** — if you add try/catch, log and re-throw or return error state
6. **Cite scenarios** — when fixing a bug, reference which scenario it relates to
7. **Update this file** — if you discover a new failure mode, add a scenario
8. **Respect anonymous mode** — NEVER log, notify, or expose real displayName when isAnonymous is true
9. **Moderation changes require extra scrutiny** — changes to moderationService.ts, BLOCKED_TERMS, or normalizeObfuscation must include tests for the specific bypass being addressed

### Before Committing Checklist

- [ ] All existing tests pass (`cd server && npm test`)
- [ ] New code has tests that assert correctness (not just existence)
- [ ] No coverage theater patterns (see Section 3)
- [ ] Defensive code logs/signals failures (no silent swallowing)
- [ ] Changes don't introduce new state machine gaps
- [ ] Anonymous mode identity is never leaked in notifications, logs, or responses
- [ ] Moderation fallback behavior is safe-by-default (REVIEW, not SAFE)

## 6. The Human Gate

These decisions require human judgment — AI sessions should flag them, not make them:

- **Moderation threshold tuning** — Changing the `reviewThreshold` (0.7) or hard-flagged categories affects what content youth see
- **BLOCKED_TERMS additions** — Cultural context matters; some terms are slurs in one context and neutral in another
- **Anonymous mode architecture** — Changing when/how identity is revealed has privacy implications
- **Admin secret rotation** — Changing auth mechanism requires coordinated deployment
- **Encouragement content policy** — What biblical content is appropriate for distressed Filipino youth requires pastoral judgment
- **REVIEW escalation policy** — How long content sits in review before action affects real people waiting for help
- **Push notification strategy** — Retry logic, rate limits, and batching affect user experience at scale
