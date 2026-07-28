/**
 * Service worker for installability only — it deliberately caches nothing.
 *
 * Chrome will not offer to install an app without a service worker that has a
 * fetch handler, and an installable window is the whole point here: the
 * dashboard becomes its own window in the dock instead of one tab among many.
 *
 * Offline support would be a lie. Every number on this dashboard comes from the
 * herdr daemon over a WebSocket to 127.0.0.1, so a cached shell with no daemon
 * behind it renders an empty grid that looks like a race with no cars rather
 * than like a disconnection. The server also sends `cache-control: no-store` on
 * everything it serves, so caching responses here would contradict it.
 *
 * The fetch handler therefore passes everything straight through to the network.
 * That is a real handler as far as the install criteria go, and it leaves the
 * server's own headers as the only thing deciding what gets stored.
 */

// Take over from any previous worker immediately, so a stale copy of this file
// never outlives the version of the app that shipped it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  // Pass-through. Returning without calling respondWith() would also work, but
  // being explicit keeps the handler unmistakably present for the install check.
  event.respondWith(fetch(event.request));
});
