import { useTranslations } from 'next-intl';
import { WORDMARK_DOTS, WORDMARK_H, WORDMARK_PATH, WORDMARK_W } from './wordmarkData';

// Capas de extrusión, de la más lejana a la más cercana, cada una 3 px más abajo y a la derecha.
const LAYERS = ['var(--ficha-4)', 'var(--ficha-2)', 'var(--ficha-0)', 'var(--ficha-1)'];
const STEP = 3;
const EXTRA = LAYERS.length * STEP;

/**
 * Logotipo: rótulo grueso con extrusión de color en capas y una fila de puntos dentro de cada letra.
 * El texto está convertido a trazados (scripts/build_wordmark.py): no depende de ninguna fuente.
 * `size` es el ancho en px.
 */
export function Wordmark({ size = 240, showTagline = false }: { size?: number; showTagline?: boolean }) {
  const t = useTranslations('app');
  const w = WORDMARK_W + EXTRA;
  const h = WORDMARK_H + EXTRA;

  return (
    <div style={{ width: size }} className="inline-flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={t('name')}>
        {LAYERS.map((color, i) => {
          const d = (LAYERS.length - i) * STEP;
          return <path key={color} d={WORDMARK_PATH} transform={`translate(${d} ${d})`} fill={color} />;
        })}
        <path d={WORDMARK_PATH} fill="var(--crema)" />
        {WORDMARK_DOTS.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="var(--acento)" />
        ))}
      </svg>
      {showTagline ? (
        <p
          className="font-semibold uppercase text-[var(--crema)]"
          style={{ fontFamily: 'var(--font-inter), sans-serif', letterSpacing: '0.3em', fontSize: Math.max(10, size / 22), marginRight: '-0.3em' }}
        >
          {t('descriptor')}
        </p>
      ) : null}
    </div>
  );
}
