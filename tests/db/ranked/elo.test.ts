import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGame, createPlayer, exec, realNumbers, type Player, type TestGame } from '../helpers';
import { expectedElo, kFactor } from './elo';

// T072: ELO al cerrar una clasificatoria.

let a: Player;
let b: Player;

beforeAll(async () => {
  [a, b] = await Promise.all([createPlayer(), createPlayer()]);
});
afterAll(cleanup);

async function setRating(p: Player, elo: number, rankedGames: number) {
  await admin.from('profiles').update({ elo, ranked_games: rankedGames, ranked_wins: 0 }).eq('id', p.id);
}

async function rating(p: Player) {
  const { data } = await admin.from('profiles').select('elo, ranked_games, ranked_wins').eq('id', p.id).single();
  return data!;
}

/** a declara bien y gana. */
async function aWins(game: TestGame) {
  const { error } = await a.client.rpc('declare_code', { p_game_id: game.id, p_numbers: await realNumbers(game, 0) });
  expect(error).toBeNull();
}

describe('apply_elo', () => {
  it('fórmula estándar con K = 32 al principio: suma cero entre los dos', async () => {
    await setRating(a, 1000, 0);
    await setRating(b, 1030, 0);
    const game = await createGame([a, b], 'ranked');
    await aWins(game);

    const [ra, rb] = [await rating(a), await rating(b)];
    expect(ra).toEqual({ elo: expectedElo(1000, 1030, 1, 0), ranked_games: 1, ranked_wins: 1 });
    expect(rb).toEqual({ elo: expectedElo(1030, 1000, 0, 0), ranked_games: 1, ranked_wins: 0 });
    expect(ra.elo - 1000).toBe(-(rb.elo - 1030));

    const { data: history } = await admin.from('elo_history').select('profile_id, elo_before, elo_after, delta, k_factor').eq('game_id', game.id);
    expect(history).toHaveLength(2);
    expect(history!.find((h) => h.profile_id === a.id)).toEqual({
      profile_id: a.id, elo_before: 1000, elo_after: ra.elo, delta: ra.elo - 1000, k_factor: 32,
    });
  });

  it('K por tramo: 24 desde 20 partidas, 16 desde 2000 de ELO', async () => {
    await setRating(a, 2100, 30);
    await setRating(b, 1500, 30);
    const game = await createGame([a, b], 'ranked');
    await aWins(game);
    const { data: history } = await admin.from('elo_history').select('profile_id, k_factor').eq('game_id', game.id);
    expect(history!.find((h) => h.profile_id === a.id)?.k_factor).toBe(kFactor(2100, 30));
    expect(history!.find((h) => h.profile_id === b.id)?.k_factor).toBe(kFactor(1500, 30));
    expect(kFactor(2100, 30)).toBe(16);
    expect(kFactor(1500, 30)).toBe(24);
    expect((await rating(a)).elo).toBe(expectedElo(2100, 1500, 1, 30));
    expect((await rating(b)).elo).toBe(expectedElo(1500, 2100, 0, 30));
  });

  it('el ELO nunca baja de 100', async () => {
    // b (105) pierde contra alguien de su nivel (100): sin suelo bajaría a 93.
    await setRating(a, 100, 30);
    await setRating(b, 105, 30);
    expect(105 + Math.round(24 * (0 - 1 / (1 + 10 ** ((100 - 105) / 400))))).toBeLessThan(100);
    const game = await createGame([a, b], 'ranked');
    await aWins(game);
    expect((await rating(b)).elo).toBe(100);
    const { data } = await admin.from('elo_history').select('delta').eq('game_id', game.id).eq('profile_id', b.id).single();
    expect(data?.delta).toBe(-5); // lo que de verdad bajó
  });

  it('abandonar cuenta como derrota', async () => {
    await setRating(a, 1200, 30);
    await setRating(b, 1200, 30);
    const game = await createGame([a, b], 'ranked');
    await b.client.rpc('abandon_game', { p_game_id: game.id });
    expect((await rating(a)).elo).toBe(expectedElo(1200, 1200, 1, 30));
    expect((await rating(b)).elo).toBe(expectedElo(1200, 1200, 0, 30));
  });

  it('empate técnico: medio punto para cada uno', async () => {
    await setRating(a, 1300, 30);
    await setRating(b, 1100, 30);
    const game = await createGame([a, b], 'ranked');
    await exec(`select game_internal.lock_game('${game.id}'); select game_internal.finish_game('${game.id}', null);`);
    expect((await rating(a)).elo).toBe(expectedElo(1300, 1100, 0.5, 30)); // el favorito pierde algo
    expect((await rating(b)).elo).toBe(expectedElo(1100, 1300, 0.5, 30));
  });

  it('se aplica una sola vez', async () => {
    await setRating(a, 1000, 30);
    await setRating(b, 1000, 30);
    const game = await createGame([a, b], 'ranked');
    await aWins(game);
    const once = await rating(a);
    await exec(`select game_internal.apply_elo('${game.id}')`);
    expect(await rating(a)).toEqual(once);
    const { data } = await admin.from('elo_history').select('id').eq('game_id', game.id);
    expect(data).toHaveLength(2);
  });

  it('las partidas privadas y de práctica no tocan el ELO', async () => {
    await setRating(a, 1000, 30);
    await setRating(b, 1000, 30);
    const game = await createGame([a, b], 'private');
    await aWins(game);
    expect((await rating(a)).elo).toBe(1000);
    const { data } = await admin.from('elo_history').select('id').eq('game_id', game.id);
    expect(data).toEqual([]);
  });
});
