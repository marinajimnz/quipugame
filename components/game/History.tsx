'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import type { PlayerLabel } from '@/lib/game/playerLabel';
import { useGameText } from '@/lib/game/useGameText';

interface EventRow {
  seq: number;
  kind: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
}

/** Historial desplegable con los eventos en orden. Solo contiene información pública. */
export function History({
  gameId, eventSeq, labels,
}: { gameId: string; eventSeq: number; labels: Map<string, PlayerLabel> }) {
  const t = useTranslations('game');
  const { playerName, clueText } = useGameText();

  const { data: events } = useQuery({
    queryKey: ['events', gameId, eventSeq],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('game_events')
        .select('seq, kind, actor_id, payload')
        .eq('game_id', gameId)
        .order('seq');
      if (error) throw error;
      return data as unknown as EventRow[];
    },
  });

  function line(e: EventRow): string {
    const name = playerName(e.actor_id ? labels.get(e.actor_id) : undefined);
    const p = e.payload;
    switch (e.kind) {
      case 'game_started':
        return t('eventGameStarted');
      case 'tile_revealed':
        return t('eventTileRevealed', { name, number: Number(p.number) });
      case 'turn_skipped':
        return t('eventTurnSkipped', { name });
      case 'clue_asked':
        return t('eventClueAsked', {
          name,
          tile: Number(p.tile_number),
          answer: clueText({
            kind: p.kind as 'classify' | 'compare',
            target_slot: p.target_slot as number | null,
            answer_position: p.answer_position as number | null,
            answer_same: p.answer_same as boolean | null,
          }),
        });
      case 'turn_timeout':
        return t('eventTurnTimeout', { name, consecutive: Number(p.consecutive) });
      case 'declared':
        return t('eventDeclared', { name, correct: String(p.correct) });
      case 'eliminated':
        return t('eventEliminated', { name, reason: String(p.reason) });
      case 'game_ended':
        return t('eventGameEnded');
      default:
        return '';
    }
  }

  return (
    <details className="rounded-2xl bg-espacio-claro/70 px-4 py-2 ring-1 ring-espacio-borde">
      <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold">{t('history')}</summary>
      <ol className="flex flex-col gap-1 pb-2 text-sm">
        {(events ?? []).map((e) => (
          <li key={e.seq} className="flex gap-2">
            <span className="w-6 shrink-0 text-right tabular-nums text-crema-suave">{e.seq}</span>
            <span>{line(e)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
