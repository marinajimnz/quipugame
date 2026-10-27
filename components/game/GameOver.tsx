'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { PracticeAgain } from '@/components/home/PracticeForm';
import type { GameState } from '@/lib/game/types';
import { EloChange } from './EloChange';
import { MySupport } from './Support';

/**
 * Resultado de la partida en una ventana centrada sobre la partida desenfocada, con mis números
 * reales (el servidor ya me los entrega). Solo se sale con sus botones.
 */
export function GameOver({ state, gameId, userId }: { state: GameState; gameId: string; userId: string }) {
  const t = useTranslations('game.over');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const winnerId = state.game.winner_player_id;

  const headline = !winnerId ? t('draw') : winnerId === state.me.player_id ? t('won') : t('lost');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[calc(100%-2rem)] max-w-[400px] rounded-3xl bg-espacio-claro p-5 text-crema ring-2 ring-acento backdrop:bg-espacio/50 backdrop:backdrop-blur-md motion-safe:animate-[panel-in_220ms_ease-out]"
    >
      <div className="flex flex-col gap-5 text-center">
        <h1 id={titleId} className="text-balance font-display text-4xl font-extrabold">{headline}</h1>
        {state.game.mode === 'ranked' ? <EloChange gameId={gameId} userId={userId} /> : null}
        <div className="flex flex-col gap-2 rounded-2xl bg-espacio/70 p-3">
          <h2 className="text-sm font-semibold">{t('yourNumbers')}</h2>
          <MySupport me={state.me} size={52} />
        </div>
        <div className="flex flex-col gap-4">
          {state.game.mode === 'practice' ? <PracticeAgain bots={state.players.length} /> : null}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-[22px] bg-espacio-borde px-5 text-base font-bold shadow-[0_5px_0_color-mix(in_oklab,var(--espacio-borde)_70%,black)] active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
          >
            {t('backHome')}
          </Link>
        </div>
      </div>
    </dialog>
  );
}
