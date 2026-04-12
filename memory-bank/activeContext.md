# Active Context — PUSO Spaze

**Last Updated:** April 12, 2026

## Current Work Focus
- Quality playbook full retest and update
- Android build & testing (Expo prebuild → Android Studio)

## Recent Changes

### Quality Playbook Retest (April 12, 2026)
- **Functional tests**: Synced replicated moderation logic with production `moderationService.ts` — was 61% incomplete (missing Unicode normalization, 61 blocked terms, 9 phrase patterns)
- **Test FS-1h**: Changed from asserting Cyrillic bypass (known gap) to asserting FLAGGED (gap now fixed in production code)
- **4 new tests added**: FS-1i (zero-width stripping), FS-1j (ableist phrase patterns), FS-1k (Filipino-specific slurs), FS-1l (discrimination terms) — total now 56 tests, all passing
- **TC-11 Playwright fix**: Changed `btn.click(); btn.click()` to `btn.dblclick()` — button disappears after first click (loading state), causing timeout. Now 20/20 Playwright tests pass
- **QUALITY.md Scenario 1**: Updated to reflect Unicode homoglyph normalization is now MITIGATED, with remaining gap documented (mathematical alphanumerics)
- **Server unit tests**: 2/2 passing (commentController.test.ts)

### Device ID (April 11, 2026)
- Removed device ID enforcement for web clients — web no longer sends `deviceId` to server
- One-time device ID sync skipped on web
- Native (iOS/Android) retains full device binding

### Login Screen (April 11, 2026)
- Added `useEffect` to prefill username from `getDeviceOwner()` on mount

### Coach Dashboard (April 11, 2026)
- Removed `padStart(2, '0')` from stat values — `0` now displays as `0` not `00`

### Journal Screen (April 11, 2026)
- Save Entry button moved to its own row, right-aligned on mobile and narrow web (< 900px)
- On wide web (≥ 900px), Save Entry stays inline with action chips

## Next Steps
- Complete Android APK build and test on physical tablet
- Test device ID changes on web (clearing cache → re-login)
- Continue responsive UI polish across screens

## Active Decisions
- Web users can log in with any username without device binding restriction
- Native users still enforce device-username binding
- `isWide` (web ≥ 900px) used as breakpoint for layout decisions (not just `Platform.OS`)
