import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ConvertSheet } from '@/components/account/ConvertSheet';
import { Avatar } from '@/components/profile/Avatar';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { SignOutButton } from '@/components/profile/SignOutButton';
import { createClient } from '@/lib/supabase/server';

export default async function PerfilPage() {
  const t = await getTranslations('profile');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', auth.user!.id).single();
  if (!profile) redirect('/entrar');

  const winRate = profile.games_played > 0 ? Math.round((profile.games_won / profile.games_played) * 100) : 0;

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <Avatar avatarKey={profile.avatar_key} name={profile.display_name} size={64} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{profile.display_name}</h1>
          {profile.is_guest ? (
            <span className="w-fit rounded-full bg-lila px-2.5 py-0.5 text-xs font-semibold">{t('guestBadge')}</span>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ['elo', profile.elo],
            ['played', profile.games_played],
            ['won', profile.games_won],
            ['winRate', `${winRate}%`],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-2xl bg-blanco py-3 shadow-sm ring-1 ring-grafito/10">
            <dd className="font-display text-2xl font-extrabold tabular-nums">{value}</dd>
            <dt className="text-xs opacity-70">{t(key)}</dt>
          </div>
        ))}
      </dl>

      {profile.is_guest ? <ConvertSheet /> : null}

      <ProfileForm userId={profile.id} initialName={profile.display_name} initialAvatar={profile.avatar_key} />

      <div className="mt-auto flex flex-col gap-3">
        <Link href="/clasificacion" className="min-h-11 py-2 text-center text-sm font-semibold underline">
          {t('leaderboard')}
        </Link>
        <SignOutButton />
        <Link href="/" className="min-h-11 py-2 text-center text-sm underline">
          {t('back')}
        </Link>
      </div>
    </main>
  );
}
