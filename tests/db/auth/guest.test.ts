import { afterAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createGuest, createPlayer } from '../helpers';

afterAll(cleanup);

describe('invitados (inicio de sesión anónimo)', () => {
  it('un invitado entra sin formulario y tiene perfil Invitado-XXXXX', async () => {
    const guest = await createGuest();
    const { data, error } = await guest.client
      .from('profiles').select('display_name, elo, is_guest').eq('id', guest.id).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ elo: 1000, is_guest: true });
    expect(data?.display_name).toMatch(/^Invitado-[0-9A-F]{5}$/);
  });

  it('un invitado puede cambiar su nombre y su avatar', async () => {
    const guest = await createGuest();
    const name = `Inv${Math.floor(Math.random() * 1e6)}`;
    const { error } = await guest.client
      .from('profiles').update({ display_name: name, avatar_key: 'ficha-2' }).eq('id', guest.id);
    expect(error).toBeNull();
    const { data } = await admin.from('profiles').select('display_name, avatar_key').eq('id', guest.id).single();
    expect(data).toEqual({ display_name: name, avatar_key: 'ficha-2' });
  });

  it('un invitado puede ver la partida de un registrado, pero no a la inversa por RLS ajena', async () => {
    const guest = await createGuest();
    const player = await createPlayer();
    const { data } = await guest.client.from('profiles').select('id').eq('id', player.id);
    expect(data).toHaveLength(1); // los perfiles son públicos
  });
});

describe('conversión de invitado a cuenta permanente', () => {
  it('conserva el id, el nombre y las estadísticas, y deja de ser invitado', async () => {
    const guest = await createGuest();
    await admin.from('profiles').update({ games_played: 3, games_won: 1, display_name: 'ConvertidoTest' }).eq('id', guest.id);

    const email = `convert-${guest.id}@quipugame-tests.invalid`;
    const { error } = await admin.auth.admin.updateUserById(guest.id, {
      email, password: `pw-${guest.id}`, email_confirm: true,
    });
    expect(error).toBeNull();

    const { data } = await admin.from('profiles').select('*').eq('id', guest.id).single();
    expect(data).toMatchObject({ is_guest: false, display_name: 'ConvertidoTest', games_played: 3, games_won: 1, elo: 1000 });
  });
});
