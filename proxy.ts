import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

// En Next.js 16 el antiguo middleware se llama proxy.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo salvo estáticos, imágenes optimizadas y el favicon.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
