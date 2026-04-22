# TASK007 — Google Play Store Release Readiness

**Status:** In Progress
**Owner:** puso-engineer
**Created:** Apr 20, 2026
**Updated:** Apr 22, 2026

## Goal
Get the Android app ready for a first **Production**-track release on the Google Play Store.

## Decisions
1. First-upload track: **production** (not internal / closed).
2. NDK fix: pin a known-good NDK in `eas.json` so production builds run on EAS cloud and the local NDK problem in TASK001 doesn't block release.
3. Account deletion: **immediate hard delete** (no grace period). Required by Google Play 2024+ policy.

## Work Completed Apr 20
- [x] Added `POST_NOTIFICATIONS` to `apps/mobile/app.json` android.permissions (required on Android 13+ for `expo-notifications`). Camera permission deliberately omitted — the app only uses `launchImageLibraryAsync`, never the camera.
- [x] Pinned NDK `26.1.10909125` in `apps/mobile/eas.json` production android profile.
- [x] Switched `apps/mobile/eas.json` submit production track from `internal` → `production`.
- [x] Server: added `DELETE /api/users/:userId` controller (`deleteAccount` in `server/src/controllers/userController.ts`) — JWT-auth + owner-only check, hard delete via Prisma transaction, explicitly clears matching `RecoveryRequest` rows by displayName.
- [x] Server: registered route in `server/src/api/userRoutes.ts`.
- [x] Client: added `apiDeleteAccount(userId)` in `apps/mobile/services/api.ts`.
- [x] Client: added Danger Zone with "Delete my account" button in `ProfileScreen.tsx` Preferences tab. Uses `showConfirm` then calls `apiDeleteAccount`, then `logoutUser` to clear local state and reset navigation.
- [x] Updated `apps/mobile/overview/privacy-policy.html` section 9 + retention section to mention in-app deletion path.
- [x] Server typecheck (`npx tsc --noEmit` in `server/`) passes.
- [x] Client typecheck on edited screens: clean (used `colors.errorText` token).

## Still To Do Before Submission
- [ ] EAS production build: `cd apps/mobile && eas build --platform android --profile production`
- [ ] Smoke test the resulting AAB on a real Android device:
  - signup/login + PIN
  - post + image upload (Cloudinary)
  - reactions, comments, mentions
  - push notification with app backgrounded
  - daily reflection card
  - coach chat round trip
  - **delete account flow → user can no longer log in, posts gone**
- [ ] Play Console listing assets:
  - Feature graphic 1024×500
  - 4–8 phone screenshots (1080×1920+)
  - 7" tablet screenshots (optional, app supports tablet)
  - Short description (≤80 chars), long description (≤4000 chars)
  - Category: Health & Fitness or Lifestyle
  - Content rating questionnaire — declare user-generated content + AI moderation
  - Data Safety form — Cloudinary, Firebase/FCM, OpenAI, JWT
  - Target audience: 13+
  - Reviewer test account + PIN
- [ ] Optional polish (warnings from readiness assessment, can ship without):
  - Rate limiting on PIN login + recovery endpoints
  - Terms of Service page
  - Custom monochrome notification icon
- [ ] Verify Play Console doesn't already have a build with `versionCode ≥ 4` (autoIncrement will bump from there).
- [ ] `eas submit --platform android --profile production` once AAB is uploaded and tested.

## Files Touched
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `apps/mobile/services/api.ts`
- `apps/mobile/screens/ProfileScreen.tsx`
- `apps/mobile/overview/privacy-policy.html`
- `server/src/controllers/userController.ts`
- `server/src/api/userRoutes.ts`

## Notes
- Local Android Studio build (TASK001) still has the broken NDK; not a blocker for production release because EAS cloud builds use the pinned NDK.
- Hard delete relies on existing Prisma `onDelete: Cascade` rules on User → posts/comments/reactions/journals/conversations/messages/notifications. RecoveryRequest is not FK-linked to User, so it's deleted by displayName explicitly inside the same transaction.

## Progress Log
### April 22, 2026
- Refreshed Android-facing brand assets: `icon.png`, `adaptive-icon.png`, `splash.png`, `logo.png`, favicon/PWA icons, and updated overview screenshots to Android phone/tablet captures for store-facing presentation consistency.
- Bumped Android `versionCode` to `5` in `apps/mobile/app.json`.
- Verified `POST_NOTIFICATIONS` permission remains present for Android 13+.
- Corrected adaptive icon background back to the theme canvas color (`#FCF8FF`) so release assets stay aligned with the app theme and deployment checklist.
- Release readiness work now also includes refreshed Android phone/tablet screenshot folders under `apps/mobile/assets/screens/` and mirrored web/public overview assets.

### April 22, 2026 (later)
- Bumped Android `versionCode` from `5` to `6` for the next Play upload cycle.
- Refreshed Android phone screenshots (`feed`, `journal`, `login`, `notifications`, `profile`, `spaze-coach`) to newer captures under `apps/mobile/assets/screens/android-phone/`.
- Added Play listing collateral assets: `feature-graphic.png`, `play-store-icon-512.png`, and feature tile set `apps/mobile/assets/features/01-05.png`.
- Added `apps/mobile/overview/child-safety.html` for additional policy/compliance documentation support.

### April 22, 2026 (deploy gate pass)
- Bumped Android `versionCode` from `6` to `7` in `apps/mobile/app.json` for the current production upload sequence.
- Refreshed release-facing app and PWA branding assets in `apps/mobile/assets/` and `apps/mobile/public/` (`icon`, `adaptive-icon`, `logo`, `splash`, `apple-touch-icon`, `favicon`, `icon-192`, `icon-512`, and web `icon.png`) to keep store and web shell branding aligned.
- Logged into Railway CLI, linked the `Postgres` service, and verified production Prisma state against `DATABASE_PUBLIC_URL` / `hopper.proxy.rlwy.net:42841`.
- `npx prisma migrate deploy` reported no pending migrations; `npx prisma migrate status` reported production schema up to date.
