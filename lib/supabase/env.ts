// Las dos variables son públicas por diseño (van al navegador): la URL y la clave anon/publishable.
// La clave de servicio (SUPABASE_SERVICE_ROLE_KEY) no se usa en el cliente ni en Next.js.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}
