import type { ButtonHTMLAttributes } from 'react';
import { Boton } from './Boton';

type Variant = 'primary' | 'secondary';

/** Botón de las pantallas: envuelve a Boton (cara + canto) con las dos variantes de siempre. */
export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <Boton variante={variant === 'primary' ? 'principal' : 'neutro'} {...props} />;
}
