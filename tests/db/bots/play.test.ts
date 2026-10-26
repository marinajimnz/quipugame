import { describe, expect, it } from 'vitest';
import { sql } from '../helpers';

// T042: partidas enteras entre bots con el motor real. simulate_bot_game borra la partida al acabar.

interface Result {
  status: string;
  turns: number;
  winner: string | null;
  wrong_declarations: Record<string, number>;
}

async function simulate(difficulties: string[], count: number): Promise<Result[]> {
  const list = difficulties.map((d) => `'${d}'`).join(',');
  const rows = await sql<{ r: Result }>(
    `select game_internal.simulate_bot_game(array[${list}]) as r from generate_series(1, ${count})`,
  );
  return rows.map((x) => x.r);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const ownTurns = (rs: Result[]) => mean(rs.map((r) => r.turns / 2));

describe('bots', () => {
  it('ningún nivel declara mal (declaran solo con certeza)', { timeout: 300_000 }, async () => {
    const results = [
      ...(await simulate(['easy', 'normal', 'hard'], 15)),
      ...(await simulate(['normal', 'normal', 'normal', 'hard'], 10)),
    ];
    for (const r of results) {
      expect(r.status).toBe('finished');
      expect(r.wrong_declarations).toEqual({});
    }
  });

  it('con 4 bots también terminan sin errores', { timeout: 300_000 }, async () => {
    for (const r of await simulate(['normal', 'normal', 'normal', 'normal'], 10)) {
      expect(r.status).toBe('finished');
    }
  });

  it('easy contra easy: terminan', { timeout: 300_000 }, async () => {
    for (const r of await simulate(['easy', 'easy'], 15)) expect(r.status).toBe('finished');
  });

  // Balance (simulación 2026-10-26, 40 partidas por pareja): turnos propios hasta ganar
  // easy ≈17, normal ≈9, hard ≈5. Los umbrales dejan margen para el azar de 20 partidas.
  it('la escalera de niveles se nota en la duración de la partida', { timeout: 400_000 }, async () => {
    const easy = ownTurns(await simulate(['easy', 'easy'], 20));
    const normal = ownTurns(await simulate(['normal', 'normal'], 20));
    const hard = ownTurns(await simulate(['hard', 'hard'], 20));
    expect(hard).toBeLessThan(normal - 1.5);
    expect(normal).toBeLessThan(easy - 3);
  });

  it('hard gana a normal la mayoría de las veces y normal a easy casi siempre', { timeout: 400_000 }, async () => {
    const hardVsNormal = await simulate(['hard', 'normal'], 30);
    expect(hardVsNormal.filter((r) => r.winner === 'hard').length).toBeGreaterThanOrEqual(18);
    const normalVsEasy = await simulate(['normal', 'easy'], 30);
    expect(normalVsEasy.filter((r) => r.winner === 'normal').length).toBeGreaterThanOrEqual(24);
  });
});
