'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { markTutorial, useTutorialSeen } from '@/lib/tutorial/seen';

/** Tarjeta para quien entra por primera vez: ofrece el tutorial. Desaparece al hacerlo o descartarlo. */
export function TutorialPrompt() {
  const t = useTranslations('tutorial.prompt');
  const router = useRouter();
  const seen = useTutorialSeen();

  if (seen !== null) return null;

  return (
    <section aria-labelledby="tutorial-prompt" className="flex flex-col gap-3 rounded-3xl bg-espacio-claro p-5 ring-2 ring-acento">
      <h2 id="tutorial-prompt" className="font-display text-2xl font-extrabold">{t('title')}</h2>
      <p className="leading-snug">{t('body')}</p>
      <Button onClick={() => router.push('/tutorial')}>{t('start')}</Button>
      <button
        type="button"
        onClick={() => markTutorial('dismissed')}
        className="min-h-11 self-center rounded-xl px-4 text-sm font-semibold text-crema-suave focus-visible:outline-2 focus-visible:outline-acento"
      >
        {t('dismiss')}
      </button>
    </section>
  );
}
