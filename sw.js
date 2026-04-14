const CACHE_NAME = 'njust-kb-v22';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/capacitor.js',
  './js/app.js',
  './js/features.js',
  './js/native-sync.js',
  './js/parser.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isAppShellAsset = isSameOrigin && (
    requestUrl.pathname.endsWith('/')
    || requestUrl.pathname.endsWith('/index.html')
    || requestUrl.pathname.endsWith('/css/app.css')
    || requestUrl.pathname.endsWith('/js/app.js')
    || requestUrl.pathname.endsWith('/js/features.js')
    || requestUrl.pathname.endsWith('/js/native-sync.js')
    || requestUrl.pathname.endsWith('/js/parser.js')
    || requestUrl.pathname.endsWith('/manifest.json')
  );

  if (isAppShellAsset || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok && isSameOrigin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return caches.match('./');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || !response.ok) return response;
          if (isSameOrigin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return caches.match('./');
        });
    })
  );
});
