# Code Review Protocol — PUSO Spaze

## Bootstrap

Before starting the review, read these files in order:

1. `quality/QUALITY.md` — Quality constitution (10 fitness scenarios, coverage targets)
2. `memory-bank/systemPatterns.md` — Architecture and design patterns
3. `.github/copilot-instructions.md` — Platform constraints (web + native)
4. `packages/types/index.ts` — Shared type definitions
5. `server/prisma/schema.prisma` — Data models and constraints

## Scope

Review the PUSO Spaze server (`server/src/`) and shared packages (`packages/`). Client code (`apps/mobile/`) can be reviewed separately for UI/UX concerns.

## Focus Areas

| # | Area | Files | What to Look For |
|---|------|-------|-----------------|
| 1 | Content moderation | `server/src/services/moderationService.ts` | Obfuscation bypass, missing slur patterns, fallback safety |
| 2 | Anonymous identity protection | `postController.ts`, `commentController.ts`, notification services | Real name leaks in notifications, responses, logs when `isAnonymous: true` |
| 3 | Auth & device ownership | `userController.ts`, `authController.ts` | Bypass via missing `deviceId`, invite code reuse, role escalation |
| 4 | Admin security | `adminController.ts`, `config/env.ts` | Hardcoded secrets, auth header validation, rate limiting |
| 5 | Encouragement scheduler | `encouragementScheduler.ts`, `biblicalEncouragementService.ts` | Moderation fallback to SAFE, system user creation race, cron reliability |
| 6 | Notification delivery | `notificationService.ts`, `mentionService.ts` | Silent failure swallowing, push token validation, anonymous name in payloads |
| 7 | File uploads | `postRoutes.ts`, `userRoutes.ts`, `index.ts` | Header-only MIME check (client can spoof), magic byte validation missing, static serve without CSP |
| 8 | Data access & pagination | All controllers with `findMany` | Missing pagination limits, unbounded queries, N+1 queries |

## Mandatory Guardrails

### 1. Line Numbers Are Mandatory
Every finding MUST include a file path and line number. No line number → not a finding.

```
✅ BUG: `server/src/services/moderationService.ts` line 283 — returns SAFE when OpenAI key is missing
❌ BUG: The moderation service doesn't handle missing API keys safely  (WHERE?)
```

### 2. Read Function Bodies, Not Just Signatures
Before claiming a function has a bug, read the ENTIRE function body. Many "bugs" are actually handled deeper in the function or in a called helper. The encouragement scheduler, for example, has multiple layers of fallback — read all of them.

### 3. If Unsure: QUESTION, Not BUG
```
✅ QUESTION: `server/src/controllers/postController.ts` line 174 — getPosts includes REVIEW posts
   in the feed query. Is this intentional? Users would see their own REVIEW posts but this means
   ALL REVIEW posts are visible to everyone.
❌ BUG: REVIEW posts are shown in the feed  (maybe intentional for post authors?)
```

### 4. Grep Before Claiming Missing
Before saying "there's no validation for X," search the codebase:
```bash
grep -rn "validate\|check\|verify" server/src/ --include="*.ts"
grep -rn "multer\|upload\|file" server/src/ --include="*.ts"
```
If you find it elsewhere, adjust your finding. If you still can't find it, include your search command in the finding.

### 5. No Style Suggestions
Do NOT flag: naming conventions, comment style, import ordering, formatting, whitespace, semicolons.
Only flag things that are **incorrect** — wrong behavior, missing validation, logic errors, security issues.

## Finding Format

```
[SEVERITY]: `[file]` line [N] — [one-line description]

Detail: [2-3 sentences explaining the issue, what happens, and why it matters]

Evidence:
```typescript
[relevant code snippet]
```

Suggested fix: [concrete suggestion, not "add validation"]
```

Severity levels:
- **BUG** — Confirmed incorrect behavior
- **RISK** — Code that could fail under specific conditions
- **QUESTION** — Potentially intentional, needs human judgment

## Phase 2: Regression Tests

After the review produces BUG findings, write regression tests:

1. For each BUG finding, write a test in `quality/test_regression.ts` that reproduces the bug
2. Each test should FAIL on the current implementation (confirming the bug is real)
3. If the test passes, the "bug" might be a false positive — investigate

### Regression Test Template

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

test('regression_review_N_description', async () => {
  // Review Finding #N (BUG): file.ts line NN
  // [Description of the bug]

  // Setup: create the conditions that trigger the bug
  // ...

  // Assert: this should NOT happen but currently does
  // If the test fails, the bug is confirmed
});
```

### Confirmation Table

After running regression tests, report:

| Finding | Severity | Regression Test | Result |
|---------|----------|----------------|--------|
| #1 | BUG | `regression_review_1_...` | BUG CONFIRMED / FALSE POSITIVE / NEEDS INVESTIGATION |
