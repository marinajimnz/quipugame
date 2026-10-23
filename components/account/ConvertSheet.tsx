'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { authErrorKey } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';

/**
 * Convierte la cuenta de invitado en permanente en un solo paso, sin salir de la pantalla.
 * Es el mismo usuario (mismo id): conserva partidas, nombre y estadísticas.
 */
export function ConvertSheet() {
  const t = useTranslations('convert');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { data, error } = await createClient().auth.updateUser(
      { email, password },
      { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(location.pathname)}` },
    );
    setBusy(false);
    if (error) return setError(tAuth(`errors.${authErrorKey(error)}`));

    // Con confirmación por correo, la cuenta sigue siendo de invitado hasta que se confirme.
    const confirmed = !data.user?.is_anonymous;
    setMessage(confirmed ? t('done') : t('checkEmail'));
    if (confirmed) router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => dialog.current?.showModal()}>
        {t('cta')}
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby="convert-title"
        className="m-0 mt-auto w-full max-w-[430px] rounded-t-3xl bg-crema p-5 text-grafito backdrop:bg-grafito/50 sm:mx-auto"
      >
        <div className="flex flex-col gap-4">
          <h2 id="convert-title" className="font-display text-2xl font-extrabold">
            {t('title')}
          </h2>
          <p className="text-sm opacity-80">{t('description')}</p>

          {message ? (
            <p role="status">{message}</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <TextField
                label={tAuth('email')}
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label={tAuth('password')}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                hint={tAuth('passwordHint')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error ? (
                <p role="alert" className="text-sm text-ficha-2">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy}>
                {busy ? tAuth('working') : t('submit')}
              </Button>
            </form>
          )}

          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            {tCommon('close')}
          </Button>
        </div>
      </dialog>
    </>
  );
}
