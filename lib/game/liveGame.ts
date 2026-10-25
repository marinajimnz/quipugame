import { create } from 'zustand';

/**
 * La partida en curso del jugador, si la hay en pantalla. El menú de navegación la consulta
 * para preguntar antes de dejarla: `abandon` está definido solo mientras se puede abandonar.
 */
export const useLiveGame = create<{ abandon: (() => Promise<void>) | null }>(() => ({ abandon: null }));
