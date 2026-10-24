import { OfflineScreen } from '@/components/pwa/OfflineScreen';

// Página estática que el service worker sirve cuando no hay conexión.
export const dynamic = 'force-static';

export default function SinConexionPage() {
  return <OfflineScreen />;
}
