import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/server';

// Destino de los enlaces de confirmación por correo (registro y conversión de invitado).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/entrar`);
}
