/* Najman Dashboard — offline app-shell service worker.
   Goal: once the app has been opened at least once with internet,
   later visits (even fully offline) can still boot and show the
   Sign In screen instantly, using cached copies of the page itself
   and the React/ReactDOM/Supabase libraries it depends on.
   Actual sign-in still needs internet (it talks to Supabase), but
   the screen itself no longer has to wait on a network request. */

const CACHE_VERSION = 'najman-shell-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => console.warn('SW precache failed (will still work online):', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

function isCoreLib(url) {
  return url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // The app page itself: try the network first (to get the latest version),
  // but if there's no connection, fall back to the cached copy so the
  // Sign In screen can still render.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // React / ReactDOM / Supabase libraries: serve the cached copy instantly
  // (so the app boots fast even offline), and refresh the cache in the
  // background whenever there is a connection.
  if (isCoreLib(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else (fonts, images, Supabase API calls, etc.): normal
  // network-first behaviour, since school data must always be current.
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
