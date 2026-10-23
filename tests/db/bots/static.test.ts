import { describe, expect, it } from 'vitest';
import { sql } from '../helpers';

// R1/R2 para los bots: solo ven lo que ve un humano.

describe('los bots no pueden leer fichas ocultas', () => {
  it('ninguna función bot_* menciona game_tiles', async () => {
    const rows = await sql<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'game_internal' and p.proname like 'bot\\_%' and p.prosrc ilike '%game_tiles%'`);
    expect(rows).toEqual([]);
  });

  it('las funciones de decisión reciben el JSON de estado, no un id de partida', async () => {
    const rows = await sql<{ proname: string; args: string }>(`
      select p.proname, pg_get_function_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'game_internal'
        and p.proname in ('bot_candidates', 'bot_choose_color', 'bot_choose_clue', 'bot_declaration')
      order by 1`);
    expect(rows.map((r) => r.proname)).toEqual(['bot_candidates', 'bot_choose_clue', 'bot_choose_color', 'bot_declaration']);
    for (const r of rows) {
      expect(r.args, r.proname).toMatch(/^p_state jsonb/);
      expect(r.args, r.proname).not.toMatch(/uuid/);
    }
  });

  it('bot_take_turn y bot_try_declare leen el estado solo con state_for_player', async () => {
    const rows = await sql<{ proname: string; src: string }>(`
      select p.proname, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'game_internal' and p.proname in ('bot_take_turn', 'bot_try_declare')`);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.src, r.proname).toContain('state_for_player');
      expect(r.src, r.proname).not.toMatch(/public\.game_tiles/);
    }
  });
});
