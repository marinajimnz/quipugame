import { describe, expect, it } from 'vitest';
import { authErrorKey, safeNext } from '@/lib/auth/errors';

describe('authErrorKey', () => {
  it('mapea los códigos conocidos y cae en generic', () => {
    expect(authErrorKey({ code: 'invalid_credentials' })).toBe('invalidCredentials');
    expect(authErrorKey({ code: 'user_already_exists' })).toBe('emailTaken');
    expect(authErrorKey({ code: 'weak_password' })).toBe('weakPassword');
    expect(authErrorKey({ code: 'algo_raro' })).toBe('generic');
    expect(authErrorKey({})).toBe('generic');
  });
});

describe('safeNext', () => {
  it('solo admite rutas internas', () => {
    expect(safeNext('/perfil')).toBe('/perfil');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('/\\evil.com')).toBe('/');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('', '/perfil')).toBe('/perfil');
  });
});
