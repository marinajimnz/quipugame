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
 * Estado de la partida tal como lo ve este jugador. Con Realtime conectado, los cambios llegan
 * por el canal (useGameChannel) y el sondeo queda como red de seguridad cada 10 s; sin él,
 * se sondea cada 1,5 s.
 */
export function useGameState(gameId: string, realtimeConnected = false) {
  return useQuery({
    queryKey: ['game', gameId],
    queryFn: async (): Promise<GameSnapshot> => {
      const { data, error } = await createClient().rpc('get_game_state', { p_game_id: gameId });
      if (error) throw error;
      const state = data as unknown as GameState;
      return { state, clockOffsetMs: Date.parse(state.game.server_time) - Date.now() };
    },
    refetchInterval: (query) =>
      query.state.data?.state.game.status === 'finished' ? false : realtimeConnected ? 10_000 : 1500,
  });
}
