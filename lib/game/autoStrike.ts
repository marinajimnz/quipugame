import type { GameState } from './types';

/**
 * Números que ya son públicamente imposibles para mis fichas: los que se ven en los soportes
 * ajenos, en el mazo visible o en una ficha ya gastada en una pista.
 */
export function autoStruck(state: GameState): Set<number> {
  const out = new Set<number>();
  for (const player of state.players) for (const tile of player.support) out.add(tile.number);
  for (const tile of state.pool) out.add(tile.number);
  for (const clue of state.clues) out.add(clue.tile_number);
  return out;
}

/** Añade el elemento si no está y lo quita si está. No modifica la lista original. */
export function toggleIn(list: readonly number[], n: number): number[] {
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b);
}
