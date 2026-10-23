'use client';

import { useTranslations } from 'next-intl';
import { TILE_POINTS } from '@/src/game/pointsTable';
import type { GameState, OtherPlayer } from '@/lib/game/types';
import { GameTile } from './GameTile';

const SLOTS = [0, 1, 2, 3, 4];

/** Soporte de otro jugador: sus 5 fichas, visibles para ti. */
export function OtherSupport({ player, size = 52 }: { player: OtherPlayer; size?: number }) {
  return (
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
  );
}

/**
 * Mi soporte: 5 huecos que no puedo leer. Cada uno enseña su color y su glifo; el orden
 * ascendente es público. Si ya me han eliminado o ha terminado la partida, enseña mis números.
 */
export function MySupport({
  me, size = 62, selectableSlot = false, selectedSlot, onSelectSlot,
}: {
  me: GameState['me'];
  size?: number;
  selectableSlot?: boolean;
  selectedSlot?: number | null;
  onSelectSlot?: (slot: number) => void;
}) {
  const t = useTranslations('game');

  return (
    <div className="flex gap-1.5">
      {me.support.map((s) => {
        const resolved = s.resolved_number !== null;
        return (
          <div key={s.slot} className="flex flex-col items-center gap-0.5">
            <GameTile
              number={s.resolved_number}
              colorIndex={s.color_index}
              points={resolved ? TILE_POINTS[s.resolved_number!] : null}
              state={resolved ? 'solved' : 'unknown'}
              size={size}
              selected={selectedSlot === s.slot}
              onPress={selectableSlot ? () => onSelectSlot?.(s.slot) : undefined}
            />
            <span className="text-xs tabular-nums opacity-60">{t('slotLabel', { n: s.slot + 1 })}</span>
          </div>
        );
      })}
    </div>
  );
}
