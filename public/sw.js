// Minimaler Service Worker für "Die Zentrale":
// Network-first mit Cache-Fallback (Shell & Assets) – die App hat keine API.
const CACHE = 'die-zentrale-v10'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Fehlerseiten nicht in den Offline-Cache schreiben.
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  )
})
