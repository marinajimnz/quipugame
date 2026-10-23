import { useId, type InputHTMLAttributes } from 'react';

export function TextField({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="min-h-11 rounded-xl bg-blanco px-3 text-base ring-1 ring-grafito/25 focus-visible:outline-2 focus-visible:outline-lila aria-invalid:ring-2 aria-invalid:ring-ficha-2"
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-ficha-2">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm opacity-70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
