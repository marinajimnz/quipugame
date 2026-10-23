import { describe, expect, it } from 'vitest';
import { DISCONNECTED_AFTER_MS, isDisconnected } from '@/lib/game/presence';

describe('isDisconnected', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');

  it('desconectado pasados 30 s sin señales, con el reloj del servidor', () => {
    expect(isDisconnected('2026-10-23T11:59:45Z', now)).toBe(false); // 15 s
    expect(isDisconnected('2026-10-23T11:59:30Z', now)).toBe(false); // justo 30 s
    expect(isDisconnected('2026-10-23T11:59:29Z', now)).toBe(true); //  31 s
    expect(DISCONNECTED_AFTER_MS).toBe(30_000);
  });
});
