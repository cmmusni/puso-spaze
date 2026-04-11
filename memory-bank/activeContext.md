# Active Context — PUSO Spaze

**Last Updated:** April 11, 2026

## Current Work Focus
- Android build & testing (Expo prebuild → Android Studio)
- Responsive UI refinements (Journal screen action buttons layout)
- Device identity improvements (skip device ID enforcement on web)
- Login UX: prefill username from device storage on LoginScreen load

## Recent Changes

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
