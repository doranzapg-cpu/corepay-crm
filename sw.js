// sw.js — Core Pay CRM PWA
// fix26: NUNCA cachear index.html. Invalidar caché anterior.
const CACHE_NAME = 'corepay-crm-v3';
const STATIC_ASSETS = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-144.png'
];

// Nunca cachear estas rutas
const NO_CACHE = ['index.html', './', '/'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // NUNCA cachear index.html ni la raíz
  if (
    event.request.method !== 'GET' ||
    path.endsWith('index.html') ||
    path === '/' ||
    path === url.origin + '/' ||
    NO_CACHE.some(n => path.endsWith(n))
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Scripts de Google (OAuth, GSI) — siempre red
  if (url.hostname.includes('google') || url.hostname.includes('googleapis')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Apps Script — siempre red, nunca cachear
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Activos estáticos: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('', { status: 503 }));
    })
  );
});
