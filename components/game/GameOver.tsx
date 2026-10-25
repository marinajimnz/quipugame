'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PracticeAgain } from '@/components/home/PracticeForm';
import type { PlayerLabel } from '@/lib/game/playerLabel';
import type { GameState } from '@/lib/game/types';
import { useGameText } from '@/lib/game/useGameText';
import { EloChange } from './EloChange';
import { MySupport } from './Support';

/** Resultado de la partida con mis números reales (el servidor ya me los entrega). */
export function GameOver({
  state, labels, gameId, userId,
}: { state: GameState; labels: Map<string, PlayerLabel>; gameId: string; userId: string }) {
  const t = useTranslations('game.over');
  const { playerName } = useGameText();
  const winnerId = state.game.winner_player_id;
  const winner = winnerId ? labels.get(winnerId) : undefined;

  const headline = !winnerId
    ? t('draw')
    : winnerId === state.me.player_id
      ? t('won')
      : winner?.kind === 'bot'
        ? t('wonByBot')
        : t('lost', { name: playerName(winner) });

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-espacio-claro p-4 ring-2 ring-acento" aria-live="polite">
      <h1 className="font-display text-3xl font-extrabold">{headline}</h1>
      {state.game.mode === 'ranked' ? <EloChange gameId={gameId} userId={userId} /> : null}
      <div className="flex flex-col gap-1.5 rounded-2xl bg-espacio/70 p-3">
        <h2 className="text-sm font-semibold">{t('yourNumbers')}</h2>
        <MySupport me={state.me} size={52} />
      </div>
      <div className="flex flex-col gap-2">
        {state.game.mode === 'practice' ? <PracticeAgain bots={state.players.length} /> : null}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-[22px] bg-espacio-borde px-5 text-base font-bold shadow-[0_5px_0_color-mix(in_oklab,var(--espacio-borde)_70%,black)] active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
        >
          {t('backHome')}
        </Link>
      </div>
    </section>
  );
}
