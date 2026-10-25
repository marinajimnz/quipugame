'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { validateDeclaration, type DeclarationIssue } from '@/lib/game/validateDeclaration';
import { TILE_POINTS } from '@/src/game/pointsTable';
import { GameTile } from './GameTile';

type Stage = 'edit' | 'confirm' | 'result';

/** Hoja de declaración: validación local, resumen y confirmación explícita (una sola oportunidad). */
export function DeclareSheet({
  open, onClose, slotColors, guesses = {}, onDeclare,
}: {
  open: boolean;
  onClose: () => void;
  slotColors: number[];
  /** Lo apuntado en el tablero: rellena los huecos al abrir. */
  guesses?: Record<number, number>;
  onDeclare: (numbers: number[]) => Promise<boolean>;
}) {
  const t = useTranslations('declare');
  const [values, setValues] = useState<string[]>(() => [0, 1, 2, 3, 4].map((i) => (guesses[i] ? String(guesses[i]) : '')));
  const [stage, setStage] = useState<Stage>('edit');
  const [issues, setIssues] = useState<DeclarationIssue[]>([]);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);

  function review() {
    const parsed = values.map((v) => (v.trim() === '' ? null : Number(v)));
    const check = validateDeclaration(parsed, slotColors);
    if (!check.ok) return setIssues(check.issues);
    setIssues([]);
    setNumbers(check.numbers);
    setStage('confirm');
  }

  async function confirm() {
    setSending(true);
    const ok = await onDeclare(numbers);
    setSending(false);
    setCorrect(ok);
    setStage('result');
  }

  function close() {
    onClose();
    // Tras una declaración, la hoja no se reabre con los datos viejos.
    if (stage === 'result') {
      setStage('edit');
      setValues(['', '', '', '', '']);
      setCorrect(null);
    }
  }

  const issueText = (i: DeclarationIssue) =>
    i.kind === 'incomplete' ? t('issues.incomplete') : t(`issues.${i.kind}`, { n: i.index + 1 });

  return (
    <Sheet open={open} onClose={close} title={t('title')}>
      {stage === 'edit' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">{t('intro')}</p>
          <div className="flex justify-center gap-1.5">
            {slotColors.map((color, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <GameTile
                  number={Number(values[i]) || null}
                  colorIndex={color}
                  points={null}
                  state={Number(values[i]) ? 'guess' : 'unknown'}
                  size={48}
                />
                <label className="sr-only" htmlFor={`declare-${i}`}>{t('slot', { n: i + 1 })}</label>
                <input
                  id={`declare-${i}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={values[i]}
                  onChange={(e) => setValues(values.map((v, k) => (k === i ? e.target.value.replace(/\D/g, '') : v)))}
                  aria-invalid={issues.some((x) => 'index' in x && x.index === i) || undefined}
                  className="min-h-11 w-12 rounded-xl bg-espacio-claro text-center font-display text-xl font-extrabold tabular-nums ring-1 ring-espacio-borde focus-visible:outline-2 focus-visible:outline-acento aria-invalid:ring-2 aria-invalid:ring-error"
                />
              </div>
            ))}
          </div>
          {issues.length ? (
            <ul role="alert" className="flex flex-col gap-0.5 text-sm text-error">
              {issues.map((i, k) => (
                <li key={k}>{issueText(i)}</li>
              ))}
            </ul>
          ) : null}
          <Button onClick={review}>{t('review')}</Button>
        </div>
      ) : null}

      {stage === 'confirm' ? (
        <div className="flex flex-col gap-4">
          <p className="font-semibold">{t('reviewTitle')}</p>
          <div className="flex justify-center gap-1.5">
            {numbers.map((n, i) => (
              <GameTile key={i} number={n} colorIndex={slotColors[i]} points={TILE_POINTS[n]} state="solved" size={58} />
            ))}
          </div>
          <p role="alert" className="rounded-xl bg-acento/85 text-grafito p-3 text-sm font-medium">{t('warning')}</p>
          <Button disabled={sending} onClick={confirm}>{sending ? t('sending') : t('confirm')}</Button>
          <Button variant="secondary" disabled={sending} onClick={() => setStage('edit')}>{t('back')}</Button>
        </div>
      ) : null}

      {stage === 'result' ? (
        <p role="status" className="font-display text-2xl font-extrabold">{correct ? t('correct') : t('wrong')}</p>
      ) : null}
    </Sheet>
  );
}
