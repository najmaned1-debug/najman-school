// Najman SMS — Service Worker
// Caches the app shell + CDN libraries so the app opens instantly after the first install.
// NEVER caches Supabase requests (auth/data) — those must always hit the network live.

const CACHE_NAME = "najman-sms-v1";

const PRECACHE_URLS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800;900&family=Caveat:wght@500;700&display=swap"
];

// Domains that must NEVER be served from cache (live data / auth).
const NEVER_CACHE = ["supabase.co", "supabase.in"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // If a CDN asset fails to precache (e.g. offline install), don't block activation.
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Always go straight to network for Supabase (live data/auth) — never cache.
  if (NEVER_CACHE.some((domain) => url.includes(domain))) {
    return;
  }

  // Only handle GET requests for the app shell + known CDN libraries.
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache successful same-origin or CDN static responses for next time.
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
