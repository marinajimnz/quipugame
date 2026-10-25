'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toggleIn } from './autoStrike';

interface Marks {
  struck: number[]; //  tachados por mí: descartados
  circled: number[]; // rodeados por mí: posibles
  guesses: Record<number, number>; // posición (0–4) -> número que creo que tiene mi ficha
}

interface DeductionStore {
  games: Record<string, Marks>;
  toggleStrike: (gameId: string, n: number) => void;
  toggleCircle: (gameId: string, n: number) => void;
  /** Apunta (o quita, con null) el número que creo que tiene mi ficha de esa posición. */
  setGuess: (gameId: string, slot: number, n: number | null) => void;
  clear: (gameId: string) => void;
}

const empty: Marks = { struck: [], circled: [], guesses: {} };

// Las marcas guardadas antes de existir `circled` o `guesses` no los traen.
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
          return { games: { ...s.games, [gameId]: { ...marks, struck: toggleIn(marks.struck, n), circled } } };
        }),
      toggleCircle: (gameId, n) =>
        set((s) => {
          const marks = marksOf(s.games, gameId);
          const struck = marks.struck.filter((x) => x !== n);
          return { games: { ...s.games, [gameId]: { ...marks, struck, circled: toggleIn(marks.circled, n) } } };
        }),
      setGuess: (gameId, slot, n) =>
        set((s) => {
          const marks = marksOf(s.games, gameId);
          const guesses = { ...marks.guesses };
          if (n === null) delete guesses[slot];
          else guesses[slot] = n;
          return { games: { ...s.games, [gameId]: { ...marks, guesses } } };
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

/** Marcas de una partida, completas aunque vengan de una versión anterior. Rehidrata al montar. */
export function useMarks(gameId: string): Marks {
  const stored = useDeductionStore((s) => s.games[gameId]);
  useEffect(() => {
    void useDeductionStore.persist.rehydrate();
  }, []);
  return { ...empty, ...stored };
}
