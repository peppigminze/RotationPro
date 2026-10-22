// RotationPro Service Worker – App-Shell offline, Schriften zur Laufzeit gecacht
const VERSION = 'e912f9ceb0';
const CACHE = 'rotationpro-' + VERSION;
const FONT_CACHE = 'rotationpro-fonts';
const ASSETS = [
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/engine/analysis.js',
  './js/engine/core.js',
  './js/engine/formation.js',
  './js/engine/lessons.js',
  './js/engine/questions.js',
  './js/engine/rng.js',
  './js/engine/srs.js',
  './js/engine/systems.js',
  './js/i18n.js',
  './js/modes/field.js',
  './js/modes/game.js',
  './js/modes/learn.js',
  './js/modes/more.js',
  './js/modes/quiz.js',
  './js/modes/settings.js',
  './js/modes/squad.js',
  './js/modes/stats.js',
  './js/modes/systems.js',
  './js/modes/tactics.js',
  './js/ui/court.js',
  './js/ui/dom.js',
  './js/ui/icons.js',
  './js/ui/qvisual.js',
  './js/ui/render.js',
  './js/ui/share.js',
  './js/ui/store.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/maskable-512.png',
  './icons/maskable.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('rotationpro-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
