/*
 * Offline support.
 *
 * Metro platforms are underground with no signal, which is exactly where you
 * need a departure board. Every byte this app serves is static, so caching it
 * is unusually safe: there is no user state and no live feed to go stale.
 *
 * Strategy:
 *  - Navigations: network first, falling back to cache, so a reachable network
 *    always wins and an unreachable one still opens the page you last used.
 *  - Static assets and /data JSON: stale-while-revalidate — instant from cache,
 *    refreshed in the background for next time.
 *
 * Timetables only change a few times a year and the UI always states the feed
 * version, so serving a cached copy underground is honest.
 */
const VERSION = 'v1';
const CACHE = `namma-commute-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])).then(
      () => self.skipWaiting(),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache another origin — map tiles are large and have their own rules.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
