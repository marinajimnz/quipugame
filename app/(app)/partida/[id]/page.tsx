import { GameScreen } from '@/components/game/GameScreen';
import { createClient } from '@/lib/supabase/server';

export default async function PartidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // El layout de (app) ya garantiza sesión.
  return <GameScreen gameId={id} userId={data.user!.id} />;
}
