/* eslint-disable react/jsx-no-literals -- página de muestra del estilo, no es interfaz de producción */
import { notFound } from 'next/navigation';
import { Wordmark } from '@/components/brand/Wordmark';
import { GameTile } from '@/components/game/GameTile';
import { Fondo } from '@/components/layout/Fondo';
import { Boton } from '@/components/ui/Boton';
import { Panel } from '@/components/ui/Panel';
import { TILE_POINTS } from '@/src/game/pointsTable';

// Hoja de muestra de la dirección visual. Solo en desarrollo.
const SAMPLE = [16, 42, 13, 24, 35]; // una de cada color: 0, 1, 2, 3, 4
const SIZES = [44, 58];
const TINTES = [
  { nombre: 'morado · --espacio (partida)', tinte: 'var(--espacio)' },
  { nombre: 'gris · ajustes', tinte: '#8E8AA3' },
  { nombre: 'azul · inicio', tinte: '#1F4E79' },
  { nombre: 'ciruela · resultado', tinte: '#5A2160' },
];

function Fila({ titulo, state, size }: { titulo: string; state: 'public' | 'unknown' | 'back'; size: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-[var(--crema)]">{titulo}</h3>
      <div className="flex items-end gap-2">
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
    </div>
  );
}

export default function EstiloPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <>
      <Fondo grano="todo" className="px-5 py-10">
        <div className="flex flex-col items-center gap-10">
          <Wordmark size={300} showTagline />

          <section className="flex w-full flex-col gap-6">
            <h2 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-[var(--crema)]">Fichas</h2>
            {SIZES.map((size) => (
              <Panel key={size} className="flex flex-col gap-4">
                <h3 className="text-base font-semibold">{size} px {size < 56 ? '· sin símbolo' : ''}</h3>
                <Fila titulo="Pública o resuelta" state="public" size={size} />
                <Fila titulo="Sin resolver" state="unknown" size={size} />
                <Fila titulo="Reverso" state="back" size={size} />
              </Panel>
            ))}
            <Panel className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">Seleccionada (izquierda) y normal</h3>
              <div className="flex gap-2">
                <GameTile number={13} colorIndex={2} points={TILE_POINTS[13]} state="public" size={58} selected />
                <GameTile number={24} colorIndex={3} points={TILE_POINTS[24]} state="public" size={58} />
              </div>
            </Panel>
          </section>

          <section className="flex w-full flex-col gap-4">
            <h2 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-[var(--crema)]">Botones</h2>
            <Boton>Clasificar</Boton>
            <Boton variante="confirmar">Es tu turno</Boton>
            <Boton variante="neutro">Ver historial</Boton>
            <Boton disabled>No disponible</Boton>
          </section>
        </div>
      </Fondo>

      <h2 className="bg-[var(--espacio)] px-5 pt-8 font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-[var(--crema)]">
        Mismo fondo, cuatro tintes
      </h2>
      {TINTES.map(({ nombre, tinte }) => (
        <Fondo key={nombre} tinte={tinte} className="min-h-0! px-5 py-8">
          <Panel className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{nombre}</p>
            <div className="flex gap-2">
              {SAMPLE.map((n) => (
                <GameTile key={n} number={n} colorIndex={(n - 1) % 5} points={TILE_POINTS[n]} state="public" size={52} />
              ))}
            </div>
          </Panel>
        </Fondo>
      ))}
    </>
  );
}
