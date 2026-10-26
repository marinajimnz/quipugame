'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { DeductionBoard } from '@/components/game/DeductionBoard';
import { Button } from '@/components/ui/Button';
import { loadLastGame, type LastGame } from '@/lib/game/lastGame';

let cached: LastGame | null | undefined;
const readLastGame = () => {
  if (cached === undefined) cached = loadLastGame();
  return cached;
};

/** Pantalla sin conexión: reglas y el tablero de deducción de la última partida. */
export function OfflineScreen() {
  const t = useTranslations('offline');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const last = useSyncExternalStore(
    () => () => undefined,
    readLastGame,
    () => null,
  );

  return (
    <main className="flex min-h-pantalla flex-col justify-center gap-5 px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{t('title')}</h1>
      <p>{t('body')}</p>

      {last ? (
        <div className="flex flex-col gap-2">
          <Button onClick={() => setOpen(true)}>{t('openBoard')}</Button>
          <p className="text-sm text-crema-suave">
            {t('savedAt', { when: format.dateTime(new Date(last.savedAt), { dateStyle: 'short', timeStyle: 'short' }) })}
          </p>
          <DeductionBoard open={open} onClose={() => setOpen(false)} gameId={last.gameId} state={last.state} />
        </div>
      ) : (
        <p className="text-sm text-crema-suave">{t('noSaved')}</p>
      )}

      <Link href="/reglas" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-espacio-claro px-5 font-semibold ring-1 ring-espacio-borde">
        {t('rules')}
      </Link>
      <Button variant="secondary" onClick={() => location.reload()}>{t('retry')}</Button>
    </main>
  );
}
