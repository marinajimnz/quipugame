import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient, cleanup, collectNumbers, createGame, createPlayer, getState, playTurn, realNumbers,
  sql, type Player, type TestGame,
} from '../helpers';

/**
 * Grupo FUGA, parte 2 (R2): un jugador no puede leer sus propios números mientras la partida
 * está activa y él sigue en juego, por ninguna vía. Debe ejecutarse en cada commit.
 */

let p: Player[];
let game: TestGame;
const TURNS = 15;

beforeAll(async () => {
  p = await Promise.all([createPlayer(), createPlayer(), createPlayer()]);
  game = await createGame(p);
});
afterAll(cleanup);

/** Comprueba todas las vías de lectura para cada jugador. */
async function assertNoLeak(label: string) {
  for (const seat of game.seats) {
    const mine = await realNumbers(game, seat.seat);
    const client = seat.player.client;

    // 1. get_game_state
    const state = await getState(game, seat.seat);
    for (const s of state.me.support) expect(s.resolved_number, `${label} resolved_number`).toBeNull();
    const inState = collectNumbers(state).filter((n) => mine.includes(n));
    expect(inState, `${label}: get_game_state de ${seat.seat} contiene números propios`).toEqual([]);

    // 2. game_events
    const events = await client.from('game_events').select('payload').eq('game_id', game.id);
    expect(events.error).toBeNull();
    const inEvents = collectNumbers(events.data).filter((n) => mine.includes(n));
    expect(inEvents, `${label}: eventos de ${seat.seat}`).toEqual([]);

    // 3. game_clues
    const clues = await client.from('game_clues').select('*').eq('game_id', game.id);
    expect(clues.error).toBeNull();
    const inClues = collectNumbers(clues.data).filter((n) => mine.includes(n));
    expect(inClues, `${label}: pistas de ${seat.seat}`).toEqual([]);

    // 4. game_tiles directo
    const tiles = await client.from('game_tiles').select('*').eq('owner_id', seat.playerId);
    expect(tiles.error?.code, label).toBe('42501');
    expect(tiles.data).toBeNull();
  }
}

describe('fuga: nadie lee sus propios números durante la partida', () => {
  it('antes de la primera jugada', async () => {
    await assertNoLeak('reparto');
  });

  it(`tras cada uno de ${TURNS} turnos`, { timeout: 300_000 }, async () => {
    for (let t = 1; t <= TURNS; t++) {
      const state = await playTurn(game);
      if (state.game.status !== 'active') break;
      await assertNoLeak(`turno ${t}`);
    }
  });

  it('las vistas de otros jugadores sí muestran los números ajenos (el juego funciona)', async () => {
    const state = await getState(game, 0);
    const others = collectNumbers(state.players);
    expect(others).toHaveLength(10);
    expect(others).toEqual(
      [...(await realNumbers(game, 1)), ...(await realNumbers(game, 2))],
    );
  });

  it('un usuario sin sesión no lee nada de la partida', async () => {
    const anon = anonClient();
    for (const table of ['games', 'game_players', 'game_events', 'game_clues', 'game_tiles']) {
      const { data, error } = await anon.from(table).select('*');
      expect(error, table).not.toBeNull();
      expect(data, table).toBeNull();
    }
    const state = await anon.rpc('get_game_state', { p_game_id: game.id });
    expect(state.error).not.toBeNull();
  });

  it('un usuario ajeno a la partida no ve nada de ella', async () => {
    const stranger = await createPlayer();
    for (const table of ['games', 'game_players', 'game_events', 'game_clues']) {
      const { data, error } = await stranger.client.from(table).select('*').eq(table === 'games' ? 'id' : 'game_id', game.id);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });
});

describe('fuga: tras eliminarse, el jugador sí recibe sus números', () => {
  it('get_game_state los devuelve solo cuando ya no está activo', async () => {
    const g = await createGame(p);
    const real = await realNumbers(g, 1);
    const wrong = real.join() === '1,2,3,4,5' ? [56, 57, 58, 59, 60] : [1, 2, 3, 4, 5];

    const before = await getState(g, 1);
    expect(before.me.support.every((s: { resolved_number: number | null }) => s.resolved_number === null)).toBe(true);

    await g.seats[1].player.client.rpc('declare_code', { p_game_id: g.id, p_numbers: wrong });
    const after = await getState(g, 1);
    expect(after.me.support.map((s: { resolved_number: number }) => s.resolved_number)).toEqual(real);

    const other = await getState(g, 0);
    expect(other.me.support.every((s: { resolved_number: number | null }) => s.resolved_number === null)).toBe(true);
  });
});

describe('fuga: superficie de funciones', () => {
  it('ninguna función de game_internal es ejecutable por anon ni authenticated', async () => {
    const rows = await sql<{ proname: string; role: string }>(`
      select p.proname, r.role
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join (values ('anon'), ('authenticated')) as r(role)
      where n.nspname = 'game_internal' and has_function_privilege(r.role, p.oid, 'execute')`);
    expect(rows).toEqual([]);
  });

  it('anon y authenticated no tienen USAGE sobre game_internal', async () => {
    const rows = await sql<{ role: string }>(`
      select r.role from (values ('anon'), ('authenticated')) as r(role)
      where has_schema_privilege(r.role, 'game_internal', 'usage')`);
    expect(rows).toEqual([]);
  });

  it('un jugador no puede llamar a las funciones internas por RPC', async () => {
    for (const fn of ['deal_game', 'reveal_tile_as', 'state_for_player', 'finish_game']) {
      const { error } = await p[0].client.schema('game_internal' as never).rpc(fn as never, {} as never);
      expect(error, fn).not.toBeNull();
    }
  });
});
