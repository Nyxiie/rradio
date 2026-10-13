// Minimal service worker: caches the app shell so the UI opens offline.
// Audio streams and APIs are cross-origin and are never touched here.
const CACHE = 'rradio-shell-v2'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // Network first, fall back to cache; keeps deploys fresh.
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache complete, successful same-origin responses (no 404/500 pages, no partial content).
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}))
        }
        return res
      })
      .catch(() =>
        caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error())),
      ),
  )
})
