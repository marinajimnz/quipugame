import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations();

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-10">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{t('app.name')}</h1>
      <p className="text-lg leading-snug">{t('app.tagline')}</p>
      <p className="rounded-2xl bg-blanco p-4 text-sm shadow-sm ring-1 ring-grafito/10">
        {t('home.underConstruction')}
      </p>
    </main>
  );
}
