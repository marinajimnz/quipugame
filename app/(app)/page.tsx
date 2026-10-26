import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/brand/Wordmark';
import { HomeModes } from '@/components/home/HomeModes';
import { TutorialPrompt } from '@/components/home/TutorialPrompt';
import { RankedCard } from '@/components/ranked/RankedCard';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  // Si vuelvo a abrir la app con una partida en curso, me lleva directamente a ella.
  const { data: activeGame } = await supabase.rpc('get_my_active_game');
  if (activeGame) redirect(`/partida/${activeGame}`);
  const { data: queue } = await supabase.rpc('get_queue_status');
  const inQueue = Boolean((queue as { in_queue?: boolean } | null)?.in_queue);
  // ?modo=practica abre directamente la práctica (viene del final del tutorial).
  const practice = (await searchParams).modo === 'practica';
  const { data: profile } = await supabase
    .from('profiles')
    .select('elo, is_guest')
    .eq('id', auth.user!.id)
    .single();

  return (
    <main className="flex min-h-pantalla flex-col justify-center gap-6 px-4 py-10">
      <h1 className="sr-only">{t('app.name')}</h1>
      <div className="flex justify-center">
        <Wordmark size={260} showTagline />
      </div>
      <p className="text-balance text-center text-lg leading-snug">{t('app.tagline')}</p>

      <TutorialPrompt />

      <HomeModes
        defaultOpen={inQueue ? 'ranked' : practice ? 'practice' : null}
        ranked={profile ? <RankedCard isGuest={profile.is_guest} elo={profile.elo} inQueue={inQueue} /> : null}
      />
    </main>
  );
}
