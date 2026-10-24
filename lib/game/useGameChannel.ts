'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { seqGap } from './seqGap';

/**
 * Un canal Realtime por partida (no por jugador). Cada cambio invalida la consulta del estado,
 * que se vuelve a pedir completa: Realtime no escribe en la caché (menos riesgo de
 * desincronización). Devuelve si el canal está conectado: mientras no lo esté, quien consulta
 * vuelve al sondeo rápido, y al reconectar se pide el estado completo.
 */
export function useGameChannel(gameId: string): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const lastSeq = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const key = ['game', gameId];
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });

    const channel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, invalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_clues', filter: `game_id=eq.${gameId}` }, invalidate)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const seq = Number((payload.new as { seq: number }).seq);
          const gap = seqGap(lastSeq.current, seq);
          lastSeq.current = Math.max(lastSeq.current, seq);
          invalidate();
          // Hueco: se descarta lo que se tenía y se pide el estado completo sin esperar.
          if (gap) void queryClient.refetchQueries({ queryKey: key });
        },
      )
      // SUBSCRIBED llega antes de que el servidor escuche Postgres: al quedar lista la escucha
      // se pide otra vez el estado, por si algo cambió en ese hueco.
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') invalidate();
      })
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        if (ok) invalidate(); // al (re)conectar: estado completo
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, queryClient]);

  return connected;
}
