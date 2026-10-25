'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { authErrorKey } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signIn' | 'signUp';

export function AuthForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  function fail(e: { code?: string; message?: string }) {
    setError(t(`errors.${authErrorKey(e)}`));
    setBusy(false);
  }

  function done() {
    router.replace(next);
    router.refresh();
  }

  async function playAsGuest() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInAnonymously();
    if (error) return fail(error);
    done();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCheckEmail(false);
    const supabase = createClient();

    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return fail(error);
      return done();
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) return fail(error);
    if (data.session) return done(); // la confirmación por correo está desactivada
    setBusy(false);
    setCheckEmail(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button onClick={playAsGuest} disabled={busy}>
          {t('guestCta')}
        </Button>
        <p className="text-sm text-crema-suave">{t('guestHint')}</p>
      </div>

      <p className="text-center text-sm text-crema-suave">{t('or')}</p>

      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(['signIn', 'signUp'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              setCheckEmail(false);
            }}
            className="min-h-11 rounded-xl text-sm font-semibold ring-1 ring-espacio-borde aria-selected:bg-acento aria-selected:text-grafito aria-selected:ring-0 focus-visible:outline-2 focus-visible:outline-acento"
          >
            {t(m === 'signIn' ? 'modeSignIn' : 'modeSignUp')}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t('password')}
          type="password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          required
          minLength={8}
          hint={mode === 'signUp' ? t('passwordHint') : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        {checkEmail ? <p role="status">{t('checkEmail')}</p> : null}
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? t('working') : t(mode === 'signIn' ? 'submitSignIn' : 'submitSignUp')}
        </Button>
      </form>
    </div>
  );
}
