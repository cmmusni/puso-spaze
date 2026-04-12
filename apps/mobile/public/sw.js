// ─────────────────────────────────────────────
// public/sw.js — Service Worker for Web Push Notifications
// Handles push events and notification clicks
// ─────────────────────────────────────────────

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
    url = `/post/${data.postId}`;
  } else if (data.conversationId) {
    url = '/chat';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
