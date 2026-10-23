import { describe, expect, it } from 'vitest';
import { autoStruck, toggleIn } from '@/lib/game/autoStrike';
import { formatSeconds, secondsLeft } from '@/lib/game/turnTimer';
import type { GameState } from '@/lib/game/types';
import { validateDeclaration } from '@/lib/game/validateDeclaration';

const state = {
  players: [
    { support: [{ slot: 0, number: 6, color_index: 0, points: 3 }, { slot: 1, number: 12, color_index: 1, points: 3 }] },
    { support: [{ slot: 0, number: 33, color_index: 2, points: 2 }] },
  ],
  pool: [{ number: 4, color_index: 3, points: 2 }],
  clues: [{ tile_number: 59 }, { tile_number: 4 }],
} as unknown as GameState;

describe('autoStruck', () => {
  it('reúne soportes ajenos, mazo y fichas gastadas, sin repetir', () => {
    expect([...autoStruck(state)].sort((a, b) => a - b)).toEqual([4, 6, 12, 33, 59]);
  });
});

describe('toggleIn', () => {
  it('añade ordenado y quita sin mutar', () => {
    const list = [3, 9];
    expect(toggleIn(list, 5)).toEqual([3, 5, 9]);
    expect(toggleIn(list, 3)).toEqual([9]);
    expect(list).toEqual([3, 9]);
  });
});

describe('validateDeclaration', () => {
  const colors = [0, 1, 2, 3, 4];

  it('acepta cinco números ascendentes del color de cada posición', () => {
    expect(validateDeclaration([1, 7, 13, 24, 35], colors)).toEqual({ ok: true, numbers: [1, 7, 13, 24, 35] });
  });

  it('detecta huecos', () => {
    expect(validateDeclaration([1, 7, null, 24, 35], colors)).toEqual({ ok: false, issues: [{ kind: 'incomplete' }] });
    expect(validateDeclaration([1, 7], colors)).toEqual({ ok: false, issues: [{ kind: 'incomplete' }] });
  });

  it('detecta color incorrecto, orden y repetidos', () => {
    const r = validateDeclaration([2, 7, 13, 24, 35], colors); // 2 es del color 1, no del 0
    expect(r).toEqual({ ok: false, issues: [{ kind: 'color', index: 0 }] });

    const order = validateDeclaration([31, 7, 13, 24, 35], colors); // 31 es color 0 pero > 7
    expect(order.ok).toBe(false);
    if (!order.ok) expect(order.issues).toContainEqual({ kind: 'order', index: 1 });

    const dup = validateDeclaration([1, 1, 13, 24, 35], colors);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.issues).toContainEqual({ kind: 'duplicate', index: 1 });
  });

  it('rechaza fuera de rango y no enteros', () => {
    expect(validateDeclaration([0, 7, 13, 24, 35], colors).ok).toBe(false);
    expect(validateDeclaration([1, 7, 13, 24, 61], colors).ok).toBe(false);
    expect(validateDeclaration([1.5, 7, 13, 24, 35], colors).ok).toBe(false);
  });
});

describe('turnTimer', () => {
  it('cuenta con el reloj del servidor', () => {
    const now = Date.parse('2026-10-23T12:00:00Z');
    expect(secondsLeft('2026-10-23T12:00:30Z', 0, now)).toBe(30);
    expect(secondsLeft('2026-10-23T12:00:30Z', 10_000, now)).toBe(20); // el servidor va 10 s por delante
    expect(secondsLeft('2026-10-23T11:59:00Z', 0, now)).toBe(0);
    expect(secondsLeft(null, 0, now)).toBeNull();
  });

  it('formatea m:ss', () => {
    expect(formatSeconds(75)).toBe('1:15');
    expect(formatSeconds(9)).toBe('0:09');
    expect(formatSeconds(0)).toBe('0:00');
  });
});
