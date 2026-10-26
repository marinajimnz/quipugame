// Ficha del juego, dibujada en SVG por código (nunca con imágenes generadas: los números tienen
// que ser nítidos a 44 px). Lienzo 100 × 108: cara cuadrada de 100 y un canto de 8 que asoma debajo.

import { SYMBOLS } from './tileColors';

export { SYMBOLS };
export const TILE_W = 100;
export const TILE_H = 108;

const FACE = 100;
const RADIUS = 22; // 22 % del lado
const CANTO = 8;
// Por debajo de este ancho (px) se oculta el símbolo de la esquina: solo número y barras.
const SYMBOL_FROM = 56;

const FILL = ['var(--ficha-0)', 'var(--ficha-1)', 'var(--ficha-2)', 'var(--ficha-3)', 'var(--ficha-4)'];
const EDGE = ['var(--ficha-0-canto)', 'var(--ficha-1-canto)', 'var(--ficha-2-canto)', 'var(--ficha-3-canto)', 'var(--ficha-4-canto)'];
const INK = ['var(--grafito)', 'var(--grafito)', 'var(--crema)', 'var(--crema)', 'var(--crema)'];

export interface TileProps {
  /** Número de la ficha; null si no se conoce. */
  number: number | null;
  colorIndex: number;
  /** Barras llenas de la ficha (1–3); null si no se conocen. */
  points: number | null;
  /**
   * solved: tuya, ya resuelta · public: visible para todos · unknown: ficha tuya sin resolver ·
   * guess: tuya sin resolver, con el número que tú crees (number) · back: boca abajo (reserva).
   */
  state: 'solved' | 'public' | 'unknown' | 'guess' | 'back';
  /** Ancho en px. Alto = ancho × 1,08. */
  size: number;
  selected?: boolean;
  /** Anima el número con un "pop" (acaba de declararse). */
  pop?: boolean;
  /** Señala que es lo que toca pulsar ahora: borde que late. */
  hint?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  label: string;
}

function Glyph({ index, cx, cy, r, fill }: { index: number; cx: number; cy: number; r: number; fill: string }) {
  return <path d={SYMBOLS[index]} transform={`translate(${cx} ${cy}) scale(${r})`} fill={fill} />;
}

function Padlock() {
  return (
    <g>
      <path d="M41 51V44A9 9 0 0 1 59 44V51" fill="none" stroke="var(--crema)" strokeWidth={5.5} strokeLinecap="round" />
      <rect x={33} y={50} width={34} height={25} rx={7} fill="var(--crema)" />
      <circle cx={50} cy={60} r={3.6} fill="var(--grafito)" />
      <rect x={48.4} y={60} width={3.2} height={8} rx={1.6} fill="var(--grafito)" />
    </g>
  );
}

/** Barras de la ficha: tres segmentos; se rellenan tantos como barras tenga la ficha (su «puntuación»). */
function PointBar({ points, ink, outlined }: { points: number | null; ink: string; outlined: boolean }) {
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const x = 15 + i * 24.5;
        const on = !outlined && points != null && i < points;
        return outlined ? (
          <rect key={i} x={x + 0.8} y={80.8} width={21.4} height={8.4} rx={4.2} fill="none" stroke="var(--crema)" strokeOpacity={0.75} strokeWidth={1.6} />
        ) : (
          <rect key={i} x={x} y={80} width={22} height={10} rx={5} fill={ink} fillOpacity={on ? 1 : 0.25} />
        );
      })}
    </g>
  );
}

function Face({ number, colorIndex, points, state, size, pop }: Pick<TileProps, 'number' | 'colorIndex' | 'points' | 'state' | 'size' | 'pop'>) {
  const guess = state === 'guess';
  const animated = guess || pop;
  // Una ficha apuntada sigue siendo tuya y sin resolver: se pinta apagada, con el número en lugar del candado.
  const unknown = state === 'unknown' || guess;
  const back = state === 'back';
  const fill = FILL[colorIndex];
  const ink = INK[colorIndex];
  const dim = unknown ? 0.4 : 1;
  const showSymbol = size >= SYMBOL_FROM;

  return (
    <svg viewBox={`0 0 ${TILE_W} ${TILE_H}`} width="100%" height="100%" aria-hidden="true" focusable="false">
      {/* Base opaca bajo las fichas apagadas: lo que haya detrás (la flecha del orden) no se transparenta. */}
      {unknown ? (
        <>
          <rect y={CANTO} width={FACE} height={FACE} rx={RADIUS} fill="var(--espacio-claro)" />
          <rect width={FACE} height={FACE} rx={RADIUS} fill="var(--espacio-claro)" />
        </>
      ) : null}
      <rect y={CANTO} width={FACE} height={FACE} rx={RADIUS} fill={EDGE[colorIndex]} fillOpacity={dim} />
      <rect width={FACE} height={FACE} rx={RADIUS} fill={fill} fillOpacity={dim} />

      {back ? (
        <Glyph index={colorIndex} cx={50} cy={50} r={25} fill={ink} />
      ) : (
        <>
          {showSymbol ? <Glyph index={colorIndex} cx={21} cy={21} r={7.5} fill={unknown ? fill : ink} /> : null}
          {unknown && !guess ? (
            <Padlock />
          ) : (
            <text
              key={animated ? number : undefined}
              className={animated ? 'tile-guess-in' : undefined}
              x={50} y={showSymbol ? 69 : 64} textAnchor="middle" fill={guess ? 'var(--crema)' : ink}
              style={{ font: `800 ${showSymbol ? 42 : 50}px var(--font-bricolage), sans-serif`, fontVariantNumeric: 'tabular-nums' }}
            >
              {number}
            </text>
          )}
          <PointBar points={points} ink={ink} outlined={unknown} />
        </>
      )}
    </svg>
  );
}

/**
 * Ficha del juego. Un solo dibujo que escala con `size`.
 * Con onPress es un botón (objetivo táctil ≥ 44 px); si no, una imagen con su etiqueta.
 */
export function Tile({ size, selected = false, hint = false, disabled = false, onPress, label, ...face }: TileProps) {
  const height = Math.round((size * TILE_H) / TILE_W);
  // El mínimo de 44 px es por el objetivo táctil: una ficha que no se pulsa puede ser más pequeña.
  const box = onPress ? { width: size, height, minWidth: 44, minHeight: 44 } : { width: size, height };
  const ring = selected
    ? 'outline-3 outline-offset-2 outline-[var(--acento)]'
    : hint
      ? 'outline-2 outline-offset-2 outline-dashed outline-[var(--acento)] motion-safe:animate-pulse focus-visible:outline-3 focus-visible:outline-solid'
      : 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]';

  if (!onPress) {
    return (
      <span role="img" aria-label={label} style={box} className={`inline-block shrink-0 rounded-[22%] ${selected ? ring : ''}`}>
        <Face {...face} size={size} />
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
      className={`inline-block shrink-0 rounded-[22%] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${ring}`}
    >
      <Face {...face} size={size} />
    </button>
  );
}
