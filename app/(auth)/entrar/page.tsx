import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/AuthForm';
import { Wordmark } from '@/components/brand/Wordmark';
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
      <h1 className="sr-only">{t('auth.title', { app: t('app.name') })}</h1>
      <div className="flex justify-center">
        <Wordmark size={280} showTagline />
      </div>
      <AuthForm next={next} />
      <Link href="/reglas" className="min-h-11 self-center py-2 text-sm font-semibold underline">
        {t('auth.rulesLink')}
      </Link>
    </main>
  );
}
