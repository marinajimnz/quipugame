import type { CSSProperties, ReactNode } from 'react';

/**
 * Fondo recoloreable en capas. El color vive en `--tinte`; los patrones son siempre los mismos
 * archivos (formas en blanco o negro sobre transparente) y se pintan encima con poca opacidad:
 * cambiar de pantalla es cambiar `tinte`. Los archivos salen de scripts/build_patterns.py.
 *
 *   tinte      color base (cualquier color CSS)
 *   plano      sin patrones ni grano: solo el color
 *   grano      'fondo' (por defecto): granulado detrás del contenido · 'todo': también sobre fichas y
 *              botones, como en las ilustraciones de referencia · false: sin grano
 */
export function Fondo({
  tinte = 'var(--espacio)',
  plano = false,
  grano = 'fondo',
  children,
  className = '',
}: {
  tinte?: string;
  plano?: boolean;
  grano?: 'fondo' | 'todo' | false;
  children?: ReactNode;
  className?: string;
}) {
  const style = { '--tinte': tinte, backgroundColor: 'var(--tinte)' } as CSSProperties;
  const capa = 'pointer-events-none absolute inset-0';
  const granoCapa = (
    <div
      aria-hidden="true"
      className={`${capa} opacity-[0.45] mix-blend-overlay`}
      style={{ backgroundImage: "url('/patterns/grano.png')", backgroundSize: '256px 256px' }}
    />
  );

  return (
    <div className={`relative isolate min-h-dvh transition-[background-color] duration-700 ${className}`} style={style}>
      {plano ? null : (
        <>
          {/* Bandas del mismo tono, más oscuras */}
          <div
            aria-hidden="true"
            className={`${capa} opacity-[0.2]`}
            style={{ backgroundImage: "url('/patterns/ondas.png')", backgroundSize: '1024px 1024px' }}
          />
          {/* Estrellas redondeadas y puntos */}
          <div
            aria-hidden="true"
            className={`${capa} opacity-[0.22]`}
            style={{ backgroundImage: "url('/patterns/estrellas.png')", backgroundSize: '512px 512px' }}
          />
          {grano === 'fondo' ? granoCapa : null}
        </>
      )}
      <div className="relative">{children}</div>
      {!plano && grano === 'todo' ? granoCapa : null}
    </div>
  );
}
