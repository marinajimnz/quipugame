'use client';

import { useSyncExternalStore } from 'react';

// Si el jugador ya ha hecho (o descartado) el tutorial. Solo en este dispositivo: es una
// comodidad, no estado de juego.

const KEY = 'quipu.tutorial';
const EVENT = 'quipu-tutorial';

export type TutorialSeen = 'done' | 'dismissed';

function read(): TutorialSeen | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'done' || v === 'dismissed' ? v : null;
  } catch {
    return null;
  }
}

export function markTutorial(value: TutorialSeen) {
  try {
    // Hecho manda sobre descartado.
    if (read() !== 'done') localStorage.setItem(KEY, value);
  } catch {
    // Sin almacenamiento (navegación privada): se volverá a ofrecer, sin más.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** 'unknown' en el servidor y en la primera pintura: así no se ve la tarjeta parpadear. */
export function useTutorialSeen(): TutorialSeen | null | 'unknown' {
  return useSyncExternalStore(subscribe, read, () => 'unknown');
}
