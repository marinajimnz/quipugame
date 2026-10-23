export const DISCONNECTED_AFTER_MS = 30_000;

/** ¿Hace más de 30 s que no sé nada de este jugador? serverNowMs = hora del servidor estimada. */
export function isDisconnected(lastSeenAt: string, serverNowMs: number): boolean {
  return serverNowMs - Date.parse(lastSeenAt) > DISCONNECTED_AFTER_MS;
}
