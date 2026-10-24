'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

/** Al acabar una clasificatoria: cuánto ELO he ganado o perdido (spec HU-3). */
export function EloChange({ gameId, userId }: { gameId: string; userId: string }) {
  const t = useTranslations('game.over');
  const { data } = useQuery({
    queryKey: ['elo', gameId, userId],
    // apply_elo corre en la misma transacción que cierra la partida, pero se reintenta por si acaso.
    refetchInterval: (q) => (q.state.data ? false : 1500),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('elo_history')
        .select('delta, elo_after')
        .eq('game_id', gameId)
        .eq('profile_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!data) return null;
  const sign = data.delta > 0 ? '+' : '−';
  return (
    <p className={`font-display text-2xl font-extrabold tabular-nums ${data.delta < 0 ? 'text-ficha-2' : ''}`}>
      {t('eloChange', { delta: data.delta, sign, abs: Math.abs(data.delta), after: data.elo_after })}
    </p>
  );
}
