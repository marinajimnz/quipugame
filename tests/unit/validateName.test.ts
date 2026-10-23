import { describe, expect, it } from 'vitest';
import { validateName } from '@/lib/profile/validateName';

describe('validateName', () => {
  it('acepta de 3 a 16 caracteres y recorta espacios', () => {
    expect(validateName('abc')).toEqual({ ok: true, value: 'abc' });
    expect(validateName('  Marina  ')).toEqual({ ok: true, value: 'Marina' });
    expect(validateName('x'.repeat(16)).ok).toBe(true);
  });

  it('rechaza nombres cortos y largos, contando tras recortar', () => {
    expect(validateName('ab')).toEqual({ ok: false, reason: 'tooShort' });
    expect(validateName('  ab  ')).toEqual({ ok: false, reason: 'tooShort' });
    expect(validateName('   ')).toEqual({ ok: false, reason: 'tooShort' });
    expect(validateName('x'.repeat(17))).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('cuenta caracteres Unicode, no unidades UTF-16', () => {
    expect(validateName('😀'.repeat(3)).ok).toBe(true);
    expect(validateName('😀'.repeat(17))).toEqual({ ok: false, reason: 'tooLong' });
    expect(validateName('ñandú')).toEqual({ ok: true, value: 'ñandú' });
  });

  it('rechaza caracteres de control', () => {
    expect(validateName('ab\ncd')).toEqual({ ok: false, reason: 'invalidChars' });
  });
});
