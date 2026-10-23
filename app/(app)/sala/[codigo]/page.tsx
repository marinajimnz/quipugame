import { RoomScreen } from '@/components/room/RoomScreen';
import { cleanRoomCode } from '@/lib/room/roomErrors';
import { createClient } from '@/lib/supabase/server';

export default async function SalaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // El layout de (app) ya garantiza sesión (un invitado también la tiene).
  return <RoomScreen code={cleanRoomCode(decodeURIComponent(codigo))} userId={data.user!.id} />;
}
