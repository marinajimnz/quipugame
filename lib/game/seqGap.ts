/**
 * Los eventos de una partida llegan numerados (seq). Si llega uno con un número mayor que el
 * siguiente esperado, se ha perdido alguno. `last` = 0 significa "todavía no he visto ninguno".
 */
export function seqGap(last: number, incoming: number): boolean {
  return last > 0 && incoming > last + 1;
}
