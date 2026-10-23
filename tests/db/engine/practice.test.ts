import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, cleanup, createGuest, createPlayer, trackGame, type Player } from '../helpers';

// T040: partida de práctica contra bots.

let p: Player;

beforeAll(async () => {
  p = await createPlayer();
});
afterAll(cleanup);

async function start(player: Player, bots: number, difficulty = 'normal') {
  const res = await player.client.rpc('start_practice_game', { p_bots: bots, p_difficulty: difficulty });
  if (res.data) trackGame(res.data as string);
  return res;
}

describe('start_practice_game', () => {
  it('crea la partida: tú más 1–3 bots, modo práctica, ya repartida', async () => {
    for (const bots of [1, 2, 3]) {
      const { data: id, error } = await start(p, bots, 'easy');
      expect(error).toBeNull();

      const { data: players } = await admin.from('game_players').select('*').eq('game_id', id!).order('seat');
      expect(players).toHaveLength(bots + 1);
      expect(players!.filter((x) => !x.is_bot)).toHaveLength(1);
      expect(players!.filter((x) => x.is_bot).every((x) => x.bot_difficulty === 'easy' && x.profile_id === null)).toBe(true);
      expect(players!.map((x) => x.seat)).toEqual(Array.from({ length: bots + 1 }, (_, i) => i));

      const { data: game } = await admin.from('games').select('mode, status').eq('id', id!).single();
      expect(game).toEqual({ mode: 'practice', status: 'active' });
    }
  });

  it('rechaza un número de bots o una dificultad inválidos', async () => {
    for (const bots of [0, 4, -1]) {
      expect((await start(p, bots)).error?.message, String(bots)).toBe('invalid_bots');
    }
    expect((await start(p, 1, 'imposible')).error?.message).toBe('invalid_difficulty');
  });

  it('un invitado puede jugar; sin sesión no', async () => {
    const guest = await createGuest();
    const { data: id, error } = await start(guest, 1);
    expect(error).toBeNull();
    const state = await guest.client.rpc('get_game_state', { p_game_id: id });
    expect(state.error).toBeNull();

    const anon = await anonClient().rpc('start_practice_game', { p_bots: 1, p_difficulty: 'normal' });
    expect(anon.error).not.toBeNull();
  });

  it('el asiento del humano es aleatorio', { timeout: 120_000 }, async () => {
    const seats = new Set<number>();
    for (let i = 0; i < 12 && seats.size < 3; i++) {
      const { data: id } = await start(p, 2);
      const { data } = await admin.from('game_players').select('seat').eq('game_id', id!).eq('profile_id', p.id).single();
      seats.add(data!.seat);
    }
    expect(seats.size).toBeGreaterThanOrEqual(2);
  });

  it('empezar otra abandona la anterior: nunca te quedas bloqueado', async () => {
    const { data: first } = await start(p, 1);
    const { data: second } = await start(p, 1);
    const { data: games } = await admin.from('games').select('id, status').in('id', [first!, second!]);
    expect(games!.find((g) => g.id === first)?.status).toBe('finished');
    expect(games!.find((g) => g.id === second)?.status).toBe('active');
  });

  it('el estado del humano muestra a los bots como jugadores sin nombre', async () => {
    const { data: id } = await start(p, 2);
    const { data: state } = await p.client.rpc('get_game_state', { p_game_id: id! });
    const bots = state.players.filter((x: { is_bot: boolean }) => x.is_bot);
    expect(bots).toHaveLength(2);
    for (const b of bots) expect(b.display_name).toBeNull();
  });

  it('si el humano abandona, la partida termina y los bots no siguen jugando solos', async () => {
    const { data: id } = await start(p, 2);
    const { error } = await p.client.rpc('abandon_game', { p_game_id: id! });
    expect(error).toBeNull();
    const { data: game } = await admin.from('games').select('status, winner_player_id').eq('id', id!).single();
    expect(game).toEqual({ status: 'finished', winner_player_id: null });
  });
});
