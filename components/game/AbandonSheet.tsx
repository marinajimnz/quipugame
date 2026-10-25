'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

/** Botón de abandonar con confirmación: abandonar cuenta como derrota. */
export function AbandonSheet({ onAbandon }: { onAbandon: () => Promise<void> }) {
  const t = useTranslations('game');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 self-center rounded-xl px-4 text-sm font-semibold underline focus-visible:outline-2 focus-visible:outline-acento"
      >
        {t('abandon')}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('abandonTitle')}>
        <div className="flex flex-col gap-3">
          <p>{t('abandonBody')}</p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onAbandon();
              setBusy(false);
              setOpen(false);
            }}
          >
            {t('abandonConfirm')}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t('abandonKeep')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
