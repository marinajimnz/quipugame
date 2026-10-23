import {
  BackPattern, CarvedGlyph, CarvedRect, PointDots, TILE_FILL, TILE_FILL_UNKNOWN, TILE_H, TILE_INK, TILE_W,
  UNKNOWN_MARK, type TileProps,
} from './tileParts';

/** Ficha simplificada para 44–99 px: cuatro esquinas, glifo, panel central, número y puntos. */
export function TileCompact({ number, colorIndex, points, state }: Pick<TileProps, 'number' | 'colorIndex' | 'points' | 'state'>) {
  const unknown = state === 'unknown';
  const fill = unknown || state === 'back' ? TILE_FILL_UNKNOWN[colorIndex] : TILE_FILL[colorIndex];
  const ink = TILE_INK[colorIndex];
  const panel = { x: 12, y: 22, w: 56, h: 60 };

  return (
    <svg viewBox={`0 0 ${TILE_W} ${TILE_H}`} width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect width={TILE_W} height={TILE_H} rx={9} fill="var(--color-grafito)" stroke="var(--color-piedra-hueco)" strokeWidth={1} />

      {[[5, 5], [68, 5], [5, 88], [68, 88]].map(([x, y]) => (
        <CarvedRect key={`${x}-${y}`} x={x} y={y} w={7} h={7} r={1.5} fill={fill} />
      ))}
      <CarvedGlyph colorIndex={colorIndex} cx={40} cy={12.5} size={14} fill={fill} />

      {state === 'back' ? (
        <BackPattern colorIndex={colorIndex} {...panel} fill={fill} />
      ) : unknown ? (
        <>
          <rect {...panel} rx={6} fill="none" stroke={fill} strokeWidth={2.4} strokeDasharray="5 4" />
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
