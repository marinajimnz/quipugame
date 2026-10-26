import { useTranslations } from 'next-intl';
import { Tile } from './Tile';
import type { TileProps } from './Tile';

/** Tile con su etiqueta accesible traducida ("Ficha 23, azul, 2 barras"). */
export function GameTile(props: Omit<TileProps, 'label'>) {
  const t = useTranslations('tile');
  const color = t(`colors.${props.colorIndex}`);

  const label =
    props.state === 'back'
      ? t('back', { color })
      : props.state === 'unknown'
        ? t('unknown', { color })
        : props.state === 'guess'
          ? t('guess', { color, number: props.number ?? 0 })
        : t('solved', { number: props.number ?? 0, color, points: props.points ?? 0 });

  return <Tile {...props} label={label} />;
}
