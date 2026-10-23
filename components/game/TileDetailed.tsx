import {
  BackPattern, CarvedGlyph, CarvedRect, PointDots, TILE_FILL, TILE_FILL_UNKNOWN, TILE_H, TILE_INK, TILE_W,
  UNKNOWN_MARK, type TileProps,
} from './tileParts';

/**
 * Ficha ornamentada para ≥ 100 px: añade barras paralelas en los márgenes, marco y grano de
 * piedra. No es un scale() de TileCompact: por debajo de unos 100 px estos detalles no se leen.
 */
export function TileDetailed({ number, colorIndex, points, state }: Pick<TileProps, 'number' | 'colorIndex' | 'points' | 'state'>) {
  const unknown = state === 'unknown';
  const fill = unknown || state === 'back' ? TILE_FILL_UNKNOWN[colorIndex] : TILE_FILL[colorIndex];
  const ink = TILE_INK[colorIndex];
  const panel = { x: 13, y: 22, w: 54, h: 60 };
  const grain = `grain-${colorIndex}`;

  return (
    <svg viewBox={`0 0 ${TILE_W} ${TILE_H}`} width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={colorIndex + 3} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0" result="g" />
          <feComposite in="g" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>

      <rect width={TILE_W} height={TILE_H} rx={9} fill="var(--color-grafito)" />
      <rect width={TILE_W} height={TILE_H} rx={9} filter={`url(#${grain})`} />
      <rect x={0.5} y={0.5} width={TILE_W - 1} height={TILE_H - 1} rx={8.5} fill="none" stroke="var(--color-piedra-hueco)" />

      {/* Esquinas */}
      {[[4, 4], [69, 4], [4, 89], [69, 89]].map(([x, y]) => (
        <CarvedRect key={`${x}-${y}`} x={x} y={y} w={7} h={7} r={1.5} fill={fill} />
      ))}

      {/* Barras paralelas en los cuatro márgenes */}
      {[15, 17.6].map((x) => (
        <g key={`h${x}`}>
          <CarvedRect x={x} y={4.6} w={13} h={1.4} fill={fill} grow={0.8} />
          <CarvedRect x={x + 36} y={4.6} w={13} h={1.4} fill={fill} grow={0.8} />
          <CarvedRect x={x} y={94} w={13} h={1.4} fill={fill} grow={0.8} />
          <CarvedRect x={x + 36} y={94} w={13} h={1.4} fill={fill} grow={0.8} />
        </g>
      ))}
      {[4.6, 7.2].map((x) => (
        <g key={`v${x}`}>
          <CarvedRect x={x} y={16} w={1.4} h={13} fill={fill} grow={0.8} />
          <CarvedRect x={x} y={71} w={1.4} h={13} fill={fill} grow={0.8} />
          <CarvedRect x={x + 66.6} y={16} w={1.4} h={13} fill={fill} grow={0.8} />
          <CarvedRect x={x + 66.6} y={71} w={1.4} h={13} fill={fill} grow={0.8} />
        </g>
      ))}

      <CarvedGlyph colorIndex={colorIndex} cx={40} cy={12} size={15} fill={fill} />

      {/* Marco */}
      <rect x={10} y={19} width={60} height={66} rx={8} fill="none" stroke="var(--color-piedra-hueco)" strokeWidth={3.2} />
      <rect x={10} y={19} width={60} height={66} rx={8} fill="none" stroke={fill} strokeWidth={1.4} />

      {state === 'back' ? (
        <BackPattern colorIndex={colorIndex} {...panel} fill={fill} />
      ) : unknown ? (
        <>
          <rect {...panel} rx={6} fill="none" stroke={fill} strokeWidth={2.2} strokeDasharray="5 4" />
          <CarvedGlyph colorIndex={colorIndex} cx={40} cy={45} size={24} fill={fill} />
          <text x={40} y={74} textAnchor="middle" fill={fill} style={{ font: '800 20px var(--font-bricolage), sans-serif' }}>
            {UNKNOWN_MARK}
          </text>
        </>
      ) : (
        <>
          <CarvedRect {...panel} r={6} fill={fill} />
          <text
            x={40} y={58} textAnchor="middle" fill={ink}
            style={{ font: '800 32px var(--font-bricolage), sans-serif', fontVariantNumeric: 'tabular-nums' }}
          >
            {number}
          </text>
          {points ? <PointDots points={points} cx={40} cy={72} ink={ink} /> : null}
        </>
      )}
    </svg>
  );
}
