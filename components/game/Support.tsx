'use client';

import { useTranslations } from 'next-intl';
import { TILE_POINTS } from '@/src/game/pointsTable';
import type { Clue, GameState, OtherPlayer } from '@/lib/game/types';
import { ClueRail } from './ClueRail';
import { GameTile } from './GameTile';

const SLOTS = [0, 1, 2, 3, 4];

/** Soporte de otro jugador: sus 5 fichas, visibles para ti, y debajo sus pistas. */
export function OtherSupport({ player, clues = [], size = 52 }: { player: OtherPlayer; clues?: Clue[]; size?: number }) {
  return (
    <div className="mx-auto flex w-fit flex-col gap-2">
      <div className="flex gap-1.5">
        {SLOTS.map((slot) => {
          const tile = player.support.find((s) => s.slot === slot);
          return tile ? (
            <GameTile key={slot} number={tile.number} colorIndex={tile.color_index} points={tile.points} state="public" size={size} />
          ) : (
            <span key={slot} style={{ width: size }} />
          );
        })}
      </div>
      <ClueRail clues={clues} tileSize={size} />
    </div>
  );
}

/**
 * Mi soporte: 5 huecos que no puedo leer. Cada uno enseña su color y su glifo; el orden
 * ascendente es público. Si ya me han eliminado o ha terminado la partida, enseña mis números.
 */
export function MySupport({
  me, clues = [], guesses = {}, size = 62, selectableSlot = false, selectedSlot, onSelectSlot,
}: {
  me: GameState['me'];
  clues?: Clue[];
  /** Números que el jugador ha apuntado en su tablero, por posición. */
  guesses?: Record<number, number>;
  size?: number;
  selectableSlot?: boolean;
  selectedSlot?: number | null;
  onSelectSlot?: (slot: number) => void;
}) {
  const t = useTranslations('game');

  return (
    <div className="mx-auto flex w-fit flex-col gap-2">
      <div className="flex gap-1.5">
        {me.support.map((s) => {
          const resolved = s.resolved_number !== null;
          const guess = resolved ? undefined : guesses[s.slot];
          return (
            <div key={s.slot} className="flex flex-col items-center gap-0.5">
              <GameTile
                number={s.resolved_number ?? guess ?? null}
                colorIndex={s.color_index}
                points={resolved ? TILE_POINTS[s.resolved_number!] : null}
                state={resolved ? 'solved' : guess !== undefined ? 'guess' : 'unknown'}
                size={size}
                selected={selectedSlot === s.slot}
                hint={selectableSlot && selectedSlot == null}
                onPress={selectableSlot ? () => onSelectSlot?.(s.slot) : undefined}
              />
              <span className="sr-only">{t('slotLabel', { n: s.slot + 1 })}</span>
            </div>
          );
        })}
      </div>
      <ClueRail clues={clues} tileSize={size} />
    </div>
  );
}
