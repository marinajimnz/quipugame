const KNOWN = new Set([
  'room_not_found', 'room_full', 'room_expired', 'room_not_open', 'not_enough_players', 'not_host',
]);

/** Clave de messages/es.json (room.errors.*) para un error de las funciones de sala. */
export function roomErrorKey(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? '';
  return KNOWN.has(message) ? message : 'generic';
}

// Sin 0, O, 1 ni I: igual que el servidor.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Normaliza lo que escribe el usuario: mayúsculas, solo caracteres válidos, máximo 6. */
export function cleanRoomCode(raw: string): string {
  return Array.from(raw.toUpperCase())
    .filter((c) => ALPHABET.includes(c))
    .slice(0, 6)
    .join('');
}

export function isRoomCode(code: string): boolean {
  return code.length === 6 && Array.from(code).every((c) => ALPHABET.includes(c));
}
