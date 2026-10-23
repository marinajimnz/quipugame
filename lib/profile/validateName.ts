export const NAME_MIN = 3;
export const NAME_MAX = 16;

export type NameCheck =
  | { ok: true; value: string }
  | { ok: false; reason: 'tooShort' | 'tooLong' | 'invalidChars' };

/** Valida un nombre visible: 3–16 caracteres tras recortar espacios, sin caracteres de control. */
export function validateName(raw: string): NameCheck {
  const value = raw.trim();
  const length = Array.from(value).length; // caracteres Unicode, igual que char_length en Postgres
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return { ok: false, reason: 'invalidChars' };
  if (length < NAME_MIN) return { ok: false, reason: 'tooShort' };
  if (length > NAME_MAX) return { ok: false, reason: 'tooLong' };
  return { ok: true, value };
}
