# TASK003 — PWA notification click blank screen

## Status
Completed

## Summary
Fix the blank-screen PWA failure when a user clicks a web push notification.

## Plan
- Trace the notification-click URL built by the service worker.
- Align service-worker URLs with React Navigation web linking.
- Add web URL fallbacks in destination screens so notification opens still work even if route params are absent.
- Validate the edited files and record the fix.

## Findings
- The service worker opened message notifications at `/chat`, but ChatScreen requires `conversationId` in route params.
- AppNavigator's web linking config mapped Chat to `chat` without a conversation ID segment.
- PostDetailScreen had a web pathname fallback, but it looked for `/PostDetail/...` instead of the actual `/post/...` path used by the service worker and web linking.

## Progress Log
- Apr 17, 2026: Identified mismatched web notification routes as the likely root cause of the blank PWA screen.
- Apr 17, 2026: Updated the service worker to open parameterized post/chat URLs, aligned AppNavigator chat linking, and added web URL fallbacks in ChatScreen and PostDetailScreen.

## Validation
- Type/error checks passed for `public/sw.js`, `navigation/AppNavigator.tsx`, `screens/ChatScreen.tsx`, and `screens/PostDetailScreen.tsx`.
- Root cause verified in code: message notifications previously opened `/chat` without the required `conversationId`, and PostDetailScreen's web pathname fallback expected `/PostDetail/...` instead of `/post/...`.