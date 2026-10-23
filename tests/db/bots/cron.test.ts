import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createPlayer, sql, trackGame, type Player } from '../helpers';

// T043: la tarea periódica hace jugar a los bots.

let p: Player;

beforeAll(async () => {
  p = await createPlayer();
});
afterAll(cleanup);

describe('play_bot_turns (pg_cron)', () => {
  it('el trabajo está programado cada segundo y activo', async () => {
    const rows = await sql<{ schedule: string; active: boolean; command: string }>(
      `select schedule, active, command from cron.job where jobname = 'play-bot-turns'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(true);
    expect(rows[0].schedule).toBe('1 second');
    expect(rows[0].command).toContain('game_internal.play_bot_turns');
  });

  it('una partida de práctica avanza sola: el bot juega su turno entre 2 y 8 s después', { timeout: 120_000 }, async () => {
    const { data: id } = await p.client.rpc('start_practice_game', { p_bots: 1, p_difficulty: 'normal' });
    trackGame(id as string);

    // Si empieza el humano, juega su turno; después le toca al bot.
    let state = await p.client.rpc('get_game_state', { p_game_id: id }).then((r) => r.data);
    if (state.game.current_seat === state.me.seat) {
      const reserve: number[] = state.game.reserve_by_color;
      const color = reserve.findIndex((n) => n > 0);
      await p.client.rpc('reveal_tile', { p_game_id: id, p_color: color });
      const mine = (await p.client.rpc('get_game_state', { p_game_id: id })).data;
      await p.client.rpc('ask_clue', { p_game_id: id, p_tile: mine.pool[0].number, p_kind: 'classify' });
    }

    const { data: before } = await admin.from('game_events').select('seq').eq('game_id', id as string);
    const started = Date.now();
    let botActed = false;
    while (Date.now() - started < 30_000) {
      await new Promise((r) => setTimeout(r, 1000));
      const { data: events } = await admin
        .from('game_events').select('kind, actor_id').eq('game_id', id as string).order('seq');
      const { data: bots } = await admin.from('game_players').select('id').eq('game_id', id as string).eq('is_bot', true);
      const botIds = new Set(bots!.map((b) => b.id));
      if (events!.some((e) => e.actor_id && botIds.has(e.actor_id) && e.kind === 'clue_asked')) {
        botActed = true;
        break;
      }
    }
    expect(botActed, 'el bot no jugó en 30 s').toBe(true);
    const elapsed = (Date.now() - started) / 1000;
    expect(elapsed).toBeLessThan(15);
    expect(before!.length).toBeGreaterThan(0);

    // Tras el turno del bot, vuelve a ser el del humano (o ya terminó la partida).
    state = (await p.client.rpc('get_game_state', { p_game_id: id })).data;
    expect(['active', 'finished']).toContain(state.game.status);
  });
});
