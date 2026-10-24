import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createPlayer, exec, type Player } from '../helpers';

// T075: clasificación. Se usan ELOs por encima de cualquier jugador real (4000 hacia abajo), así
// los perfiles de prueba ocupan las primeras posiciones sin depender de quién más haya.

let me: Player;
let novice: Player;

beforeAll(async () => {
  [me, novice] = await Promise.all([createPlayer(), createPlayer()]);
  // 119 perfiles más, creados directamente (nunca inician sesión), con 4000-i de ELO.
  await exec(`
    insert into auth.users (id, email)
    select gen_random_uuid(), 'lb-' || i || '-' || gen_random_uuid() || '@quipugame-tests.invalid'
      from generate_series(1, 119) i;
    update public.profiles p set elo = 4000 - (split_part(u.email, '-', 2))::int, ranked_games = 5 + (split_part(u.email, '-', 2))::int % 3
      from auth.users u where u.id = p.id and u.email like 'lb-%@quipugame-tests.invalid';`);
  // Yo quedo en el puesto 110 (entre 4000-109 y 4000-110).
  await admin.from('profiles').update({ elo: 3890, ranked_games: 9 }).eq('id', me.id);
  await admin.from('profiles').update({ elo: 3999, ranked_games: 4 }).eq('id', novice.id); // 4 partidas: no cuenta
}, 60_000);

afterAll(async () => {
  await exec(`delete from auth.users where email like 'lb-%@quipugame-tests.invalid'`);
  await cleanup();
});

describe('get_leaderboard', () => {
  it('los 100 mejores por ELO, ordenados, con nombre, avatar, ELO y partidas', async () => {
    const { data, error } = await me.client.rpc('get_leaderboard');
    expect(error).toBeNull();
    const top = data.top as { rank: number; elo: number; display_name: string; avatar_key: string; ranked_games: number }[];
    expect(top).toHaveLength(100);
    expect(top[0]).toMatchObject({ rank: 1, elo: 3999 - 0 }); // el de 4000-1
    for (let i = 1; i < top.length; i++) expect(top[i].elo).toBeLessThanOrEqual(top[i - 1].elo);
    for (const r of top) {
      expect(r.display_name).toBeTruthy();
      expect(r.ranked_games).toBeGreaterThanOrEqual(5);
    }
  });

  it('veo mi posición aunque esté fuera de los 100', async () => {
    const { data } = await me.client.rpc('get_leaderboard');
    expect(data.me).toMatchObject({ rank: 110, elo: 3890, ranked_games: 9 });
    expect(data.top.some((r: { id: string }) => r.id === me.id)).toBe(false);
  });

  it('con menos de 5 clasificatorias no se aparece', async () => {
    const { data } = await novice.client.rpc('get_leaderboard');
    expect(data.me).toBeNull();
    expect(data.top.some((r: { id: string }) => r.id === novice.id)).toBe(false);
  });
});
