/** Segundos que quedan, según el reloj del servidor. offsetMs = hora del servidor − hora local. */
export function secondsLeft(deadline: string | null, offsetMs: number, nowMs = Date.now()): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((Date.parse(deadline) - (nowMs + offsetMs)) / 1000));
}

/** 75 → "1:15". */
export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
