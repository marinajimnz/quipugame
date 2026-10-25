'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useNow } from '@/lib/game/useNow';
import { formatSeconds } from '@/lib/game/turnTimer';
import { OFFER_BOT_AFTER_S } from '@/lib/ranked/rankedErrors';
import { createClient } from '@/lib/supabase/client';

interface QueueStatus {
  in_queue: boolean;
  joined_at: string | null;
  elo: number | null;
  window: number | null;
  server_time: string;
}

/**
 * Cola clasificatoria: tiempo de espera, rango de ELO que se busca y salir. El emparejamiento lo
 * hace el servidor cada 3 s; aquí solo se espera a tener partida y se entra en ella.
 */
export function QueueScreen() {
  const t = useTranslations('queue');
  const router = useRouter();
  const supabase = createClient();
  const now = useNow(1000);
  const [dismissedBot, setDismissedBot] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: ['queue-status'],
    refetchInterval: 2000,
    queryFn: async () => {
      const [{ data: s, error }, { data: game }] = await Promise.all([
        supabase.rpc('get_queue_status'),
        supabase.rpc('get_my_active_game'),
      ]);
      if (error) throw error;
      const q = s as unknown as QueueStatus;
      return { q, game: (game as string | null) ?? null, offsetMs: Date.parse(q.server_time) - Date.now() };
    },
  });

  const game = status.data?.game ?? null;
  useEffect(() => {
    if (game) router.replace(`/partida/${game}`);
  }, [game, router]);

  if (!status.data) return null;
  const { q, offsetMs } = status.data;

  if (!q.in_queue) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 px-4 py-8">
        <p>{t('notInQueue')}</p>
        <Button
          onClick={async () => {
            await supabase.rpc('join_queue');
            await status.refetch();
          }}
        >
          {t('join')}
        </Button>
      </main>
    );
  }

  const waited = Math.max(0, Math.floor((now + offsetMs - Date.parse(q.joined_at!)) / 1000));
  const window = q.window ?? 50;

  async function leave() {
    setBusy(true);
    await supabase.rpc('leave_queue');
    router.replace('/');
  }

  async function playBot() {
    setBusy(true);
    await supabase.rpc('leave_queue');
    const { data } = await supabase.rpc('start_practice_game', { p_bots: 1, p_difficulty: 'normal' });
    router.replace(data ? `/partida/${data}` : '/');
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{t('title')}</h1>

      <div className="flex flex-col items-center gap-2 rounded-3xl bg-espacio-claro p-6 ring-1 ring-espacio-borde" aria-live="polite">
        <p className="text-sm text-crema-suave">{t('waited')}</p>
        <p className="font-display text-6xl font-extrabold tabular-nums">{formatSeconds(waited)}</p>
        <p className="text-sm tabular-nums">{t('range', { min: Math.max(100, q.elo! - window), max: q.elo! + window })}</p>
      </div>

      {waited >= OFFER_BOT_AFTER_S && !dismissedBot ? (
        <section role="status" className="flex flex-col gap-3 rounded-3xl bg-espacio-claro p-4 ring-2 ring-acento">
          <h2 className="font-display text-xl font-extrabold">{t('slowTitle')}</h2>
          <p className="text-sm">{t('slowBody')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setDismissedBot(true)}>{t('keepWaiting')}</Button>
            <Button disabled={busy} onClick={playBot}>{t('playBot')}</Button>
          </div>
        </section>
      ) : null}

      <Button variant="secondary" className="mt-auto" disabled={busy} onClick={leave}>{t('cancel')}</Button>
    </main>
  );
}
