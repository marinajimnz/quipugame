'use client';

import { useTranslations } from 'next-intl';
import type { PlayerLabel } from './playerLabel';
import type { Clue } from './types';

/** Textos del juego que dependen de datos: nombres de jugador y respuestas a pistas. */
export function useGameText() {
  const t = useTranslations('game');

  const playerName = (label: PlayerLabel | undefined): string => {
    if (!label) return '';
    if (label.kind === 'me') return t('you');
    if (label.kind === 'bot') return t('bot', { n: label.n });
    return label.name;
  };

  const clueText = (c: Pick<Clue, 'kind' | 'target_slot' | 'answer_position' | 'answer_same'>): string =>
    c.kind === 'classify'
      ? t('clueClassify', { position: String(c.answer_position), a: c.answer_position ?? 0, b: (c.answer_position ?? 0) + 1 })
      : t('clueCompare', { slot: (c.target_slot ?? 0) + 1, same: String(c.answer_same) });

  return { playerName, clueText };
}
