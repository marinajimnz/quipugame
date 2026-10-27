'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { gameErrorKey } from '@/lib/game/errors';
import { saveLastGame } from '@/lib/game/lastGame';
import { useLiveGame } from '@/lib/game/liveGame';
import { labelsOf } from '@/lib/game/playerLabel';
import { isMyTurn } from '@/lib/game/types';
import { useMarks } from '@/lib/game/deductionStore';
import { useGameChannel } from '@/lib/game/useGameChannel';
import { useGameState } from '@/lib/game/useGameState';
import { useOnline } from '@/lib/game/useOnline';
import { usePresence } from '@/lib/game/usePresence';
import { useGameText } from '@/lib/game/useGameText';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/profile/Avatar';
import { AbandonSheet } from './AbandonSheet';
import { ConnectionBanner } from './ConnectionBanner';
import { DeclareSheet } from './DeclareSheet';
import { DeductionBoard } from './DeductionBoard';
import { GameOver } from './GameOver';
import { Pool } from './Pool';
import { MySupport, OtherSupport } from './Support';
import { TurnActions, EMPTY_DRAFT, type ClueDraft } from './TurnActions';
import { TurnBar } from './TurnBar';

export function GameScreen({ gameId, userId }: { gameId: string; userId: string }) {
  const t = useTranslations('game');
  const queryClient = useQueryClient();
  const connected = useGameChannel(gameId);
  const { data, error: loadError, isError } = useGameState(gameId, connected);
  const online = useOnline();
  const { playerName } = useGameText();

  // El borrador de pista pertenece al estado en que se creó: cuando llega un evento nuevo
  // (turno que cambia, ficha revelada…) deja de valer y se empieza limpio.
  const [draftRaw, setDraftRaw] = useState<{ seq: number | undefined; draft: ClueDraft }>({
    seq: undefined,
    draft: EMPTY_DRAFT,
  });
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  // Cada apertura de la hoja de declarar parte de lo apuntado en el tablero en ese momento.
  const [declareKey, setDeclareKey] = useState(0);
  const { guesses } = useMarks(gameId);

  const state = data?.state;
  const eventSeq = state?.event_seq;
  usePresence(gameId, state?.game.status === 'active' && state.me.state === 'active');

  // Mientras juegas, el gesto de atrás (deslizar desde el borde, botón atrás) no te saca de la
  // partida: se queda aquí y pregunta si quieres abandonar.
  const [abandonOpen, setAbandonOpen] = useState(false);
  const inPlay = state?.game.status === 'active' && state.me.state === 'active';
  useEffect(() => {
    if (!inPlay) return;
    window.history.pushState(null, '');
    const onPop = () => {
      window.history.pushState(null, '');
      setAbandonOpen(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [inPlay]);

  // Para abrir el tablero de deducción sin conexión (/sin-conexion).
  useEffect(() => {
    if (state) saveLastGame(gameId, state);
  }, [gameId, state]);

  const draft = draftRaw.seq === eventSeq ? draftRaw.draft : EMPTY_DRAFT;
  const setDraft = (d: ClueDraft) => setDraftRaw({ seq: eventSeq, draft: d });

  const labels = useMemo(() => (state ? labelsOf(state) : new Map()), [state]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['game', gameId] });
  const supabase = createClient();

  const reveal = useMutation({
    mutationFn: async (color: number) => {
      const { error } = await supabase.rpc('reveal_tile', { p_game_id: gameId, p_color: color });
      if (error) throw error;
    },
    onError: (e) => setErrorKey(gameErrorKey(e as { message?: string })),
    onSuccess: () => setErrorKey(null),
    onSettled: refresh,
  });

  const ask = useMutation({
    mutationFn: async (d: ClueDraft) => {
      const { error } = await supabase.rpc('ask_clue', {
        p_game_id: gameId,
        p_tile: d.tile!,
        p_kind: d.kind!,
        p_slot: d.kind === 'compare' ? d.slot! : undefined,
      });
      if (error) throw error;
    },
    onError: (e) => setErrorKey(gameErrorKey(e as { message?: string })),
    onSuccess: () => {
      setErrorKey(null);
      setDraft(EMPTY_DRAFT);
    },
    onSettled: refresh,
  });

  async function abandon() {
    const { error } = await supabase.rpc('abandon_game', { p_game_id: gameId });
    if (error) setErrorKey(gameErrorKey(error));
    await refresh();
  }

  // El menú de navegación pregunta antes de dejar la partida: le damos cómo abandonarla.
  const abandonRef = useRef(abandon);
  useEffect(() => {
    abandonRef.current = abandon;
  });
  useEffect(() => {
    if (!inPlay) return;
    useLiveGame.setState({ abandon: () => abandonRef.current() });
    return () => useLiveGame.setState({ abandon: null });
  }, [inPlay]);

  if (loadError && !state) {
    return <p role="alert" className="p-4">{t('errors.load')}</p>;
  }
  if (!state || !data) {
    return <p role="status" className="p-4 text-crema-suave">{t('sending')}</p>;
  }

  const myTurn = isMyTurn(state);
  const finished = state.game.status === 'finished';
  const turnPlayer = state.players.find((p) => p.seat === state.game.current_seat);
  const turnName = playerName(turnPlayer ? labels.get(turnPlayer.player_id) : undefined);
  const pending = reveal.isPending || ask.isPending;
  const clueTime = myTurn && state.game.phase === 'clue';
  const myClues = state.clues.filter((c) => c.asker_id === state.me.player_id);

  async function declare(numbers: number[]): Promise<boolean> {
    const { data: result, error } = await supabase.rpc('declare_code', { p_game_id: gameId, p_numbers: numbers });
    await refresh();
    if (error) {
      setErrorKey(gameErrorKey(error));
      return false;
    }
    return (result as { correct: boolean }).correct;
  }

  const canAbandon = state.game.status === 'active' && state.me.state === 'active';

  return (
    <>
      {!online || isError ? <ConnectionBanner /> : null}
      <main className="flex min-h-pantalla flex-col gap-4 px-3 pb-44 pt-3">
        {finished ? (
          <GameOver state={state} gameId={gameId} userId={userId} />
        ) : (
          <TurnBar state={state} clockOffsetMs={data.clockOffsetMs} turnName={turnName} mine={myTurn} />
        )}

        {state.players.map((player) => {
          const label = labels.get(player.player_id);
          const clues = state.clues.filter((c) => c.asker_id === player.player_id);
          const badge =
            player.state === 'eliminated' ? t('eliminatedBadge') : player.state === 'abandoned' ? t('abandonedBadge') : null;
          return (
            <section key={player.player_id} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{t('rivalBoard')}</h2>
              <header className="flex items-center gap-2">
                <Avatar avatarKey={player.avatar_key ?? 'default'} name={playerName(label)} size={32} />
                <h2 className="truncate font-semibold">{playerName(label)}</h2>
                {badge ? <span className="rounded-full bg-acento text-grafito px-2 py-0.5 text-xs font-semibold">{badge}</span> : null}
                {!player.is_bot ? (
                  <span className="rounded-full bg-espacio-borde px-2 py-0.5 text-xs font-semibold text-crema">
                    {player.is_guest ? t('guestBadge') : t('verifiedBadge')}
                  </span>
                ) : null}
              </header>
              <OtherSupport player={player} clues={clues} />
            </section>
          );
        })}

        <Pool
          pool={state.pool}
          selectable={clueTime && !pending}
          selected={draft.tile}
          onSelect={(n) => setDraft({ ...draft, tile: n })}
        />

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t('mySupport')}</h2>
          <MySupport
            me={state.me}
            clues={myClues}
            guesses={guesses}
            selectableSlot={clueTime && draft.kind === 'compare' && !pending}
            selectedSlot={draft.slot}
            onSelectSlot={(slot) => setDraft({ ...draft, slot })}
          />
        </section>

        {canAbandon ? <AbandonSheet onAbandon={abandon} open={abandonOpen} onOpenChange={setAbandonOpen} /> : null}
      </main>

      {finished ? null : (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-[430px] flex-col gap-3 border-t border-espacio-borde bg-espacio/95 p-3 backdrop-blur">
          <TurnActions
            state={state}
            myTurn={myTurn}
            waitingFor={turnName}
            draft={draft}
            onDraft={setDraft}
            onReveal={(c) => reveal.mutate(c)}
            onAsk={() => ask.mutate(draft)}
            pending={pending}
          />
          {errorKey ? <p role="alert" className="text-sm text-error">{t(`errors.${errorKey}`)}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setBoardOpen(true)}>{t('deduction')}</Button>
            <Button
              disabled={state.me.state !== 'active' || state.me.has_declared}
              onClick={() => {
                setDeclareKey((k) => k + 1);
                setDeclareOpen(true);
              }}
            >
              {t('declare')}
            </Button>
          </div>
        </div>
      )}

      <DeclareSheet
        key={declareKey}
        open={declareOpen}
        guesses={guesses}
        onClose={() => setDeclareOpen(false)}
        slotColors={state.me.support.map((s) => s.color_index)}
        onDeclare={declare}
      />
      <DeductionBoard open={boardOpen} onClose={() => setBoardOpen(false)} gameId={gameId} state={state} />
    </>
  );
}
