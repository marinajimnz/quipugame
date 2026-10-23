import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

// En Next.js 16 el antiguo middleware se llama proxy.
export async function proxy(request: NextRequest) {
  // Los layouts no ven la URL: se la pasamos en una cabecera para poder volver tras iniciar sesión.
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search);
  return updateSession(new NextRequest(request, { headers }));
}

export const config = {
  matcher: [
    // Todo salvo estáticos, imágenes optimizadas y el favicon.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
