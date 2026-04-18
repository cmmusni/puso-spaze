// ─────────────────────────────────────────────
// public/sw.js — Service Worker for Web Push Notifications
// + PWA asset caching + API stale-while-revalidate
// ─────────────────────────────────────────────

const CACHE_VERSION = 'puso-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Static assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/icon-192.png',
];

// ── Install: precache shell assets ────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache strategy per request type ────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // 1) Cloudinary images → Cache-first (images rarely change)
  if (url.hostname.includes('res.cloudinary.com')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 2) API requests → Network-first with stale fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          // Network failed — serve stale cache if available
          const cached = await cache.match(request);
          return cached || new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
    );
    return;
  }

  // 3) Static assets (JS/CSS bundles) → Stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'PUSO Spaze', body: event.data.text() };
  }

  const { title = 'PUSO Spaze', body = '', data = {}, icon, badge } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      data,
      vibrate: [200, 100, 200],
      tag: data.postId || 'puso-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  // Navigate to the relevant screen based on notification data
  let url = '/';
  if (data.postId) {
    const params = new URLSearchParams({ openedFrom: 'notifications' });
    if (data.commentId) {
      params.set('highlightCommentId', data.commentId);
    }
    url = `/post/${data.postId}?${params.toString()}`;
  } else if (data.conversationId) {
    url = `/chat/${data.conversationId}`;
  } else if (data.screen === 'Home') {
    url = '/';
  } else if (data.screen === 'Journal') {
    url = '/journal';
  } else if (data.screen === 'Notifications') {
    url = '/notifications';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(url).then((navigatedClient) => {
            if (navigatedClient && 'focus' in navigatedClient) {
              return navigatedClient.focus();
            }
            return client.focus();
          });
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
