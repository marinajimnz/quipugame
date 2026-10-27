'use client';

import { useState, type CSSProperties } from 'react';

// La misma estrella del fondo (scripts/build_patterns.py): cuatro puntas de lados cóncavos,
// redondeadas con un trazo del mismo color. Caja de lado 2 centrada en el origen.
const STAR = 'M1 0Q0.21 0.21 0 1Q-0.21 0.21 -1 0Q-0.21 -0.21 0 -1Q0.21 -0.21 1 0Z';
// Carita triste, no texto traducible: es un dibujo.
const SAD = ':(';
const WIN_COLORS = ['var(--ficha-0)', 'var(--ficha-1)', 'var(--ficha-2)', 'var(--ficha-3)', 'var(--ficha-4)', 'var(--acento)', 'var(--crema)'];

interface Piece {
  left: number; // % del ancho
  size: number; // px
  delay: number; // s
  duration: number; // s
  drift: number; // px de deriva lateral al caer
  spin: number; // grados de giro al caer
  color: string;
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

function makePieces(kind: 'win' | 'lose'): Piece[] {
  const win = kind === 'win';
  return Array.from({ length: win ? 80 : 36 }, () => ({
    left: between(0, 100),
    size: win ? between(12, 26) : between(22, 40),
    delay: between(0, win ? 1.2 : 1.6),
    duration: between(win ? 2.6 : 3.2, win ? 4.2 : 5),
    drift: between(-60, 60),
    spin: between(-540, 540) * (win ? 1 : 0.4),
    color: win ? WIN_COLORS[Math.floor(Math.random() * WIN_COLORS.length)] : 'var(--ficha-3)',
  }));
}

/**
 * Lluvia que cae por toda la pantalla al terminar la partida: estrellas de colores de la paleta
 * si ganas, caritas tristes ":(" en rojo si pierdes. Decorativa: no recibe toques, la ignoran los
 * lectores de pantalla y no se pinta con "reducir movimiento".
 */
export function Confetti({ kind }: { kind: 'win' | 'lose' }) {
  const [pieces] = useState(() => makePieces(kind));

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        >
          {kind === 'win' ? (
            <svg viewBox="-1.3 -1.3 2.6 2.6" width="100%" height="100%">
              <path d={STAR} fill={p.color} stroke={p.color} strokeWidth={0.3} strokeLinejoin="round" />
            </svg>
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-display font-extrabold leading-none"
              style={{ color: p.color, fontSize: p.size * 0.8 }}
            >
              {SAD}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
