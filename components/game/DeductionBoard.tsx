'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { autoStruck } from '@/lib/game/autoStrike';
import { useDeductionStore, useMarks } from '@/lib/game/deductionStore';
import type { GameState } from '@/lib/game/types';
import { TILE_POINTS } from '@/src/game/pointsTable';
import { GameTile } from './GameTile';
import { SYMBOLS, TILE_H, TILE_W } from './Tile';
import { TILE_FILL, TILE_INK } from './tileColors';

type Mode = 'strike' | 'circle'; // tachar = descartado · rodear = posible
type View = 'all' | number; // número = color (0–4) que se muestra solo

const NUMBERS = Array.from({ length: 60 }, (_, i) => i + 1);

/**
 * Tablero personal con las 60 fichas: completo (en orden, cada columna es un color) o un color
 * solo, con las casillas más grandes. Tachado manual, tachado automático de lo que ya es público
 * (distinto aspecto) y rodeado de lo posible. Arriba, fijas, tus fichas: al tocar una se apunta
 * el número que crees que tiene. Es solo una ayuda: no decide nada del juego.
 */
export function DeductionBoard({
  open, onClose, gameId, state,
}: { open: boolean; onClose: () => void; gameId: string; state: GameState }) {
  const t = useTranslations('deduction');
  const tGame = useTranslations('game');
  const tTile = useTranslations('tile');
  const marks = useMarks(gameId);
  const { toggleStrike, toggleCircle, setGuess, clear } = useDeductionStore.getState();
  const [mode, setMode] = useState<Mode>('strike');
  const [view, setView] = useState<View>('all');
  // Ficha mía en la que se está apuntando un número (o null).
  const [guessSlot, setGuessSlot] = useState<number | null>(null);
  const shown = view === 'all' ? NUMBERS : NUMBERS.filter((n) => (n - 1) % 5 === view);
  const guessColor = guessSlot === null ? null : state.me.support.find((s) => s.slot === guessSlot)!.color_index;

  const auto = autoStruck(state);

  function pickSlot(slot: number, color: number) {
    if (guessSlot === slot) return setGuessSlot(null);
    setGuessSlot(slot);
    setView(color); // solo valen números de su color
  }

  function press(n: number) {
    if (guessSlot !== null) {
      if ((n - 1) % 5 !== guessColor) return;
      setGuess(gameId, guessSlot, marks.guesses[guessSlot] === n ? null : n);
      setGuessSlot(null);
    } else if (mode === 'strike') toggleStrike(gameId, n);
    else toggleCircle(gameId, n);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('title')}>
      <div className="flex flex-col gap-3">
        <section aria-label={t('mine')} className="sticky -top-4 z-10 -mx-4 flex flex-col gap-1.5 bg-espacio-claro px-4 pb-2 pt-1">
          <div className="flex justify-center gap-1.5">
            {state.me.support.map((s) => {
              const guess = marks.guesses[s.slot];
              return s.resolved_number !== null ? (
                <GameTile
                  key={s.slot}
                  number={s.resolved_number}
                  colorIndex={s.color_index}
                  points={TILE_POINTS[s.resolved_number]}
                  state="solved"
                  size={52}
                />
              ) : (
                <GameTile
                  key={s.slot}
                  number={guess ?? null}
                  colorIndex={s.color_index}
                  points={null}
                  state={guess ? 'guess' : 'unknown'}
                  size={52}
                  selected={guessSlot === s.slot}
                  onPress={() => pickSlot(s.slot, s.color_index)}
                />
              );
            })}
          </div>
          <p className="text-center text-sm font-medium" aria-live="polite">
            {guessSlot === null ? t('mineHelp') : t('pickGuess', { n: guessSlot + 1 })}
          </p>
        </section>

        <p className="text-sm">{t('help')}</p>

        <div role="radiogroup" aria-label={t('mode')} className="grid grid-cols-2 gap-1.5">
          {(['strike', 'circle'] as const).map((m) => (
            <button
              key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className="min-h-11 rounded-xl text-sm font-semibold ring-1 ring-espacio-borde aria-checked:bg-acento aria-checked:text-grafito aria-checked:ring-0 focus-visible:outline-2 focus-visible:outline-acento"
            >
              {m === 'strike' ? t('modeStrike') : t('modeCircle')}
            </button>
          ))}
        </div>

        <div role="tablist" aria-label={t('view')} className="grid grid-cols-7 gap-1.5">
          <button
            type="button" role="tab" aria-selected={view === 'all'} onClick={() => setView('all')}
            className="col-span-2 min-h-11 rounded-xl text-sm font-semibold ring-1 ring-espacio-borde aria-selected:bg-crema aria-selected:text-grafito aria-selected:ring-0 focus-visible:outline-2 focus-visible:outline-acento"
          >
            {t('viewAll')}
          </button>
          {[0, 1, 2, 3, 4].map((color) => (
            <button
              key={color} type="button" role="tab" aria-selected={view === color}
              aria-label={tTile(`colors.${color}`)}
              onClick={() => setView(color)}
              style={{ background: TILE_FILL[color] }}
              className="flex min-h-11 items-center justify-center rounded-xl aria-selected:ring-3 aria-selected:ring-crema aria-selected:ring-offset-2 aria-selected:ring-offset-espacio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
            >
              <svg viewBox="-1.2 -1.2 2.4 2.4" width={20} height={20} aria-hidden="true" focusable="false">
                <path d={SYMBOLS[color]} fill={TILE_INK[color]} />
              </svg>
            </button>
          ))}
        </div>

        <div
          className={`grid justify-items-center gap-1.5 ${view === 'all' ? 'grid-cols-5' : 'grid-cols-4'}`}
          role="tabpanel"
          aria-label={t('title')}
        >
          {shown.map((n) => {
            const color = (n - 1) % 5;
            const byMe = marks.struck.includes(n);
            const byAuto = auto.has(n);
            const circled = marks.circled.includes(n);
            const size = view === 'all' ? 56 : 72;
            const blocked = guessColor !== null && color !== guessColor;

            return (
              <button
                key={n}
                type="button"
                onClick={() => press(n)}
                disabled={blocked}
                aria-label={`${t('cell', { number: n, points: TILE_POINTS[n] })}${byMe ? `, ${t('struck')}` : circled ? `, ${t('circled')}` : ''}`}
                data-auto={byAuto || undefined}
                className="relative rounded-[22%] disabled:opacity-30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-crema"
              >
                <span aria-hidden="true" className={`block ${byMe || byAuto ? 'opacity-35' : ''} ${byAuto ? 'saturate-50' : ''}`}>
                  <GameTile number={n} colorIndex={color} points={TILE_POINTS[n]} state="public" size={size} />
                </span>
                {/* Marcas dibujadas sobre la ficha, en el mismo lienzo (100 × 108) y con la tinta de su color. */}
                {byMe || byAuto || circled ? (
                  <svg
                    viewBox={`0 0 ${TILE_W} ${TILE_H}`}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden="true"
                    focusable="false"
                  >
                    {byMe || byAuto ? (
                      <line x1={14} y1={90} x2={86} y2={14} stroke="var(--crema)" strokeWidth={byMe ? 7 : 5} strokeLinecap="round" />
                    ) : null}
                    {circled ? (
                      <ellipse cx={50} cy={53} rx={36} ry={24} fill="none" stroke={TILE_INK[color]} strokeWidth={6} />
                    ) : null}
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>

        <Button variant="secondary" onClick={() => clear(gameId)}>{t('reset')}</Button>
        <span className="sr-only">{tGame('deduction')}</span>
      </div>
    </Sheet>
  );
}
