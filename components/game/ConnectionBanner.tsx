'use client';

import { useTranslations } from 'next-intl';

/** Aviso de conexión perdida. La app reintenta sola; al volver la red recupera el estado actual. */
export function ConnectionBanner() {
  const t = useTranslations('game');
  return (
    <p
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[430px] bg-grafito px-4 py-2 text-center text-sm font-semibold text-crema"
    >
      {t('connectionLost')}
    </p>
  );
}
