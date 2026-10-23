'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toggleIn } from './autoStrike';

interface Marks {
  struck: number[]; //                       tachados por mí
  candidates: Record<number, number[]>; //   posición (0–4) -> números anotados
}

interface DeductionStore {
  games: Record<string, Marks>;
  toggleStrike: (gameId: string, n: number) => void;
  toggleCandidate: (gameId: string, slot: number, n: number) => void;
  clear: (gameId: string) => void;
}

const empty: Marks = { struck: [], candidates: {} };

/**
 * Lo que el jugador apunta en su tablero de deducción. No sale del dispositivo (no es estado
 * de juego) y se guarda en localStorage con la clave de la partida.
 */
export const useDeductionStore = create<DeductionStore>()(
  persist(
    (set) => ({
      games: {},
      toggleStrike: (gameId, n) =>
        set((s) => {
          const marks = s.games[gameId] ?? empty;
          return { games: { ...s.games, [gameId]: { ...marks, struck: toggleIn(marks.struck, n) } } };
        }),
      toggleCandidate: (gameId, slot, n) =>
        set((s) => {
          const marks = s.games[gameId] ?? empty;
          const next = toggleIn(marks.candidates[slot] ?? [], n);
          return { games: { ...s.games, [gameId]: { ...marks, candidates: { ...marks.candidates, [slot]: next } } } };
        }),
      clear: (gameId) =>
        set((s) => {
          const games = { ...s.games };
          delete games[gameId];
          return { games };
        }),
    }),
    {
      name: 'quipu-deduction',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // se rehidrata en el cliente, para que servidor y cliente pinten lo mismo
    },
  ),
);

export const EMPTY_MARKS = empty;
