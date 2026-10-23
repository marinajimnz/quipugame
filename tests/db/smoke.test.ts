import { afterAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createPlayer } from './helpers';

afterAll(cleanup);

describe('ayudantes de test', () => {
  it('crea un jugador real, con perfil, y lo limpia', async () => {
    const player = await createPlayer();

    const { data, error } = await player.client
      .from('profiles')
      .select('display_name, elo')
      .eq('id', player.id)
      .single();

    expect(error).toBeNull();
    expect(data?.elo).toBe(1000);
    expect(data?.display_name).toMatch(/^Invitado-[0-9A-F]{5}$/);

    await cleanup();
    const { data: after } = await admin.from('profiles').select('id').eq('id', player.id);
    expect(after).toEqual([]);
  });
});
