'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { Button } from '@/components/ui/Button';
import { roomErrorKey } from '@/lib/room/roomErrors';
import { useRoomChannel } from '@/lib/room/useRoomChannel';
import { createClient } from '@/lib/supabase/client';

/**
 * Sala de espera: quién se ha unido (en tiempo real), el código para compartir y, solo para el
 * anfitrión, el botón de iniciar. Al abrir el enlace, entra en la sala automáticamente.
 */
export function RoomScreen({ code, userId }: { code: string; userId: string }) {
  const t = useTranslations('room');
  const tApp = useTranslations('app');
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 1. Entrar en la sala (idempotente: si ya soy miembro, no cambia nada).
  const join = useQuery({
    queryKey: ['room-join', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('join_room', { p_code: code });
      if (error) throw error;
      return data as string;
    },
    retry: false,
    staleTime: Infinity,
  });
  const roomId = join.data;
  const connected = useRoomChannel(roomId);
  const poll = connected ? 10_000 : 2_000;

  const room = useQuery({
    enabled: !!roomId,
    queryKey: ['room', roomId],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId!).single();
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    enabled: !!roomId,
    queryKey: ['room-members', roomId],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_members')
        .select('profile_id, joined_at, profiles(display_name, avatar_key)')
        .eq('room_id', roomId!)
        .order('joined_at');
      if (error) throw error;
      return data;
    },
  });

  // 2. Cuando el anfitrión inicia la partida, todos pasan a ella.
  const gameId = room.data?.status === 'started' ? room.data.game_id : null;
  useEffect(() => {
    if (gameId) router.replace(`/partida/${gameId}`);
  }, [gameId, router]);

  if (join.error) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 px-4 py-8">
        <p role="alert" className="text-lg">{t(`errors.${roomErrorKey(join.error as { message?: string })}`)}</p>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blanco px-5 font-semibold ring-1 ring-grafito/20">
          {t('backHome')}
        </Link>
      </main>
    );
  }
  if (!room.data || !members.data) {
    return <p role="status" className="p-4 text-grafito-suave">{t('joining')}</p>;
  }

  const r = room.data;
  const list = members.data;
  const isHost = r.host_id === userId;
  const link = `${location.origin}/sala/${r.code}`;
  const canStart = r.fill_with_bots || list.length >= 2;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: tApp('name'), text: t('shareText', { code: r.code }), url: link });
        return;
      } catch {
        // cancelado: no hacer nada
      }
    }
    await navigator.clipboard.writeText(link);
    setNotice(t('copied'));
  }

  async function start() {
    setBusy(true);
    setErrorKey(null);
    const { data, error } = await supabase.rpc('start_game', { p_room_id: r.id });
    if (error) {
      setErrorKey(roomErrorKey(error));
      setBusy(false);
      return;
    }
    router.replace(`/partida/${data}`);
  }

  async function leave() {
    await supabase.rpc('leave_room', { p_room_id: r.id });
    await queryClient.invalidateQueries({ queryKey: ['room-join', code] });
    router.replace('/');
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-grafito-suave">{t('codeLabel')}</p>
        <p className="font-display text-6xl font-extrabold tracking-[0.12em] tabular-nums" aria-label={r.code.split('').join(' ')}>
          {r.code}
        </p>
      </header>

      {r.status === 'expired' ? (
        <p role="alert" className="rounded-2xl bg-lila text-piedra-hueco p-4 font-semibold">{t('closed')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={share}>{t('share')}</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(r.code);
              setNotice(t('copied'));
            }}
          >
            {t('copyCode')}
          </Button>
        </div>
      )}
      {notice ? <p role="status" className="text-sm">{notice}</p> : null}

      <section className="flex flex-col gap-2" aria-label={t('members')}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-extrabold">{t('members')}</h2>
          <p className="text-sm tabular-nums text-grafito-suave">{t('seatsCount', { count: list.length, seats: r.seats })}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {list.map((m) => {
            const name = m.profiles?.display_name ?? '';
            return (
              <li key={m.profile_id} className="flex items-center gap-3 rounded-2xl bg-blanco p-3 ring-1 ring-grafito/10">
                <Avatar avatarKey={m.profiles?.avatar_key ?? 'default'} name={name} size={40} />
                <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
                {m.profile_id === r.host_id ? (
                  <span className="rounded-full bg-lila text-piedra-hueco px-2.5 py-0.5 text-xs font-semibold">{t('host')}</span>
                ) : null}
                {m.profile_id === userId ? <span className="text-xs text-grafito-suave">{t('you')}</span> : null}
              </li>
            );
          })}
        </ul>
        {r.fill_with_bots ? <p className="text-sm text-grafito-suave">{t('botsNote')}</p> : null}
      </section>

      {r.status === 'open' ? (
        <div className="mt-auto flex flex-col gap-3">
          {errorKey ? <p role="alert" className="text-sm text-error">{t(`errors.${errorKey}`)}</p> : null}
          {isHost ? (
            <>
              {!canStart ? <p className="text-sm">{t('needMore')}</p> : null}
              <Button disabled={!canStart || busy} onClick={start}>{busy ? t('starting') : t('start')}</Button>
            </>
          ) : (
            <p className="text-sm" aria-live="polite">{t('waitingHost')}</p>
          )}
          <Button variant="secondary" onClick={leave}>{t('leave')}</Button>
        </div>
      ) : (
        <Link href="/" className="mt-auto inline-flex min-h-11 items-center justify-center rounded-2xl bg-blanco px-5 font-semibold ring-1 ring-grafito/20">
          {t('backHome')}
        </Link>
      )}
    </main>
  );
}
