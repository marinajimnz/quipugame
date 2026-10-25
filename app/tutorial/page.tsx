import { TutorialScreen } from '@/components/tutorial/TutorialScreen';

// Tutorial: público (sin sesión), estático y disponible sin conexión, como /reglas. La partida
// es simulada en el cliente: no toca el servidor.

export const dynamic = 'force-static';

export default function TutorialPage() {
  return <TutorialScreen />;
}
