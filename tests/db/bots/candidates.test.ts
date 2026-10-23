import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TILE_POINTS } from '../../../src/game/pointsTable';
import { cleanup, createGame, createPlayer, sql, type Player, type TestGame } from '../helpers';

// T041: candidatos del bot, con estados fijos. Soporte del asiento 0: 1, 7, 13, 24, 35
// (colores 0, 1, 2, 3, 4, una ficha de cada). Nadie más tiene fichas y el mazo está vacío.

const SUPPORT = [1, 7, 13, 24, 35];
const color = (n: number) => (n - 1) % 5;
const ofColor = (c: number) => Array.from({ length: 60 }, (_, i) => i + 1).filter((n) => color(n) === c);

let a: Player;
let b: Player;

beforeAll(async () => {
  [a, b] = await Promise.all([createPlayer(), createPlayer()]);
});
afterAll(cleanup);

/** Monta el escenario y devuelve los candidatos del asiento 0 según su vista pública. */
async function candidates(
  game: TestGame,
  extra: { otherSupport?: number[]; clues?: { tile: number; kind: 'classify' | 'compare'; slot?: number; position?: number; same?: boolean }[]; pool?: number[] } = {},
): Promise<number[][]> {
  const g = game.id;
  const me = game.seats[0].playerId;
  const other = game.seats[1].playerId;
  const clues = extra.clues ?? [];

  const statements = [
    `update public.game_tiles set place = 'reserve', owner_id = null, slot = null where game_id = '${g}'`,
    ...SUPPORT.map((n, i) => `update public.game_tiles set place = 'support', owner_id = '${me}', slot = ${i} where game_id = '${g}' and number = ${n}`),
    ...(extra.otherSupport ?? []).map((n, i) => `update public.game_tiles set place = 'support', owner_id = '${other}', slot = ${i} where game_id = '${g}' and number = ${n}`),
    ...(extra.pool ?? []).map((n) => `update public.game_tiles set place = 'pool' where game_id = '${g}' and number = ${n}`),
    ...clues.map((c) => `update public.game_tiles set place = 'spent' where game_id = '${g}' and number = ${c.tile}`),
    ...clues.map(
      (c) => `insert into public.game_clues (game_id, asker_id, tile_number, kind, target_slot, answer_position, answer_same)
              values ('${g}', '${me}', ${c.tile}, '${c.kind}', ${c.slot ?? 'null'}, ${c.position ?? 'null'}, ${c.same ?? 'null'})`,
    ),
    `select game_internal.bot_candidates(game_internal.state_for_player('${g}', '${me}')) as c`,
  ];
  const rows = await sql<{ c: number[][] }>(statements.join(';\n'));
  return rows[0].c;
}

describe('bot_candidates', () => {
  it('sin pistas: cada posición solo admite números de su color', async () => {
    const game = await createGame([a, b]);
    const c = await candidates(game);
    expect(c).toHaveLength(5);
    c.forEach((list, i) => {
      expect(list).toEqual(ofColor(color(SUPPORT[i])));
    });
  });

  it('descarta los números que se ven en otras fichas (soportes ajenos, mazo y gastadas)', async () => {
    const game = await createGame([a, b]);
    const c = await candidates(game, { otherSupport: [6, 12], pool: [11, 2], clues: [{ tile: 16, kind: 'classify', position: 5 }] });
    // 6, 11 y 16 son del color 0: no pueden ser mi posición 0. 12 y 2 son del color 1.
    expect(c[0]).not.toContain(6);
    expect(c[0]).not.toContain(11);
    expect(c[0]).not.toContain(16);
    expect(c[1]).not.toContain(12);
    expect(c[1]).not.toContain(2);
    expect(c[2]).toEqual(ofColor(2)); // el color 2 no se ve en ningún sitio
  });

  it('classify: exactamente "posición" de mis fichas son menores que la de la pista', async () => {
    const game = await createGame([a, b]);
    // La ficha 33 (color 2) encaja en la posición 2: dos fichas mías son menores y tres mayores.
    const c = await candidates(game, { clues: [{ tile: 33, kind: 'classify', position: 2 }] });
    expect(Math.max(...c[0])).toBeLessThan(33);
    expect(Math.max(...c[1])).toBeLessThan(33);
    expect(Math.min(...c[2])).toBeGreaterThan(33);
    expect(Math.min(...c[3])).toBeGreaterThan(33);
    expect(Math.min(...c[4])).toBeGreaterThan(33);
    // La pista manda sobre la ficha real: con ella, la posición 3 ya no puede valer 24.
    expect(c[3]).not.toContain(24);
  });

  it('classify en los extremos: 0 (por debajo de todas) y 5 (por encima de todas)', async () => {
    const low = await candidates(await createGame([a, b]), { clues: [{ tile: 31, kind: 'classify', position: 0 }] });
    for (const list of low) expect(Math.min(...list)).toBeGreaterThan(31);

    const high = await candidates(await createGame([a, b]), { clues: [{ tile: 31, kind: 'classify', position: 5 }] });
    for (const list of high) expect(Math.max(...list)).toBeLessThan(31);
  });

  it('compare: "sí" deja solo los números con los mismos puntos; "no", los demás', async () => {
    const game = await createGame([a, b]);
    const tile = 20; // color 4
    const pts = TILE_POINTS[tile];
    const same = await candidates(game, { clues: [{ tile, kind: 'compare', slot: 1, same: true }] });
    for (const n of same[1]) expect(TILE_POINTS[n]).toBe(pts);

    const different = await candidates(await createGame([a, b]), { clues: [{ tile, kind: 'compare', slot: 1, same: false }] });
    for (const n of different[1]) expect(TILE_POINTS[n]).not.toBe(pts);
  });

  it('el orden ascendente propaga entre posiciones', async () => {
    const game = await createGame([a, b]);
    // La posición 1 (color 1) no puede superar a la mayor de la posición 2 menos nada; forzamos
    // un tope: posición 2 < 40 (pista classify de la 41, posición 3 → 0..2 menores).
    const c = await candidates(game, { clues: [{ tile: 41, kind: 'classify', position: 3 }] });
    expect(Math.max(...c[2])).toBeLessThan(41);
    // Como la posición 3 > posición 2 y ambas deben ser coherentes, el menor de la 3 supera al menor de la 2.
    expect(Math.min(...c[3])).toBeGreaterThan(Math.min(...c[2]));
    expect(Math.min(...c[1])).toBeGreaterThan(Math.min(...c[0]));
  });
});
