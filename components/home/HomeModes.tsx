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
      panel: <RoomOptions />,
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
                className="flex min-h-14 w-full items-center rounded-3xl px-5 font-display text-2xl font-extrabold focus-visible:outline-2 focus-visible:outline-acento aria-expanded:text-acento"
              >
                {label}
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

/** Sala privada: primero eliges crear una o unirte con código, y entonces salen sus opciones. */
function RoomOptions() {
  const tCreate = useTranslations('createRoom');
  const tJoin = useTranslations('joinRoom');
  const [choice, setChoice] = useState<'create' | 'join' | null>(null);
  const id = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {(['create', 'join'] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-expanded={choice === c}
            aria-controls={`${id}-room`}
            onClick={() => setChoice(choice === c ? null : c)}
            className="min-h-11 rounded-xl px-2 text-sm font-semibold ring-1 ring-espacio-borde aria-expanded:bg-acento aria-expanded:text-grafito aria-expanded:ring-0 focus-visible:outline-2 focus-visible:outline-acento"
          >
            {c === 'create' ? tCreate('create') : tJoin('title')}
          </button>
        ))}
      </div>
      {choice ? (
        <div id={`${id}-room`} key={choice} className="motion-safe:animate-[panel-in_220ms_ease-out]">
          {choice === 'create' ? <CreateRoomForm /> : <JoinRoomForm />}
        </div>
      ) : null}
    </div>
  );
}
