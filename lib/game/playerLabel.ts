import type { GameState } from './types';

/** Nombre visible de cada jugador de la partida: id -> {kind, name?, botNumber?}. */
export type PlayerLabel = { kind: 'me' } | { kind: 'human'; name: string } | { kind: 'bot'; n: number };

export function labelsOf(state: GameState): Map<string, PlayerLabel> {
  const map = new Map<string, PlayerLabel>();
  map.set(state.me.player_id, { kind: 'me' });
  let bots = 0;
  for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
    if (p.is_bot) map.set(p.player_id, { kind: 'bot', n: ++bots });
    else map.set(p.player_id, { kind: 'human', name: p.display_name ?? '' });
  }
  return map;
}
