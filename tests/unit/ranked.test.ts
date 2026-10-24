import { describe, expect, it } from 'vitest';
import { OFFER_BOT_AFTER_S, rankedErrorKey } from '@/lib/ranked/rankedErrors';

describe('rankedErrorKey', () => {
  it('traduce los errores de la cola', () => {
    expect(rankedErrorKey({ message: 'guest_not_allowed' })).toBe('guest_not_allowed');
    expect(rankedErrorKey({ message: 'already_in_game' })).toBe('already_in_game');
    expect(rankedErrorKey({ message: 'otra_cosa' })).toBe('generic');
  });

  it('ofrece un bot a los 90 s (spec HU-3)', () => {
    expect(OFFER_BOT_AFTER_S).toBe(90);
  });
});
