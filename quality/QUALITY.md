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

### Scenario 1: Unicode Homoglyphs and Novel Obfuscations ~~Bypass~~ → Now Caught by Local Keyword Filter

**Status: MITIGATED (April 2026)** — Unicode homoglyph normalization, zero-width character stripping, and expanded BLOCKED_TERMS (97 terms + 10 contextual phrase patterns) were added to `normalizeObfuscation()`. Cyrillic, Greek, and Fullwidth Latin characters are now mapped to ASCII equivalents before keyword matching.

**What was fixed:** `normalizeObfuscation()` now includes three new preprocessing steps: (1) Strip zero-width characters (U+200B, U+200C, U+200D, U+FEFF), (2) Map Unicode homoglyphs (Cyrillic а→a, Greek ο→o, Fullwidth ａ→a, etc.) to ASCII, (3) Expanded BLOCKED_TERMS from 36 to 97 entries covering discrimination vocabulary (racial, gender, religious, disability, class, Filipino-specific). Added 10 contextual phrase patterns for ableist, racist, and Filipino-specific hostile constructions.

**Remaining gap:** Mathematical alphanumeric symbols (𝓯𝓾𝓬𝓴) and novel separator obfuscations not covered by existing regex rules (e.g., `p.u.t.a` with periods) still bypass detection. The OpenAI moderation API serves as a secondary defense for these cases.

**Where in code:** `moderationService.ts` lines ~201–278: `HOMOGLYPH_MAP` with Cyrillic, Greek, and Fullwidth Latin mappings. Zero-width stripping at line ~201. BLOCKED_TERMS at lines 16–162 (97 entries). BLOCKED_PHRASE_PATTERNS at lines 168–177 (10 patterns).

**How to verify:** Test `localKeywordCheck` with: (1) Cyrillic-substituted words like `gаgо` → should be FLAGGED (verified by FS-1h). (2) Zero-width characters inserted into blocked terms → should be FLAGGED (verified by FS-1i). (3) Contextual phrase patterns like "so autistic" → should be FLAGGED (verified by FS-1j). (4) Mathematical alphanumerics like `𝗴𝗮𝗴𝗼` → still bypass (remaining gap).

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

### Scenario 5: Device Ownership Check Is Bypassable → MITIGATED via JWT Auth + PIN

**Status: MITIGATED (April 2026)** — JWT authentication added across the entire API. PIN-based cross-device login provides a legitimate path for users to migrate between devices. Account recovery system handles locked-out users.

**What was fixed:**
1. **JWT auth layer**: `requireAuth` middleware (`middlewares/requireAuth.ts`) verifies `Authorization: Bearer <token>` on all protected routes. Tokens are signed with `JWT_SECRET` (7-day expiry, payload: `{ userId, role }`).
2. **Token issuance**: `userController.ts` and `authController.ts` return a `token` field on login/invite redemption.
3. **Client-side token lifecycle**: `UserContext.tsx` stores JWT in SecureStore/AsyncStorage, restores on app load, clears on logout. `api.ts` attaches token to all axios and fetch requests via interceptor.
4. **Web deviceId**: Web clients now generate and send `deviceId` like native clients. DeviceId persists in localStorage.
5. **PIN-based device migration**: Each user gets a unique 6-digit PIN (auto-generated on first login). Presenting username + matching PIN from a different device allows cross-device login and updates the deviceId binding.
6. **Account recovery**: Locked-out users without their PIN can submit a recovery request (public endpoint). Coaches review the request alongside the user's post/journal history, then approve (clears deviceId) or deny.
7. **401 handling**: Expired/invalid tokens trigger automatic token clearance, prompting re-login.

**Remaining gap:** The `deviceId` ownership check itself still requires both sides to be truthy (`existingUser.deviceId && deviceId`). However, the combination of JWT auth + PIN + recovery means an attacker would need either: a valid token (requires original device), the user's PIN, or a coach-approved recovery.

**Where in code:** `middlewares/requireAuth.ts`, `utils/jwt.ts`, `config/env.ts` (`JWT_SECRET`), all `*Routes.ts` files (requireAuth added), `userController.ts` (PIN generation/validation), `recoveryController.ts` (recovery flow), `UserContext.tsx` (token storage), `services/api.ts` (interceptor).

**How to verify:** (1) POST to any protected endpoint without token → 401. (2) POST with valid token → succeeds. (3) Login with username from different device without PIN → 409. (4) Login with username + correct PIN from different device → success. (5) Recovery request → coach approval → login from new device → success. All verified via curl E2E tests (April 2026).

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

### Scenario 8: File Upload MIME Validation — Partially Mitigated with Magic Bytes

**Status: PARTIALLY MITIGATED (April 2026)** — Magic bytes validation added for avatar uploads via `validateImageMagicBytes.ts`. Post image uploads still rely on header-based MIME check only.

**What was fixed:** A new utility `server/src/utils/validateImageMagicBytes.ts` validates uploaded files by reading actual file content (magic bytes), not just the client-provided `Content-Type` header. Supports JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46`), and WebP (`52 49 46 46...57 45 42 50`). This is used in `userRoutes.ts` for avatar uploads.

**Remaining gap:** Post image uploads (`postRoutes.ts`) still rely on multer's `file.mimetype` header check only. Files are still served via `express.static` without `Content-Disposition: attachment` or CSP headers. A malicious client could spoof `Content-Type: image/jpeg` on post image uploads while uploading HTML/SVG content containing JavaScript.

**Where in code:** `validateImageMagicBytes.ts` (new), `userRoutes.ts` (uses magic bytes for avatars), `postRoutes.ts` lines 20–45 (still header-based only), `index.ts` line ~41: `app.use('/uploads', express.static(...))` with no content-type override or CSP.

**How to verify:** (1) Confirm avatar upload with spoofed MIME type but non-image content is rejected. (2) Confirm post image upload with spoofed MIME type is still accepted (remaining gap). (3) Verify `express.static` serves files without XSS-preventing headers.

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

---

### Scenario 11: PIN Collision and Brute-Force Risk

**What happened:** Users are assigned a unique 6-digit PIN for cross-device login. `generateUniquePin()` generates random 6-digit PINs and retries up to 10 times on database UNIQUE constraint collisions, falling back to 8-digit PINs if all 10 attempts fail. With 10^6 possible 6-digit PINs and a growing user base, collision probability increases over time (birthday paradox). Additionally, the PIN login endpoint has no rate limiting — an attacker who knows a username can brute-force the 6-digit PIN (10^6 attempts) to hijack the account from a different device.

**Where in code:** `userController.ts` `generateUniquePin()`: retries 10× with 6-digit, falls back to 8-digit. Login check: `if (pin && existingUser.pin === pin)` — plain-text comparison, no rate limiting, no lockout after failed attempts.

**How to verify:** (1) Test PIN generation produces unique 6-digit PINs. (2) Test collision fallback to 8-digit. (3) Verify that rapid failed PIN attempts are not rate-limited (current gap). (4) Verify PINs are stored and compared in plaintext (current gap — should be hashed).

**Requirement tag:** [Req: inferred — from generateUniquePin() and login PIN validation logic]

---

### Scenario 12: Recovery Request Abuse — Spam and Social Engineering

**What happened:** The recovery request endpoint (`POST /api/recovery-requests`) is intentionally public (no auth required) because it serves locked-out users who can't authenticate. However, this means anyone can submit unlimited recovery requests for any username. A malicious actor could: (1) flood coaches with fake recovery requests (DoS on the review queue), (2) submit recovery requests for other users' accounts to attempt social engineering (e.g., convincing a coach to clear the deviceId binding for a victim's account). The endpoint checks for duplicate PENDING requests per username but has no IP-based or time-based rate limiting.

**Where in code:** `recoveryController.ts` `submitRecoveryRequest()`: validates `displayName` and `reason` are non-empty, checks for existing PENDING request (prevents duplicates per username), but no rate limiting. `recoveryRoutes.ts`: `POST /api/recovery-requests` has no auth middleware.

**How to verify:** (1) Confirm duplicate PENDING request for same username is rejected. (2) Test rapid submissions for different usernames are all accepted (no rate limiting). (3) Verify coach review UI shows sufficient user history to prevent social engineering (post history, journal count, account age).

**Requirement tag:** [Req: inferred — from public recovery endpoint design]

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
