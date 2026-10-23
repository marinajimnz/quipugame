// Catálogo provisional de avatares (pendiente de diseño). Una clave por avatar, nunca una URL.
// Mientras no haya arte, cada avatar es un círculo con el color de una ficha.
export const AVATAR_KEYS = ['ficha-0', 'ficha-1', 'ficha-2', 'ficha-3', 'ficha-4'] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const DEFAULT_AVATAR = 'default';

/** Color de ficha (0–4) que representa un avatar; null si la clave no está en el catálogo. */
export function avatarColorIndex(key: string): number | null {
  const i = AVATAR_KEYS.indexOf(key as AvatarKey);
  return i === -1 ? null : i;
}
