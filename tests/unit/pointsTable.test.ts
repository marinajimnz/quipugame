import { describe, expect, it } from 'vitest';
import { colorOfTile, TILE_POINTS } from '@/src/game/pointsTable';

// La tabla se genera con scripts/generate_points_table.py; esto solo vigila que el cliente la recibe íntegra.
describe('pointsTable', () => {
  it('tiene las 60 fichas, con 1, 2 o 3 puntos', () => {
    expect(Object.keys(TILE_POINTS)).toHaveLength(60);
    for (let n = 1; n <= 60; n++) expect([1, 2, 3]).toContain(TILE_POINTS[n]);
  });

  it('reparte 20 fichas de cada valor y 4/4/4 por color', () => {
    for (const points of [1, 2, 3]) {
      const tiles = Object.keys(TILE_POINTS).map(Number).filter((n) => TILE_POINTS[n] === points);
      expect(tiles).toHaveLength(20);
      for (let color = 0; color < 5; color++) {
        expect(tiles.filter((n) => colorOfTile(n) === color)).toHaveLength(4);
      }
    }
  });

  it('el color sale del número: (n − 1) % 5', () => {
    expect([1, 2, 3, 4, 5, 6, 60].map(colorOfTile)).toEqual([0, 1, 2, 3, 4, 0, 4]);
  });
});
