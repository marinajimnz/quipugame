import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGame, createPlayer, exec, getState, type Player, type TestGame } from '../helpers';

// Grupo TURNO.

let a: Player;
let b: Player;
let game: TestGame; // a = asiento 0, b = asiento 1

const reveal = (p: Player, color: number, g = game) =>
  p.client.rpc('reveal_tile', { p_game_id: g.id, p_color: color });
const clue = (p: Player, tile: number, kind: 'classify' | 'compare' = 'classify', slot: number | null = null, g = game) =>
  p.client.rpc('ask_clue', { p_game_id: g.id, p_tile: tile, p_kind: kind, p_slot: slot });

beforeAll(async () => {
  [a, b] = await Promise.all([createPlayer(), createPlayer()]);
  game = await createGame([a, b]);
});
afterAll(cleanup);

describe('turno', () => {
  it('no puedes revelar fuera de tu turno', async () => {
    const { error } = await reveal(b, 0);
    expect(error?.message).toBe('not_your_turn');
  });

  it('no puedes pedir una pista antes de revelar', async () => {
    const { error } = await clue(a, 1);
    expect(error?.message).toBe('wrong_phase');
  });

  it('rechaza un color inválido', async () => {
    for (const color of [-1, 5, 99]) {
      const { error } = await reveal(a, color);
      expect(error?.message, String(color)).toBe('invalid_color');
    }
  });

  it('un desconocido no puede jugar en la partida', async () => {
    const stranger = await createPlayer();
    const { error } = await reveal(stranger, 0);
    expect(error?.message).toBe('not_a_player');
    const state = await stranger.client.rpc('get_game_state', { p_game_id: game.id });
    expect(state.error?.message).toBe('not_a_player');
  });

  it('revelar pasa la ficha al mazo visible y abre la fase de pista', async () => {
    const before = (await getState(game, 0)).game.reserve_by_color as number[];
    const { error } = await reveal(a, 2);
    expect(error).toBeNull();

    const state = await getState(game, 0);
    expect(state.game.phase).toBe('clue');
    expect(state.pool).toHaveLength(6);
    expect((state.game.reserve_by_color as number[])[2]).toBe(before[2] - 1);

    const { data: events } = await admin
      .from('game_events').select('kind, payload').eq('game_id', game.id).eq('kind', 'tile_revealed');
    expect(events).toHaveLength(1);
    expect(events![0].payload.color_index).toBe(2);
  });

  it('no puedes revelar dos veces en el mismo turno', async () => {
    const { error } = await reveal(a, 2);
    expect(error?.message).toBe('wrong_phase');
  });

  it('no puedes pedir pista sobre una ficha que no está en el mazo', async () => {
    const { data } = await admin
      .from('game_tiles').select('number').eq('game_id', game.id).eq('place', 'reserve').limit(1);
    const { error } = await clue(a, data![0].number);
    expect(error?.message).toBe('tile_not_in_pool');
  });

  it('no puedes revelar un color agotado', async () => {
    const other = await createGame([a, b]);
    await exec(`update public.game_tiles gt set place = 'spent'
                from public.tile_definitions td
                where gt.game_id = '${other.id}' and gt.place = 'reserve'
                  and td.number = gt.number and td.color_index = 0`);
    const { error } = await reveal(a, 0, other);
    expect(error?.message).toBe('no_tiles_of_color');
    const ok = await reveal(a, 1, other);
    expect(ok.error).toBeNull();
  });

  it('con la reserva vacía se omite la revelación y el mazo queda como está', async () => {
    const other = await createGame([a, b]);
    await exec(`update public.game_tiles set place = 'spent' where game_id = '${other.id}' and place = 'reserve'`);
    const { error } = await reveal(a, 3, other);
    expect(error).toBeNull();
    const state = await getState(other, 0);
    expect(state.game.phase).toBe('clue');
    expect(state.pool).toHaveLength(5);
    const { data } = await admin.from('game_events').select('kind').eq('game_id', other.id).eq('kind', 'turn_skipped');
    expect(data).toHaveLength(1);
  });
});
