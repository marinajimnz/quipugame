'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toggleIn } from './autoStrike';

interface Marks {
  struck: number[]; //  tachados por mí: descartados
  circled: number[]; // rodeados por mí: posibles
}

interface DeductionStore {
  games: Record<string, Marks>;
  toggleStrike: (gameId: string, n: number) => void;
  toggleCircle: (gameId: string, n: number) => void;
  clear: (gameId: string) => void;
}

const empty: Marks = { struck: [], circled: [] };

// Las marcas guardadas antes de existir `circled` no lo traen.
const marksOf = (games: Record<string, Marks>, gameId: string): Marks => ({ ...empty, ...games[gameId] });

/**
 * Lo que el jugador apunta en su tablero de deducción. No sale del dispositivo (no es estado
 * de juego) y se guarda en localStorage con la clave de la partida.
 */
export const useDeductionStore = create<DeductionStore>()(
  persist(
    (set) => ({
      games: {},
      // Tachar y rodear se excluyen: marcar una cosa quita la otra.
      toggleStrike: (gameId, n) =>
        set((s) => {
          const marks = marksOf(s.games, gameId);
          const circled = marks.circled.filter((x) => x !== n);
          return { games: { ...s.games, [gameId]: { struck: toggleIn(marks.struck, n), circled } } };
        }),
      toggleCircle: (gameId, n) =>
        set((s) => {
          const marks = marksOf(s.games, gameId);
          const struck = marks.struck.filter((x) => x !== n);
          return { games: { ...s.games, [gameId]: { struck, circled: toggleIn(marks.circled, n) } } };
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
