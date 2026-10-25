// Colores de ficha para quien los necesite fuera de <Tile> (p. ej. el tablero de deducción).
// color_index = (número − 1) % 5. Valores en src/styles/tokens.css.

export const TILE_FILL = ['var(--ficha-0)', 'var(--ficha-1)', 'var(--ficha-2)', 'var(--ficha-3)', 'var(--ficha-4)'];

// Tinta del número: grafito sobre ámbar y lima; crema sobre rosa, rojo y azul.
export const TILE_INK = ['var(--grafito)', 'var(--grafito)', 'var(--crema)', 'var(--crema)', 'var(--crema)'];

// Un símbolo por color (P6: el color nunca es el único portador de información).
// Cada forma cabe en una caja de lado 2 centrada en el origen.
export const SYMBOLS: string[] = [
  'M0 -1A1 1 0 1 1 0 1A1 1 0 1 1 0 -1Z', //                                0 ámbar · círculo
  'M0 -1.05L1.1 0.85H-1.1Z', //                                            1 lima · triángulo
  'M-0.9 -0.9H0.9V0.9H-0.9Z', //                                           2 rosa · cuadrado
  'M0 -1.15L1.15 0L0 1.15L-1.15 0Z', //                                    3 rojo · rombo
  'M-0.5 -0.95H0.5L1.05 0L0.5 0.95H-0.5L-1.05 0Z', //                      4 azul · hexágono
];
