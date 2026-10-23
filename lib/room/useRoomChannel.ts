'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Realtime de una sala: quién entra o sale y cuándo se inicia la partida. */
export function useRoomChannel(roomId: string | undefined): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const supabase = createClient();
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['room', roomId] });
      void queryClient.invalidateQueries({ queryKey: ['room-members', roomId] });
    };

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, invalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, invalidate)
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        if (ok) invalidate();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  return connected;
}
