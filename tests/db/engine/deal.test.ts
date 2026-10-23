import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGame, createPlayer, getState, type Player, type TestGame } from '../helpers';

// Grupo REPARTO. Lee game_tiles con la clave de administrador solo para comprobar.

let players: Player[];
let games: TestGame[] = [];

beforeAll(async () => {
  players = await Promise.all([createPlayer(), createPlayer(), createPlayer(), createPlayer()]);
  // Una partida por tamaño (2, 3, 4) más una repetición, para cubrir el azar.
  for (const n of [2, 3, 4, 4]) games.push(await createGame(players.slice(0, n)));
});
afterAll(cleanup);

describe('reparto', () => {
  it('reparte las 60 fichas sin repetidos', async () => {
    for (const game of games) {
      const { data } = await admin.from('game_tiles').select('number, place').eq('game_id', game.id);
      expect(data).toHaveLength(60);
      expect(new Set(data!.map((t) => t.number)).size).toBe(60);
    }
  });

  it('cada jugador recibe 5 fichas, una de cada color, ordenadas de menor a mayor', async () => {
    for (const game of games) {
      for (const seat of game.seats) {
        const { data } = await admin
          .from('game_tiles')
          .select('number, slot')
          .eq('game_id', game.id)
          .eq('owner_id', seat.playerId)
          .eq('place', 'support')
          .order('slot');
        expect(data).toHaveLength(5);
        expect(data!.map((t) => t.slot)).toEqual([0, 1, 2, 3, 4]);
        const numbers = data!.map((t) => t.number);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        expect(new Set(numbers.map((n) => (n - 1) % 5)).size).toBe(5);
      }
    }
  });

  it('el mazo visible tiene 5 fichas, una de cada color, y la reserva el resto', async () => {
    for (const game of games) {
      const n = game.seats.length;
      const { data } = await admin.from('game_tiles').select('number, place').eq('game_id', game.id);
      const pool = data!.filter((t) => t.place === 'pool');
      expect(pool).toHaveLength(5);
      expect(new Set(pool.map((t) => (t.number - 1) % 5)).size).toBe(5);
      expect(data!.filter((t) => t.place === 'support')).toHaveLength(5 * n);
      expect(data!.filter((t) => t.place === 'reserve')).toHaveLength(60 - 5 * n - 5);
    }
  });

  it('la partida arranca en el asiento 0, fase revelar, con cronómetro', async () => {
    const { data } = await admin.from('games').select('*').eq('id', games[0].id).single();
    expect(data).toMatchObject({ status: 'active', current_seat: 0, phase: 'reveal', event_seq: 1 });
    expect(new Date(data!.turn_deadline).getTime()).toBeGreaterThan(Date.now());
  });

  it('emite game_started con solo el número de jugadores', async () => {
    const { data } = await admin.from('game_events').select('*').eq('game_id', games[1].id);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ seq: 1, kind: 'game_started', payload: { players: 3 } });
  });

  it('get_game_state: tu soporte son 5 huecos con su color y sin número', async () => {
    const state = await getState(games[1], 0);
    expect(state.me.support).toHaveLength(5);
    for (const s of state.me.support) expect(s.resolved_number).toBeNull();
    expect(state.me.support.map((s: { color_index: number }) => s.color_index).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(state.players).toHaveLength(2);
    expect(state.pool).toHaveLength(5);
  });

  it('rechaza repartir una partida ya iniciada', async () => {
    const { exec } = await import('../helpers');
    await expect(exec(`select game_internal.deal_game('${games[0].id}')`)).rejects.toThrow(/invalid_state/);
  });
});
