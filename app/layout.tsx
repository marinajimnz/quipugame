import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Fondo } from '@/components/layout/Fondo';
import { ServiceWorker } from '@/components/pwa/ServiceWorker';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: '800',
  variable: '--font-bricolage',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: t('name'),
    description: t('tagline'),
    appleWebApp: { capable: true, title: t('name'), statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2a1b47',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-espacio text-crema antialiased">
        <NextIntlClientProvider>
          {/* Móvil primero: 390 px de diseño; en escritorio es la misma pantalla centrada. */}
          <Fondo>
            <div className="mx-auto min-h-dvh w-full max-w-[430px]">{children}</div>
          </Fondo>
        </NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
