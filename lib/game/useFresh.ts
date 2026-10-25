import { useEffect, useState } from 'react';

/**
 * Claves que acaban de aparecer desde que se montó el componente (las iniciales no cuentan).
 * Siguen "nuevas" `ms` milisegundos, lo que dura una animación de entrada, y luego pasan a vistas.
 */
export function useFresh<K extends string | number>(keys: readonly K[], ms = 700): ReadonlySet<K> {
  const [seen, setSeen] = useState<ReadonlySet<K>>(() => new Set(keys));
  const fresh = new Set(keys.filter((k) => !seen.has(k)));
  const signature = keys.join('|');

  useEffect(() => {
    if (fresh.size === 0) return;
    const id = setTimeout(() => setSeen(new Set(keys)), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` resume `keys` y `fresh`
  }, [signature, ms]);

  return fresh;
}
