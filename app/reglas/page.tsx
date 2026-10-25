import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

// Reglas: pública (sin sesión), estática y disponible sin conexión (la guarda el service worker).
// Fuente normativa: specs/001-mvp/spec.md §4. El texto es propio (P7).

export const dynamic = 'force-static';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ReglasPage() {
  const t = await getTranslations('rules');

  return (
    <main className="flex flex-col gap-7 px-4 py-8 leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-lg">{t('intro')}</p>
      </header>

      <Section title={t('setupTitle')}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t('setup1')}</li>
          <li>{t('setup2')}</li>
          <li>{t('setup3')}</li>
        </ul>
      </Section>

      <Section title={t('turnTitle')}>
        <p>{t('turnIntro')}</p>
        <h3 className="font-semibold">{t('turn1Title')}</h3>
        <p>{t('turn1')}</p>
        <h3 className="font-semibold">{t('turn2Title')}</h3>
        <p>{t('turn2')}</p>
        <dl className="flex flex-col gap-2 rounded-2xl bg-espacio-claro p-3 ring-1 ring-espacio-borde">
          <dt className="font-semibold">{t('classifyTitle')}</dt>
          <dd>{t('classify')}</dd>
          <dt className="font-semibold">{t('compareTitle')}</dt>
          <dd>{t('compare')}</dd>
        </dl>
        <p>{t('turn3')}</p>
      </Section>

      <Section title={t('declareTitle')}>
        <p>{t('declare1')}</p>
        <p>{t('declare2')}</p>
      </Section>

      <Section title={t('endTitle')}>
        <p>{t('end1')}</p>
        <p>{t('end2')}</p>
      </Section>

      <Section title={t('timeTitle')}>
        <p>{t('time1')}</p>
        <p>{t('time2')}</p>
      </Section>

      <Section title={t('modesTitle')}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t('modePractice')}</li>
          <li>{t('modeRoom')}</li>
          <li>{t('modeRanked')}</li>
        </ul>
      </Section>

      <Section title={t('tipTitle')}>
        <p>{t('tip')}</p>
      </Section>

      <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-espacio-claro px-5 font-semibold ring-1 ring-espacio-borde">
        {t('backHome')}
      </Link>
    </main>
  );
}
