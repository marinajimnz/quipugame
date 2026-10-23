import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { createClient } from '@/lib/supabase/server';

// Todo lo de (app) exige sesión. Un invitado también tiene sesión (cuenta anónima).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const path = (await headers()).get('x-pathname') ?? '/';
    redirect(`/entrar?next=${encodeURIComponent(path)}`);
  }

  return <QueryProvider>{children}</QueryProvider>;
}
