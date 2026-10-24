const KNOWN = new Set(['guest_not_allowed', 'already_in_queue', 'already_in_game']);

/** Clave de messages/es.json (ranked.errors.*) para un error al entrar en la cola. */
export function rankedErrorKey(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? '';
  return KNOWN.has(message) ? message : 'generic';
}

/** Ofrecer un bot pasados 90 s de espera (spec HU-3). */
export const OFFER_BOT_AFTER_S = 90;
