'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { DeclareSheet } from '@/components/game/DeclareSheet';
import { DeductionBoard } from '@/components/game/DeductionBoard';
import { Pool } from '@/components/game/Pool';
import { MySupport, OtherSupport } from '@/components/game/Support';
import { TurnActions, EMPTY_DRAFT, type ClueDraft, type TurnLimits } from '@/components/game/TurnActions';
import { TurnBar } from '@/components/game/TurnBar';
import { Avatar } from '@/components/profile/Avatar';
import { Button } from '@/components/ui/Button';
import { useDeductionStore, useMarks } from '@/lib/game/deductionStore';
import { isMyTurn } from '@/lib/game/types';
import {
  BOT_MOVES, COMPARE_SLOT, FIRST_REVEAL, SECOND_REVEAL, SOLUTION, STAGES, TUTORIAL_GAME_ID,
  isMine, stageIndex, tutorialState, type StageId,
} from '@/lib/tutorial/script';
import { markTutorial } from '@/lib/tutorial/seen';
import { COACH_PRIMARY, COACH_SECONDARY, Coach, Spot } from './Coach';

type Zone = 'rival' | 'pool' | 'mine' | 'actions' | 'board' | 'declare';

/** Qué zonas se resaltan en cada paso. Las demás se atenúan. */
const FOCUS: Record<StageId, Zone[]> = {
  board: ['mine', 'rival'],
  order: ['mine'],
  reveal: ['actions'],
  classify: ['pool', 'actions'],
  classified: ['mine'],
  botTurn: ['rival', 'pool'],
  reveal2: ['actions'],
  compare: ['pool', 'mine', 'actions'],
  compared: ['mine'],
  deduce: ['board'],
  declare: ['declare'],
  done: [],
};

/** Pasos que solo se leen: avanzan con "Siguiente". El resto avanza al hacer lo que piden. */
const READ_ONLY: StageId[] = ['board', 'order', 'classified', 'botTurn', 'compared'];

const BOT_DELAY_MS = 1300;

/**
 * Tutorial: una partida simulada (sin servidor) con la misma pantalla que una de verdad, guiada
 * paso a paso. Solo se puede pulsar lo que pide cada paso.
 */
export function TutorialScreen() {
  const t = useTranslations('tutorial');
  const tGame = useTranslations('game');
  const router = useRouter();

  const [stage, setStage] = useState(0);
  const [botMoves, setBotMoves] = useState(0);
  const [draft, setDraft] = useState<ClueDraft>(EMPTY_DRAFT);
  const [boardOpen, setBoardOpen] = useState(false);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [declareKey, setDeclareKey] = useState(0);
  const [declared, setDeclared] = useState<boolean | null>(null);
  const marks = useMarks(TUTORIAL_GAME_ID);

  const id = STAGES[stage].id;
  const step = STAGES[stage].step;
  const state = useMemo(() => tutorialState(stage, botMoves), [stage, botMoves]);
  const myTurn = isMyTurn(state);
  const deduced = marks.guesses[COMPARE_SLOT] === SOLUTION[COMPARE_SLOT];
  const botName = t('botName');

  // Cada vez se empieza con el tablero limpio.
  useEffect(() => {
    void Promise.resolve(useDeductionStore.persist.rehydrate()).then(() =>
      useDeductionStore.getState().clear(TUTORIAL_GAME_ID),
    );
  }, []);

  // Quipu juega solo, una jugada tras otra.
  useEffect(() => {
    if (id !== 'botTurn' || botMoves >= BOT_MOVES) return;
    const timer = setTimeout(() => setBotMoves((m) => m + 1), BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [id, botMoves]);

  useEffect(() => {
    if (id !== 'done') return;
    markTutorial('done');
    useDeductionStore.getState().clear(TUTORIAL_GAME_ID);
  }, [id]);

  function goTo(next: number) {
    setStage(next);
    setBotMoves(0);
    setDraft(EMPTY_DRAFT);
    setBoardOpen(false);
    setDeclareOpen(false);
    setDeclared(null);
  }
  const advance = () => goTo(stage + 1);

  function restart() {
    useDeductionStore.getState().clear(TUTORIAL_GAME_ID);
    goTo(0);
  }

  function reveal(color: number) {
    if ((id === 'reveal' && color === FIRST_REVEAL.color) || (id === 'reveal2' && color === SECOND_REVEAL.color)) advance();
  }

  function ask() {
    if (id === 'classify' && draft.tile === FIRST_REVEAL.tile && draft.kind === 'classify') advance();
    if (id === 'compare' && draft.tile === SECOND_REVEAL.tile && draft.kind === 'compare' && draft.slot === COMPARE_SLOT) advance();
  }

  function showSolution() {
    const { setGuess } = useDeductionStore.getState();
    SOLUTION.forEach((n, slot) => setGuess(TUTORIAL_GAME_ID, slot, n));
    setDeclared(null);
    setDeclareKey((k) => k + 1); // la hoja se vuelve a abrir con los números ya escritos
  }

  if (id === 'done') {
    return (
      <main className="flex min-h-pantalla flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-center font-display text-4xl font-extrabold tracking-tight">{t('done.title')}</h1>
        <MySupport me={state.me} />
        <ul className="flex flex-col gap-2 rounded-3xl bg-espacio-claro p-4 leading-relaxed ring-1 ring-espacio-borde">
          {(['recap1', 'recap2', 'recap3'] as const).map((k) => (
            <li key={k} className="flex gap-2">
              <svg
                width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
                className="mt-0.5 shrink-0 text-lima"
              >
                <path d="M5 12l5 5L19 7" />
              </svg>
              {t(`done.${k}`)}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-4">
          <Button onClick={() => router.push('/?modo=practica')}>{t('done.play')}</Button>
          <Button variant="secondary" onClick={() => router.push('/')}>{t('done.home')}</Button>
          <button type="button" onClick={restart} className={`${COACH_SECONDARY} self-center`}>
            {t('done.again')}
          </button>
        </div>
      </main>
    );
  }

  const focus = FOCUS[id];
  const spot = (zone: Zone) => ({
    on: focus.includes(zone),
    dim: focus.length > 0 && !focus.includes(zone),
    lead: focus[0] === zone,
  });
  // El panel de acciones aparece cuando se empieza a jugar; en los pasos de leer, deja sitio.
  const showActions = !READ_ONLY.includes(id);
  const only: TurnLimits = {
    colors: id === 'reveal' ? [FIRST_REVEAL.color] : id === 'reveal2' ? [SECOND_REVEAL.color] : [],
    kinds: id === 'classify' ? ['classify'] : id === 'compare' ? ['compare'] : [],
  };
  const picking = id === 'classify' || id === 'compare';
  const botBusy = id === 'botTurn' && botMoves < BOT_MOVES;
  const rival = state.players[0];

  const back =
    stage > 0 ? (
      <button type="button" onClick={() => goTo(stage - 1)} className={COACH_SECONDARY}>{t('back')}</button>
    ) : null;

  let coach;
  if (id === 'deduce' && deduced) {
    coach = (
      <Coach
        step={step}
        title={t('stages.deduced.title')}
        actions={<>{back}<button type="button" onClick={advance} className={COACH_PRIMARY}>{t('next')}</button></>}
      >
        {t('stages.deduced.body')}
      </Coach>
    );
  } else if (id === 'declare') {
    coach = (
      <Coach step={step} title={t('stages.declareNote.title')} actions={back}>
        {t('stages.declareNote.body')}
      </Coach>
    );
  } else {
    coach = (
      <Coach
        step={step}
        title={t(`stages.${id}.title`)}
        actions={
          <>
            {back}
            {id === 'deduce' ? (
              <button type="button" onClick={() => setBoardOpen(true)} className={COACH_PRIMARY}>{t('openBoard')}</button>
            ) : READ_ONLY.includes(id) ? (
              <button type="button" onClick={advance} disabled={botBusy} className={COACH_PRIMARY}>{t('next')}</button>
            ) : null}
          </>
        }
      >
        {t(`stages.${id}.body`)}
        {botBusy ? <span className="mt-1 block font-semibold text-acento">{t('botThinking')}</span> : null}
      </Coach>
    );
  }

  return (
    <>
      <main className={`flex min-h-pantalla flex-col gap-4 px-3 ${showActions ? 'pb-72' : 'pb-8'}`}>
        <div className="sticky top-0 z-20 -mx-3 flex flex-col gap-2 bg-espacio/95 px-3 pb-3 pt-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-lg font-extrabold">{t('title')}</h1>
            <Link
              href="/"
              onClick={() => markTutorial('dismissed')}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold ring-1 ring-espacio-borde focus-visible:outline-2 focus-visible:outline-acento"
            >
              {t('skip')}
            </Link>
          </div>
          {coach}
        </div>

        <div className={focus.length ? 'opacity-40 motion-safe:transition-opacity' : ''}>
          <TurnBar state={state} clockOffsetMs={0} turnName={botName} mine={myTurn} />
        </div>

        <Spot {...spot('rival')}>
          <section className="flex flex-col gap-2 p-1">
            <h2 className="text-sm font-semibold">{tGame('rivalBoard')}</h2>
            <header className="flex items-center gap-2">
              <Avatar avatarKey="ficha-4" name={botName} size={32} />
              <h2 className="truncate font-semibold">{botName}</h2>
              <span className="rounded-full bg-espacio-borde px-2 py-0.5 text-xs font-semibold">{tGame('botBadge')}</span>
            </header>
            <OtherSupport player={rival} clues={state.clues.filter((c) => !isMine(c))} />
          </section>
        </Spot>

        <Spot {...spot('pool')}>
          <Pool
            pool={state.pool}
            selectable={picking}
            only={id === 'classify' ? [FIRST_REVEAL.tile] : [SECOND_REVEAL.tile]}
            selected={draft.tile}
            onSelect={(n) => setDraft({ ...draft, tile: n })}
          />
        </Spot>

        <Spot {...spot('mine')}>
          <section className="flex flex-col gap-2 p-1">
            <h2 className="text-sm font-semibold">{tGame('mySupport')}</h2>
            <MySupport
              me={state.me}
              clues={state.clues.filter(isMine)}
              guesses={marks.guesses}
              selectableSlot={id === 'compare' && draft.kind === 'compare'}
              onlySlot={COMPARE_SLOT}
              selectedSlot={draft.slot}
              onSelectSlot={(slot) => setDraft({ ...draft, slot })}
            />
          </section>
        </Spot>
      </main>

      {showActions ? (
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-[430px] flex-col gap-3 border-t border-espacio-borde bg-espacio/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Spot {...spot('actions')}>
          <div className="p-1">
            <TurnActions
              state={state}
              myTurn={myTurn}
              waitingFor={botName}
              draft={draft}
              onDraft={setDraft}
              onReveal={reveal}
              onAsk={ask}
              pending={botBusy}
              only={only}
            />
          </div>
        </Spot>
        <div className="grid grid-cols-2 gap-2">
          <Spot {...spot('board')}>
            <Button variant="secondary" disabled={stage < stageIndex('deduce')} onClick={() => setBoardOpen(true)}>
              {tGame('deduction')}
            </Button>
          </Spot>
          <Spot {...spot('declare')}>
            <Button
              disabled={id !== 'declare'}
              onClick={() => {
                setDeclared(null);
                setDeclareKey((k) => k + 1);
                setDeclareOpen(true);
              }}
            >
              {tGame('declare')}
            </Button>
          </Spot>
        </div>
      </div>
      ) : null}

      <DeductionBoard
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        gameId={TUTORIAL_GAME_ID}
        state={state}
        coach={
          id === 'deduce' ? (
            <Coach
              key={String(deduced)}
              step={step}
              title={t(deduced ? 'stages.deduced.title' : 'stages.deduce.title')}
              actions={
                deduced ? <button type="button" onClick={advance} className={COACH_PRIMARY}>{t('next')}</button> : null
              }
            >
              {t(deduced ? 'stages.deduced.body' : 'stages.deduce.body')}
            </Coach>
          ) : null
        }
      />
      <DeclareSheet
        key={declareKey}
        open={declareOpen}
        guesses={marks.guesses}
        slotColors={state.me.support.map((s) => s.color_index)}
        onClose={() => {
          setDeclareOpen(false);
          if (declared) advance();
          else setDeclareKey((k) => k + 1); // tras fallar, se vuelve a abrir para corregir
        }}
        onDeclare={async (numbers) => {
          const ok = numbers.every((n, i) => n === SOLUTION[i]);
          setDeclared(ok);
          return ok;
        }}
        coach={
          <Coach
            step={step}
            title={t('stages.declare.title')}
            actions={
              declared ? (
                <button type="button" onClick={advance} className={COACH_PRIMARY}>{t('next')}</button>
              ) : (
                <>
                  <button type="button" onClick={showSolution} className={COACH_SECONDARY}>{t('showSolution')}</button>
                  {declared === false ? (
                    // La hoja vuelve a empezar, con lo apuntado en el tablero.
                    <button type="button" onClick={() => setDeclareKey((k) => k + 1)} className={COACH_PRIMARY}>
                      {t('tryAgain')}
                    </button>
                  ) : null}
                </>
              )
            }
          >
            {declared === false ? t('retry') : t('stages.declare.body')}
          </Coach>
        }
      />
    </>
  );
}
