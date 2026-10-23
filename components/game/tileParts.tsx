// Piezas compartidas por TileCompact y TileDetailed. Lienzo de la ficha: 80 × 100.
//
// Técnica de DESIGN.md: cada forma de color lleva detrás la misma forma ligeramente mayor en
// --piedra-hueco, que simula el corte tallado en la piedra.

export const TILE_W = 80;
export const TILE_H = 100;
export const UNKNOWN_MARK = '?';

const HUECO = 'var(--color-piedra-hueco)';

export const TILE_FILL = [
  'var(--color-ficha-0)',
  'var(--color-ficha-1)',
  'var(--color-ficha-2)',
  'var(--color-ficha-3)',
  'var(--color-ficha-4)',
];

// Sobre grafito el verde no se distingue: en las fichas sin resolver se usa un verde más claro.
export const TILE_FILL_UNKNOWN = [...TILE_FILL.slice(0, 4), 'var(--color-ficha-4-sin-resolver)'];

// Tintas de DESIGN.md: grafito sobre amarillo y rosa; crema sobre rojo, azul y verde.
export const TILE_INK = [
  'var(--color-grafito)',
  'var(--color-grafito)',
  'var(--color-crema)',
  'var(--color-crema)',
  'var(--color-crema)',
];

// Un glifo geométrico por color (P6: el color nunca es el único portador de información).
// Referencia andina: escalonado, concéntrico y ortogonal. Caja de 12 × 12.
export const GLYPHS = [
  'M0 12V9H3V6H6V3H9V0H12V12Z', //                                   0 amarillo · escalera
  'M0 0H12V12H0Z M2 2V10H10V2Z M4 4H8V8H4Z', //                      1 rosa · cuadrados concéntricos
  'M4 0H8V2H10V4H12V8H10V10H8V12H4V10H2V8H0V4H2V2H4Z', //            2 rojo · cruz escalonada
  'M0 12V8H3V4H6V8H9V4H12V12Z', //                                   3 azul · almenas
  'M5 0H7V2H9V4H11V8H9V10H7V12H5V10H3V8H1V4H3V2H5Z', //              4 verde · rombo escalonado
];

export function CarvedRect({
  x, y, w, h, r = 0, fill, grow = 1.2,
}: { x: number; y: number; w: number; h: number; r?: number; fill: string; grow?: number }) {
  return (
    <>
      <rect x={x - grow} y={y - grow} width={w + 2 * grow} height={h + 2 * grow} rx={r + grow} fill={HUECO} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} />
    </>
  );
}

export function CarvedGlyph({
  colorIndex, cx, cy, size, fill,
}: { colorIndex: number; cx: number; cy: number; size: number; fill: string }) {
  const s = size / 12;
  const d = GLYPHS[colorIndex];
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}>
      <path d={d} fill={HUECO} stroke={HUECO} strokeWidth={1.4 / s} strokeLinejoin="miter" fillRule="evenodd" />
      <path d={d} fill={fill} fillRule="evenodd" />
    </g>
  );
}

/** Puntos de la ficha: 1, 2 o 3 círculos centrados. */
export function PointDots({ points, cx, cy, ink }: { points: number; cx: number; cy: number; ink: string }) {
  const gap = 9;
  const start = cx - ((points - 1) * gap) / 2;
  return (
    <>
      {Array.from({ length: points }, (_, i) => (
        <circle key={i} cx={start + i * gap} cy={cy} r={3} fill={ink} />
      ))}
    </>
  );
}

/** Reverso: cuadros concéntricos en el color de la ficha, con su glifo en el centro. */
export function BackPattern({
  colorIndex, x, y, w, h, fill,
}: { colorIndex: number; x: number; y: number; w: number; h: number; fill: string }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const inset = 3 + i * 7;
        return (
          <rect
            key={i}
            x={x + inset}
            y={y + inset * (h / w)}
            width={w - 2 * inset}
            height={h - 2 * inset * (h / w)}
            rx={3}
            fill="none"
            stroke={fill}
            strokeWidth={2.4}
          />
        );
      })}
      <CarvedGlyph colorIndex={colorIndex} cx={cx} cy={cy} size={22} fill={fill} />
    </>
  );
}

export interface TileProps {
  /** Número de la ficha; null si no se conoce. */
  number: number | null;
  colorIndex: number;
  /** Puntos de la ficha; null si no se conocen. */
  points: number | null;
  /**
   * solved: tuya, ya resuelta · public: visible para todos · unknown: ficha tuya sin resolver ·
   * back: boca abajo.
   */
  state: 'solved' | 'public' | 'unknown' | 'back';
  /** Ancho en px. Alto = ancho × 1,25. */
  size: number;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  label: string;
}
