// Tabla de puntos de Quinteto. Generada por generate_points_table.py
// Semilla 20261023. No modificar a mano: regenerar y volver a verificar.

export const TILE_POINTS: Readonly<Record<number, 1 | 2 | 3>> = {
  1: 2, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 1, 8: 2, 9: 3, 10: 2,
  11: 1, 12: 3, 13: 3, 14: 1, 15: 3, 16: 1, 17: 2, 18: 3, 19: 3, 20: 2,
  21: 1, 22: 2, 23: 1, 24: 1, 25: 1, 26: 3, 27: 1, 28: 2, 29: 3, 30: 3,
  31: 2, 32: 2, 33: 2, 34: 1, 35: 1, 36: 3, 37: 1, 38: 3, 39: 2, 40: 3,
  41: 3, 42: 3, 43: 2, 44: 3, 45: 1, 46: 1, 47: 2, 48: 1, 49: 2, 50: 3,
  51: 2, 52: 3, 53: 3, 54: 2, 55: 1, 56: 2, 57: 3, 58: 1, 59: 1, 60: 2,
} as const;

export const colorOfTile = (n: number): 0 | 1 | 2 | 3 | 4 =>
  ((n - 1) % 5) as 0 | 1 | 2 | 3 | 4;
