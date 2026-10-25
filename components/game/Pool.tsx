'use client';

import { useTranslations } from 'next-intl';
import { useFresh } from '@/lib/game/useFresh';
import type { PublicTile } from '@/lib/game/types';
import { GameTile } from './GameTile';

/**
 * Mazo visible: 5 fichas, o 6 justo después de revelar. Se muestran en una sola fila que se
 * reparte el ancho (≥ 54 px por ficha en 390 px), así los objetivos táctiles quedan por encima
 * de 44 px y con aire entre ellos. Si la pantalla fuera más estrecha, baja a 44 px.
 */
export function Pool({
  pool, selectable, selected, onSelect, only,
}: {
  pool: PublicTile[];
  selectable: boolean;
  selected: number | null;
  onSelect: (n: number) => void;
  /** Las únicas fichas que se pueden elegir (lo usa el tutorial). Sin esto, todas. */
  only?: readonly number[];
}) {
  const t = useTranslations('game');
  const fresh = useFresh(pool.map((tile) => tile.number));

  return (
    <section aria-label={t('pool')} className="flex flex-col gap-1.5 rounded-2xl bg-espacio-claro/70 p-3 ring-1 ring-espacio-borde">
      <h2 className="text-sm font-semibold">{t('pool')}</h2>
      <div className="flex flex-wrap justify-center gap-1.5">
        {pool.map((tile) => {
          const pickable = selectable && (!only || only.includes(tile.number));
          return (
          <span key={tile.number} className={fresh.has(tile.number) ? 'tile-drop' : undefined}>
          <GameTile
            number={tile.number}
            colorIndex={tile.color_index}
            points={tile.points}
            state="public"
            size={52}
            selected={selected === tile.number}
            hint={pickable && selected === null}
            onPress={pickable ? () => onSelect(tile.number) : undefined}
          />
          </span>
          );
        })}
      </div>
    </section>
  );
}
