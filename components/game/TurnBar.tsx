'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { formatSeconds, secondsLeft } from '@/lib/game/turnTimer';
import type { GameState } from '@/lib/game/types';

/** Turno, cronómetro y fichas que quedan en la reserva. El reloj es el del servidor. */
export function TurnBar({
  state, clockOffsetMs, turnName, mine,
}: { state: GameState; clockOffsetMs: number; turnName: string; mine: boolean }) {
  const t = useTranslations('game');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const left = state.game.status === 'active' ? secondsLeft(state.game.turn_deadline, clockOffsetMs, now) : null;
  const reserve = state.game.reserve_by_color.reduce((a, b) => a + b, 0);
  const urgent = left !== null && left <= 10;

  return (
    <header
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-grafito/10 ${mine ? 'bg-lila' : 'bg-blanco'}`}
    >
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-extrabold">
          {mine ? t('yourTurn') : t('turnOf', { name: turnName })}
        </p>
        <p className="text-sm opacity-80">{t('reserve', { count: reserve })}</p>
      </div>
      {left !== null ? (
        <p
          aria-label={t('time')}
          className={`font-display text-3xl font-extrabold tabular-nums ${urgent ? 'text-ficha-2' : ''}`}
        >
          {formatSeconds(left)}
        </p>
      ) : null}
    </header>
  );
}
