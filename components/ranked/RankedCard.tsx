'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConvertSheet } from '@/components/account/ConvertSheet';
import { Button } from '@/components/ui/Button';
import { rankedErrorKey } from '@/lib/ranked/rankedErrors';
import { createClient } from '@/lib/supabase/client';

/** Entrada a la clasificatoria desde el inicio. Los invitados ven cómo convertir su cuenta. */
export function RankedCard({ isGuest, elo, inQueue }: { isGuest: boolean; elo: number; inQueue: boolean }) {
  const t = useTranslations('ranked');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function find() {
    setBusy(true);
    setErrorKey(null);
    const { error } = await createClient().rpc('join_queue');
    if (error && error.message !== 'already_in_queue') {
      setErrorKey(rankedErrorKey(error));
      setBusy(false);
      return;
    }
    router.push('/cola');
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-blanco p-4 shadow-sm ring-1 ring-grafito/10">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-extrabold">{t('title')}</h2>
        {!isGuest ? <span className="text-sm tabular-nums text-grafito-suave">{t('yourElo', { elo })}</span> : null}
      </div>

      {isGuest ? (
        <>
          <p className="text-sm">{t('guestBody')}</p>
          <ConvertSheet />
        </>
      ) : inQueue ? (
        <Link
          href="/cola"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-lila text-piedra-hueco px-5 font-semibold focus-visible:outline-2 focus-visible:outline-grafito"
        >
          {t('backToQueue')}
        </Link>
      ) : (
        <>
          <p className="text-sm">{t('body')}</p>
          {errorKey ? <p role="alert" className="text-sm text-error">{t(`errors.${errorKey}`)}</p> : null}
          <Button disabled={busy} onClick={find}>{busy ? t('finding') : t('find')}</Button>
        </>
      )}

      <Link href="/clasificacion" className="min-h-11 py-2 text-center text-sm font-semibold underline">
        {t('leaderboardLink')}
      </Link>
    </section>
  );
}
