import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/AuthForm';
import { safeNext } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/server';

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next);

  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-8 px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        {t('auth.title', { app: t('app.name') })}
      </h1>
      <AuthForm next={next} />
    </main>
  );
}
