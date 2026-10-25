'use client';

import { useTranslations } from 'next-intl';
import { useGameText } from '@/lib/game/useGameText';
import type { Clue } from '@/lib/game/types';
import { TILE_POINTS } from '@/src/game/pointsTable';
import { GameTile } from './GameTile';

/** Pistas pedidas por un jugador: la ficha usada y la respuesta. Son públicas. */
export function ClueList({ clues, empty = false }: { clues: Clue[]; empty?: boolean }) {
  const t = useTranslations('game');
  const { clueText } = useGameText();

  if (clues.length === 0) {
    return empty ? <p className="text-sm text-crema-suave">{t('noClues')}</p> : null;
  }

  return (
    <ul className="grid grid-cols-1 gap-1.5">
      {clues.map((c) => (
        <li key={c.id} className="flex items-center gap-2 rounded-xl bg-espacio-claro/70 p-1.5 ring-1 ring-espacio-borde">
          <GameTile
            number={c.tile_number}
            colorIndex={(c.tile_number - 1) % 5}
            points={TILE_POINTS[c.tile_number]}
            state="public"
            size={48}
          />
          <span className="text-sm leading-tight">{clueText(c)}</span>
        </li>
      ))}
    </ul>
  );
}
