/**
 * CorePay CRM — Service Worker (MC-8 + fix24)
 * Estrategia:
 *   - Shell del app (HTML/assets estáticos): Cache-First
 *   - Google Sheets API (backend): Network-First con fallback a cache
 *   - Todo lo demás: Network-First sin fallback
 */

const CACHE_NAME = 'corepay-crm-v1';
const CACHE_SHELL = 'corepay-shell-v1';

// Assets del app shell que se cachean al instalar
const SHELL_ASSETS = [
  './corepay_crm_v20_MC8_pwa.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── INSTALL: precachear el shell ──────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[CorePay SW] Instalando…');
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(function(cache) {
        return Promise.allSettled(
          SHELL_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[CorePay SW] No se pudo cachear:', url, err.message);
            });
          })
        );
      })
      .then(function() {
        console.log('[CorePay SW] Shell cacheado.');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[CorePay SW] Activando…');
  const VALID_CACHES = [CACHE_NAME, CACHE_SHELL];
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(key) { return !VALID_CACHES.includes(key); })
            .map(function(key) {
              console.log('[CorePay SW] Eliminando cache viejo:', key);
              return caches.delete(key);
            })
        );
      })
      .then(function() { return self.clients.claim(); })
  );
});

// ── FETCH: estrategia por tipo de recurso ─────────────────────────────────────
self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // fix24: nunca interceptar POST — dejar pasar directo a la red
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 1) Google Sheets API → Network-First (datos en tiempo real)
  if (url.includes('script.google.com') || url.includes('sheets.googleapis.com')) {
    event.respondWith(networkFirst(event.request, CACHE_NAME));
    return;
  }

  // 2) Shell del app (HTML propio) → Cache-First
  if (url.includes('corepay_crm') || url.includes('manifest.json') || url.includes('corepay-crm')) {
    event.respondWith(cacheFirst(event.request, CACHE_SHELL));
    return;
  }

  // 3) Iconos y assets estáticos → Cache-First
  if (url.includes('/icons/') || url.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(cacheFirst(event.request, CACHE_SHELL));
    return;
  }

  // 4) Todo lo demás → Network-First sin fallback
  event.respondWith(fetch(event.request).catch(function() {
    return caches.match(event.request);
  }));
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        // fix24: solo cachear GET con respuesta válida
        if (response && response.status === 200 && request.method === 'GET') {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function() {
        return new Response(
          '<html><body style="font-family:sans-serif;background:#060a12;color:#00f0ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">' +
          '<div><h2>CorePay CRM</h2><p style="color:#8fa3c7">Sin conexión. Reconecta para continuar.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
    });
  });
}

function networkFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return fetch(request).then(function(response) {
      // fix24: solo cachear GET con respuesta válida
      if (response && response.status === 200 && request.method === 'GET') {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(function() {
      return cache.match(request);
    });
  });
}
