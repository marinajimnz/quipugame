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
const createdGameIds: string[] = [];

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

/** Crea un invitado: inicio de sesión anónimo real, como el del botón "Jugar como invitado". */
export async function createGuest(): Promise<Player> {
  const client = createClient(SUPABASE_URL, ANON_KEY, noSession);
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`signInAnonymously: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email: '', client };
}

/** Borra los usuarios creados (el perfil y sus datos caen en cascada). */
export async function cleanup(): Promise<void> {
  if (createdGameIds.length) {
    await admin.from('games').delete().in('id', createdGameIds.splice(0));
  }
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
  let stdout: string;
  try {
    ({ stdout } = await run(
      'supabase',
      ['db', 'query', '--linked', '--output-format', 'json', query],
      { maxBuffer: 10 * 1024 * 1024 },
    ));
  } catch (e) {
    // La CLI deja el error de Postgres en stderr/stdout; sin esto solo se vería "Command failed".
    const err = e as { stdout?: string; stderr?: string; message: string };
    throw new Error(`${err.message}\n${err.stderr ?? ''}\n${err.stdout ?? ''}`);
  }
  // Sin --output-format la CLI imprime una tabla en un terminal normal y un JSON envuelto
  // cuando detecta un agente. Con él: un array (terminal) o { rows } (agente). Se aceptan ambos.
  const start = stdout.search(/^[[{]/m);
  if (start === -1) throw new Error(`Respuesta inesperada de supabase db query:\n${stdout}`);
  const parsed = JSON.parse(stdout.slice(start).trim());
  return (Array.isArray(parsed) ? parsed : parsed.rows) as T[];
}

/** SQL de escritura contra el proyecto (como postgres): solo para montar escenarios de test. */
export const exec = sql;

export interface TestSeat {
  player: Player;
  playerId: string; // id dentro de la partida (game_players.id)
  seat: number;
}

export interface TestGame {
  id: string;
  seats: TestSeat[];
}

/** Registra una partida creada por otra vía (p. ej. start_practice_game) para borrarla al limpiar. */
export function trackGame(id: string): void {
  createdGameIds.push(id);
}

/** Crea una partida y la reparte con el motor real (game_internal.deal_game). */
export async function createGame(players: Player[], mode = 'private'): Promise<TestGame> {
  const id = randomUUID();
  const seats: TestSeat[] = players.map((player, seat) => ({ player, playerId: randomUUID(), seat }));
  createdGameIds.push(id);

  const values = seats
    .map((s) => `('${s.playerId}', '${id}', '${s.player.id}', ${s.seat})`)
    .join(', ');
  await exec(`
    insert into public.games (id, mode, status) values ('${id}', '${mode}', 'waiting');
    insert into public.game_players (id, game_id, profile_id, seat) values ${values};
    select game_internal.deal_game('${id}');`);

  return { id, seats };
}

/** Números reales de las fichas de un jugador (lectura de administrador, solo para comprobar). */
export async function realNumbers(game: TestGame, seat: number): Promise<number[]> {
  const { data, error } = await admin
    .from('game_tiles')
    .select('number, slot')
    .eq('game_id', game.id)
    .eq('owner_id', game.seats[seat].playerId)
    .eq('place', 'support')
    .order('slot');
  if (error) throw new Error(error.message);
  return data!.map((t) => t.number);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameState = any;

export async function getState(game: TestGame, seat: number): Promise<GameState> {
  const { data, error } = await game.seats[seat].player.client.rpc('get_game_state', {
    p_game_id: game.id,
  });
  if (error) throw new Error(`get_game_state: ${error.message}`);
  return data;
}

/** Juega un turno completo con movimientos válidos al azar (revelar + pista). */
export async function playTurn(game: TestGame): Promise<GameState> {
  const state = await getState(game, 0);
  const seat = game.seats[state.game.current_seat];
  const client = seat.player.client;

  const reserve: number[] = state.game.reserve_by_color;
  const colors = reserve.map((n, c) => (n > 0 ? c : -1)).filter((c) => c >= 0);
  const color = colors[Math.floor(Math.random() * colors.length)] ?? 0;
  const reveal = await client.rpc('reveal_tile', { p_game_id: game.id, p_color: color });
  if (reveal.error) throw new Error(`reveal_tile: ${reveal.error.message}`);

  const mine = await getState(game, seat.seat);
  const pool: { number: number }[] = mine.pool;
  const tile = pool[Math.floor(Math.random() * pool.length)].number;
  const useClassify = Math.random() < 0.5;
  const clue = await client.rpc('ask_clue', {
    p_game_id: game.id,
    p_tile: tile,
    p_kind: useClassify ? 'classify' : 'compare',
    p_slot: useClassify ? null : Math.floor(Math.random() * 5),
  });
  if (clue.error) throw new Error(`ask_clue: ${clue.error.message}`);
  return getState(game, seat.seat);
}

/** Todos los números que aparecen bajo las claves number / tile_number / resolved_number. */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'number' || k === 'tile_number' || k === 'resolved_number') && typeof v === 'number') {
        out.push(v);
      } else {
        collectNumbers(v, out);
      }
    }
  }
  return out;
}
