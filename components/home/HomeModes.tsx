'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';
import { PracticeForm } from './PracticeForm';
import { CreateRoomForm, JoinRoomForm } from './RoomForms';

type Mode = 'practice' | 'ranked' | 'room';

/**
 * Los tres modos de juego como botones. Al pulsar uno se despliegan sus opciones justo debajo
 * (solo uno abierto a la vez); volver a pulsarlo lo cierra.
 */
export function HomeModes({ ranked, defaultOpen = null }: { ranked: ReactNode; defaultOpen?: Mode | null }) {
  const tPractice = useTranslations('practice');
  const tRanked = useTranslations('ranked');
  const tRoom = useTranslations('createRoom');
  const [open, setOpen] = useState<Mode | null>(defaultOpen);
  const id = useId();

  const modes: { key: Mode; label: string; panel: ReactNode }[] = [
    { key: 'practice', label: tPractice('title'), panel: <PracticeForm /> },
    { key: 'ranked', label: tRanked('title'), panel: ranked },
    {
      key: 'room',
      label: tRoom('title'),
      panel: (
        <div className="flex flex-col gap-5">
          <CreateRoomForm />
          <JoinRoomForm />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {modes.map(({ key, label, panel }) => {
        const expanded = open === key;
        return (
          <section key={key} className="rounded-3xl bg-espacio-claro shadow-sm ring-1 ring-espacio-borde">
            <h2>
              <button
                type="button"
                id={`${id}-${key}-button`}
                aria-expanded={expanded}
                aria-controls={`${id}-${key}-panel`}
                onClick={() => setOpen(expanded ? null : key)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-3xl px-5 font-display text-2xl font-extrabold focus-visible:outline-2 focus-visible:outline-acento aria-expanded:text-acento"
              >
                {label}
                <svg
                  width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
                  className={`shrink-0 motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </h2>
            {/* Cuando está cerrado no se pinta (ni se enfoca); al abrir entra con un fundido. */}
            {expanded ? (
              <div
                id={`${id}-${key}-panel`}
                role="region"
                aria-labelledby={`${id}-${key}-button`}
                className="px-5 pb-5 motion-safe:animate-[panel-in_220ms_ease-out]"
              >
                {panel}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
