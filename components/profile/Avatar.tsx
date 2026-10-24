import { avatarColorIndex } from '@/lib/avatars';

// Tintas de DESIGN.md: grafito sobre amarillo y rosa, crema sobre el resto.
const BG = ['bg-ficha-0', 'bg-ficha-1', 'bg-ficha-2', 'bg-ficha-3', 'bg-ficha-4'];
const INK = ['text-grafito', 'text-grafito', 'text-crema', 'text-crema', 'text-crema'];

export function Avatar({ avatarKey, name, size = 56 }: { avatarKey: string; name: string; size?: number }) {
  const color = avatarColorIndex(avatarKey);
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '';
  const palette = color === null ? 'bg-lila text-piedra-hueco' : `${BG[color]} ${INK[color]}`;

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display text-xl font-extrabold ${palette}`}
    >
      {initial}
    </span>
  );
}
