import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGame, createPlayer, realNumbers, type Player } from '../helpers';

// Grupo CONCURRENCIA: dos declaraciones correctas casi simultáneas producen un solo ganador.

let a: Player;
let b: Player;

beforeAll(async () => {
  [a, b] = await Promise.all([createPlayer(), createPlayer()]);
});
afterAll(cleanup);

describe('concurrencia', () => {
  it('dos declaraciones correctas simultáneas: un solo ganador', { timeout: 180_000 }, async () => {
    for (let i = 0; i < 10; i++) {
      const g = await createGame([a, b]);
      const [na, nb] = [await realNumbers(g, 0), await realNumbers(g, 1)];

      const [ra, rb] = await Promise.all([
        a.client.rpc('declare_code', { p_game_id: g.id, p_numbers: na }),
        b.client.rpc('declare_code', { p_game_id: g.id, p_numbers: nb }),
      ]);

      const winners = [ra, rb].filter((r) => r.data?.correct === true);
      const losers = [ra, rb].filter((r) => r.error);
      expect(winners, `repetición ${i}`).toHaveLength(1);
      expect(losers, `repetición ${i}`).toHaveLength(1);
      expect(losers[0].error?.message).toBe('game_not_active');

      const { data: events } = await admin.from('game_events').select('kind, seq').eq('game_id', g.id).order('seq');
      expect(events!.filter((e) => e.kind === 'game_ended')).toHaveLength(1);
      expect(events!.map((e) => e.seq)).toEqual(events!.map((_, k) => k + 1)); // sin huecos

      const { data: game } = await admin.from('games').select('winner_player_id').eq('id', g.id).single();
      const winnerSeat = ra.data?.correct ? 0 : 1;
      expect(game?.winner_player_id).toBe(g.seats[winnerSeat].playerId);
    }
  });
});
