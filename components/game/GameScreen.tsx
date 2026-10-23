'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { gameErrorKey } from '@/lib/game/errors';
import { labelsOf } from '@/lib/game/playerLabel';
import { isMyTurn } from '@/lib/game/types';
import { useGameState } from '@/lib/game/useGameState';
import { useGameText } from '@/lib/game/useGameText';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/profile/Avatar';
import { ClueList } from './ClueList';
import { DeclareSheet } from './DeclareSheet';
import { DeductionBoard } from './DeductionBoard';
import { GameOver } from './GameOver';
import { History } from './History';
import { Pool } from './Pool';
import { MySupport, OtherSupport } from './Support';
import { TurnActions, EMPTY_DRAFT, type ClueDraft } from './TurnActions';
import { TurnBar } from './TurnBar';

export function GameScreen({ gameId }: { gameId: string }) {
  const t = useTranslations('game');
  const queryClient = useQueryClient();
  const { data, error: loadError } = useGameState(gameId);
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

  const state = data?.state;
  const eventSeq = state?.event_seq;

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

  if (loadError && !state) {
    return <p role="alert" className="p-4">{t('errors.load')}</p>;
  }
  if (!state || !data) {
    return <p role="status" className="p-4 opacity-70">{t('sending')}</p>;
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

  return (
    <>
      <main className="flex min-h-dvh flex-col gap-4 px-3 pb-44 pt-3">
        {finished ? (
          <GameOver state={state} labels={labels} />
        ) : (
          <TurnBar state={state} clockOffsetMs={data.clockOffsetMs} turnName={turnName} mine={myTurn} />
        )}

        {state.players.map((player) => {
          const label = labels.get(player.player_id);
          const clues = state.clues.filter((c) => c.asker_id === player.player_id);
          const badge =
            player.state === 'eliminated' ? t('eliminatedBadge') : player.state === 'abandoned' ? t('abandonedBadge') : null;
          return (
            <section key={player.player_id} className="flex flex-col gap-2 rounded-2xl bg-blanco/70 p-3 ring-1 ring-grafito/10">
              <header className="flex items-center gap-2">
                <Avatar avatarKey={player.avatar_key ?? 'default'} name={playerName(label)} size={32} />
                <h2 className="truncate font-semibold">{playerName(label)}</h2>
                {badge ? <span className="rounded-full bg-lila px-2 py-0.5 text-xs font-semibold">{badge}</span> : null}
              </header>
              <OtherSupport player={player} />
              <ClueList clues={clues} />
            </section>
          );
        })}

        <Pool
          pool={state.pool}
          selectable={clueTime && !pending}
          selected={draft.tile}
          onSelect={(n) => setDraft({ ...draft, tile: n })}
        />

        <section className="flex flex-col gap-2 rounded-2xl bg-blanco/70 p-3 ring-1 ring-grafito/10">
          <h2 className="text-sm font-semibold">{t('mySupport')}</h2>
          <MySupport
            me={state.me}
            selectableSlot={clueTime && draft.kind === 'compare' && !pending}
            selectedSlot={draft.slot}
            onSelectSlot={(slot) => setDraft({ ...draft, slot })}
          />
          <h3 className="mt-1 text-sm font-semibold">{t('cluesTitle')}</h3>
          <ClueList clues={myClues} empty />
        </section>

        <History gameId={gameId} eventSeq={state.event_seq} labels={labels} />
      </main>

      {finished ? null : (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-[430px] flex-col gap-3 border-t border-grafito/15 bg-crema/95 p-3 backdrop-blur">
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
          {errorKey ? <p role="alert" className="text-sm text-ficha-2">{t(`errors.${errorKey}`)}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setBoardOpen(true)}>{t('deduction')}</Button>
            <Button
              disabled={state.me.state !== 'active' || state.me.has_declared}
              onClick={() => setDeclareOpen(true)}
            >
              {t('declare')}
            </Button>
          </div>
        </div>
      )}

      <DeclareSheet
        open={declareOpen}
        onClose={() => setDeclareOpen(false)}
        slotColors={state.me.support.map((s) => s.color_index)}
        onDeclare={declare}
      />
      <DeductionBoard open={boardOpen} onClose={() => setBoardOpen(false)} gameId={gameId} state={state} />
    </>
  );
}
