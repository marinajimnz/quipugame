import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, createGame, createPlayer, sql, type Player, type TestGame } from '../helpers';

// T052: Realtime publica lo que el cliente escucha, respeta RLS y nunca publica game_tiles.

interface Change {
  table: string;
  new: Record<string, unknown>;
}

let a: Player;
let b: Player;
let stranger: Player;
let game: TestGame;
const channels: { client: SupabaseClient; channel: RealtimeChannel }[] = [];

beforeAll(async () => {
  [a, b, stranger] = await Promise.all([createPlayer(), createPlayer(), createPlayer()]);
  game = await createGame([a, b]);
});

afterAll(async () => {
  for (const { client, channel } of channels) await client.removeChannel(channel);
  await cleanup();
});

/** Se suscribe a las tablas de la partida y devuelve la lista (viva) de cambios recibidos. */
async function listen(player: Player, tables: string[], filterColumn = 'game_id'): Promise<Change[]> {
  const received: Change[] = [];
  let channel = player.client.channel(`test-${Math.random().toString(36).slice(2)}`);
  for (const table of tables) {
    const filter = table === 'games' ? `id=eq.${game.id}` : `${filterColumn}=eq.${game.id}`;
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) => {
      received.push({ table, new: payload.new as Record<string, unknown> });
    });
  }
  // SUBSCRIBED llega antes de que el servidor tenga lista la escucha de Postgres: hay que esperar
  // también al mensaje de sistema de postgres_changes (ok o error, p. ej. en game_tiles).
  await new Promise<void>((resolve, reject) => {
    let subscribed = false;
    let ready = false;
    const done = () => {
      if (subscribed && ready) {
        clearTimeout(timer);
        resolve();
      }
    };
    const timer = setTimeout(() => reject(new Error('Realtime no quedó listo en 15 s')), 15_000);
    channel.on('system', {}, (payload: { extension?: string }) => {
      if (payload.extension === 'postgres_changes') {
        ready = true;
        done();
      }
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        done();
      }
    });
  });
  channels.push({ client: player.client, channel });
  return received;
}

const waitFor = async (cond: () => boolean, ms = 8000) => {
  const start = Date.now();
  while (!cond() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 100));
  return cond();
};

describe('publicación', () => {
  it('publica las tablas que escucha el cliente y nunca game_tiles', async () => {
    const rows = await sql<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1`,
    );
    const published = rows.map((r) => r.tablename);
    for (const t of ['game_clues', 'game_events', 'game_players', 'games', 'room_members', 'rooms']) {
      expect(published, t).toContain(t);
    }
    expect(published).not.toContain('game_tiles');
  });
});

describe('Realtime en una partida', () => {
  it('el rival recibe los eventos de mi jugada, y quien no participa no recibe nada', { timeout: 60_000 }, async () => {
    const forB = await listen(b, ['games', 'game_events', 'game_clues']);
    const forStranger = await listen(stranger, ['games', 'game_events', 'game_clues']);
    const forTiles = await listen(b, ['game_tiles']);

    const t0 = Date.now();
    const { error } = await a.client.rpc('reveal_tile', { p_game_id: game.id, p_color: 0 });
    expect(error).toBeNull();

    const arrived = await waitFor(() => forB.some((c) => c.table === 'game_events' && c.new.kind === 'tile_revealed'));
    expect(arrived, 'el evento no llegó en 8 s').toBe(true);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(forB.some((c) => c.table === 'games')).toBe(true);

    await new Promise((r) => setTimeout(r, 3000)); // margen para que llegara algo indebido
    expect(forStranger).toEqual([]);
    expect(forTiles).toEqual([]); // game_tiles no emite nada, ni siquiera a un participante
  });
});
