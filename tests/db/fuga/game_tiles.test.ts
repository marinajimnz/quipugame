import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, cleanup, createPlayer, sql, type Player } from '../helpers';

/**
 * Grupo FUGA, parte 1 (R1): game_tiles es ilegible para cualquier cliente.
 * Debe ejecutarse en cada commit.
 */

let alice: Player;

beforeAll(async () => {
  alice = await createPlayer();
});
afterAll(cleanup);

describe('game_tiles es inaccesible', () => {
  it('no tiene ninguna política RLS', async () => {
    const rows = await sql<{ n: number }>(`select count(*)::int as n from pg_policies where tablename = 'game_tiles'`);
    expect(rows[0].n).toBe(0);
  });

  it('anon, authenticated y PUBLIC no tienen ningún permiso sobre la tabla', async () => {
    const rows = await sql<{ grantee: string; privilege_type: string }>(`
      select grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'game_tiles'
        and grantee in ('anon', 'authenticated', 'PUBLIC')`);
    expect(rows).toEqual([]);
  });

  it('ninguna columna de game_tiles es accesible a anon ni authenticated', async () => {
    const rows = await sql<{ grantee: string; column_name: string }>(`
      select grantee, column_name from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'game_tiles'
        and grantee in ('anon', 'authenticated', 'PUBLIC')`);
    expect(rows).toEqual([]);
  });

  it('un usuario autenticado no puede leerla por la API', async () => {
    const { data, error } = await alice.client.from('game_tiles').select('*');
    expect(error?.code).toBe('42501'); // permiso denegado
    expect(data).toBeNull();
  });

  it('anon no puede leerla por la API', async () => {
    const { data, error } = await anonClient().from('game_tiles').select('*');
    expect(error?.code).toBe('42501');
    expect(data).toBeNull();
  });

  it('nadie del cliente puede escribirla ni borrarla', async () => {
    for (const client of [alice.client, anonClient()]) {
      const ins = await client.from('game_tiles').insert({ number: 1 });
      expect(ins.error).not.toBeNull();
      const upd = await client.from('game_tiles').update({ slot: 0 }).eq('number', 1);
      expect(upd.error).not.toBeNull();
      const del = await client.from('game_tiles').delete().eq('number', 1);
      expect(del.error).not.toBeNull();
    }
  });
});
