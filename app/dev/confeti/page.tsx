'use client';
/* eslint-disable react/jsx-no-literals -- página de desarrollo, no es interfaz de producción */
import { useState } from 'react';
import { GameOver } from '@/components/game/GameOver';
import type { GameState } from '@/lib/game/types';

// Prueba del final de partida (confeti al ganar, caritas tristes al perder). Solo en desarrollo.
function fakeState(winner: string | null): GameState {
  return {
    game: { status: 'finished', mode: 'private', phase: 'clue', current_seat: null, turn_deadline: null,
      winner_player_id: winner, server_time: '', reserve_by_color: [0, 0, 0, 0, 0] },
    me: { player_id: 'me', seat: 0, state: 'active', has_declared: true,
      support: [6, 17, 33, 44, 55].map((n, slot) => ({ slot, color_index: (n - 1) % 5, resolved_number: n })) },
    players: [], pool: [], clues: [], event_seq: 0,
  } as unknown as GameState;
}

export default function ConfetiPage() {
  const [run, setRun] = useState<{ winner: string | null; n: number } | null>(null);
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
      <button type="button" className="min-h-11 rounded-xl bg-acento px-5 font-bold text-grafito" onClick={() => setRun({ winner: 'me', n: Date.now() })}>
        Ganar
      </button>
      <button type="button" className="min-h-11 rounded-xl bg-espacio-borde px-5 font-bold" onClick={() => setRun({ winner: 'rival', n: Date.now() })}>
        Perder
      </button>
      {run ? <GameOver key={run.n} state={fakeState(run.winner)} labels={new Map()} gameId="dev" userId="me" /> : null}
    </main>
  );
}
