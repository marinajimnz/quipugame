import { describe, expect, it } from 'vitest';
import { sql } from '../helpers';

// R3: toda función que muta una partida la bloquea primero con select ... for update
// (game_internal.lock_game). Comprobación estática sobre el código de las funciones.

// Funciones de apoyo que se ejecutan siempre con la partida ya bloqueada por quien las llama.
const CALLED_WITH_LOCK_HELD = ['emit_event', 'finish_game', 'check_last_standing', 'advance_turn'];

// Crean una partida nueva (no hay ninguna que bloquear antes de escribir).
const CREATES_NEW_GAME = ['simulate_bot_game'];
// Escriben en salas, no en partidas.
const NOT_ABOUT_GAMES = ['expire_rooms'];

describe('bloqueo de partida (R3)', () => {
  it('lock_game toma select ... for update sobre games', async () => {
    const [row] = await sql<{ src: string }>(`
      select prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'game_internal' and p.proname = 'lock_game'`);
    expect(row.src).toMatch(/from public\.games where id = p_game_id for update/);
  });

  it('toda función interna que escribe empieza bloqueando la partida', async () => {
    const fns = await sql<{ proname: string; src: string }>(`
      select p.proname, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'game_internal'
        and p.prosrc ~* '(insert into|update|delete from)\\s+public\\.'`);

    const mutators = fns.filter((f) => !CALLED_WITH_LOCK_HELD.includes(f.proname) && !CREATES_NEW_GAME.includes(f.proname) && !NOT_ABOUT_GAMES.includes(f.proname) && f.proname !== 'lock_game');
    expect(mutators.length).toBeGreaterThan(0);

    for (const f of mutators) {
      const lockAt = f.src.indexOf('game_internal.lock_game(');
      const writeAt = f.src.search(/(insert into|update|delete from)\s+public\./i);
      expect(lockAt, `${f.proname} no llama a lock_game`).toBeGreaterThanOrEqual(0);
      expect(lockAt, `${f.proname} escribe antes de bloquear`).toBeLessThan(writeAt);
    }
  });

  it('las funciones de apoyo no se invocan desde ningún envoltorio público', async () => {
    const rows = await sql<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and p.prosrc ~ 'game_internal\\.(emit_event|finish_game|advance_turn|check_last_standing)'`);
    expect(rows).toEqual([]);
  });
});
