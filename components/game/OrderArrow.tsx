import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const MINUS = '−';
const PLUS = '+';

const LEFT = 'polygon(100% 0, 0 50%, 100% 100%)';
const RIGHT = 'polygon(0 0, 100% 50%, 0 100%)';

/**
 * Flecha rellena de dos puntas dibujada por detrás de una fila de fichas y asomando por los dos
 * lados: − a la izquierda, + a la derecha. Lee el orden del soporte, de menor a mayor.
 * No ocupa sitio: la fila conserva su ancho y las pistas de debajo siguen alineadas.
 */
export function OrderArrow({ children }: { children: ReactNode }) {
  const t = useTranslations('game');

  return (
    <div className="relative" role="group" aria-label={t('orderHint')}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -inset-x-5 flex items-center text-crema-suave/80">
        <span className="flex h-9 w-5 shrink-0 items-center justify-end bg-current pr-0.5 text-base font-extrabold leading-none" style={{ clipPath: LEFT }}>
          <span className="text-grafito">{MINUS}</span>
        </span>
        <span className="h-3 flex-1 bg-current" />
        <span className="flex h-9 w-5 shrink-0 items-center justify-start bg-current pl-0.5 text-base font-extrabold leading-none" style={{ clipPath: RIGHT }}>
          <span className="text-grafito">{PLUS}</span>
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
