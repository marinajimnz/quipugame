'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { AVATAR_KEYS } from '@/lib/avatars';
import { createClient } from '@/lib/supabase/client';
import { validateName } from '@/lib/profile/validateName';

export function ProfileForm({
  userId,
  initialName,
  initialAvatar,
}: {
  userId: string;
  initialName: string;
  initialAvatar: string;
}) {
  const t = useTranslations('profile');
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);

    const check = validateName(name);
    if (!check.ok) return setError(t(`errors.${check.reason}`));

    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from('profiles')
      .update({ display_name: check.value, avatar_key: avatar })
      .eq('id', userId);
    setBusy(false);

    if (error) {
      // 23505: nombre duplicado (la unicidad no distingue mayúsculas). 23514: no cumple las reglas.
      if (error.code === '23505') return setError(t('errors.taken'));
      if (error.code === '23514') return setError(t('errors.invalidChars'));
      return setError(t('errors.generic'));
    }
    setName(check.value);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <TextField
        label={t('name')}
        hint={t('nameHint')}
        error={error ?? undefined}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="nickname"
        maxLength={40}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('avatar')}</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_KEYS.map((key, i) => (
            <label
              key={key}
              className="relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full has-[:checked]:outline-3 has-[:checked]:outline-offset-2 has-[:checked]:outline-acento has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-crema"
            >
              <input
                type="radio"
                name="avatar"
                value={key}
                checked={avatar === key}
                onChange={() => setAvatar(key)}
                className="sr-only"
                aria-label={t('avatarOption', { n: i + 1 })}
              />
              <Avatar avatarKey={key} name={name || initialName} size={44} />
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={busy}>
        {t('save')}
      </Button>
      {saved ? <p role="status">{t('saved')}</p> : null}
    </form>
  );
}
