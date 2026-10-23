import { TileCompact } from './TileCompact';
import { TileDetailed } from './TileDetailed';
import { TILE_H, TILE_W, type TileProps } from './tileParts';

// Por debajo de este ancho (px) se usa el dibujo simplificado.
const DETAILED_FROM = 100;

/**
 * Ficha del juego. Mismo contrato para las dos variantes; `size` elige el dibujo.
 * Con onPress es un botón (objetivo táctil ≥ 44 px); si no, una imagen con su etiqueta.
 */
export function Tile({ size, selected = false, disabled = false, onPress, label, ...face }: TileProps) {
  const Face = size >= DETAILED_FROM ? TileDetailed : TileCompact;
  const height = Math.round((size * TILE_H) / TILE_W);
  const ring = selected
    ? 'outline-3 outline-offset-2 outline-lila'
    : 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lila';
  const box = { width: size, height, minWidth: 44, minHeight: 44 };

  if (!onPress) {
    return (
      <span role="img" aria-label={label} style={box} className={`inline-block shrink-0 rounded-[11%] ${selected ? ring : ''}`}>
        <Face {...face} />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      style={box}
      className={`inline-block shrink-0 rounded-[11%] disabled:cursor-not-allowed disabled:opacity-60 ${ring}`}
    >
      <Face {...face} />
    </button>
  );
}
