/* CORE PAY CRM — Service Worker MC-133
   App shell cache only. Google Apps Script calls stay network-first. */
const CACHE_NAME = 'corepay-crm-mc133-v1';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca cachear APIs/datos dinámicos.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com') || url.hostname.includes('accounts.google.com')) {
    event.respondWith(fetch(req));
    return;
  }

  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    fetch(req)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
