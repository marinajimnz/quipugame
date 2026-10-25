'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { GameState } from '@/lib/game/types';
import { GameTile } from './GameTile';

export interface ClueDraft {
  tile: number | null;
  kind: 'classify' | 'compare' | null;
  slot: number | null;
}

export const EMPTY_DRAFT: ClueDraft = { tile: null, kind: null, slot: null };

export function draftReady(d: ClueDraft): boolean {
  return d.tile !== null && (d.kind === 'classify' || (d.kind === 'compare' && d.slot !== null));
}

/** Lo único que se puede elegir (lo usa el tutorial). Sin esto, vale todo. */
export interface TurnLimits {
  colors?: readonly number[];
  kinds?: readonly NonNullable<ClueDraft['kind']>[];
}

/** Panel de acciones del turno: revelar un color, o elegir ficha y tipo de pista. */
export function TurnActions({
  state, myTurn, waitingFor, draft, onDraft, onReveal, onAsk, pending, only,
}: {
  state: GameState;
  myTurn: boolean;
  waitingFor: string;
  draft: ClueDraft;
  onDraft: (d: ClueDraft) => void;
  onReveal: (color: number) => void;
  onAsk: () => void;
  pending: boolean;
  only?: TurnLimits;
}) {
  const t = useTranslations('game');

  if (state.game.status !== 'active') return null;
  if (state.me.state !== 'active') return <p className="text-sm">{t('eliminatedNotice')}</p>;
  if (!myTurn) return <p className="text-sm" aria-live="polite">{t('waiting', { name: waitingFor })}</p>;

  if (state.game.phase === 'reveal') {
    const reserve = state.game.reserve_by_color;
    const empty = reserve.every((n) => n === 0);

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('phaseReveal')}</p>
        {empty ? (
          <>
            <p className="text-sm">{t('reserveEmpty')}</p>
            <Button disabled={pending} onClick={() => onReveal(0)}>
              {t('continue')}
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap justify-center gap-1.5">
            {reserve.map((count, color) => {
              const open = count > 0 && (!only?.colors || only.colors.includes(color));
              return (
                <GameTile
                  key={color}
                  number={null}
                  colorIndex={color}
                  points={null}
                  state="back"
                  size={52}
                  disabled={pending || !open}
                  hint={!pending && open}
                  onPress={() => onReveal(color)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Fase de pista
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {draft.tile === null
          ? t('pickTile')
          : draft.kind === null
            ? t('chooseKind')
            : draft.kind === 'classify'
              ? t('classifyHelp')
              : draft.slot === null
                ? t('pickSlot')
                : t('compareHelp')}
      </p>

      {draft.tile !== null ? (
        <div className="grid grid-cols-2 gap-2">
          {(['classify', 'compare'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={only?.kinds && !only.kinds.includes(kind)}
              aria-pressed={draft.kind === kind}
              onClick={() => onDraft({ ...draft, kind, slot: kind === 'classify' ? null : draft.slot })}
              className={`min-h-11 rounded-xl text-sm font-semibold ring-1 ring-espacio-borde disabled:opacity-40 ${draft.kind === null && !(only?.kinds && !only.kinds.includes(kind)) ? 'outline-2 outline-offset-2 outline-dashed outline-acento motion-safe:animate-pulse' : ''} aria-pressed:bg-acento aria-pressed:text-grafito aria-pressed:ring-0 focus-visible:outline-2 focus-visible:outline-acento`}
            >
              {t(kind)}
            </button>
          ))}
        </div>
      ) : null}

      <Button disabled={!draftReady(draft) || pending} onClick={onAsk}>
        {pending ? t('sending') : t('confirmClue')}
      </Button>
    </div>
  );
}
