/* eslint-disable react/jsx-no-literals -- página de desarrollo, no es interfaz de producción */
import { notFound } from 'next/navigation';
import { GameTile } from '@/components/game/GameTile';
import { TILE_POINTS } from '@/src/game/pointsTable';

// Hoja de muestra de las fichas. Solo en desarrollo.
const SIZES = [44, 52, 72, 100, 140];
const SAMPLE = [1, 2, 3, 4, 5]; // una de cada color

export default function FichasPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="flex flex-col gap-8 px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold">Fichas</h1>

      {SIZES.map((size) => (
        <section key={size} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{size} px</h2>
          {(['public', 'unknown', 'back'] as const).map((state) => (
            <div key={state} className="flex flex-wrap items-end gap-2">
              {SAMPLE.map((n) => (
                <GameTile
                  key={n}
                  number={state === 'public' ? n : null}
                  colorIndex={(n - 1) % 5}
                  points={state === 'public' ? TILE_POINTS[n] : null}
                  state={state}
                  size={size}
                />
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            {[3, 22, 41, 58, 60].map((n) => (
              <GameTile key={n} number={n} colorIndex={(n - 1) % 5} points={TILE_POINTS[n]} state="public" size={size} selected={n === 22} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
