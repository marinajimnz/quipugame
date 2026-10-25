import type { MetadataRoute } from 'next';

// T080: instalable como app. Colores de DESIGN.md (espacio de fondo).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quipu',
    short_name: 'Quipu',
    description: 'Deduce tus propios números antes que nadie.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2a1b47',
    theme_color: '#2a1b47',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
