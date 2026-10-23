import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TILE_POINTS } from '../../../src/game/pointsTable';
import { admin, cleanup, createGame, createPlayer, exec, getState, type Player, type TestGame } from '../helpers';

// Grupo PISTAS. Montaje fijo: el asiento 0 tiene las fichas 10, 20, 30, 40, 50.

let a: Player;
let b: Player;

/** Partida con el soporte del asiento 0 fijado y listo para pedir pista con `poolTile`. */
async function setup(poolTile: number): Promise<TestGame> {
  const game = await createGame([a, b]);
  const owner = game.seats[0].playerId;
  await exec(`
    update public.game_tiles set place = 'reserve', owner_id = null, slot = null
     where game_id = '${game.id}' and (owner_id = '${owner}' or place = 'pool');
    update public.game_tiles set place = 'support', owner_id = '${owner}', slot = (number / 10) - 1
     where game_id = '${game.id}' and number in (10, 20, 30, 40, 50);
    update public.game_tiles set place = 'pool', owner_id = null, slot = null where game_id = '${game.id}' and number = ${poolTile};
    update public.games set phase = 'clue', current_seat = 0 where id = '${game.id}';`);
  return game;
}

const ask = (g: TestGame, tile: number, kind: 'classify' | 'compare', slot: number | null = null) =>
  a.client.rpc('ask_clue', { p_game_id: g.id, p_tile: tile, p_kind: kind, p_slot: slot });

beforeAll(async () => {
  [a, b] = await Promise.all([createPlayer(), createPlayer()]);
});
afterAll(cleanup);

describe('pistas: classify', () => {
  it.each([
    [5, 0], [15, 1], [25, 2], [35, 3], [45, 4], [55, 5],
  ])('la ficha %i encaja en la posición %i', async (tile, expected) => {
    const game = await setup(tile);
    const { error } = await ask(game, tile, 'classify');
    expect(error).toBeNull();

    const { data } = await admin.from('game_clues').select('*').eq('game_id', game.id).single();
    expect(data).toMatchObject({
      tile_number: tile, kind: 'classify', answer_position: expected, target_slot: null, answer_same: null,
    });
  });
});

describe('pistas: compare', () => {
  const own = 10; // slot 0
  const ownPoints = TILE_POINTS[own];
  const sameTile = Object.keys(TILE_POINTS).map(Number).find((n) => ![10, 20, 30, 40, 50].includes(n) && TILE_POINTS[n] === ownPoints)!;

  it('responde sí con los mismos puntos', async () => {
    const game = await setup(sameTile);
    expect((await ask(game, sameTile, 'compare', 0)).error).toBeNull();
    const { data } = await admin.from('game_clues').select('*').eq('game_id', game.id).single();
    expect(data).toMatchObject({ kind: 'compare', target_slot: 0, answer_same: true, answer_position: null });
  });

  it.each([1, 2, 3])('responde no con distintos puntos (la ficha de la pista vale %i)', async (points) => {
    if (points === ownPoints) return; // este caso es el "sí"
    const tile = Object.keys(TILE_POINTS).map(Number).find((n) => ![10, 20, 30, 40, 50].includes(n) && TILE_POINTS[n] === points)!;
    const game = await setup(tile);
    expect((await ask(game, tile, 'compare', 0)).error).toBeNull();
    const { data } = await admin.from('game_clues').select('answer_same').eq('game_id', game.id).single();
    expect(data?.answer_same).toBe(false);
  });
});

describe('pistas: reglas', () => {
  it('la ficha usada pasa a gastada, el turno avanza y el evento es público', async () => {
    const game = await setup(25);
    expect((await ask(game, 25, 'classify')).error).toBeNull();

    const { data: tile } = await admin.from('game_tiles').select('place').eq('game_id', game.id).eq('number', 25).single();
    expect(tile?.place).toBe('spent');

    const state = await getState(game, 1);
    expect(state.game).toMatchObject({ current_seat: 1, phase: 'reveal' });
    expect(state.clues).toHaveLength(1);

    const { data: ev } = await admin.from('game_events').select('payload').eq('game_id', game.id).eq('kind', 'clue_asked').single();
    expect(ev?.payload).toEqual({
      tile_number: 25, kind: 'classify', target_slot: null, answer_position: 2, answer_same: null,
    });
  });

  it('classify no admite ranura; compare la exige entre 0 y 4', async () => {
    const game = await setup(25);
    expect((await ask(game, 25, 'classify', 2)).error?.message).toBe('invalid_slot');
    expect((await ask(game, 25, 'compare', null)).error?.message).toBe('invalid_slot');
    expect((await ask(game, 25, 'compare', 5)).error?.message).toBe('invalid_slot');
    expect((await ask(game, 25, 'compare', -1)).error?.message).toBe('invalid_slot');
  });

  it('no puedes pedir pista fuera de tu turno', async () => {
    const game = await setup(25);
    const { error } = await b.client.rpc('ask_clue', { p_game_id: game.id, p_tile: 25, p_kind: 'classify' });
    expect(error?.message).toBe('not_your_turn');
  });
});
