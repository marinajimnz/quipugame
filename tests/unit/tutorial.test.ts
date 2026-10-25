import { describe, expect, it } from 'vitest';
import { autoStruck } from '@/lib/game/autoStrike';
import type { GameState } from '@/lib/game/types';
import { BOT_MOVES, SOLUTION, STAGES, stageIndex, tutorialState } from '@/lib/tutorial/script';
import { TILE_POINTS } from '@/src/game/pointsTable';

/**
 * Todas las combinaciones de números que encajan con lo que el jugador sabe: el color y el orden
 * de sus fichas, lo que ya es público y las respuestas a sus pistas.
 */
function candidates(state: GameState): number[][] {
  const seen = autoStruck(state);
  const mine = state.clues.filter((c) => c.asker_id === state.me.player_id);
  const options = state.me.support.map((s) =>
    Array.from({ length: 60 }, (_, i) => i + 1).filter((n) => (n - 1) % 5 === s.color_index && !seen.has(n)),
  );
  const out: number[][] = [];
  const fits = (nums: number[]) =>
    mine.every((c) =>
      c.kind === 'classify'
        ? nums.filter((n) => n < c.tile_number).length === c.answer_position
        : (TILE_POINTS[c.tile_number] === TILE_POINTS[nums[c.target_slot!]]) === c.answer_same,
    );
  const walk = (slot: number, nums: number[]) => {
    if (slot === 5) return void (fits(nums) && out.push(nums));
    for (const n of options[slot]) if (!nums.length || n > nums[nums.length - 1]) walk(slot + 1, [...nums, n]);
  };
  walk(0, []);
  return out;
}

describe('tutorial', () => {
  it('al llegar a deducir, la única solución posible son tus fichas', () => {
    expect(candidates(tutorialState(stageIndex('deduce')))).toEqual([[...SOLUTION]]);
  });

  it('antes de comparar todavía hay más de una solución: la comparación hace falta', () => {
    expect(candidates(tutorialState(stageIndex('compare'))).length).toBeGreaterThan(1);
  });

  it('el reparto es coherente en todos los pasos', () => {
    for (let stage = 0; stage < STAGES.length; stage++) {
      for (let moves = 0; moves <= BOT_MOVES; moves++) {
        const s = tutorialState(stage, moves);
        const tiles = [
          ...s.me.support.map((_, i) => SOLUTION[i]),
          ...s.players.flatMap((p) => p.support.map((t) => t.number)),
          ...s.pool.map((t) => t.number),
          ...s.clues.map((c) => c.tile_number),
        ];
        expect(new Set(tiles).size).toBe(tiles.length); // ninguna ficha está en dos sitios
        expect(s.pool.length === 5 || (s.pool.length === 6 && s.game.phase === 'clue')).toBe(true);
        expect(s.game.reserve_by_color.reduce((a, b) => a + b, 0) + tiles.length).toBe(60);
      }
    }
  });

  it('la ficha azul es la que se compara y comparte puntos con la 55', () => {
    expect(TILE_POINTS[55]).toBe(TILE_POINTS[SOLUTION[4]]);
  });
});
