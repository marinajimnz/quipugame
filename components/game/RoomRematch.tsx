'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { PlayerLabel } from '@/lib/game/playerLabel';
import type { GameState } from '@/lib/game/types';
import { useGameText } from '@/lib/game/useGameText';
import { useRoomChannel } from '@/lib/room/useRoomChannel';
import { createClient } from '@/lib/supabase/client';

interface Rematch {
  room_id: string;
  next_game_id: string | null;
  members: { profile_id: string; player_id: string | null; ready: boolean }[];
}

/**
 * Final de una partida de sala privada: «Jugar otra vez» (empieza otra en la misma sala cuando
 * todos los que siguen lo piden) y «Volver al inicio» (sale de la sala). Avisa de quién ha
 * salido y de a quién se espera.
 */
export function RoomRematch({
  state, gameId, labels, homeClassName,
}: { state: GameState; gameId: string; labels: Map<string, PlayerLabel>; homeClassName: string }) {
  const t = useTranslations('game.over');
  const format = useFormatter();
  const { playerName } = useGameText();
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const key = ['rematch', gameId];
  const [leaving, setLeaving] = useState(false);

  const rematch = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_room_rematch', { p_game_id: gameId });
      if (error) throw error;
      return data as unknown as Rematch | null;
    },
    // Respaldo por si se pierde algún aviso en tiempo real.
    refetchInterval: 5000,
  });
  useRoomChannel(rematch.data?.room_id, () => void queryClient.invalidateQueries({ queryKey: key }));

  const vote = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rematch_room', { p_game_id: gameId });
      if (error) throw error;
      return data as unknown as string | null;
    },
    onSuccess: (next) => {
      if (next) router.replace(`/partida/${next}`);
      else void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  // Cuando el último en votar empieza la nueva, los demás pasan a ella.
  const next = rematch.data?.next_game_id;
  useEffect(() => {
    if (next) router.replace(`/partida/${next}`);
  }, [next, router]);

  async function goHome() {
    setLeaving(true);
    await supabase.rpc('leave_room_game', { p_game_id: gameId });
    router.push('/');
  }

  const home = (
    <button type="button" disabled={leaving} onClick={goHome} className={homeClassName}>
      {t('backHome')}
    </button>
  );

  const data = rematch.data;
  if (!data) return home; // aún cargando, o partida sin sala

  // Personas de la partida que ya no están en la sala.
  const stay = new Set(data.members.map((m) => m.player_id));
  const humans = state.players.filter((p) => !p.is_bot);
  const gone = humans.filter((p) => !stay.has(p.player_id));
  const waiting = data.members.filter((m) => !m.ready && m.player_id !== state.me.player_id);
  const iVoted = data.members.some((m) => m.player_id === state.me.player_id && m.ready);
  const alone = data.members.length < 2;
  const names = (ids: (string | null)[]) =>
    format.list(ids.map((id) => playerName(id ? labels.get(id) : undefined)), { type: 'conjunction' });

  return (
    <>
      {gone.length || (iVoted && waiting.length) || alone ? (
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          {gone.map((p) => (
            <p key={p.player_id} className="font-semibold">{t('leftRoom', { name: playerName(labels.get(p.player_id)) })}</p>
          ))}
          {alone ? <p>{t('rematchAlone')}</p> : null}
          {!alone && iVoted && waiting.length ? <p>{t('rematchWaiting', { names: names(waiting.map((m) => m.player_id)) })}</p> : null}
        </div>
      ) : null}
      {vote.isError ? <p role="alert" className="text-sm text-error">{t('rematchError')}</p> : null}
      <Button disabled={alone || iVoted || vote.isPending || leaving} onClick={() => vote.mutate()}>
        {iVoted && !alone ? t('rematchSent') : t('playAgain')}
      </Button>
      {home}
    </>
  );
}
