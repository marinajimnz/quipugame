import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PracticeForm } from '@/components/home/PracticeForm';
import { CreateRoomForm, JoinRoomForm } from '@/components/home/RoomForms';
import { RankedCard } from '@/components/ranked/RankedCard';
import { Avatar } from '@/components/profile/Avatar';
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
    .select('display_name, avatar_key, elo, is_guest')
    .eq('id', auth.user!.id)
    .single();

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-10">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{t('app.name')}</h1>
      <p className="text-lg leading-snug">{t('app.tagline')}</p>

      {profile ? (
        <Link
          href="/perfil"
          className="flex min-h-11 items-center gap-3 rounded-2xl bg-blanco p-3 shadow-sm ring-1 ring-grafito/10 focus-visible:outline-2 focus-visible:outline-lila"
        >
          <Avatar avatarKey={profile.avatar_key} name={profile.display_name} />
          <span className="flex flex-col">
            <span className="font-semibold">{t('home.greeting', { name: profile.display_name })}</span>
            <span className="text-sm text-grafito-suave">{t('home.profileLink')}</span>
          </span>
        </Link>
      ) : null}

      <Link href="/reglas" className="min-h-11 self-start py-2 text-sm font-semibold underline">
        {t('home.rulesLink')}
      </Link>
      <PracticeForm />
      {profile ? <RankedCard isGuest={profile.is_guest} elo={profile.elo} inQueue={inQueue} /> : null}
      <CreateRoomForm />
      <JoinRoomForm />
    </main>
  );
}
