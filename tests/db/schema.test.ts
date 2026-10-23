import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, cleanup, createPlayer, sql, type Player } from './helpers';

let alice: Player;
let bob: Player;

beforeAll(async () => {
  alice = await createPlayer();
  bob = await createPlayer();
});
afterAll(cleanup);

describe('esquema', () => {
  it('toda tabla de public tiene RLS activada', async () => {
    const rows = await sql<{ relname: string }>(`
      select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('las funciones SECURITY DEFINER de public son exactamente las aprobadas', async () => {
    const rows = await sql<{ proname: string }>(`
      select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
      order by 1`);
    // Una función nueva debe añadirse aquí a propósito, tras revisar quién puede llamarla.
    expect(rows.map((r) => r.proname)).toEqual([
      'abandon_game',
      'ask_clue',
      'create_room',
      'declare_code',
      'get_game_state',
      'get_my_active_game',
      'get_room_by_code',
      'handle_new_user',
      'is_participant',
      'is_room_member',
      'join_room',
      'leave_room',
      'reveal_tile',
      'start_game',
      'start_practice_game',
      'sync_guest_flag',
      'touch_presence',
    ]);
  });

  it('anon no puede ejecutar ninguna función de public', async () => {
    const rows = await sql<{ proname: string }>(`
      select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`);
    expect(rows).toEqual([]);
  });

  it('authenticated no puede ejecutar handle_new_user', async () => {
    const { error } = await alice.client.rpc('handle_new_user');
    expect(error).not.toBeNull();
  });

  it('game_internal no está expuesto por la API', async () => {
    const { error } = await alice.client
      .schema('game_internal' as never)
      .rpc('deal_game' as never);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('PGRST106'); // schema no expuesto
  });
});

describe('tile_definitions', () => {
  it('tiene 60 fichas, 20 de cada valor y 4/4/4 por color', async () => {
    const { data, error } = await admin.from('tile_definitions').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(60);

    for (const points of [1, 2, 3]) {
      expect(data!.filter((t) => t.points === points)).toHaveLength(20);
      for (let color = 0; color < 5; color++) {
        expect(data!.filter((t) => t.points === points && t.color_index === color)).toHaveLength(4);
      }
    }
    for (const t of data!) expect(t.color_index).toBe((t.number - 1) % 5);
  });

  it('es legible por anon y nadie del cliente puede escribirla', async () => {
    const anon = anonClient();
    const read = await anon.from('tile_definitions').select('number');
    expect(read.data).toHaveLength(60);

    for (const client of [anon, alice.client]) {
      const { error } = await client.from('tile_definitions').update({ points: 3 }).eq('number', 1);
      expect(error).not.toBeNull();
      const del = await client.from('tile_definitions').delete().eq('number', 1);
      expect(del.error).not.toBeNull();
    }
    const { data } = await admin.from('tile_definitions').select('points').eq('number', 1).single();
    expect(data?.points).toBe(2); // valor de la tabla fijada
  });
});

describe('profiles', () => {
  it('crea el perfil al alta, con ELO 1000 y nombre provisional', async () => {
    const { data } = await admin.from('profiles').select('*').eq('id', alice.id).single();
    expect(data?.elo).toBe(1000);
    expect(data?.display_name).toMatch(/^Invitado-[0-9A-F]{5}$/);
    expect(data?.is_guest).toBe(false);
  });

  it('el usuario puede cambiar su nombre y su avatar', async () => {
    const name = `Jugador${Math.floor(Math.random() * 1e6)}`.slice(0, 16);
    const { error } = await alice.client
      .from('profiles')
      .update({ display_name: name, avatar_key: 'otro' })
      .eq('id', alice.id);
    expect(error).toBeNull();
    const { data } = await admin.from('profiles').select('display_name, avatar_key').eq('id', alice.id).single();
    expect(data).toEqual({ display_name: name, avatar_key: 'otro' });
  });

  it('el usuario no puede tocar su ELO ni sus contadores', async () => {
    for (const column of ['elo', 'ranked_games', 'ranked_wins', 'games_played', 'games_won', 'is_guest']) {
      const { error } = await alice.client
        .from('profiles')
        .update({ [column]: column === 'is_guest' ? true : 5000 })
        .eq('id', alice.id);
      expect(error, column).not.toBeNull();
    }
    const { data } = await admin.from('profiles').select('elo').eq('id', alice.id).single();
    expect(data?.elo).toBe(1000);
  });

  it('el usuario no puede modificar el perfil de otro', async () => {
    const before = await admin.from('profiles').select('display_name').eq('id', bob.id).single();
    const { data } = await alice.client
      .from('profiles')
      .update({ display_name: 'Intruso' })
      .eq('id', bob.id)
      .select();
    expect(data).toEqual([]); // RLS filtra la fila: no se actualiza nada
    const after = await admin.from('profiles').select('display_name').eq('id', bob.id).single();
    expect(after.data?.display_name).toBe(before.data?.display_name);
  });

  it('rechaza nombres fuera de 3–16 caracteres', async () => {
    for (const name of ['ab', 'x'.repeat(17)]) {
      const { error } = await alice.client.from('profiles').update({ display_name: name }).eq('id', alice.id);
      expect(error, name).not.toBeNull();
    }
  });

  it('los nombres son únicos sin distinguir mayúsculas', async () => {
    const { data } = await admin.from('profiles').select('display_name').eq('id', bob.id).single();
    const { error } = await alice.client
      .from('profiles')
      .update({ display_name: data!.display_name.toUpperCase() === data!.display_name ? data!.display_name.toLowerCase() : data!.display_name.toUpperCase() })
      .eq('id', alice.id);
    expect(error?.code).toBe('23505');
  });
});

describe('reglas del nombre', () => {
  it('rechaza nombres con espacios sobrantes', async () => {
    const x = await createPlayer();
    const { error } = await x.client.from('profiles').update({ display_name: ' Marina ' }).eq('id', x.id);
    expect(error?.code).toBe('23514');
  });
});
