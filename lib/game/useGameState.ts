'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { GameState } from './types';

export interface GameSnapshot {
  state: GameState;
  /** Hora del servidor − hora local, para que el cronómetro use el reloj del servidor. */
  clockOffsetMs: number;
}

/**
 * Estado de la partida tal como lo ve este jugador. De momento se refresca por sondeo cada
 * 1,5 s; el hito 5 lo cambia por Realtime sin tocar a quien lo usa (la misma clave de caché).
 */
export function useGameState(gameId: string) {
  return useQuery({
    queryKey: ['game', gameId],
    queryFn: async (): Promise<GameSnapshot> => {
      const { data, error } = await createClient().rpc('get_game_state', { p_game_id: gameId });
      if (error) throw error;
      const state = data as unknown as GameState;
      return { state, clockOffsetMs: Date.parse(state.game.server_time) - Date.now() };
    },
    refetchInterval: (query) => (query.state.data?.state.game.status === 'finished' ? false : 1500),
  });
}
