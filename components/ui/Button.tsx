import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

const base =
  'inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 text-base font-semibold ' +
  'transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lila ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-grafito text-crema',
  secondary: 'bg-blanco text-grafito ring-1 ring-grafito/20',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
