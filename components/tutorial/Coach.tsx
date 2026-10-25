'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { STEP_COUNT } from '@/lib/tutorial/script';

const SMALL_BUTTON =
  'min-h-11 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-40';
export const COACH_PRIMARY = `${SMALL_BUTTON} bg-acento text-grafito`;
export const COACH_SECONDARY = `${SMALL_BUTTON} ring-1 ring-espacio-borde`;

/**
 * Globo del tutorial: en qué paso vas, qué está pasando y qué toca hacer. Al aparecer se desplaza
 * hasta quedar a la vista (dentro de una hoja, puede haberse quedado arriba).
 */
export function Coach({
  step, title, children, actions,
}: { step: number; title: string; children: ReactNode; actions?: ReactNode }) {
  const t = useTranslations('tutorial');
  const id = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-2 rounded-3xl bg-espacio-claro p-4 shadow-[0_6px_0_var(--grafito)] ring-2 ring-acento"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-crema-suave">{t('progress', { step, total: STEP_COUNT })}</p>
        <ol aria-hidden="true" className="flex gap-1">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <li key={i} className={`h-2 w-2 rounded-full ${i < step ? 'bg-acento' : 'bg-espacio-borde'}`} />
          ))}
        </ol>
      </div>
      <h2 id={`${id}-title`} className="font-display text-xl font-extrabold">{title}</h2>
      <div aria-live="polite" className="text-sm leading-relaxed">{children}</div>
      {actions ? <div className="mt-1 flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </section>
  );
}

/**
 * Zona de la pantalla que el tutorial puede resaltar (anillo amarillo) o apagar (atenuada), para
 * que se vea qué toca mirar. La primera zona resaltada (lead) se desplaza hasta quedar a la vista.
 */
export function Spot({ on, dim, lead, children }: { on: boolean; dim: boolean; lead: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [lead]);

  return (
    <div
      ref={ref}
      className={`scroll-mt-80 scroll-mb-72 rounded-2xl motion-safe:transition-opacity motion-safe:duration-300 ${
        on ? 'ring-2 ring-acento ring-offset-4 ring-offset-espacio' : ''
      } ${dim ? 'opacity-40' : ''}`}
    >
      {children}
    </div>
  );
}
