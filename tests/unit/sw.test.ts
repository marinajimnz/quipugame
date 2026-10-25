import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

// T080: la lógica del service worker (public/sw.js), ejecutada en un entorno simulado: caché en
// memoria y una red que se puede "desconectar".

const ORIGIN = 'https://quipu.test';
const SW = readFileSync('public/sw.js', 'utf8');

type Handler = (event: unknown) => void;
type Req = { method: string; url: string; mode?: string };

let handlers: Record<string, Handler>;
let store: Map<string, Map<string, Response>>;
let online: boolean;
let network: Record<string, () => Response>;
let fetched: string[];

const keyOf = (r: string | Req) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).pathname;

function context() {
  const caches = {
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        put: async (r: string | Req, res: Response) => void c.set(keyOf(r), res),
        add: async (r: string) => {
          const res = await fakeFetch(r);
          c.set(keyOf(r), res);
        },
        keys: async () => [...c.keys()].map((k) => ({ url: ORIGIN + k })),
      };
    },
    async match(r: string | Req) {
      for (const c of store.values()) {
        const hit = c.get(keyOf(r));
        if (hit) return hit.clone();
      }
      return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };

  async function fakeFetch(r: string | Req) {
    const path = keyOf(r);
    fetched.push(path);
    if (!online) throw new TypeError('Failed to fetch');
    const make = network[path];
    return make ? make() : new Response('not found', { status: 404 });
  }

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  return { self, caches, fetch: fakeFetch, URL, Response, Promise, Set };
}

const html = (body: string, assets: string[] = []) => () =>
  new Response(`<html>${assets.map((a) => `<script src="${a}"></script>`).join('')}${body}</html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

async function install() {
  let done: Promise<unknown> = Promise.resolve();
  handlers.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
  await done;
}

/** Simula una petición: devuelve la respuesta del SW, o null si el SW no intervino. */
async function request(path: string, init: Partial<Req> = {}): Promise<Response | null> {
  let response: Promise<Response> | null = null;
  const req: Req = { method: 'GET', url: path.startsWith('http') ? path : ORIGIN + path, ...init };
  handlers.fetch({ request: req, respondWith: (p: Promise<Response>) => (response = p) });
  return response ? await response : null;
}

beforeEach(async () => {
  handlers = {};
  store = new Map();
  online = true;
  fetched = [];
  network = {
    '/reglas': html('Cómo se juega', ['/_next/static/chunks/reglas.js', '/_next/static/css/app.css']),
    '/tutorial': html('Tutorial', ['/_next/static/chunks/tutorial.js', '/_next/static/css/app.css']),
    '/sin-conexion': html('Sin conexión', ['/_next/static/chunks/offline.js', '/_next/static/css/app.css']),
    '/manifest.webmanifest': () => new Response('{}'),
    '/icons/icon-192.png': () => new Response('png'),
    '/icons/icon-512.png': () => new Response('png'),
    '/_next/static/chunks/reglas.js': () => new Response('js'),
    '/_next/static/chunks/offline.js': () => new Response('js'),
    '/_next/static/chunks/tutorial.js': () => new Response('js'),
    '/_next/static/css/app.css': () => new Response('css'),
    '/partida/abc': html('partida en vivo'),
  };
  runInNewContext(SW, context());
  await install();
});

describe('service worker', () => {
  it('al instalar guarda /reglas, /tutorial y /sin-conexion con sus JS y CSS', async () => {
    const cached = [...store.get('quipu-v1')!.keys()].sort();
    expect(cached).toEqual([
      '/_next/static/chunks/offline.js',
      '/_next/static/chunks/reglas.js',
      '/_next/static/chunks/tutorial.js',
      '/_next/static/css/app.css',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/manifest.webmanifest',
      '/reglas',
      '/sin-conexion',
      '/tutorial',
    ]);
  });

  it('sin conexión, /tutorial se sirve desde la caché', async () => {
    online = false;
    const res = await request('/tutorial', { mode: 'navigate' });
    expect(await res!.text()).toContain('Tutorial');
  });

  it('las partidas van siempre a la red y nunca se guardan', async () => {
    const res = await request('/partida/abc', { mode: 'navigate' });
    expect(await res!.text()).toContain('partida en vivo');
    expect(store.get('quipu-v1')!.has('/partida/abc')).toBe(false);
  });

  it('sin conexión, una partida se sustituye por /sin-conexion', async () => {
    online = false;
    const res = await request('/partida/abc', { mode: 'navigate' });
    expect(await res!.text()).toContain('Sin conexión');
  });

  it('sin conexión, /reglas se sirve desde la caché', async () => {
    online = false;
    const res = await request('/reglas', { mode: 'navigate' });
    expect(await res!.text()).toContain('Cómo se juega');
  });

  it('con conexión, /reglas se pide a la red y se actualiza la copia', async () => {
    network['/reglas'] = html('reglas nuevas');
    const res = await request('/reglas', { mode: 'navigate' });
    expect(await res!.text()).toContain('reglas nuevas');
    expect(await (await store.get('quipu-v1')!.get('/reglas')!.clone()).text()).toContain('reglas nuevas');
  });

  it('los recursos estáticos se sirven primero desde la caché', async () => {
    fetched = [];
    const res = await request('/_next/static/css/app.css');
    expect(await res!.text()).toBe('css');
    expect(fetched).toEqual([]); // ni siquiera tocó la red
  });

  it('no toca otras webs (Supabase) ni peticiones que no son GET', async () => {
    expect(await request('https://xxyigxrjaflwnehztdsr.supabase.co/rest/v1/rpc/get_game_state')).toBeNull();
    expect(await request('/api/algo', { method: 'POST' })).toBeNull();
    expect(await request('/partida/abc')).toBeNull(); // peticiones que no son de navegación (RSC, fetch): red normal
  });
});
