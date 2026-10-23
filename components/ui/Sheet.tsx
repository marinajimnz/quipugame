'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

/** Hoja inferior sobre <dialog> nativo: foco atrapado, Esc cierra y la parte oscura también. */
export function Sheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTranslations('common');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-crema p-4 text-grafito backdrop:bg-grafito/50 sm:mx-auto"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl px-3 text-sm font-semibold ring-1 ring-grafito/20 focus-visible:outline-2 focus-visible:outline-lila"
        >
          {t('close')}
        </button>
      </div>
      {children}
    </dialog>
  );
}
