'use client';

import { useTranslations } from 'next-intl';
import type { PublicTile } from '@/lib/game/types';
import { GameTile } from './GameTile';

/**
 * Mazo visible: 5 fichas, o 6 justo después de revelar. Se muestran en una sola fila que se
 * reparte el ancho (≥ 54 px por ficha en 390 px), así los objetivos táctiles quedan por encima
 * de 44 px y con aire entre ellos. Si la pantalla fuera más estrecha, baja a 44 px.
 */
export function Pool({
  pool, selectable, selected, onSelect,
}: { pool: PublicTile[]; selectable: boolean; selected: number | null; onSelect: (n: number) => void }) {
  const t = useTranslations('game');

  return (
    <section aria-label={t('pool')} className="flex flex-col gap-1.5">
      <h2 className="text-sm font-semibold">{t('pool')}</h2>
      <div className="grid grid-cols-6 justify-items-center gap-1.5">
        {pool.map((tile) => (
          <GameTile
            key={tile.number}
            number={tile.number}
            colorIndex={tile.color_index}
            points={tile.points}
            state="public"
            size={52}
            selected={selected === tile.number}
            onPress={selectable ? () => onSelect(tile.number) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
