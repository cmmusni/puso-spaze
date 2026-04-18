# TASK005 — PWA Performance Optimization

**Status:** ✅ Completed
**Created:** April 18, 2026
**Priority:** High

## Problem
PWA users report slow image loading, slow page refresh, and occasional network timeouts.

## Root Causes Found
1. No gzip/brotli compression on server responses
2. Cloudinary images served at full resolution (no transforms)
3. Using React Native `Image` (no disk caching) instead of `expo-image`
4. Service worker only handles push — no asset or API response caching
5. Duplicate concurrent GET requests on HomeScreen focus (4 API calls)
6. No Cache-Control headers on any GET endpoint

## Changes Made

### Server
- **Compression middleware**: Added `compression` package to Express pipeline → gzip all JSON responses
- **Cache-Control headers**: Added `public, max-age=60, stale-while-revalidate=300` to all `GET /api/*` responses
- **Cloudinary upload transforms**: Added `quality: 'auto', fetch_format: 'auto'` to `uploadBuffer()` → new uploads are auto-optimized

### Client
- **expo-image**: Replaced React Native `Image` with `expo-image` `Image` in PostCard, HomeScreen, PostDetailScreen → built-in memory + disk caching, fade transitions
- **Cloudinary URL optimizer**: New `utils/optimizeImage.ts` — inserts `f_auto,q_auto,w_{2x}` into Cloudinary URLs at render time for existing images
- **Request deduplication**: Added `deduplicatedGet()` wrapper in `services/api.ts` → prevents duplicate in-flight GET requests (same URL + params coalesced into one network call)
- **Deduplication applied to**: `apiFetchPosts`, `apiGetUnreadCount`, `apiGetDashboardStats`

### PWA Service Worker
- **Install event**: Precaches app shell (/, icon)
- **Activate event**: Cleans old cache versions
- **Fetch event**: Three strategies:
  - Cloudinary images → cache-first (images rarely change)
  - API requests → network-first with stale fallback (offline resilience)
  - Static assets → stale-while-revalidate (instant loads, background update)

## Files Changed
- `server/src/index.ts` — compression, Cache-Control
- `server/src/config/cloudinary.ts` — upload transforms
- `server/package.json` — compression dependency
- `apps/mobile/utils/optimizeImage.ts` — new file
- `apps/mobile/services/api.ts` — deduplicatedGet
- `apps/mobile/components/PostCard.tsx` — expo-image
- `apps/mobile/screens/HomeScreen.tsx` — expo-image
- `apps/mobile/screens/PostDetailScreen.tsx` — expo-image
- `apps/mobile/public/sw.js` — full caching strategy
- `apps/mobile/package.json` — expo-image dependency
