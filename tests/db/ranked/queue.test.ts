import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, cleanup, createGuest, createPlayer, sql, trackGame, type Player } from '../helpers';

// T070: entrar y salir de la cola.

let p: Player;

beforeAll(async () => {
  p = await createPlayer();
});
afterAll(cleanup);

describe('join_queue / leave_queue / get_queue_status', () => {
  it('la ventana crece 25 cada 10 s desde ±50, con tope en ±400', async () => {
    const rows = await sql<{ w: number[] }>(
      `select array[game_internal.queue_window(0), game_internal.queue_window(10), game_internal.queue_window(60),
                    game_internal.queue_window(200), game_internal.queue_window(100000)] as w`,
    );
    expect(rows[0].w).toEqual([50, 75, 200, 400, 400]);
  });

  it('entrar copia mi ELO; el estado dice desde cuándo y qué rango se busca', async () => {
    // Un ELO que nadie más tiene, para que el emparejamiento real no me empareje mientras tanto.
    await admin.from('profiles').update({ elo: 3777 }).eq('id', p.id);
    expect((await p.client.rpc('join_queue')).error).toBeNull();
    try {
      const { data: row } = await admin.from('matchmaking_queue').select('elo').eq('profile_id', p.id).single();
      expect(row?.elo).toBe(3777);

      const { data: status } = await p.client.rpc('get_queue_status');
      expect(status).toMatchObject({ in_queue: true, elo: 3777, window: 50 });

      expect((await p.client.rpc('join_queue')).error?.message).toBe('already_in_queue');
    } finally {
      expect((await p.client.rpc('leave_queue')).error).toBeNull();
    }
    const { data: after } = await p.client.rpc('get_queue_status');
    expect(after).toMatchObject({ in_queue: false, window: null });
    expect((await p.client.rpc('leave_queue')).error).toBeNull(); // salir sin estar: no pasa nada
  });

  it('los invitados no pueden entrar en clasificatoria', async () => {
    const guest = await createGuest();
    expect((await guest.client.rpc('join_queue')).error?.message).toBe('guest_not_allowed');
  });

  it('con una partida en curso no se puede entrar', async () => {
    const { data: id } = await p.client.rpc('start_practice_game', { p_bots: 1, p_difficulty: 'normal' });
    trackGame(id as string);
    expect((await p.client.rpc('join_queue')).error?.message).toBe('already_in_game');
    await p.client.rpc('abandon_game', { p_game_id: id });
  });

  it('sin sesión no se puede llamar', async () => {
    expect((await anonClient().rpc('join_queue')).error).not.toBeNull();
    expect((await anonClient().rpc('get_queue_status')).error).not.toBeNull();
  });
});
