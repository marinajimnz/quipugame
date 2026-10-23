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

describe('bots', () => {
  it('normal contra normal: 40 partidas terminan y el bot normal nunca declara mal', { timeout: 300_000 }, async () => {
    const results = [...(await simulate(['normal', 'normal'], 20)), ...(await simulate(['normal', 'normal', 'normal'], 20))];
    expect(results).toHaveLength(40);
    for (const r of results) {
      expect(r.status).toBe('finished');
      expect(r.winner).toBe('normal');
      expect(r.wrong_declarations.normal ?? 0).toBe(0);
    }
  });

  it('con 4 bots también terminan sin errores', { timeout: 300_000 }, async () => {
    const results = await simulate(['normal', 'normal', 'normal', 'normal'], 15);
    for (const r of results) {
      expect(r.status).toBe('finished');
      expect(r.wrong_declarations.normal ?? 0).toBe(0);
    }
  });

  it('easy puede fallar pero la partida siempre termina; normal le gana casi siempre', { timeout: 300_000 }, async () => {
    const results = await simulate(['easy', 'normal', 'normal'], 20);
    for (const r of results) {
      expect(r.status).toBe('finished');
      expect(r.wrong_declarations.normal ?? 0).toBe(0);
    }
    const normalWins = results.filter((r) => r.winner === 'normal').length;
    expect(normalWins).toBeGreaterThanOrEqual(15);
  });

  it('easy contra easy: terminan', { timeout: 300_000 }, async () => {
    const results = await simulate(['easy', 'easy'], 20);
    for (const r of results) expect(r.status).toBe('finished');
  });
});
