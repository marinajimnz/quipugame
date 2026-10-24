// Service worker de Quipu (T080). Sencillo a propósito:
//   · /reglas y /sin-conexion: se guardan al instalar (con sus JS y CSS) y se sirven sin conexión.
//   · Recursos estáticos con hash (/_next/static, /icons): primero caché.
//   · Todo lo demás, incluidas las partidas, va SIEMPRE a la red: una partida cacheada es una
//     partida mal pintada. Sin conexión, las páginas se sustituyen por /sin-conexion.
//   · Nunca toca otras webs (Supabase incluida) ni peticiones que no sean GET.

const CACHE = 'quipu-v1';
const OFFLINE_PAGES = ['/reglas', '/sin-conexion'];
const PRECACHE = [...OFFLINE_PAGES, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

async function precache() {
  const cache = await caches.open(CACHE);
  for (const url of PRECACHE) {
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) continue;
      await cache.put(url, res.clone());
      if ((res.headers.get('content-type') || '').includes('text/html')) {
        // Los JS y CSS de la página, para que funcione (y se hidrate) sin conexión.
        const html = await res.text();
        const assets = new Set([...html.matchAll(/["'](\/_next\/static\/[^"'?#]+)/g)].map((m) => m[1]));
        await Promise.all([...assets].map((a) => cache.add(a).catch(() => undefined)));
      }
    } catch {
      // Sin red al instalar: se volverá a intentar en la próxima instalación.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

async function networkFirst(request, path) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(CACHE)).put(path, res.clone());
    return res;
  } catch {
    return (await caches.match(path)) || (await caches.match('/sin-conexion')) || Response.error();
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('/sin-conexion')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      OFFLINE_PAGES.includes(url.pathname) ? networkFirst(request, url.pathname) : networkOnly(request),
    );
  }
});
