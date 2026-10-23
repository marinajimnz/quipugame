import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, cleanup, createGame, createPlayer, type Player, type TestGame } from '../helpers';

// T062 + T064: presencia y partida en curso.

let a: Player;
let b: Player;
let stranger: Player;
let game: TestGame;

beforeAll(async () => {
  [a, b, stranger] = await Promise.all([createPlayer(), createPlayer(), createPlayer()]);
  game = await createGame([a, b]);
});
afterAll(cleanup);

const lastSeen = async (seat: number) => {
  const { data } = await admin.from('game_players').select('last_seen_at').eq('id', game.seats[seat].playerId).single();
  return new Date(data!.last_seen_at).getTime();
};

describe('touch_presence', () => {
  it('actualiza solo mi propia marca de presencia', async () => {
    await admin.from('game_players').update({ last_seen_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq('game_id', game.id);

    const { error } = await a.client.rpc('touch_presence', { p_game_id: game.id });
    expect(error).toBeNull();
    expect(await lastSeen(0)).toBeGreaterThan(Date.now() - 10_000);
    expect(await lastSeen(1)).toBeLessThan(Date.now() - 4 * 60_000);
  });

  it('un ajeno a la partida no cambia nada y sin sesión no se puede llamar', async () => {
    await admin.from('game_players').update({ last_seen_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq('game_id', game.id);
    await stranger.client.rpc('touch_presence', { p_game_id: game.id });
    expect(await lastSeen(0)).toBeLessThan(Date.now() - 4 * 60_000);
    expect(await lastSeen(1)).toBeLessThan(Date.now() - 4 * 60_000);

    const anon = await anonClient().rpc('touch_presence', { p_game_id: game.id });
    expect(anon.error).not.toBeNull();
  });
});

describe('get_my_active_game', () => {
  it('devuelve la partida en curso y deja de hacerlo al abandonar', async () => {
    const mine = await a.client.rpc('get_my_active_game');
    expect(mine.data).toBe(game.id);

    const none = await stranger.client.rpc('get_my_active_game');
    expect(none.data).toBeNull();

    await a.client.rpc('abandon_game', { p_game_id: game.id });
    expect((await a.client.rpc('get_my_active_game')).data).toBeNull();
    expect((await b.client.rpc('get_my_active_game')).data).toBeNull(); // la partida terminó
  });

  it('sin sesión no se puede llamar', async () => {
    expect((await anonClient().rpc('get_my_active_game')).error).not.toBeNull();
  });
});
