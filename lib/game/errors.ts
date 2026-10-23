const KNOWN = new Set([
  'not_your_turn', 'wrong_phase', 'no_tiles_of_color', 'tile_not_in_pool', 'invalid_slot',
  'invalid_declaration', 'game_not_active', 'player_not_active',
]);

/** Clave de messages/es.json (game.errors.*) para un error de las funciones del motor. */
export function gameErrorKey(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? '';
  return KNOWN.has(message) ? message : 'generic';
}
