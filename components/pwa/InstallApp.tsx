'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

type InstallPrompt = Event & { prompt: () => Promise<void> };

/**
 * Instalar como app. Android/Chrome: botón que lanza el aviso del navegador.
 * iPhone (Safari no tiene aviso): indicación de Compartir → Añadir a pantalla de inicio.
 * Si ya está instalada (modo standalone) no se muestra nada.
 */
export function InstallApp() {
  const t = useTranslations('install');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const ios = useSyncExternalStore(
    () => () => undefined,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone(),
    () => false,
  );

  useEffect(() => {
    if (isStandalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (prompt) {
    return (
      <Button
        variant="secondary"
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
      >
        {t('button')}
      </Button>
    );
  }
  return ios ? (
    <p className="text-center text-sm text-crema-suave">{t('iosHint')}</p>
  ) : null;
}
