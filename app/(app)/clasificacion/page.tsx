import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/profile/Avatar';
import { createClient } from '@/lib/supabase/server';

interface Row {
  id: string;
  rank: number;
  display_name: string;
  avatar_key: string;
  elo: number;
  ranked_games: number;
}

export default async function ClasificacionPage() {
  const t = await getTranslations('leaderboard');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase.rpc('get_leaderboard');
  const board = (data ?? { top: [], me: null }) as unknown as { top: Row[]; me: Row | null };
  const meInTop = board.top.some((r) => r.id === auth.user?.id);

  const row = (r: Row, mine: boolean) => (
    <li
      key={r.id}
      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-2xl p-2.5 ring-1 ring-espacio-borde ${mine ? 'bg-acento text-grafito' : 'bg-espacio-claro'}`}
    >
      <span className="text-center font-display text-lg font-extrabold tabular-nums">{r.rank}</span>
      <span className="flex min-w-0 items-center gap-2">
        <Avatar avatarKey={r.avatar_key} name={r.display_name} size={36} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{mine ? t('nameYou', { name: r.display_name }) : r.display_name}</span>
          <span className={`text-xs tabular-nums ${mine ? '' : 'text-crema-suave'}`}>{t('gamesCount', { count: r.ranked_games })}</span>
        </span>
      </span>
      <span className="font-display text-lg font-extrabold tabular-nums">{r.elo}</span>
    </li>
  );

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-crema-suave">{t('subtitle')}</p>
      </header>

      {board.top.length === 0 ? <p>{t('empty')}</p> : <ol className="flex flex-col gap-1.5">{board.top.map((r) => row(r, r.id === auth.user?.id))}</ol>}

      {!meInTop ? (
        <section className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold">{t('yourPosition')}</h2>
          {board.me ? <ol>{row(board.me, true)}</ol> : <p className="text-sm">{t('notRanked')}</p>}
        </section>
      ) : null}

      <Link href="/" className="mt-auto min-h-11 py-2 text-center text-sm underline">{t('back')}</Link>
    </main>
  );
}
