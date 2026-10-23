import { GameScreen } from '@/components/game/GameScreen';

export default async function PartidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameScreen gameId={id} />;
}
