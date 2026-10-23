'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

type Difficulty = 'easy' | 'normal' | 'hard';

async function startPractice(bots: number, difficulty: Difficulty): Promise<string> {
  const { data, error } = await createClient().rpc('start_practice_game', {
    p_bots: bots,
    p_difficulty: difficulty,
  });
  if (error || !data) throw error ?? new Error('no game');
  return data;
}

/** Inicio de una partida de práctica: número de bots y dificultad. Sin efecto en el ELO. */
export function PracticeForm() {
  const t = useTranslations('practice');
  const router = useRouter();
  const [bots, setBots] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    setBusy(true);
    setError(false);
    try {
      router.push(`/partida/${await startPractice(bots, difficulty)}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const choice =
    'min-h-11 rounded-xl text-sm font-semibold ring-1 ring-grafito/25 aria-checked:bg-lila aria-checked:ring-0 focus-visible:outline-2 focus-visible:outline-lila';

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-blanco p-4 shadow-sm ring-1 ring-grafito/10">
      <h2 className="font-display text-2xl font-extrabold">{t('title')}</h2>

      <div role="radiogroup" aria-label={t('bots')} className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={bots === n} onClick={() => setBots(n)} className={choice}>
            {t('botsOption', { count: n })}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label={t('difficulty')} className="grid grid-cols-3 gap-2">
        {(['easy', 'normal', 'hard'] as const).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={difficulty === d} onClick={() => setDifficulty(d)} className={choice}>
            {t(d)}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="text-sm text-ficha-2">{t('error')}</p> : null}
      <Button disabled={busy} onClick={start}>{busy ? t('starting') : t('start')}</Button>
    </section>
  );
}

/** Botón "Jugar otra vez" con los mismos bots y dificultad normal. */
export function PracticeAgain({ bots }: { bots: number }) {
  const tOver = useTranslations('game.over');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          router.push(`/partida/${await startPractice(Math.min(3, Math.max(1, bots)), 'normal')}`);
        } catch {
          setBusy(false);
        }
      }}
    >
      {tOver('playAgain')}
    </Button>
  );
}
