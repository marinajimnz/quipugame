'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { autoStruck } from '@/lib/game/autoStrike';
import { EMPTY_MARKS, useDeductionStore } from '@/lib/game/deductionStore';
import type { GameState } from '@/lib/game/types';
import { TILE_POINTS } from '@/src/game/pointsTable';
import { TILE_FILL, TILE_INK } from './tileParts';

type Mode = 'strike' | number; // número = posición (0–4) cuyos candidatos se anotan

const NUMBERS = Array.from({ length: 60 }, (_, i) => i + 1);

/**
 * Tablero personal con las 60 fichas, en columnas por color. Tachado manual, tachado automático
 * de lo que ya es público (distinto aspecto) y candidatos por posición. Es solo una ayuda:
 * no decide nada del juego.
 */
export function DeductionBoard({
  open, onClose, gameId, state,
}: { open: boolean; onClose: () => void; gameId: string; state: GameState }) {
  const t = useTranslations('deduction');
  const tGame = useTranslations('game');
  const marks = useDeductionStore((s) => s.games[gameId]) ?? EMPTY_MARKS;
  const { toggleStrike, toggleCandidate, clear } = useDeductionStore.getState();
  const [mode, setMode] = useState<Mode>('strike');

  useEffect(() => {
    void useDeductionStore.persist.rehydrate();
  }, []);

  const auto = autoStruck(state);

  function press(n: number) {
    if (mode === 'strike') toggleStrike(gameId, n);
    else toggleCandidate(gameId, mode, n);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('title')}>
      <div className="flex flex-col gap-3">
        <p className="text-sm">{t('help')}</p>

        <div role="radiogroup" aria-label={t('mode')} className="grid grid-cols-7 gap-1.5">
          <button
            type="button" role="radio" aria-checked={mode === 'strike'} onClick={() => setMode('strike')}
            className="col-span-2 min-h-11 rounded-xl text-sm font-semibold ring-1 ring-grafito/25 aria-checked:bg-lila aria-checked:ring-0 focus-visible:outline-2 focus-visible:outline-lila"
          >
            {t('modeStrike')}
          </button>
          {[0, 1, 2, 3, 4].map((slot) => (
            <button
              key={slot} type="button" role="radio" aria-checked={mode === slot}
              aria-label={t('modeCandidate', { n: slot + 1 })}
              onClick={() => setMode(slot)}
              className="min-h-11 rounded-xl text-sm font-semibold tabular-nums ring-1 ring-grafito/25 aria-checked:bg-lila aria-checked:ring-0 focus-visible:outline-2 focus-visible:outline-lila"
            >
              {slot + 1}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={t('title')}>
          {NUMBERS.slice().sort((a, b) => ((a - 1) % 5) - ((b - 1) % 5) || a - b).map((n) => {
            const color = (n - 1) % 5;
            const byMe = marks.struck.includes(n);
            const byAuto = auto.has(n);
            const slots = Object.entries(marks.candidates)
              .filter(([, list]) => list.includes(n))
              .map(([slot]) => Number(slot) + 1);
            const struck = byMe || byAuto;

            return (
              <button
                key={n}
                type="button"
                onClick={() => press(n)}
                aria-label={t('cell', { number: n, points: TILE_POINTS[n] })}
                aria-pressed={byMe}
                data-auto={byAuto || undefined}
                style={{ background: TILE_FILL[color], color: TILE_INK[color] }}
                className={`relative flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-1 font-display font-extrabold tabular-nums ring-1 ring-piedra-hueco/40 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-grafito ${struck ? 'opacity-35' : ''} ${byAuto ? 'saturate-50' : ''}`}
              >
                <span className={`text-lg leading-none ${struck ? 'line-through decoration-2' : ''}`}>{n}</span>
                <span className="text-[10px] leading-none opacity-80" aria-hidden="true">
                  {'•'.repeat(TILE_POINTS[n])}
                </span>
                {byAuto && !byMe ? (
                  <span className="absolute inset-x-1 top-1/2 h-0.5 -rotate-12 bg-current opacity-80" aria-hidden="true" />
                ) : null}
                {slots.length ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-grafito px-1 text-[10px] leading-4 text-crema" aria-hidden="true">
                    {slots.join('')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-xs opacity-70">{t('auto')}</p>
        <Button variant="secondary" onClick={() => clear(gameId)}>{t('reset')}</Button>
        <span className="sr-only">{tGame('deduction')}</span>
      </div>
    </Sheet>
  );
}
