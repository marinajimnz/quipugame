// T056: mide la latencia de una acción de juego y la propagación de eventos al rival, contra el
// proyecto Supabase enlazado (variables de .env.local). Objetivos de la spec §12 (percentil 95):
// acción < 300 ms, propagación < 500 ms.
//
// Es una medición desde ESTE equipo hacia Frankfurt, no desde dos móviles reales: la red del
// móvil suma su propia latencia. Uso: node scripts/measure-latency.mjs [turnos]
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const { SUPABASE_URL: SB_URL, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE } = process.env;
if (!SB_URL || !ANON || !SERVICE) throw new Error('Faltan variables en .env.local');
if (new URL(SB_URL).hostname.split('.')[0] !== 'xxyigxrjaflwnehztdsr') throw new Error('Proyecto no permitido');

const TURNS = Number(process.argv[2] ?? 12);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SB_URL, SERVICE, opts);
const users = [];
let roomId;
let gameId;

async function player() {
  const email = `latency-${randomUUID()}@quipugame-tests.invalid`;
  const password = randomUUID();
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  users.push(data.user.id);
  const client = createClient(SB_URL, ANON, opts);
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, client };
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const ms = (n) => Math.round(n);
const summary = (xs) => ({ n: xs.length, p50: ms(pct(xs, 50)), p95: ms(pct(xs, 95)), max: ms(Math.max(...xs)) });

try {
  const [a, b] = [await player(), await player()];

  // Sala -> partida, como en el uso real.
  const { data: code } = await a.client.rpc('create_room', { p_seats: 2 });
  roomId = (await admin.from('rooms').select('id').eq('code', code).single()).data.id;
  await b.client.rpc('join_room', { p_code: code });
  gameId = (await a.client.rpc('start_game', { p_room_id: roomId })).data;

  const bySeat = new Map(
    (await admin.from('game_players').select('profile_id, seat').eq('game_id', gameId)).data.map((r) => [r.seat, r.profile_id]),
  );
  const clients = new Map([[a.id, a.client], [b.id, b.client]]);

  // Cada jugador escucha los eventos de la partida.
  const arrivals = [];
  const channels = [];
  for (const p of [a, b]) {
    const channel = p.client
      .channel(`lat-${p.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` }, (e) => {
        arrivals.push({ who: p.id, seq: e.new.seq, at: performance.now() });
      });
    await new Promise((res) => channel.subscribe((s) => s === 'SUBSCRIBED' && res()));
    channels.push([p.client, channel]);
  }

  const action = [];
  const fromSend = [];
  const fromCommit = [];

  for (let i = 0; i < TURNS; i++) {
    const { data: g } = await admin.from('games').select('current_seat, event_seq, status').eq('id', gameId).single();
    if (g.status !== 'active') break;
    const actor = bySeat.get(g.current_seat);
    const rival = actor === a.id ? b.id : a.id;
    const client = clients.get(actor);

    const reserve = (await client.rpc('get_game_state', { p_game_id: gameId })).data.game.reserve_by_color;
    const call = async (name, args) => {
      const before = g.event_seq;
      const t0 = performance.now();
      const { error } = await client.rpc(name, args);
      const t1 = performance.now();
      if (error) throw new Error(`${name}: ${error.message}`);
      action.push(t1 - t0);
      // Espera a que el evento llegue al rival.
      const deadline = performance.now() + 8000;
      let hit;
      while (!(hit = arrivals.find((x) => x.who === rival && x.seq > before)) && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5));
      }
      if (hit) {
        fromSend.push(hit.at - t0);
        fromCommit.push(hit.at - t1);
      }
      return (await admin.from('games').select('event_seq').eq('id', gameId).single()).data.event_seq;
    };

    const color = reserve.findIndex((n) => n > 0);
    g.event_seq = await call('reveal_tile', { p_game_id: gameId, p_color: color });
    const pool = (await client.rpc('get_game_state', { p_game_id: gameId })).data.pool;
    await call('ask_clue', { p_game_id: gameId, p_tile: pool[0].number, p_kind: 'classify' });
  }

  console.log(JSON.stringify({
    objetivo: { accion_p95_ms: 300, propagacion_p95_ms: 500 },
    accion_rpc_ms: summary(action),
    propagacion_desde_el_envio_ms: summary(fromSend),
    propagacion_desde_la_respuesta_ms: summary(fromCommit),
    eventos_sin_llegar: action.length - fromSend.length,
  }, null, 2));

  for (const [client, channel] of channels) await client.removeChannel(channel);
} finally {
  if (roomId) await admin.from('rooms').delete().eq('id', roomId);
  if (gameId) await admin.from('games').delete().eq('id', gameId);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
