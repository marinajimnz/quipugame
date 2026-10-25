import type { HTMLAttributes } from 'react';

/** Tarjeta sobre --espacio-claro con borde y sombra sólida, sin degradado. */
export function Panel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[28px] border-2 border-[var(--espacio-borde)] bg-[var(--espacio-claro)] p-4 text-[var(--crema)] shadow-[0_6px_0_var(--grafito)] ${className}`}
      {...props}
    />
  );
}
