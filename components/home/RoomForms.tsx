'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { createClient } from '@/lib/supabase/client';
import { cleanRoomCode, isRoomCode } from '@/lib/room/roomErrors';

const choice =
  'min-h-11 rounded-xl text-sm font-semibold ring-1 ring-espacio-borde aria-checked:bg-acento aria-checked:text-grafito aria-checked:ring-0 focus-visible:outline-2 focus-visible:outline-acento';

/** Crear una sala privada: 2–4 plazas, con o sin bots. No afecta al ELO. */
export function CreateRoomForm() {
  const t = useTranslations('createRoom');
  const router = useRouter();
  const [seats, setSeats] = useState(2);
  const [bots, setBots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function create() {
    setBusy(true);
    setError(false);
    const { data, error } = await createClient().rpc('create_room', { p_seats: seats, p_fill_bots: bots });
    if (error || !data) {
      setError(true);
      setBusy(false);
      return;
    }
    router.push(`/sala/${data}`);
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-espacio-claro p-4 shadow-sm ring-1 ring-espacio-borde">
      <h2 className="font-display text-2xl font-extrabold">{t('title')}</h2>

      <div role="radiogroup" aria-label={t('seats')} className="grid grid-cols-3 gap-2">
        {[2, 3, 4].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={seats === n} onClick={() => setSeats(n)} className={choice}>
            {t('seatsOption', { count: n })}
          </button>
        ))}
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} className="size-5 accent-acento" />
        {t('bots')}
      </label>

      {error ? <p role="alert" className="text-sm text-error">{t('error')}</p> : null}
      <Button disabled={busy} onClick={create}>{busy ? t('creating') : t('create')}</Button>
    </section>
  );
}

/** Unirse a una sala con su código de 6 caracteres. */
export function JoinRoomForm() {
  const t = useTranslations('joinRoom');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isRoomCode(code)) return setInvalid(true);
    router.push(`/sala/${code}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl bg-espacio-claro p-4 shadow-sm ring-1 ring-espacio-borde">
      <h2 className="font-display text-2xl font-extrabold">{t('title')}</h2>
      <TextField
        label={t('label')}
        value={code}
        onChange={(e) => {
          setCode(cleanRoomCode(e.target.value));
          setInvalid(false);
        }}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={6}
        error={invalid ? t('invalid') : undefined}
      />
      <Button type="submit" variant="secondary">{t('submit')}</Button>
    </form>
  );
}
