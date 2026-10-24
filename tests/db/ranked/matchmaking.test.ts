import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createPlayer, exec, sql, type Player } from '../helpers';

// T071: emparejamiento. El trabajo real de pg_cron (cada 3 s) también actúa sobre la cola, así que
// cada escenario inserta las filas y llama a resolve_matchmaking en la misma transacción, y las
// comprobaciones esperan al resultado sin suponer quién lo produjo.

let a: Player;
let b: Player;
let c: Player;
let d: Player;

beforeAll(async () => {
  [a, b, c, d] = await Promise.all([createPlayer(), createPlayer(), createPlayer(), createPlayer()]);
});
afterAll(cleanup);

async function activeGameOf(player: Player): Promise<string | null> {
  const { data } = await player.client.rpc('get_my_active_game');
  return (data as string | null) ?? null;
}

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 10_000): Promise<T> {
  const start = Date.now();
  let v = await fn();
  while (!ok(v) && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 500));
    v = await fn();
  }
  return v;
}

describe('resolve_matchmaking', () => {
  it('programado cada 3 s', async () => {
    const rows = await sql<{ schedule: string; active: boolean }>(
      `select schedule, active from cron.job where jobname = 'resolve-matchmaking'`,
    );
    expect(rows).toEqual([{ schedule: '3 seconds', active: true }]);
  });

  it('empareja al más antiguo con el ELO más cercano y crea una clasificatoria de 2', async () => {
    // ELOs muy altos y únicos para no mezclarnos con nadie real.
    await exec(`
      update public.profiles set elo = 3500 where id = '${a.id}';
      update public.profiles set elo = 3540 where id = '${b.id}';
      update public.profiles set elo = 3530 where id = '${c.id}';
      insert into public.matchmaking_queue (profile_id, elo, joined_at) values
        ('${a.id}', 3500, now() - interval '5 seconds'),
        ('${b.id}', 3540, now() - interval '4 seconds'),
        ('${c.id}', 3530, now() - interval '3 seconds');
      select game_internal.resolve_matchmaking();`);

    const gameA = await waitFor(() => activeGameOf(a), (g) => g !== null);
    expect(gameA).not.toBeNull();
    expect(await activeGameOf(c)).toBe(gameA); // c (3530) es el más cercano a a (3500)

    const { data: players } = await admin.from('game_players').select('profile_id, seat').eq('game_id', gameA!);
    expect(players!.map((x) => x.seat).sort()).toEqual([0, 1]);
    const { data: game } = await admin.from('games').select('mode, status').eq('id', gameA!).single();
    expect(game).toEqual({ mode: 'ranked', status: 'active' });

    const { data: queue } = await admin.from('matchmaking_queue').select('profile_id').in('profile_id', [a.id, b.id, c.id]);
    expect(queue).toEqual([{ profile_id: b.id }]); // b sigue esperando
    await admin.from('matchmaking_queue').delete().eq('profile_id', b.id);
  });

  it('no empareja fuera de la ventana', async () => {
    await exec(`
      update public.profiles set elo = 3900 where id = '${d.id}';
      update public.profiles set elo = 3600 where id = '${b.id}';
      insert into public.matchmaking_queue (profile_id, elo, joined_at) values
        ('${b.id}', 3600, now()), ('${d.id}', 3900, now());
      select game_internal.resolve_matchmaking();`);
    try {
      await new Promise((r) => setTimeout(r, 4000)); // al menos un ciclo del trabajo real
      expect(await activeGameOf(b)).toBeNull();
      expect(await activeGameOf(d)).toBeNull();
      const { data } = await admin.from('matchmaking_queue').select('profile_id').in('profile_id', [b.id, d.id]);
      expect(data).toHaveLength(2);
    } finally {
      await admin.from('matchmaking_queue').delete().in('profile_id', [b.id, d.id]);
    }
  });

  it('con la espera, la ventana se abre y acaba emparejando', async () => {
    await exec(`
      insert into public.matchmaking_queue (profile_id, elo, joined_at) values
        ('${b.id}', 3600, now() - interval '70 seconds'), ('${d.id}', 3800, now());
      select game_internal.resolve_matchmaking();`);
    const game = await waitFor(() => activeGameOf(b), (g) => g !== null);
    expect(game).not.toBeNull();
    expect(await activeGameOf(d)).toBe(game);
  });

  it('quien ya está en una partida activa sale de la cola y nunca entra en dos', async () => {
    const game = await activeGameOf(a); // de un test anterior: a sigue jugando
    expect(game).not.toBeNull();
    await exec(`insert into public.matchmaking_queue (profile_id, elo) values ('${a.id}', 3500)
                on conflict do nothing; select game_internal.resolve_matchmaking();`);
    const { data } = await admin.from('matchmaking_queue').select('profile_id').eq('profile_id', a.id);
    expect(data).toEqual([]);
    expect(await activeGameOf(a)).toBe(game);
  });
});
