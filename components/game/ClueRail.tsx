'use client';

import { useTranslations } from 'next-intl';
import { useState, type CSSProperties } from 'react';
import { useFresh } from '@/lib/game/useFresh';
import { useGameText } from '@/lib/game/useGameText';
import type { Clue } from '@/lib/game/types';
import { TILE_POINTS } from '@/src/game/pointsTable';
import { GameTile } from './GameTile';

const CHIP = 36; // ancho de la ficha de pista, en px
const GAP = 6; // el mismo hueco que separa las fichas del soporte (gap-1.5)

/**
 * Pistas de un jugador colocadas bajo su soporte. Usa una rejilla que calca la fila del soporte
 * (cada ficha son dos medias columnas y entre fichas va el hueco), así cada pista cae justo:
 * · comparar: bajo la ficha comparada; recta si coinciden los puntos, girada 90° a la izquierda si no.
 * · encajar: entre las dos fichas que la rodean; en el borde si queda por debajo o por encima de todas.
 * Las pistas que caen en el mismo sitio se apilan y se despliegan al pulsar.
 */
export function ClueRail({ clues, tileSize }: { clues: Clue[]; tileSize: number }) {
  const fresh = useFresh(clues.map((c) => c.id));
  if (clues.length === 0) return null;

  const half = `${tileSize / 2}px`;
  const columns = Array.from({ length: 5 }, () => `${half} ${half}`).join(` ${GAP}px `);

  const compares = [0, 1, 2, 3, 4].map((slot) => clues.filter((c) => c.kind === 'compare' && c.target_slot === slot));
  const ranges = [0, 1, 2, 3, 4, 5].map((pos) => clues.filter((c) => c.kind === 'classify' && c.answer_position === pos));

  const rangeRow = compares.some((l) => l.length) ? 2 : 1;

  return (
    <div className="grid items-start gap-y-2" style={{ gridTemplateColumns: columns }}>
      {compares.map((list, slot) =>
        list.length ? (
          <ClueStack key={`c${slot}`} clues={list} fresh={fresh} style={{ gridRow: 1, gridColumn: `${3 * slot + 1} / span 2`, justifySelf: 'center' }} />
        ) : null,
      )}
      {ranges.map((list, pos) => {
        if (!list.length) return null;
        // Columnas (desde 1): la ficha i ocupa 3i+1 y 3i+2; el hueco entre i e i+1 es 3i+3.
        const place: CSSProperties =
          pos === 0
            ? { gridColumn: '1', justifySelf: 'start' }
            : pos === 5
              ? { gridColumn: '14', justifySelf: 'end' }
              : { gridColumn: `${3 * pos - 1} / span 3`, justifySelf: 'center' };
        return <ClueStack key={`r${pos}`} clues={list} fresh={fresh} style={{ gridRow: rangeRow, ...place }} />;
      })}
    </div>
  );
}

function ClueChip({ clue, fresh }: { clue: Clue; fresh: ReadonlySet<string> }) {
  const { clueText } = useGameText();
  const miss = clue.kind === 'compare' && clue.answer_same === false;

  return (
    <span className={`flex flex-col items-center ${fresh.has(clue.id) ? 'tile-drop' : ''}`}>
      <span className={`block ${miss ? '-rotate-90' : ''}`}>
        <GameTile
          number={clue.tile_number}
          colorIndex={(clue.tile_number - 1) % 5}
          points={TILE_POINTS[clue.tile_number]}
          state="public"
          size={CHIP}
        />
      </span>
      <span className="sr-only">{clueText(clue)}</span>
    </span>
  );
}

/** Una pista sola se ve tal cual; varias en el mismo sitio forman un montón con contador. */
function ClueStack({ clues, style, fresh }: { clues: Clue[]; style: CSSProperties; fresh: ReadonlySet<string> }) {
  const t = useTranslations('game');
  const [open, setOpen] = useState(false);
  const newest = clues[clues.length - 1];

  if (clues.length === 1) {
    return (
      <div style={style}>
        <ClueChip clue={newest} fresh={fresh} />
      </div>
    );
  }

  return (
    <button
      type="button"
      style={style}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-label={open ? t('clueStackHide', { count: clues.length }) : t('clueStackShow', { count: clues.length })}
      className="relative flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl p-0.5 focus-visible:outline-2 focus-visible:outline-acento"
    >
      {open ? (
        clues.map((c) => <ClueChip key={c.id} clue={c} fresh={fresh} />)
      ) : (
        <span className="relative block" style={{ paddingBottom: Math.min(clues.length - 1, 2) * 6 }}>
          {/* Las dos anteriores asoman por debajo para que se lea como montón. */}
          {clues.slice(-3, -1).map((c, i, behind) => (
            <span key={c.id} aria-hidden="true" className="absolute inset-x-0 top-0 block" style={{ transform: `translateY(${(behind.length - i) * 6}px)` }}>
              <ClueChip clue={c} fresh={fresh} />
            </span>
          ))}
          <span className="relative block">
            <ClueChip clue={newest} fresh={fresh} />
          </span>
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-acento px-1 text-center text-[11px] font-bold leading-5 tabular-nums text-grafito"
      >
        {open ? '−' : clues.length}
      </span>
    </button>
  );
}
