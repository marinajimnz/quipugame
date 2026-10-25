import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/brand/Wordmark';
import { HomeModes } from '@/components/home/HomeModes';
import { RankedCard } from '@/components/ranked/RankedCard';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  // Si vuelvo a abrir la app con una partida en curso, me lleva directamente a ella.
  const { data: activeGame } = await supabase.rpc('get_my_active_game');
  if (activeGame) redirect(`/partida/${activeGame}`);
  const { data: queue } = await supabase.rpc('get_queue_status');
  const inQueue = Boolean((queue as { in_queue?: boolean } | null)?.in_queue);
  const { data: profile } = await supabase
    .from('profiles')
    .select('elo, is_guest')
    .eq('id', auth.user!.id)
    .single();

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-10">
      <h1 className="sr-only">{t('app.name')}</h1>
      <div className="flex justify-center">
        <Wordmark size={260} showTagline />
      </div>
      <p className="text-center text-lg leading-snug">{t('app.tagline')}</p>

      <HomeModes
        defaultOpen={inQueue ? 'ranked' : null}
        ranked={profile ? <RankedCard isGuest={profile.is_guest} elo={profile.elo} inQueue={inQueue} /> : null}
      />
    </main>
  );
}
