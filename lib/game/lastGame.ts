import type { GameState } from './types';

// La última partida activa vista en este dispositivo, para abrir su tablero de deducción sin
// conexión. Solo contiene lo que este jugador ya podía ver (nunca sus propios números).
const KEY = 'quipu-last-game';

export interface LastGame {
  gameId: string;
  state: GameState;
  savedAt: number;
}

export function saveLastGame(gameId: string, state: GameState): void {
  try {
    if (state.game.status !== 'active') return;
    localStorage.setItem(KEY, JSON.stringify({ gameId, state, savedAt: Date.now() } satisfies LastGame));
  } catch {
    // Sin almacenamiento (modo privado, cuota…): no pasa nada.
  }
}

export function loadLastGame(): LastGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastGame) : null;
  } catch {
    return null;
  }
}
