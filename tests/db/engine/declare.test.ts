import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGame, createPlayer, getState, realNumbers, type Player, type TestGame } from '../helpers';

// Grupo DECLARACIÓN y ABANDONO.

let p: Player[];

const declare = (g: TestGame, seat: number, numbers: number[]) =>
  g.seats[seat].player.client.rpc('declare_code', { p_game_id: g.id, p_numbers: numbers });

const wrong = [1, 2, 3, 4, 5]; // nunca es correcto: son 5 colores distintos y 1..5 son uno por color... salvo que toque; se comprueba abajo

async function wrongFor(g: TestGame, seat: number): Promise<number[]> {
  const real = await realNumbers(g, seat);
  return real.join() === wrong.join() ? [56, 57, 58, 59, 60] : wrong;
}

beforeAll(async () => {
  p = await Promise.all([createPlayer(), createPlayer(), createPlayer()]);
});
afterAll(cleanup);

describe('declaración', () => {
  it('acertar gana la partida', async () => {
    const g = await createGame(p.slice(0, 2));
    const { data, error } = await declare(g, 1, await realNumbers(g, 1)); // fuera de turno
    expect(error).toBeNull();
    expect(data).toEqual({ correct: true });

    const { data: game } = await admin.from('games').select('*').eq('id', g.id).single();
    expect(game).toMatchObject({ status: 'finished', winner_player_id: g.seats[1].playerId });
    const { data: ev } = await admin.from('game_events').select('kind').eq('game_id', g.id).order('seq');
    expect(ev!.map((e) => e.kind)).toEqual(['game_started', 'declared', 'game_ended']);
  });

  it('fallar elimina al jugador y la partida sigue', async () => {
    const g = await createGame(p);
    const { data, error } = await declare(g, 2, await wrongFor(g, 2));
    expect(error).toBeNull();
    expect(data).toEqual({ correct: false });

    const state = await getState(g, 2);
    expect(state.me).toMatchObject({ state: 'eliminated', has_declared: true });
    expect(state.game.status).toBe('active');
    expect(state.game.current_seat).toBe(0); // no era su turno: no se mueve
  });

  it('el eliminado ve ya sus números reales; los demás siguen sin verlos', async () => {
    const g = await createGame(p);
    await declare(g, 2, await wrongFor(g, 2));

    const eliminated = await getState(g, 2);
    expect(eliminated.me.support.map((s: { resolved_number: number }) => s.resolved_number)).toEqual(
      await realNumbers(g, 2),
    );
    const active = await getState(g, 0);
    for (const s of active.me.support) expect(s.resolved_number).toBeNull();
  });

  it('no puede declarar dos veces', async () => {
    const g = await createGame(p);
    await declare(g, 2, await wrongFor(g, 2));
    const { error } = await declare(g, 2, await wrongFor(g, 2));
    expect(error?.message).toBe('player_not_active');
  });

  it('declarar mal en tu propio turno pasa el turno', async () => {
    const g = await createGame(p);
    const { error } = await declare(g, 0, await wrongFor(g, 0));
    expect(error).toBeNull();
    const state = await getState(g, 1);
    expect(state.game).toMatchObject({ status: 'active', current_seat: 1, phase: 'reveal' });
  });

  it('el último jugador en pie gana', async () => {
    const g = await createGame(p);
    await declare(g, 1, await wrongFor(g, 1));
    await declare(g, 2, await wrongFor(g, 2));
    const { data } = await admin.from('games').select('status, winner_player_id').eq('id', g.id).single();
    expect(data).toEqual({ status: 'finished', winner_player_id: g.seats[0].playerId });
  });

  it('una declaración mal formada se rechaza sin gastar la oportunidad', async () => {
    const g = await createGame(p.slice(0, 2));
    for (const bad of [[1, 2, 3], [5, 4, 3, 2, 1], [1, 1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 2, 3, 4, 61]]) {
      const { error } = await declare(g, 0, bad);
      expect(error?.message, bad.join()).toBe('invalid_declaration');
    }
    const { data } = await admin.from('game_players').select('has_declared, state').eq('id', g.seats[0].playerId).single();
    expect(data).toEqual({ has_declared: false, state: 'active' });
  });

  it('la respuesta y los eventos no contienen los números reales', async () => {
    const g = await createGame(p);
    const real = await realNumbers(g, 2);
    const { data } = await declare(g, 2, await wrongFor(g, 2));
    expect(Object.keys(data)).toEqual(['correct']);
    const { data: events } = await admin.from('game_events').select('payload').eq('game_id', g.id);
    const text = JSON.stringify(events);
    for (const n of real) expect(text).not.toMatch(new RegExp(`"(number|tile_number)":${n}[,}]`));
  });

  it('nadie puede declarar en una partida terminada', async () => {
    const g = await createGame(p.slice(0, 2));
    await declare(g, 0, await realNumbers(g, 0));
    const { error } = await declare(g, 1, await realNumbers(g, 1));
    expect(error?.message).toBe('game_not_active');
  });

  it('actualiza los contadores de partidas jugadas y ganadas de los perfiles', async () => {
    const x = await createPlayer();
    const y = await createPlayer();
    const g = await createGame([x, y]);
    await declare(g, 0, await realNumbers(g, 0));
    const { data } = await admin.from('profiles').select('id, games_played, games_won').in('id', [x.id, y.id]);
    expect(data!.find((r) => r.id === x.id)).toMatchObject({ games_played: 1, games_won: 1 });
    expect(data!.find((r) => r.id === y.id)).toMatchObject({ games_played: 1, games_won: 0 });
  });
});

describe('abandono', () => {
  const abandon = (g: TestGame, seat: number) =>
    g.seats[seat].player.client.rpc('abandon_game', { p_game_id: g.id });

  it('abandonar en tu turno pasa el turno', async () => {
    const g = await createGame(p);
    expect((await abandon(g, 0)).error).toBeNull();
    const state = await getState(g, 1);
    expect(state.game.current_seat).toBe(1);
    expect(state.players.find((x: { seat: number }) => x.seat === 0).state).toBe('abandoned');
  });

  it('con dos jugadores, abandonar da la victoria al otro', async () => {
    const g = await createGame(p.slice(0, 2));
    await abandon(g, 1);
    const { data } = await admin.from('games').select('status, winner_player_id').eq('id', g.id).single();
    expect(data).toEqual({ status: 'finished', winner_player_id: g.seats[0].playerId });
  });

  it('no se puede abandonar dos veces', async () => {
    const g = await createGame(p);
    await abandon(g, 2);
    expect((await abandon(g, 2)).error?.message).toBe('player_not_active');
  });
});
