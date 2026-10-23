'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const PING_EVERY_MS = 15_000;

/** Avisa al servidor de que sigo en la partida: al entrar, cada 15 s y al volver a la pestaña. */
export function usePresence(gameId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const ping = () => {
      void supabase.rpc('touch_presence', { p_game_id: gameId });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };

    ping();
    const id = setInterval(ping, PING_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [gameId, enabled]);
}
