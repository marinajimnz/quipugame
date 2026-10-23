import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/src/types/database';
import { supabaseEnv } from './env';

// Cliente del navegador. Las acciones de juego son RPC: el cliente solo envía intenciones.
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
