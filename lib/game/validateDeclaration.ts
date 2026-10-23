export type DeclarationIssue =
  | { kind: 'incomplete' } //     falta algún número
  | { kind: 'range'; index: number } //  fuera de 1–60
  | { kind: 'color'; index: number } //  no es del color de esa posición
  | { kind: 'duplicate'; index: number }
  | { kind: 'order'; index: number }; //  no es mayor que el anterior

export type DeclarationCheck =
  | { ok: true; numbers: number[] }
  | { ok: false; issues: DeclarationIssue[] };

/**
 * Comprobación local antes de enviar: 5 números distintos, ascendentes y del color de cada
 * posición. Solo evita errores de pulsación: la decisión final es del servidor.
 */
export function validateDeclaration(
  values: readonly (number | null)[],
  slotColors: readonly number[],
): DeclarationCheck {
  const issues: DeclarationIssue[] = [];

  if (values.length !== 5 || values.some((v) => v === null || Number.isNaN(v))) {
    return { ok: false, issues: [{ kind: 'incomplete' }] };
  }
  const numbers = values as number[];

  numbers.forEach((n, index) => {
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      issues.push({ kind: 'range', index });
      return;
    }
    if ((n - 1) % 5 !== slotColors[index]) issues.push({ kind: 'color', index });
    if (numbers.indexOf(n) !== index) issues.push({ kind: 'duplicate', index });
    else if (index > 0 && n <= numbers[index - 1]) issues.push({ kind: 'order', index });
  });

  return issues.length ? { ok: false, issues } : { ok: true, numbers };
}
