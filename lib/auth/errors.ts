// Traduce el error de Supabase Auth a una clave de messages/es.json (auth.errors.*).
export function authErrorKey(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'user_already_exists':
    case 'email_exists':
      return 'emailTaken';
    case 'weak_password':
      return 'weakPassword';
    case 'email_not_confirmed':
      return 'emailNotConfirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimited';
    case 'anonymous_provider_disabled':
      return 'guestDisabled';
    case 'validation_failed':
      return 'invalidEmail';
    default:
      return 'generic';
  }
}

/** Solo rutas internas: evita redirecciones abiertas desde el parámetro `next`. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
