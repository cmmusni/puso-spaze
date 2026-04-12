# Active Context — PUSO Spaze

**Last Updated:** April 12, 2026

## Current Work Focus
- PIN-based cross-device auth & account recovery (completed)
- Quality playbook & memory bank update
- Android build & testing (Expo prebuild → Android Studio)

## Recent Changes

### PIN-Based Cross-Device Login (April 12, 2026)
- **Server**: Added `pin` field (TEXT, UNIQUE) to User model; `generateUniquePin()` creates 6-digit PINs (8-digit fallback on collision, 10 retries)
- **Login flow**: If username exists on a different device and PIN is provided + matches → allow cross-device login + update deviceId. If no PIN → 409
- **PIN auto-backfill**: On login, if user has no PIN yet, one is auto-generated and saved
- **New endpoints**: `GET /api/users/:userId/pin`, `PATCH /api/users/:userId/pin` (both JWT-protected)
- **Client**: LoginScreen has PIN modal for cross-device login; ProfileScreen shows/edits PIN with visibility toggle

### Account Recovery System (April 12, 2026)
- **New model**: `RecoveryRequest` (id, displayName, reason, status: PENDING|APPROVED|DENIED, reviewedBy, reviewedAt)
- **New controller**: `recoveryController.ts` with submit (public), list (coach), review (coach/admin)
- **Recovery flow**: Locked-out user → submit recovery request (public, no auth) → coaches see request + user's post/journal history → approve (clears deviceId) or deny
- **Coach Dashboard**: Added "Account Recovery" queue panel with approve/deny actions + user history display
- **LoginScreen**: Recovery modal accessible after failed PIN attempts

### Magic Bytes Upload Validation (April 12, 2026)
- **New utility**: `server/src/utils/validateImageMagicBytes.ts` — validates uploaded files by checking magic bytes (JPEG: FF D8 FF, PNG: 89 50 4E 47, GIF, WebP), not just MIME headers
- Used in avatar uploads (`userRoutes.ts`) — partially mitigates QUALITY.md Scenario 8

### JWT Authentication (April 12, 2026)
- **Server**: `jwt.ts` utility (sign/verify), `requireAuth` middleware, `JWT_SECRET` env var with default + startup warning
- **Route protection**: All write endpoints require valid JWT Bearer token; public read endpoints remain open
- **Token issuance**: Returns `token` on login/invite redemption
- **Client**: `api.ts` interceptor attaches JWT; `UserContext.tsx` stores/restores/clears token
- **Web deviceId fix**: Web clients now generate and persist deviceId via AsyncStorage/localStorage

### Earlier Changes (April 11, 2026)
- Login screen prefills username from `getDeviceOwner()` on mount
- Coach Dashboard: `0` displays as `0` not `00`
- Journal Screen: Save Entry button layout adjusted for responsive breakpoints

## Next Steps
- Complete Android APK build and test on physical tablet
- Deploy PIN + recovery + JWT changes to production (set `JWT_SECRET` env var)
- Add functional tests for PIN validation and recovery request flow
- Continue responsive UI polish across screens

## Active Decisions
- All write API endpoints require JWT auth; read endpoints remain public
- PIN-based cross-device login as alternative to device-bound identity
- Recovery requests require coach review with user history verification
- Web clients now generate and persist deviceId (same as native)
- JWT tokens expire after 7 days — user must re-login
- `JWT_SECRET` has hardcoded dev default with startup warning (must override in production)
