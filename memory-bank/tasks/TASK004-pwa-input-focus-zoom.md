# TASK004 — PWA input focus zoom

## Status
Completed

## Summary
Prevent the PWA from zooming in when a user focuses a text input on mobile web / iPhone Safari.

## Plan
- Verify the root cause in the web shell and current mobile web setup.
- Apply a global web-only fix so individual screens do not need one-off TextInput patches.
- Validate the edited file and record the result.

## Findings
- iPhone Safari and installed PWAs auto-zoom focused inputs when the rendered font size is below 16px.
- The app has many compact TextInput styles below that threshold.
- The safest repo-wide fix is a web-shell CSS override for touch web inputs instead of disabling pinch zoom globally.

## Progress Log
- Apr 17, 2026: Confirmed the likely root cause and selected a global touch-web CSS fix in WebShell.
- Apr 17, 2026: Added a touch-web CSS override in WebShell to force inputs, textareas, selects, and contenteditable fields to render at 16px.

## Validation
- WebShell type/error check: no errors found.
- Fix applied globally for touch web, so existing TextInput screens do not need per-screen patches.