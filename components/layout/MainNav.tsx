'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const ICON = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const ITEMS: {
  href: string;
  key: 'play' | 'ranking' | 'rules' | 'profile';
  icon: ReactNode;
}[] = [
  { href: '/', key: 'play', icon: <path d="M8 5v14l11-7z" /> },
  {
    href: '/clasificacion',
    key: 'ranking',
    icon: (
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
    ),
  },
  {
    href: '/reglas',
    key: 'rules',
    icon: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M9 8h6" />,
  },
  {
    href: '/perfil',
    key: 'profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
];

// Pantallas de juego: sin menú para no salir por accidente y dejar espacio al tablero.
const HIDDEN_ON = ['/partida', '/cola', '/sala'];

export function MainNav({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return <>{children}</>;

  return (
    <>
      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-espacio-borde bg-espacio-claro pb-[env(safe-area-inset-bottom)] "
      >
        <ul className="mx-auto flex max-w-[430px] justify-around">
          {ITEMS.map(({ href, key, icon }) => {
            const active =
              href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-acento ${
                    active ? 'text-acento' : 'text-crema-suave hover:text-crema'
                  }`}
                >
                  <svg {...ICON}>{icon}</svg>
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </>
  );
}
