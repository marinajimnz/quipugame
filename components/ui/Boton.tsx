import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variante = 'principal' | 'confirmar' | 'neutro';

// Cara, tinta y canto. El canto es la misma cara un 25 % más oscura, como en la ficha.
const VARIANTES: Record<Variante, { cara: string; tinta: string }> = {
  principal: { cara: 'var(--acento)', tinta: 'var(--grafito)' },
  confirmar: { cara: 'var(--lima)', tinta: 'var(--grafito)' },
  neutro: { cara: 'var(--espacio-borde)', tinta: 'var(--crema)' },
};

/**
 * Botón con la anatomía de la ficha: esquinas muy redondeadas y canto inferior.
 * Al pulsar, la cara baja 2 px y el canto se encoge.
 */
export function Boton({
  variante = 'principal',
  className = '',
  type = 'button',
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const v = VARIANTES[variante];
  const vars = { '--cara': v.cara, '--canto': 'color-mix(in oklab, var(--cara) 75%, black)', color: v.tinta, ...style } as CSSProperties;

  return (
    <button
      type={type}
      style={vars}
      className={
        'inline-flex min-h-12 w-full items-center justify-center rounded-[22px] bg-[var(--cara)] px-6 text-lg font-extrabold ' +
        'shadow-[0_6px_0_var(--canto)] transition-[transform,box-shadow] duration-100 ' +
        'active:translate-y-0.5 active:shadow-[0_3px_0_var(--canto)] ' +
        'focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--crema)] ' +
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 disabled:active:shadow-[0_6px_0_var(--canto)] ' +
        `font-[family-name:var(--font-bricolage)] ${className}`
      }
      {...props}
    />
  );
}
