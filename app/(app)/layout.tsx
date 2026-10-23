import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { createClient } from '@/lib/supabase/server';

// Todo lo de (app) exige sesión. Un invitado también tiene sesión (cuenta anónima).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');

  return <QueryProvider>{children}</QueryProvider>;
}
