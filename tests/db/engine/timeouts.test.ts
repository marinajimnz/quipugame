import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGame, createPlayer, exec, sql, trackGame, type Player, type TestGame } from '../helpers';

// T060: turnos agotados. Además de estas llamadas, el trabajo real de pg_cron (cada 2 s) también
// puede actuar; por eso las comprobaciones miran el resultado, no quién lo produjo, y cada
// escenario monta el estado y ejecuta tick_timeouts en una sola sentencia.

let a: Player;
let b: Player;

beforeAll(async () => {
  [a, b] = await Promise.all([createPlayer(), createPlayer()]);
});
afterAll(cleanup);

const OVERDUE = `now() - interval '1 second'`;

async function kinds(game: TestGame): Promise<string[]> {
  const { data } = await admin.from('game_events').select('kind').eq('game_id', game.id).order('seq');
  return data!.map((e) => e.kind);
}

describe('tick_timeouts', () => {
  it('programado en pg_cron cada 2 s', async () => {
    const rows = await sql<{ jobname: string; schedule: string; active: boolean }>(
      `select jobname, schedule, active from cron.job where jobname in ('tick-timeouts', 'expire-rooms') order by 1`,
    );
    expect(rows).toEqual([
      { jobname: 'expire-rooms', schedule: '* * * * *', active: true },
      { jobname: 'tick-timeouts', schedule: '2 seconds', active: true },
    ]);
  });

  it('fase revelar: el servidor revela un color y clasifica esa ficha', async () => {
    const game = await createGame([a, b]);
    await exec(`update public.games set turn_deadline = ${OVERDUE} where id = '${game.id}'; select game_internal.tick_timeouts()`);

    expect(await kinds(game)).toEqual(['game_started', 'turn_timeout', 'tile_revealed', 'clue_asked']);
    const { data: g } = await admin.from('games').select('current_seat, phase, turn_deadline').eq('id', game.id).single();
    expect(g).toMatchObject({ current_seat: 1, phase: 'reveal' });
    expect(new Date(g!.turn_deadline).getTime()).toBeGreaterThan(Date.now());

    const { data: clue } = await admin.from('game_clues').select('*').eq('game_id', game.id).single();
    expect(clue).toMatchObject({ kind: 'classify', asker_id: game.seats[0].playerId });
    const { data: p } = await admin.from('game_players').select('timeouts').eq('id', game.seats[0].playerId).single();
    expect(p?.timeouts).toBe(1);
  });

  it('fase pista: clasifica la ficha que ya había revelado, sin revelar otra', async () => {
    const game = await createGame([a, b]);
    const reveal = await a.client.rpc('reveal_tile', { p_game_id: game.id, p_color: 0 });
    expect(reveal.error).toBeNull();
    const { data: before } = await admin.from('games').select('revealed_tile').eq('id', game.id).single();

    await exec(`update public.games set turn_deadline = ${OVERDUE} where id = '${game.id}'; select game_internal.tick_timeouts()`);

    const { data: clue } = await admin.from('game_clues').select('tile_number, kind').eq('game_id', game.id).single();
    expect(clue).toEqual({ tile_number: before!.revealed_tile, kind: 'classify' });
    expect((await kinds(game)).filter((k) => k === 'tile_revealed')).toHaveLength(1);
  });

  it('con la reserva vacía se omite la revelación y se clasifica una ficha del mazo', async () => {
    const game = await createGame([a, b]);
    await exec(`update public.game_tiles set place = 'spent' where game_id = '${game.id}' and place = 'reserve';
                update public.games set turn_deadline = ${OVERDUE} where id = '${game.id}';
                select game_internal.tick_timeouts()`);
    expect(await kinds(game)).toEqual(['game_started', 'turn_timeout', 'turn_skipped', 'clue_asked']);
  });

  it('tres turnos agotados seguidos equivalen a abandono y gana el otro', async () => {
    const game = await createGame([a, b]);
    for (let i = 1; i <= 3; i++) {
      await exec(`update public.games set current_seat = 0, phase = 'reveal', revealed_tile = null, turn_deadline = ${OVERDUE}
                  where id = '${game.id}' and status = 'active'; select game_internal.tick_timeouts()`);
      if (i < 3) {
        const { data } = await admin.from('game_players').select('timeouts').eq('id', game.seats[0].playerId).single();
        expect(data?.timeouts, `tras ${i}`).toBe(i);
      }
    }
    const { data: p } = await admin.from('game_players').select('state').eq('id', game.seats[0].playerId).single();
    expect(p?.state).toBe('abandoned');
    const { data: g } = await admin.from('games').select('status, winner_player_id').eq('id', game.id).single();
    expect(g).toEqual({ status: 'finished', winner_player_id: game.seats[1].playerId });
  });

  it('una acción manual reinicia la cuenta de turnos agotados', async () => {
    const game = await createGame([a, b]);
    await exec(`update public.games set turn_deadline = ${OVERDUE} where id = '${game.id}'; select game_internal.tick_timeouts()`);
    await exec(`update public.games set current_seat = 0, phase = 'reveal', revealed_tile = null, turn_deadline = now() + interval '60 seconds' where id = '${game.id}'`);

    const { error } = await a.client.rpc('reveal_tile', { p_game_id: game.id, p_color: 0 });
    expect(error).toBeNull();
    const { data } = await admin.from('game_players').select('timeouts').eq('id', game.seats[0].playerId).single();
    expect(data?.timeouts).toBe(0);
  });

  it('no actúa antes de que venza el plazo', async () => {
    const game = await createGame([a, b]);
    await exec(`select game_internal.tick_timeouts()`);
    expect(await kinds(game)).toEqual(['game_started']);
  });

  it('los bots no se agotan: ningún evento turn_timeout en su turno', async () => {
    const { data: id } = await a.client.rpc('start_practice_game', { p_bots: 1, p_difficulty: 'normal' });
    trackGame(id as string);
    await exec(`update public.games set current_seat = (select seat from public.game_players where game_id = '${id}' and is_bot),
                  phase = 'reveal', turn_deadline = ${OVERDUE} where id = '${id}';
                select game_internal.tick_timeouts()`);
    const { data: events } = await admin.from('game_events').select('kind').eq('game_id', id as string);
    expect(events!.some((e) => e.kind === 'turn_timeout')).toBe(false);
    const { data: bot } = await admin.from('game_players').select('timeouts').eq('game_id', id as string).eq('is_bot', true).single();
    expect(bot?.timeouts).toBe(0);
  });
});

describe('expire_rooms', () => {
  it('caduca las salas abiertas vencidas y deja las vigentes', async () => {
    const mk = (code: string, minutes: number) => ({ code, host_id: a.id, seats: 2, expires_at: new Date(Date.now() + minutes * 60_000).toISOString() });
    const { error } = await admin.from('rooms').insert([mk('234567', -1), mk('ABCDEF', 10)]);
    expect(error).toBeNull();
    try {
      await exec(`select game_internal.expire_rooms()`);
      const { data } = await admin.from('rooms').select('code, status').in('code', ['234567', 'ABCDEF']).order('code');
      expect(data).toEqual([{ code: '234567', status: 'expired' }, { code: 'ABCDEF', status: 'open' }]);
    } finally {
      await admin.from('rooms').delete().in('code', ['234567', 'ABCDEF']);
    }
  });
});
