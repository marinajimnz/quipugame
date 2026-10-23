import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

/**
 * Los tests escriben datos reales: solo se ejecutan contra proyectos de esta lista.
 * Añadir aquí el ref del proyecto de desarrollo cuando exista.
 */
const ALLOWED_PROJECT_REFS = ['xxyigxrjaflwnehztdsr'];

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env.local`);
  return value;
}

export const SUPABASE_URL = env('SUPABASE_URL');

const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
if (!ALLOWED_PROJECT_REFS.includes(ref)) {
  throw new Error(
    `Los tests se niegan a ejecutarse contra el proyecto "${ref}": no está en ALLOWED_PROJECT_REFS (tests/db/helpers.ts).`,
  );
}

const ANON_KEY = env('SUPABASE_ANON_KEY');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente administrador: salta RLS. Solo para sembrar y limpiar. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

/** Cliente sin sesión (rol anon). */
export const anonClient = (): SupabaseClient => createClient(SUPABASE_URL, ANON_KEY, noSession);

export interface Player {
  id: string;
  email: string;
  client: SupabaseClient;
}

const createdUserIds: string[] = [];

/** Crea un usuario real y devuelve un cliente autenticado como él. */
export async function createPlayer(): Promise<Player> {
  const email = `test-${randomUUID()}@quipugame-tests.invalid`;
  const password = randomUUID();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`createUser: ${error?.message}`);
  createdUserIds.push(created.user.id);

  const client = createClient(SUPABASE_URL, ANON_KEY, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  return { id: created.user.id, email, client };
}

/** Borra los usuarios creados (el perfil y sus datos caen en cascada). */
export async function cleanup(): Promise<void> {
  while (createdUserIds.length) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id);
  }
}

const run = promisify(execFile);

/**
 * SQL de solo lectura contra el proyecto enlazado, para inspeccionar el catálogo
 * (pg_class, pg_policies…). Usa la CLI de Supabase: necesita `supabase login` y `supabase link`.
 */
export async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const { stdout } = await run('supabase', ['db', 'query', '--linked', query], {
    maxBuffer: 10 * 1024 * 1024,
  });
  const start = stdout.indexOf('{');
  const parsed = JSON.parse(stdout.slice(start, stdout.lastIndexOf('}') + 1));
  return parsed.rows as T[];
}
