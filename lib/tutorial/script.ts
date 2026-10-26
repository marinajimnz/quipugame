import type { Clue, GameState, PublicTile } from '@/lib/game/types';
import { TILE_POINTS } from '@/src/game/pointsTable';

// Partida simulada del tutorial: tú contra Quipu (un bot). Todo es fijo, así las pistas llevan
// siempre a la misma deducción. Con las dos pistas del guion y lo que ya es público, la única
// solución posible es SOLUTION (lo comprueba tests/unit/tutorial.test.ts).

export const TUTORIAL_GAME_ID = 'tutorial';

const ME = 'tutorial-me';
const BOT = 'tutorial-bot';

/** Tus fichas, de menor a mayor. Colores: ámbar, rosa, rojo, lima, azul. */
export const SOLUTION = [36, 38, 39, 42, 45] as const;
const BOT_SUPPORT = [13, 17, 40, 49, 51];
const POOL = [56, 12, 8, 44, 25];

/** Lo que sale de la reserva en cada revelación del guion, por color. */
export const FIRST_REVEAL = { color: 0, tile: 31 } as const; //  ámbar
const BOT_REVEAL = 23; //                                           rosa
const BOT_CLUE_TILE = 12;
export const SECOND_REVEAL = { color: 4, tile: 55 } as const; // azul
/** La comparación del guion: la 55 con tu ficha 5 (la azul). */
export const COMPARE_SLOT = 4;

/**
 * Pasos del tutorial. Cada uno pertenece a uno de los 7 pasos que se ven (los puntos de arriba).
 * Los que no tienen acción del jugador se pasan con "Siguiente".
 */
export const STAGES = [
  { id: 'board', step: 1 },
  { id: 'order', step: 2 },
  { id: 'reveal', step: 3 },
  { id: 'classify', step: 4 },
  { id: 'classified', step: 4 },
  { id: 'botTurn', step: 5 },
  { id: 'reveal2', step: 5 },
  { id: 'compare', step: 5 },
  { id: 'compared', step: 5 },
  { id: 'deduce', step: 6 },
  { id: 'declare', step: 7 },
  { id: 'done', step: 7 },
] as const;

export type StageId = (typeof STAGES)[number]['id'];
export const STEP_COUNT = 7;
/** Jugadas de Quipu en su turno, que se ven una a una: revela y pide su pista. */
export const BOT_MOVES = 2;

export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);

const publicTile = (number: number): PublicTile => ({
  number,
  color_index: (number - 1) % 5,
  points: TILE_POINTS[number],
});

const classify = (id: string, asker: string, tile: number, support: readonly number[]): Clue => ({
  id,
  asker_id: asker,
  tile_number: tile,
  kind: 'classify',
  target_slot: null,
  answer_position: support.filter((n) => n < tile).length,
  answer_same: null,
  created_at: '2026-01-01T00:00:00Z',
});

type Event =
  | { kind: 'reveal'; tile: number }
  | { kind: 'clue'; clue: Clue; next: number }; // next: asiento al que pasa el turno

/** Lo que ha pasado en la partida al llegar a cada paso. Las jugadas de Quipu van en botTurn. */
function eventsUntil(stage: number, botMoves: number): Event[] {
  const events: Event[] = [];
  const reached = (id: StageId) => stage > stageIndex(id);

  if (reached('reveal')) events.push({ kind: 'reveal', tile: FIRST_REVEAL.tile });
  if (reached('classify')) {
    events.push({ kind: 'clue', clue: classify('clue-1', ME, FIRST_REVEAL.tile, SOLUTION), next: 1 });
  }
  const moves = reached('botTurn') ? BOT_MOVES : stage === stageIndex('botTurn') ? botMoves : 0;
  if (moves >= 1) events.push({ kind: 'reveal', tile: BOT_REVEAL });
  if (moves >= 2) events.push({ kind: 'clue', clue: classify('clue-2', BOT, BOT_CLUE_TILE, BOT_SUPPORT), next: 0 });
  if (reached('reveal2')) events.push({ kind: 'reveal', tile: SECOND_REVEAL.tile });
  if (reached('compare')) {
    events.push({
      kind: 'clue',
      clue: {
        id: 'clue-3',
        asker_id: ME,
        tile_number: SECOND_REVEAL.tile,
        kind: 'compare',
        target_slot: COMPARE_SLOT,
        answer_position: null,
        answer_same: TILE_POINTS[SECOND_REVEAL.tile] === TILE_POINTS[SOLUTION[COMPARE_SLOT]],
        created_at: '2026-01-01T00:00:00Z',
      },
      next: 1,
    });
  }
  return events;
}

/**
 * Estado de la partida simulada en un paso, con la misma forma que get_game_state. Se deriva
 * entero del paso, así ir hacia atrás es solo cambiar de paso.
 */
export function tutorialState(stage: number, botMoves = 0): GameState {
  const reserve = [9, 9, 9, 9, 9];
  let pool = POOL.map(publicTile);
  const clues: Clue[] = [];
  let phase: GameState['game']['phase'] = 'reveal';
  let seat = 0;

  for (const e of eventsUntil(stage, botMoves)) {
    if (e.kind === 'reveal') {
      reserve[(e.tile - 1) % 5] -= 1;
      pool = [...pool, publicTile(e.tile)];
      phase = 'clue';
    } else {
      pool = pool.filter((t) => t.number !== e.clue.tile_number);
      clues.push(e.clue);
      phase = 'reveal';
      seat = e.next;
    }
  }

  const done = stage >= stageIndex('done');

  return {
    game: {
      status: done ? 'finished' : 'active',
      mode: 'practice',
      phase,
      current_seat: done ? null : seat,
      turn_deadline: null, // sin reloj: el tutorial va a tu ritmo
      winner_player_id: done ? ME : null,
      server_time: '2026-01-01T00:00:00Z',
      reserve_by_color: reserve,
    },
    me: {
      player_id: ME,
      seat: 0,
      state: 'active',
      has_declared: done,
      support: SOLUTION.map((n, slot) => ({ slot, color_index: (n - 1) % 5, resolved_number: done ? n : null })),
    },
    players: [
      {
        player_id: BOT,
        seat: 1,
        display_name: null,
        avatar_key: null,
        is_bot: true,
        is_guest: false,
        state: 'active',
        has_declared: false,
        last_seen_at: '2026-01-01T00:00:00Z',
        support: BOT_SUPPORT.map((n, slot) => ({ ...publicTile(n), slot })),
      },
    ],
    pool,
    clues,
    event_seq: stage * 10 + botMoves,
  };
}

export const isMine = (clue: Clue) => clue.asker_id === ME;
