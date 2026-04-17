# Bug Fixes Log — PUSO Spaze

> This file tracks all bugs fixed in the PUSO Spaze codebase. The puso-engineer agent reads this before fixing new bugs to reuse proven patterns and avoid regression.

---

## Fix History

### BUG-001 — Server crashes on concurrent same-user reactions
- **Severity**: 🔴 Critical
- **Date**: 2026-04-13
- **Root Cause**: Reaction upsert in `reactionController.ts` did a `findUnique` → conditional `delete`/`upsert` without error handling. Under 5+ concurrent identical reactions, the race between find and upsert caused unhandled Prisma unique constraint violations (P2002) that crashed the Node.js process.
- **Fix**: Wrapped the entire find+toggle+upsert flow in a try/catch. P2002 (unique constraint violation from concurrent creates) and P2025 (record not found from concurrent deletes) now return `409 Conflict` with a retry message instead of crashing.
- **Files Changed**: `server/src/controllers/reactionController.ts`
- **Pattern**: Race Condition — always wrap Prisma operations on unique constraints in try/catch with P2002/P2025 handling.

---

### BUG-002 — 501-char post accepted (should reject at 500 max)
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: `POST_MAX_LENGTH` in `server/src/config/postLimits.ts` was set to `1000` while the client validates at `500`. Server allowed posts up to 1000 chars, bypassing client-side limit.
- **Fix**: Changed `POST_MAX_LENGTH` from `1000` to `500` to match client validation.
- **Files Changed**: `server/src/config/postLimits.ts`
- **Pattern**: Validation Boundary — always keep server and client limits in sync. Server is the source of truth.

---

### BUG-003 — 2-char comment accepted (should require 3 min)
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: Comment route validation in `postRoutes.ts` used `isLength({ min: 1 })` instead of `min: 3`. The controller only checked for non-empty content, not minimum length.
- **Fix**: (1) Changed route validation from `min: 1` to `min: 3` for both create and update comment routes. (2) Added explicit `content.trim().length < 3` check in `commentController.ts` `createComment` as a defense-in-depth measure.
- **Files Changed**: `server/src/api/postRoutes.ts`, `server/src/controllers/commentController.ts`
- **Pattern**: Missing Validation — always validate min/max in both the route (express-validator) and the controller (fallback).

---

### BUG-004 — Malformed JSON returns 500 instead of 400
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: The global error handler in `index.ts` caught all errors but returned 500 regardless of type. `express.json()` throws a `SyntaxError` with `type === 'entity.parse.failed'` for malformed JSON bodies, but this wasn't differentiated.
- **Fix**: Updated the global error handler to check for `SyntaxError` with `type === 'entity.parse.failed'` and return 400 with a clear message before falling through to the generic 500.
- **Files Changed**: `server/src/index.ts`
- **Pattern**: Error Type Leaking — check for known error subtypes (SyntaxError, Multer errors, Prisma errors) before the generic 500 handler.

---

### BUG-005 — Journal partial update requires all fields
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: PATCH `/api/journals/:id` route validation marked `title` and `content` as required (no `.optional()`). The controller destructured them as required types and passed them directly to `prisma.update()`, causing validation failures when only one field was sent.
- **Fix**: (1) Added `.optional()` to `title` and `content` validators in `journalRoutes.ts` PATCH route. (2) Changed controller to build a `data` object conditionally — only including fields that were actually provided in the request body.
- **Files Changed**: `server/src/api/journalRoutes.ts`, `server/src/controllers/journalController.ts`
- **Pattern**: Partial Update — PATCH endpoints must make body fields optional in both route validation and controller logic. Build the update `data` object conditionally.

---

### BUG-006 — Flag post endpoint mismatch (users cannot flag)
- **Severity**: 🟢 Low
- **Date**: 2026-04-13
- **Root Cause**: The only flag endpoint was `PATCH /api/coach/posts/:id/flag` which requires coach role verification. Regular users had no way to report inappropriate content.
- **Fix**: Added a user-facing `POST /api/posts/:postId/report` endpoint that moves SAFE posts to REVIEW status for coach inspection. Protected by `requireAuth` (any authenticated user can report). Does NOT set FLAGGED directly — only coaches can do that.
- **Files Changed**: `server/src/controllers/postController.ts` (added `reportPost`), `server/src/api/postRoutes.ts` (added route)
- **Pattern**: Endpoint Mismatch — when coach-only endpoints exist for user-facing actions, add a separate user-level endpoint with appropriate status transitions (SAFE → REVIEW, not SAFE → FLAGGED).

---

### BUG-007 — XSS content stored raw in database
- **Severity**: 🟢 Low
- **Date**: 2026-04-13
- **Root Cause**: Post and comment content was stored verbatim in the database, including HTML tags like `<img src=x onerror=alert(1)>`. While React auto-escapes on render, raw HTML in DB is risky if content is ever consumed by non-React contexts (email notifications, admin dashboards, API consumers).
- **Fix**: Created `server/src/utils/sanitize.ts` with `stripHtmlTags()` function. Applied it to all content entry points: `createPost`, `updatePost`, `createComment`, `updateComment`. HTML tags are stripped before moderation and storage.
- **Files Changed**: `server/src/utils/sanitize.ts` (new), `server/src/controllers/postController.ts`, `server/src/controllers/commentController.ts`
- **Pattern**: Stored XSS — always sanitize user input at the controller level before storage. Use `stripHtmlTags()` from `utils/sanitize.ts`. Defense-in-depth: sanitize even when the rendering layer (React) auto-escapes.

---

## Pattern Index

| Pattern | Occurrences | Key Lesson |
|---------|-------------|------------|
| Race Condition | BUG-001 | Wrap Prisma unique-constraint ops in try/catch; handle P2002/P2025 |
| Validation Boundary | BUG-002 | Keep server and client limits synced; server is source of truth |
| Missing Validation | BUG-003 | Validate in both route (express-validator) and controller (fallback) |
| Error Type Leaking | BUG-004 | Differentiate error types before generic 500 handler |
| Partial Update | BUG-005 | PATCH fields must be optional; build data object conditionally |
| Endpoint Mismatch | BUG-006 | Add user-level endpoints for user-facing actions |
| Stored XSS | BUG-007 | Strip HTML at controller level before DB storage |
| Null Byte Injection | BUG-008 | Strip null bytes globally before they reach Prisma/PostgreSQL |
| IDOR | BUG-009, BUG-010, BUG-011, BUG-012 | Always verify `req.user.userId === req.params.userId` on mutation endpoints |
| Stored XSS (Journals) | BUG-013 | Apply `stripHtmlTags()` to ALL user content entry points, not just posts/comments |
| Payload Abuse | BUG-014 | Reject deeply nested JSON payloads with depth checks in middleware |
| Authorization Gap (Read) | BUG-015 | Private data (journals, PINs) needs ownership checks on GET too, not just mutations |

---

## Batch 2 — Security Audit Fixes (2026-04-13)

### BUG-008 — Null bytes crash the server (CRITICAL)
- **Severity**: 🔴 Critical
- **Date**: 2026-04-13
- **Root Cause**: PostgreSQL text columns cannot store null bytes (`\u0000`). When user input containing null bytes was passed through Prisma to PostgreSQL, the pg driver threw an unhandled error that crashed the entire Node.js process. Any authenticated user could take down the server with a single request.
- **Fix**: (1) Added `stripNullBytes()` and `deepStripNullBytes()` to `utils/sanitize.ts`. (2) Added global middleware in `index.ts` that recursively strips null bytes from all `req.body` values before any route handler processes them.
- **Files Changed**: `server/src/utils/sanitize.ts`, `server/src/index.ts`
- **Pattern**: Null Byte Injection — strip null bytes globally from all request bodies as middleware. Never rely on individual controllers to handle this.

---

### BUG-009 — IDOR: Read any user's PIN (CRITICAL)
- **Severity**: 🔴 Critical
- **Date**: 2026-04-13
- **Root Cause**: `GET /api/users/:userId/pin` used `requireAuth` to verify the caller was logged in, but never checked that the JWT's `userId` matched the `:userId` URL param. Any authenticated user could read any other user's PIN in plaintext, enabling full account impersonation.
- **Fix**: Added `if (req.user?.userId !== userId) return 403` at the top of `getPin()`.
- **Files Changed**: `server/src/controllers/userController.ts`
- **Pattern**: IDOR — every user-scoped endpoint must verify `req.user.userId === req.params.userId`.

---

### BUG-010 — IDOR: Change any user's PIN (CRITICAL)
- **Severity**: 🔴 Critical
- **Date**: 2026-04-13
- **Root Cause**: Same as BUG-009 — `PATCH /api/users/:userId/pin` had no ownership check.
- **Fix**: Added `if (req.user?.userId !== userId) return 403` at the top of `updatePin()`.
- **Files Changed**: `server/src/controllers/userController.ts`
- **Pattern**: IDOR

---

### BUG-011 — IDOR: Change any user's username (CRITICAL)
- **Severity**: 🔴 Critical
- **Date**: 2026-04-13
- **Root Cause**: `PATCH /api/users/:userId/username` had no ownership check.
- **Fix**: Added `if (req.user?.userId !== userId) return 403` at the top of `updateUsername()`.
- **Files Changed**: `server/src/controllers/userController.ts`
- **Pattern**: IDOR

---

### BUG-012 — IDOR: Toggle any user's anonymous mode (HIGH)
- **Severity**: 🟠 High
- **Date**: 2026-04-13
- **Root Cause**: `PATCH /api/users/:userId/anonymous` had no ownership check. Attacker could de-anonymize other users.
- **Fix**: Added `if (req.user?.userId !== userId) return 403` at the top of `toggleAnonymous()`. Also added the same check to `toggleNotifications()` and `uploadAvatar()` for defense-in-depth.
- **Files Changed**: `server/src/controllers/userController.ts`
- **Pattern**: IDOR

---

### BUG-013 — XSS stored raw in journal entries (HIGH)
- **Severity**: 🟠 High
- **Date**: 2026-04-13
- **Root Cause**: Journal `createJournal()` and `updateJournal()` stored title and content verbatim without HTML sanitization. Posts and comments had `stripHtmlTags()` applied (from earlier BUG-007 fix), but journals were missed.
- **Fix**: Imported `stripHtmlTags` in `journalController.ts`. Applied to title and content in both `createJournal()` and `updateJournal()`.
- **Files Changed**: `server/src/controllers/journalController.ts`
- **Pattern**: Stored XSS — apply `stripHtmlTags()` to ALL user content entry points. When adding it to one controller, scan all other controllers for the same gap.

---

### BUG-014 — 20-deep nested JSON returns 500 (MEDIUM)
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: `express.json()` successfully parses deeply nested JSON, but the resulting object causes stack overflows or unhandled errors in downstream route handlers and Prisma operations. The global error handler caught it as a generic 500, leaking internal error information.
- **Fix**: Added `getJsonDepth()` utility function and middleware in `index.ts` that rejects request bodies with nesting deeper than 10 levels with a 400 error.
- **Files Changed**: `server/src/index.ts`
- **Pattern**: Payload Abuse — validate structural properties of input (depth, size, array length) at the middleware layer before route handlers.

---

### BUG-015 — Journal content accessible cross-user (MEDIUM)
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: `GET /api/journals?userId=X` and `GET /api/journals/:id?userId=X` used `requireAuth` but accepted any `userId` in the query param. Journals are private data, but any authenticated user could pass another user's ID to read their journals.
- **Fix**: Added `if (req.user?.userId !== userId) return 403` ownership check at the top of both `getJournals()` and `getJournalById()`.
- **Files Changed**: `server/src/controllers/journalController.ts`
- **Pattern**: Authorization Gap (Read) — private data needs ownership checks on READ endpoints too, not just mutations. The `userId` query param must match the JWT's userId.

---

## Batch 3 — Hardening Fixes (2026-04-13)

### BUG-016 — PWA opens blank screen from push notification tap
- **Severity**: 🟠 High
- **Date**: 2026-04-17
- **Root Cause**: Web push notification clicks used service-worker URLs that did not match the app's runtime expectations. MESSAGE notifications opened `/chat` without a `conversationId`, but `ChatScreen.tsx` requires that param to load messages. `PostDetailScreen.tsx` also had a stale web fallback that looked for `/PostDetail/...` instead of the actual `/post/...` URL used by the service worker and linking config. In PWA launches, those mismatches could leave the app on a blank or unusable screen.
- **Fix**: (1) Updated `apps/mobile/public/sw.js` to open `/chat/:conversationId` for chat notifications and `/post/:postId?openedFrom=notifications&highlightCommentId=...` for post/comment notifications. (2) Updated `apps/mobile/navigation/AppNavigator.tsx` linking config so `Chat` accepts `chat/:conversationId?`. (3) Hardened `apps/mobile/screens/ChatScreen.tsx` to recover the conversation ID from the web URL when route params are absent and show a safe fallback state instead of crashing. (4) Fixed `apps/mobile/screens/PostDetailScreen.tsx` web URL parsing to recognize `/post/...` and query-string comment highlight parameters.
- **Files Changed**: `apps/mobile/public/sw.js`, `apps/mobile/navigation/AppNavigator.tsx`, `apps/mobile/screens/ChatScreen.tsx`, `apps/mobile/screens/PostDetailScreen.tsx`
- **Pattern**: Web Deep-Link Drift — keep service-worker notification URLs, navigation linking config, and screen-level web fallbacks aligned. For protected PWA routes opened from push, never rely on route params alone; recover key IDs from the URL as a fallback.

### BUG-007 revision — Nested JSON still returns 500
- **Severity**: 🟡 Medium
- **Date**: 2026-04-13
- **Root Cause**: The depth-check middleware was correct, but the global error handler only caught `SyntaxError` with `type === 'entity.parse.failed'`. Other body-parser errors (e.g., `RangeError` from stack overflow during `JSON.parse` of extremely deep payloads, `PayloadTooLargeError`) fell through to the generic 500 handler. Additionally, the JSON body limit was set to `1mb` — excessively large for this API.
- **Fix**: (1) Replaced the `SyntaxError`-only check in the global error handler with a generic `err.status >= 400 && err.status < 500` check — body-parser always sets `err.status` for client errors. This catches malformed JSON (400), payload too large (413), and any other body-parser errors. (2) Reduced `express.json()` limit from `1mb` to `100kb`. (3) Also added `limit: '100kb'` to `express.urlencoded()`.
- **Files Changed**: `server/src/index.ts`
- **Pattern**: Error Type Leaking — use `err.status` from body-parser errors instead of checking specific error classes. Body-parser always sets `status` for client errors.

---

### BUG-001 hardening — Full null byte sanitization
- **Severity**: 🟢 Low (crash already fixed, this is defense-in-depth)
- **Date**: 2026-04-13
- **Root Cause**: The global null byte middleware only processed `req.body` (set by `express.json()`). Two gaps remained: (1) `deepStripNullBytes` only stripped null bytes from object *values*, not *keys*. (2) Multipart form uploads (multer) bypass `express.json()`, so text fields from multipart requests weren't sanitized. (3) Query string values weren't stripped.
- **Fix**: (1) Updated `deepStripNullBytes()` to also strip null bytes from object keys. (2) Extended the global middleware to also strip null bytes from `req.query` string values. (3) Updated `stripHtmlTags()` to also remove null bytes (defense-in-depth for controllers that process multipart text fields). (4) Added `containsNullBytes()` utility for future use.
- **Files Changed**: `server/src/utils/sanitize.ts`, `server/src/index.ts`
- **Pattern**: Null Byte Injection — sanitize at MULTIPLE layers: global middleware for JSON bodies + query params, and controller-level sanitize functions (stripHtmlTags) for multipart bodies.
