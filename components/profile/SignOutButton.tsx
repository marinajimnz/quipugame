'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const t = useTranslations('profile');
  const router = useRouter();

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace('/entrar');
        router.refresh();
      }}
    >
      {t('signOut')}
    </Button>
  );
}
